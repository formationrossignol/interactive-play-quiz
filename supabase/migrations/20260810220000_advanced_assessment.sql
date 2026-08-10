-- Spec 08 — Évaluations avancées et banque d'items versionnée
-- (docs/product-specs/2026-08-10-lms-program/08-advanced-assessment.md).
--
-- Correct answers live in item_answer_keys, which has no select policy for
-- `authenticated` at all — the same hardening the spec asks for ("sur le
-- modèle du durcissement existant des examens"). Only security-definer
-- scoring functions (future work, out of scope here) can read it.

create table public.assessment_items (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  item_type  text not null check (item_type in (
    'mcq','single_choice','true_false','short_answer','ranking','matching','cloze',
    'drag_drop','hotspot','scale','free_text','nps','slider','passage',
    'interactive_video','audio_video','drawing','labeling','math_graph','file','code'
  )),
  status     text not null default 'draft' check (status in ('draft','in_review','approved','published','deprecated','archived')),
  owner_id   uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index assessment_items_org_idx on public.assessment_items(org_id);

-- ASM-001/003: immutable per version; a published assessment references a
-- specific revision id, so correcting an item never touches past attempts.
create table public.assessment_item_revisions (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.assessment_items(id) on delete cascade,
  version      integer not null,
  prompt       jsonb not null,
  difficulty   text,
  cognitive_level text,
  language     text not null default 'fr',
  competencies uuid[] not null default '{}',
  duration_seconds integer,
  changelog    text,
  created_by   uuid not null references auth.users(id) default auth.uid(),
  created_at   timestamptz not null default now(),
  unique (item_id, version)
);
create index assessment_item_revisions_item_idx on public.assessment_item_revisions(item_id, version desc);

create table public.item_answer_keys (
  item_revision_id uuid primary key references public.assessment_item_revisions(id) on delete cascade,
  correct_answer   jsonb not null,
  scoring_rules    jsonb not null default '{}'::jsonb
);

create table public.item_collections (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  owner_id   uuid not null references auth.users(id) default auth.uid(),
  title      text not null,
  visibility text not null default 'private' check (visibility in ('private','org','shared')),
  created_at timestamptz not null default now()
);
create index item_collections_org_idx on public.item_collections(org_id);

create table public.item_collection_members (
  id            uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.item_collections(id) on delete cascade,
  item_id       uuid not null references public.assessment_items(id) on delete cascade,
  position      integer not null default 0,
  unique (collection_id, item_id)
);

create table public.item_permissions (
  id            uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.item_collections(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  permission    text not null check (permission in ('view','use','comment','edit')),
  unique (collection_id, user_id, permission)
);

create table public.assessments (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  owner_id          uuid not null references auth.users(id) default auth.uid(),
  title             text not null,
  status            text not null default 'draft' check (status in ('draft','published','archived')),
  published_version integer not null default 0,
  created_at        timestamptz not null default now()
);
create index assessments_org_idx on public.assessments(org_id);

-- ASM-003: an immutable structural snapshot at publish time.
create table public.assessment_versions (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  version       integer not null,
  structure     jsonb not null,
  created_at    timestamptz not null default now(),
  unique (assessment_id, version)
);

create table public.assessment_sections (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  title         text not null,
  position      integer not null default 0,
  selection_mode text not null default 'fixed' check (selection_mode in ('fixed','pool'))
);
create index assessment_sections_assessment_idx on public.assessment_sections(assessment_id, position);

create table public.assessment_item_refs (
  id                uuid primary key default gen_random_uuid(),
  section_id        uuid not null references public.assessment_sections(id) on delete cascade,
  item_revision_id  uuid not null references public.assessment_item_revisions(id),
  position          integer not null default 0
);
create index assessment_item_refs_section_idx on public.assessment_item_refs(section_id, position);

create table public.assessment_pool_rules (
  id            uuid primary key default gen_random_uuid(),
  section_id    uuid not null references public.assessment_sections(id) on delete cascade,
  collection_id uuid not null references public.item_collections(id),
  count         integer not null check (count > 0),
  filter        jsonb not null default '{}'::jsonb
);

create table public.scoring_policies (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  policy        jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- ASM-016: rescore/contestation audit — always a reason, always before/after.
create table public.score_adjustments (
  id               uuid primary key default gen_random_uuid(),
  attempt_ref      uuid not null,
  item_revision_id uuid not null references public.assessment_item_revisions(id),
  previous_score   numeric(10,4),
  new_score        numeric(10,4) not null,
  reason           text not null,
  author_id        uuid not null references auth.users(id) default auth.uid(),
  created_at       timestamptz not null default now()
);
create index score_adjustments_item_idx on public.score_adjustments(item_revision_id);

create table public.rescore_jobs (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  item_revision_id uuid not null references public.assessment_item_revisions(id),
  status           text not null default 'pending' check (status in ('pending','running','completed','failed')),
  affected_count   integer,
  created_by       uuid not null references auth.users(id) default auth.uid(),
  created_at       timestamptz not null default now(),
  completed_at     timestamptz
);

create table public.item_review_comments (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.assessment_items(id) on delete cascade,
  author_id  uuid not null references auth.users(id) default auth.uid(),
  body       text not null,
  resolved   boolean not null default false,
  created_at timestamptz not null default now()
);
create index item_review_comments_item_idx on public.item_review_comments(item_id, created_at);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.assessment_items enable row level security;
alter table public.assessment_item_revisions enable row level security;
alter table public.item_answer_keys enable row level security;
alter table public.item_collections enable row level security;
alter table public.item_collection_members enable row level security;
alter table public.item_permissions enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_versions enable row level security;
alter table public.assessment_sections enable row level security;
alter table public.assessment_item_refs enable row level security;
alter table public.assessment_pool_rules enable row level security;
alter table public.scoring_policies enable row level security;
alter table public.score_adjustments enable row level security;
alter table public.rescore_jobs enable row level security;
alter table public.item_review_comments enable row level security;

create policy assessment_items_staff on public.assessment_items
  for select using (public.has_org_role(org_id, array['trainer','pedago','admin']));
create policy assessment_items_manage on public.assessment_items
  for all using (owner_id = auth.uid() or public.has_org_role(org_id, array['pedago','admin']))
  with check (owner_id = auth.uid() or public.has_org_role(org_id, array['pedago','admin']));

create policy assessment_item_revisions_staff on public.assessment_item_revisions
  for select using (exists (select 1 from public.assessment_items i where i.id = item_id and public.has_org_role(i.org_id, array['trainer','pedago','admin'])));
-- no insert policy: create_item_revision() (security definer) is the only writer.

-- item_answer_keys: intentionally no select/insert/update/delete policy for
-- `authenticated` — correct answers are server-only (ASM permissions §).

create policy item_collections_read on public.item_collections
  for select using (public.has_org_role(org_id, array['trainer','pedago','admin']));
create policy item_collections_manage on public.item_collections
  for all using (owner_id = auth.uid() or public.has_org_role(org_id, array['pedago','admin']))
  with check (owner_id = auth.uid() or public.has_org_role(org_id, array['pedago','admin']));

create policy item_collection_members_read on public.item_collection_members
  for select using (exists (select 1 from public.item_collections c where c.id = collection_id and public.has_org_role(c.org_id, array['trainer','pedago','admin'])));
create policy item_collection_members_manage on public.item_collection_members
  for all using (exists (select 1 from public.item_collections c where c.id = collection_id and (c.owner_id = auth.uid() or public.has_org_role(c.org_id, array['pedago','admin']))))
  with check (exists (select 1 from public.item_collections c where c.id = collection_id and (c.owner_id = auth.uid() or public.has_org_role(c.org_id, array['pedago','admin']))));

create policy item_permissions_manage on public.item_permissions
  for all using (exists (select 1 from public.item_collections c where c.id = collection_id and (c.owner_id = auth.uid() or public.has_org_role(c.org_id, array['pedago','admin']))))
  with check (exists (select 1 from public.item_collections c where c.id = collection_id and (c.owner_id = auth.uid() or public.has_org_role(c.org_id, array['pedago','admin']))));

create policy assessments_staff on public.assessments
  for select using (public.has_org_role(org_id, array['trainer','pedago','admin']));
create policy assessments_manage on public.assessments
  for all using (owner_id = auth.uid() or public.has_org_role(org_id, array['pedago','admin']))
  with check (owner_id = auth.uid() or public.has_org_role(org_id, array['pedago','admin']));

create policy assessment_versions_read on public.assessment_versions
  for select using (exists (select 1 from public.assessments a where a.id = assessment_id and public.has_org_role(a.org_id, array['trainer','pedago','admin'])));

create policy assessment_sections_manage on public.assessment_sections
  for all using (exists (select 1 from public.assessments a where a.id = assessment_id and (a.owner_id = auth.uid() or public.has_org_role(a.org_id, array['pedago','admin']))))
  with check (exists (select 1 from public.assessments a where a.id = assessment_id and (a.owner_id = auth.uid() or public.has_org_role(a.org_id, array['pedago','admin']))));

create policy assessment_item_refs_manage on public.assessment_item_refs
  for all using (exists (select 1 from public.assessment_sections s join public.assessments a on a.id = s.assessment_id where s.id = section_id and (a.owner_id = auth.uid() or public.has_org_role(a.org_id, array['pedago','admin']))))
  with check (exists (select 1 from public.assessment_sections s join public.assessments a on a.id = s.assessment_id where s.id = section_id and (a.owner_id = auth.uid() or public.has_org_role(a.org_id, array['pedago','admin']))));

create policy assessment_pool_rules_manage on public.assessment_pool_rules
  for all using (exists (select 1 from public.assessment_sections s join public.assessments a on a.id = s.assessment_id where s.id = section_id and (a.owner_id = auth.uid() or public.has_org_role(a.org_id, array['pedago','admin']))))
  with check (exists (select 1 from public.assessment_sections s join public.assessments a on a.id = s.assessment_id where s.id = section_id and (a.owner_id = auth.uid() or public.has_org_role(a.org_id, array['pedago','admin']))));

create policy scoring_policies_manage on public.scoring_policies
  for all using (exists (select 1 from public.assessments a where a.id = assessment_id and (a.owner_id = auth.uid() or public.has_org_role(a.org_id, array['pedago','admin']))))
  with check (exists (select 1 from public.assessments a where a.id = assessment_id and (a.owner_id = auth.uid() or public.has_org_role(a.org_id, array['pedago','admin']))));

create policy score_adjustments_staff_read on public.score_adjustments
  for select using (exists (select 1 from public.assessment_item_revisions r join public.assessment_items i on i.id = r.item_id where r.id = item_revision_id and public.has_org_role(i.org_id, array['pedago','admin'])));

create policy rescore_jobs_staff on public.rescore_jobs
  for select using (public.has_org_role(org_id, array['pedago','admin']));

create policy item_review_comments_staff on public.item_review_comments
  for all using (exists (select 1 from public.assessment_items i where i.id = item_id and public.has_org_role(i.org_id, array['trainer','pedago','admin'])))
  with check (exists (select 1 from public.assessment_items i where i.id = item_id and public.has_org_role(i.org_id, array['trainer','pedago','admin'])));

-- ── create_item_revision() : always a new immutable row (ASM-003) ─────────
create or replace function public.create_item_revision(
  p_item_id uuid,
  p_prompt jsonb,
  p_correct_answer jsonb,
  p_changelog text default null,
  p_scoring_rules jsonb default '{}'::jsonb
)
returns public.assessment_item_revisions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.assessment_items;
  v_next_version integer;
  v_result public.assessment_item_revisions;
begin
  select * into v_item from public.assessment_items where id = p_item_id;
  if v_item.id is null then
    raise exception 'Item not found';
  end if;
  if v_item.owner_id <> auth.uid() and not public.has_org_role(v_item.org_id, array['pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  select coalesce(max(version), 0) + 1 into v_next_version from public.assessment_item_revisions where item_id = p_item_id;

  insert into public.assessment_item_revisions (item_id, version, prompt, changelog)
  values (p_item_id, v_next_version, p_prompt, p_changelog)
  returning * into v_result;

  insert into public.item_answer_keys (item_revision_id, correct_answer, scoring_rules)
  values (v_result.id, p_correct_answer, p_scoring_rules);

  return v_result;
end;
$$;

revoke all on function public.create_item_revision(uuid, jsonb, jsonb, text, jsonb) from public;
grant execute on function public.create_item_revision(uuid, jsonb, jsonb, text, jsonb) to authenticated;

-- ── submit_score_adjustment() : always audited, always a reason ───────────
create or replace function public.submit_score_adjustment(
  p_attempt_ref uuid, p_item_revision_id uuid, p_previous_score numeric, p_new_score numeric, p_reason text
)
returns public.score_adjustments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_result public.score_adjustments;
begin
  select i.org_id into v_org_id
  from public.assessment_item_revisions r join public.assessment_items i on i.id = r.item_id
  where r.id = p_item_revision_id;
  if v_org_id is null or not public.has_org_role(v_org_id, array['pedago','admin']) then
    raise exception 'Not authorized';
  end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'reason_required';
  end if;

  insert into public.score_adjustments (attempt_ref, item_revision_id, previous_score, new_score, reason)
  values (p_attempt_ref, p_item_revision_id, p_previous_score, p_new_score, p_reason)
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.submit_score_adjustment(uuid, uuid, numeric, numeric, text) from public;
grant execute on function public.submit_score_adjustment(uuid, uuid, numeric, numeric, text) to authenticated;
