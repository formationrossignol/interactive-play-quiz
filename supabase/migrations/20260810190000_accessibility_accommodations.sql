-- Spec 05 — Accessibilité, inclusion et aménagements individuels
-- (docs/product-specs/2026-08-10-lms-program/05-accessibility-accommodations.md).
--
-- No medical diagnostic or justification field exists anywhere in this
-- schema by design (spec: "ne jamais stocker diagnostic médical... si
-- Brivia n'en a pas besoin pour appliquer l'aménagement") — only the applied
-- effect (extra time, read-aloud, etc). That is also what makes ACC-006
-- ("le formateur voit les effets, pas le motif") trivially true here rather
-- than requiring column-level security.

-- ── accessibility_preferences : personal, non-certified display prefs ─────
create table public.accessibility_preferences (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  font_size       text not null default 'default' check (font_size in ('default','large','x-large')),
  spacing         text not null default 'default' check (spacing in ('default','relaxed')),
  high_contrast   boolean not null default false,
  reduce_motion   boolean not null default false,
  text_to_speech  boolean not null default false,
  preferred_language text,
  updated_at      timestamptz not null default now()
);
create trigger accessibility_preferences_touch before update on public.accessibility_preferences
  for each row execute function public.touch_updated_at();

-- ── accommodation_profiles : org + learner, certified institutional record ─
create table public.accommodation_profiles (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  learner_id uuid not null references auth.users(id) on delete cascade,
  status     text not null default 'active' check (status in ('active','expired','revoked')),
  valid_from date not null default current_date,
  valid_until date,
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index accommodation_profiles_active_unique_idx on public.accommodation_profiles(org_id, learner_id) where status = 'active';
create index accommodation_profiles_learner_idx on public.accommodation_profiles(learner_id);

-- ACC-002/003: one applied effect per row, never a diagnosis.
create table public.accommodation_rules (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.accommodation_profiles(id) on delete cascade,
  rule_type  text not null check (rule_type in (
    'extra_time','allowed_pause','no_time_limit','extended_deadline','read_aloud',
    'voice_input','text_size','high_contrast','reduced_motion','preferred_language',
    'reduced_options','extra_attempt','hint','alternative_modality','separate_room'
  )),
  value      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (profile_id, rule_type)
);

-- ACC-004: activity/session-scoped derogation — highest priority.
create table public.accommodation_overrides (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.accommodation_profiles(id) on delete cascade,
  target_type text not null check (target_type in ('assignment','exam','session')),
  target_id   uuid not null,
  rule_type   text not null,
  value       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (profile_id, target_type, target_id, rule_type)
);
create index accommodation_overrides_target_idx on public.accommodation_overrides(target_type, target_id);

-- ACC: "toute lecture ou modification d'un profil d'aménagement est
-- auditée" — append-only, written only by get_effective_accommodations()
-- and the manage RPCs below.
create table public.accommodation_access_log (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.accommodation_profiles(id) on delete cascade,
  actor_id   uuid not null references auth.users(id),
  action     text not null check (action in ('read','write')),
  created_at timestamptz not null default now()
);
create index accommodation_access_log_profile_idx on public.accommodation_access_log(profile_id, created_at desc);

create table public.content_accessibility_checks (
  id         uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content(id) on delete cascade,
  rule_code  text not null,
  severity   text not null check (severity in ('error','warning')),
  location   text,
  message    text not null,
  status     text not null default 'open' check (status in ('open','fixed','ignored')),
  checked_at timestamptz not null default now()
);
create index content_accessibility_checks_content_idx on public.content_accessibility_checks(content_id, status);

create table public.accessibility_audits (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid references public.organizations(id) on delete cascade,
  scope      text not null,
  method     text not null,
  audited_on date not null default current_date,
  status     text not null default 'not_audited' check (status in ('conformant','partially_conformant','not_audited')),
  report_url text,
  published  boolean not null default false,
  created_at timestamptz not null default now()
);
create index accessibility_audits_org_idx on public.accessibility_audits(org_id);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.accessibility_preferences enable row level security;
alter table public.accommodation_profiles enable row level security;
alter table public.accommodation_rules enable row level security;
alter table public.accommodation_overrides enable row level security;
alter table public.accommodation_access_log enable row level security;
alter table public.content_accessibility_checks enable row level security;
alter table public.accessibility_audits enable row level security;

create policy accessibility_preferences_owner on public.accessibility_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy accommodation_profiles_learner_read on public.accommodation_profiles
  for select using (learner_id = auth.uid());
create policy accommodation_profiles_staff on public.accommodation_profiles
  for all using (public.has_org_role(org_id, array['registrar','pedago','trainer','admin']))
  with check (public.has_org_role(org_id, array['registrar','pedago','admin']));

create policy accommodation_rules_learner_read on public.accommodation_rules
  for select using (exists (select 1 from public.accommodation_profiles p where p.id = profile_id and p.learner_id = auth.uid()));
create policy accommodation_rules_staff on public.accommodation_rules
  for all using (exists (select 1 from public.accommodation_profiles p where p.id = profile_id and public.has_org_role(p.org_id, array['registrar','pedago','trainer','admin'])))
  with check (exists (select 1 from public.accommodation_profiles p where p.id = profile_id and public.has_org_role(p.org_id, array['registrar','pedago','admin'])));

create policy accommodation_overrides_learner_read on public.accommodation_overrides
  for select using (exists (select 1 from public.accommodation_profiles p where p.id = profile_id and p.learner_id = auth.uid()));
create policy accommodation_overrides_staff on public.accommodation_overrides
  for all using (exists (select 1 from public.accommodation_profiles p where p.id = profile_id and public.has_org_role(p.org_id, array['registrar','pedago','trainer','admin'])))
  with check (exists (select 1 from public.accommodation_profiles p where p.id = profile_id and public.has_org_role(p.org_id, array['registrar','pedago','admin'])));

create policy accommodation_access_log_admin_read on public.accommodation_access_log
  for select using (
    exists (select 1 from public.accommodation_profiles p where p.id = profile_id and public.has_org_role(p.org_id, array['admin']))
  );

create policy content_accessibility_checks_owner_read on public.content_accessibility_checks
  for select using (exists (select 1 from public.content c where c.id = content_id and c.user_id = auth.uid()));
create policy content_accessibility_checks_staff_read on public.content_accessibility_checks
  for select using (exists (select 1 from public.content c where c.id = content_id and public.has_org_role(c.org_id, array['trainer','pedago','admin'])));
create policy content_accessibility_checks_manage on public.content_accessibility_checks
  for insert with check (exists (select 1 from public.content c where c.id = content_id and c.user_id = auth.uid()));
create policy content_accessibility_checks_update on public.content_accessibility_checks
  for update using (exists (select 1 from public.content c where c.id = content_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.content c where c.id = content_id and c.user_id = auth.uid()));

create policy accessibility_audits_public_read on public.accessibility_audits
  for select using (published = true);
create policy accessibility_audits_admin on public.accessibility_audits
  for all using (org_id is not null and public.has_org_role(org_id, array['admin']))
  with check (org_id is not null and public.has_org_role(org_id, array['admin']));

-- ── get_effective_accommodations() : ACC-004 priority merge + audited read ─
-- Priority: activity/session override > profile rule. (Session/enrollment
-- dérogation and personal display prefs layer on top client-side — this
-- foundation covers the two institutional layers plus the audit trail.)
create or replace function public.get_effective_accommodations(
  p_learner_id uuid,
  p_target_type text default null,
  p_target_id uuid default null
)
returns table(rule_type text, value jsonb, source text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.accommodation_profiles;
begin
  select * into v_profile
  from public.accommodation_profiles
  where learner_id = p_learner_id and status = 'active'
    and valid_from <= current_date and (valid_until is null or valid_until >= current_date)
  order by created_at desc
  limit 1;

  if v_profile.id is null then
    return;
  end if;

  if auth.uid() <> p_learner_id and not public.has_org_role(v_profile.org_id, array['registrar','pedago','trainer','admin']) then
    raise exception 'Not authorized';
  end if;

  insert into public.accommodation_access_log (profile_id, actor_id, action) values (v_profile.id, auth.uid(), 'read');

  return query
    select r.rule_type,
      coalesce(o.value, r.value) as value,
      case when o.id is null then 'profile' else 'override' end as source
    from public.accommodation_rules r
    left join public.accommodation_overrides o
      on o.profile_id = r.profile_id and o.rule_type = r.rule_type
      and o.target_type = p_target_type and o.target_id = p_target_id
    where r.profile_id = v_profile.id;
end;
$$;

revoke all on function public.get_effective_accommodations(uuid, text, uuid) from public;
grant execute on function public.get_effective_accommodations(uuid, text, uuid) to authenticated;
