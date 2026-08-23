-- Spec 08 — Suggestions IA (docs/product-specs/2026-08-10-lms-program/08-advanced-assessment.md,
-- section "IA d'assistance"). Closes the last open item of spec 08's
-- RESTE-A-FAIRE: génération depuis une source, proposition de distracteurs,
-- vérifications de biais/ambiguïté. Every suggestion starts as a draft with
-- a provenance marker (model, requester, timestamp) and needs an explicit
-- human accept/reject before it can inform a real revision — this migration
-- never writes to assessment_item_revisions or item_answer_keys itself, and
-- the correct answer is never sent to the model (item_answer_keys has no
-- select policy for `authenticated` at all, per 20260810220000).

create table public.org_ai_settings (
  org_id                 uuid primary key references public.organizations(id) on delete cascade,
  ai_enabled             boolean not null default true,
  provider               text not null default 'anthropic',
  monthly_request_limit  integer,
  retention_days         integer not null default 90 check (retention_days > 0),
  updated_by             uuid references auth.users(id) default auth.uid(),
  updated_at             timestamptz not null default now()
);

alter table public.org_ai_settings enable row level security;

create policy org_ai_settings_staff_read on public.org_ai_settings
  for select using (public.has_org_role(org_id, array['trainer','pedago','admin']));
create policy org_ai_settings_admin_manage on public.org_ai_settings
  for all using (public.has_org_role(org_id, array['pedago','admin']))
  with check (public.has_org_role(org_id, array['pedago','admin']));

create table public.item_ai_suggestions (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references public.assessment_items(id) on delete cascade,
  org_id          uuid not null references public.organizations(id) on delete cascade,
  suggestion_type text not null check (suggestion_type in ('generation','distractors','bias_check')),
  status          text not null default 'pending' check (status in ('pending','ready','accepted','rejected','failed')),
  source_excerpt  text,
  output          jsonb not null default '{}'::jsonb,
  model           text,
  provenance      jsonb not null default '{}'::jsonb,
  requested_by    uuid not null references auth.users(id) default auth.uid(),
  created_at      timestamptz not null default now(),
  reviewed_by     uuid references auth.users(id),
  reviewed_at     timestamptz
);
create index item_ai_suggestions_item_idx on public.item_ai_suggestions(item_id, created_at desc);
create index item_ai_suggestions_org_month_idx on public.item_ai_suggestions(org_id, created_at);

alter table public.item_ai_suggestions enable row level security;

create policy item_ai_suggestions_staff_read on public.item_ai_suggestions
  for select using (public.has_org_role(org_id, array['trainer','pedago','admin']));
-- No insert/update/delete policy: request_item_ai_suggestion(),
-- complete_item_ai_suggestion() and review_item_ai_suggestion() (all
-- security definer below) are the only writers — same hardening as
-- assessment_item_revisions/item_answer_keys in 20260810220000.

-- ── request_item_ai_suggestion(): reserves a pending row, enforces org
--    controls (fournisseur/désactivation/budget) before any provider call ──
create or replace function public.request_item_ai_suggestion(
  p_item_id uuid, p_suggestion_type text, p_source_excerpt text default null
)
returns public.item_ai_suggestions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.assessment_items;
  v_settings public.org_ai_settings;
  v_used integer;
  v_result public.item_ai_suggestions;
begin
  select * into v_item from public.assessment_items where id = p_item_id;
  if v_item.id is null then
    raise exception 'Item not found';
  end if;
  if v_item.owner_id <> auth.uid() and not public.has_org_role(v_item.org_id, array['pedago','admin']) then
    raise exception 'Not authorized';
  end if;
  if p_suggestion_type not in ('generation','distractors','bias_check') then
    raise exception 'invalid_suggestion_type';
  end if;

  select * into v_settings from public.org_ai_settings where org_id = v_item.org_id;
  if v_settings.org_id is not null and not v_settings.ai_enabled then
    raise exception 'ai_disabled';
  end if;
  if v_settings.monthly_request_limit is not null then
    select count(*) into v_used from public.item_ai_suggestions
    where org_id = v_item.org_id and created_at >= date_trunc('month', now());
    if v_used >= v_settings.monthly_request_limit then
      raise exception 'ai_budget_exceeded';
    end if;
  end if;

  insert into public.item_ai_suggestions (item_id, org_id, suggestion_type, source_excerpt, requested_by)
  values (p_item_id, v_item.org_id, p_suggestion_type, p_source_excerpt, auth.uid())
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.request_item_ai_suggestion(uuid, text, text) from public;
grant execute on function public.request_item_ai_suggestion(uuid, text, text) to authenticated;

-- ── complete_item_ai_suggestion(): the edge function calling the provider
--    writes the model output (or the failure) back onto the reserved row ──
create or replace function public.complete_item_ai_suggestion(
  p_suggestion_id uuid, p_output jsonb, p_model text, p_failed boolean default false
)
returns public.item_ai_suggestions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.item_ai_suggestions;
  v_result public.item_ai_suggestions;
begin
  select * into v_row from public.item_ai_suggestions where id = p_suggestion_id;
  if v_row.id is null then
    raise exception 'Suggestion not found';
  end if;
  if v_row.requested_by <> auth.uid() and not public.has_org_role(v_row.org_id, array['pedago','admin']) then
    raise exception 'Not authorized';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'already_completed';
  end if;

  update public.item_ai_suggestions
  set output = p_output, model = p_model,
      provenance = jsonb_build_object('model', p_model, 'requested_by', v_row.requested_by, 'completed_at', now()),
      status = case when p_failed then 'failed' else 'ready' end
  where id = p_suggestion_id
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.complete_item_ai_suggestion(uuid, jsonb, text, boolean) from public;
grant execute on function public.complete_item_ai_suggestion(uuid, jsonb, text, boolean) to authenticated;

-- ── review_item_ai_suggestion(): the only human accept/reject transition.
--    Accepting never writes a revision itself — the reviewer copies/edits
--    the suggested content into create_item_revision() by hand (ASM-015:
--    aucune note officielle sans validation humaine) ─────────────────────
create or replace function public.review_item_ai_suggestion(p_suggestion_id uuid, p_accept boolean)
returns public.item_ai_suggestions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.item_ai_suggestions;
  v_result public.item_ai_suggestions;
begin
  select * into v_row from public.item_ai_suggestions where id = p_suggestion_id;
  if v_row.id is null then
    raise exception 'Suggestion not found';
  end if;
  if not public.has_org_role(v_row.org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;
  if v_row.status <> 'ready' then
    raise exception 'not_ready';
  end if;

  update public.item_ai_suggestions
  set status = case when p_accept then 'accepted' else 'rejected' end,
      reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_suggestion_id
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.review_item_ai_suggestion(uuid, boolean) from public;
grant execute on function public.review_item_ai_suggestion(uuid, boolean) to authenticated;
