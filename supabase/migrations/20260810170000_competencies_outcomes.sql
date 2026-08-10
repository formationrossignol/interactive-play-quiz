-- Spec 03 — Compétences, résultats d'apprentissage et preuves
-- (docs/product-specs/2026-08-10-lms-program/03-competencies-outcomes.md).
--
-- Existing question-level competency tags are left untouched (CMP migration
-- note: mapping tags → real competencies is a guided screen, not an
-- automatic promotion — out of scope for this foundation).

create table public.competency_frameworks (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  title             text not null check (char_length(trim(title)) between 1 and 160),
  status            text not null default 'draft' check (status in ('draft','published','archived')),
  visibility        text not null default 'private' check (visibility in ('private','shared')),
  published_version integer not null default 0,
  created_by        uuid not null references auth.users(id),
  created_at        timestamptz not null default now()
);
create index competency_frameworks_org_idx on public.competency_frameworks(org_id);

-- Stable identity; content lives in competency_revisions (CMP-003: a
-- published version is immutable).
create table public.competencies (
  id           uuid primary key default gen_random_uuid(),
  framework_id uuid not null references public.competency_frameworks(id) on delete cascade,
  code         text not null,
  parent_id    uuid references public.competencies(id) on delete set null,
  position     integer not null default 0,
  replaced_by  uuid references public.competencies(id),
  created_at   timestamptz not null default now(),
  unique (framework_id, code)
);
create index competencies_framework_idx on public.competencies(framework_id);
create index competencies_parent_idx on public.competencies(parent_id);

create table public.competency_revisions (
  id             uuid primary key default gen_random_uuid(),
  competency_id  uuid not null references public.competencies(id) on delete cascade,
  version        integer not null,
  title          text not null,
  description    text not null default '',
  language       text not null default 'fr',
  tags           text[] not null default '{}',
  external_source text,
  created_by     uuid not null references auth.users(id),
  created_at     timestamptz not null default now(),
  unique (competency_id, version)
);
create index competency_revisions_competency_idx on public.competency_revisions(competency_id, version desc);

create table public.mastery_scales (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  title      text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index mastery_scales_org_idx on public.mastery_scales(org_id);

create table public.mastery_scale_levels (
  id        uuid primary key default gen_random_uuid(),
  scale_id  uuid not null references public.mastery_scales(id) on delete cascade,
  code      text not null,
  label     text not null,
  position  integer not null default 0,
  min_score numeric(6,3) not null default 0,
  unique (scale_id, code)
);
create index mastery_scale_levels_scale_idx on public.mastery_scale_levels(scale_id, position);

-- CMP-010/011: target is polymorphic; the DB does not (and cannot) validate
-- cross-domain FKs here — callers must resolve/authorize the target
-- resource themselves before writing (see spec note under "Modèle de
-- données indicatif").
create table public.competency_alignments (
  id            uuid primary key default gen_random_uuid(),
  competency_id uuid not null references public.competencies(id) on delete cascade,
  target_type   text not null check (target_type in ('course','module','lesson','question','assignment','rubric_criterion','exam','scorm_activity','h5p_activity','path_step')),
  target_id     uuid not null,
  weight        numeric(6,3) not null default 1,
  level_target  text,
  evidence_role text not null default 'assessment' check (evidence_role in ('teaching','practice','assessment')),
  is_required   boolean not null default false,
  created_at    timestamptz not null default now()
);
create index competency_alignments_competency_idx on public.competency_alignments(competency_id);
create index competency_alignments_target_idx on public.competency_alignments(target_type, target_id);

-- CMP-014/015: an evidence row is a fact — never edited, only voided.
create table public.competency_evidence (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  competency_id uuid not null references public.competencies(id) on delete cascade,
  learner_id    uuid not null references auth.users(id) on delete cascade,
  source_type   text not null check (source_type in ('question','rubric','global_result','scorm','h5p','manual','import')),
  source_id     uuid,
  alignment_id  uuid references public.competency_alignments(id),
  raw_score     numeric(8,4),
  level_code    text,
  occurred_at   timestamptz not null default now(),
  created_by    uuid references auth.users(id),
  comment       text,
  voided_at     timestamptz,
  voided_reason text,
  created_at    timestamptz not null default now()
);
create index competency_evidence_learner_idx on public.competency_evidence(competency_id, learner_id, occurred_at desc);

create table public.competency_mastery (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  competency_id uuid not null references public.competencies(id) on delete cascade,
  learner_id    uuid not null references auth.users(id) on delete cascade,
  scale_id      uuid references public.mastery_scales(id),
  level_code    text not null default 'not_assessed',
  rule_version  integer not null default 1,
  computed_at   timestamptz not null default now(),
  unique (competency_id, learner_id)
);
create index competency_mastery_learner_idx on public.competency_mastery(learner_id);

create table public.competency_mastery_history (
  id            uuid primary key default gen_random_uuid(),
  competency_id uuid not null references public.competencies(id) on delete cascade,
  learner_id    uuid not null references auth.users(id) on delete cascade,
  from_level    text,
  to_level      text not null,
  rule_version  integer not null,
  reason        text not null,
  evidence_id   uuid references public.competency_evidence(id),
  created_at    timestamptz not null default now()
);
create index competency_mastery_history_idx on public.competency_mastery_history(competency_id, learner_id, created_at);

create table public.competency_review_requests (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  competency_id uuid not null references public.competencies(id) on delete cascade,
  learner_id    uuid not null references auth.users(id) on delete cascade,
  evidence_id   uuid references public.competency_evidence(id),
  message       text not null default '',
  status        text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);
create index competency_review_requests_learner_idx on public.competency_review_requests(learner_id);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.competency_frameworks enable row level security;
alter table public.competencies enable row level security;
alter table public.competency_revisions enable row level security;
alter table public.mastery_scales enable row level security;
alter table public.mastery_scale_levels enable row level security;
alter table public.competency_alignments enable row level security;
alter table public.competency_evidence enable row level security;
alter table public.competency_mastery enable row level security;
alter table public.competency_mastery_history enable row level security;
alter table public.competency_review_requests enable row level security;

create policy competency_frameworks_staff_read on public.competency_frameworks
  for select using (public.has_org_role(org_id, array['trainer','pedago','registrar','admin']));
create policy competency_frameworks_learner_read on public.competency_frameworks
  for select using (status = 'published' and public.has_org_role(org_id, array['learner']));
create policy competency_frameworks_manage on public.competency_frameworks
  for all using (public.has_org_role(org_id, array['pedago','admin']))
  with check (public.has_org_role(org_id, array['pedago','admin']));

create policy competencies_read on public.competencies
  for select using (
    exists (select 1 from public.competency_frameworks f where f.id = framework_id and public.has_org_role(f.org_id, array['learner','trainer','pedago','registrar','admin']))
  );
create policy competencies_manage on public.competencies
  for all using (exists (select 1 from public.competency_frameworks f where f.id = framework_id and public.has_org_role(f.org_id, array['pedago','admin'])))
  with check (exists (select 1 from public.competency_frameworks f where f.id = framework_id and public.has_org_role(f.org_id, array['pedago','admin'])));

create policy competency_revisions_read on public.competency_revisions
  for select using (
    exists (select 1 from public.competencies c join public.competency_frameworks f on f.id = c.framework_id where c.id = competency_id and public.has_org_role(f.org_id, array['learner','trainer','pedago','registrar','admin']))
  );
create policy competency_revisions_manage on public.competency_revisions
  for all using (exists (select 1 from public.competencies c join public.competency_frameworks f on f.id = c.framework_id where c.id = competency_id and public.has_org_role(f.org_id, array['pedago','admin'])))
  with check (exists (select 1 from public.competencies c join public.competency_frameworks f on f.id = c.framework_id where c.id = competency_id and public.has_org_role(f.org_id, array['pedago','admin'])));

create policy mastery_scales_read on public.mastery_scales
  for select using (public.has_org_role(org_id, array['trainer','pedago','registrar','admin']));
create policy mastery_scales_manage on public.mastery_scales
  for all using (public.has_org_role(org_id, array['pedago','admin']))
  with check (public.has_org_role(org_id, array['pedago','admin']));

create policy mastery_scale_levels_read on public.mastery_scale_levels
  for select using (exists (select 1 from public.mastery_scales s where s.id = scale_id and public.has_org_role(s.org_id, array['trainer','pedago','registrar','admin'])));
create policy mastery_scale_levels_manage on public.mastery_scale_levels
  for all using (exists (select 1 from public.mastery_scales s where s.id = scale_id and public.has_org_role(s.org_id, array['pedago','admin'])))
  with check (exists (select 1 from public.mastery_scales s where s.id = scale_id and public.has_org_role(s.org_id, array['pedago','admin'])));

create policy competency_alignments_read on public.competency_alignments
  for select using (
    exists (select 1 from public.competencies c join public.competency_frameworks f on f.id = c.framework_id where c.id = competency_id and public.has_org_role(f.org_id, array['trainer','pedago','registrar','admin']))
  );
create policy competency_alignments_manage on public.competency_alignments
  for all using (exists (select 1 from public.competencies c join public.competency_frameworks f on f.id = c.framework_id where c.id = competency_id and public.has_org_role(f.org_id, array['pedago','admin'])))
  with check (exists (select 1 from public.competencies c join public.competency_frameworks f on f.id = c.framework_id where c.id = competency_id and public.has_org_role(f.org_id, array['pedago','admin'])));

-- evidence/mastery/history: no client insert/update — record_competency_evidence()
-- and void_competency_evidence() (security definer) are the only writers.
create policy competency_evidence_learner_read on public.competency_evidence
  for select using (learner_id = auth.uid());
create policy competency_evidence_staff_read on public.competency_evidence
  for select using (public.has_org_role(org_id, array['trainer','pedago','admin']));

create policy competency_mastery_learner_read on public.competency_mastery
  for select using (learner_id = auth.uid());
create policy competency_mastery_staff_read on public.competency_mastery
  for select using (public.has_org_role(org_id, array['trainer','pedago','registrar','admin']));

create policy competency_mastery_history_learner_read on public.competency_mastery_history
  for select using (learner_id = auth.uid());
create policy competency_mastery_history_staff_read on public.competency_mastery_history
  for select using (
    exists (select 1 from public.competencies c join public.competency_frameworks f on f.id = c.framework_id where c.id = competency_id and public.has_org_role(f.org_id, array['trainer','pedago','admin']))
  );

create policy competency_review_requests_learner on public.competency_review_requests
  for select using (learner_id = auth.uid());
create policy competency_review_requests_learner_insert on public.competency_review_requests
  for insert with check (learner_id = auth.uid());
create policy competency_review_requests_staff on public.competency_review_requests
  for all using (public.has_org_role(org_id, array['pedago','admin']))
  with check (public.has_org_role(org_id, array['pedago','admin']));

-- ── record_competency_evidence() : atomic evidence + idempotent recalc ─────
-- CMP-007 default rule for this foundation: most-recent non-voided evidence
-- wins ("dernière preuve"). Other aggregation methods (best, weighted
-- average, N-most-recent, manual validation) are a later configuration
-- layer on top of the same evidence log.
create or replace function public.record_competency_evidence(
  p_competency_id uuid,
  p_learner_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_raw_score numeric default null,
  p_level_code text default null,
  p_alignment_id uuid default null,
  p_comment text default null
)
returns public.competency_evidence
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_evidence public.competency_evidence;
begin
  select f.org_id into v_org_id
  from public.competencies c join public.competency_frameworks f on f.id = c.framework_id
  where c.id = p_competency_id;
  if v_org_id is null then
    raise exception 'Competency not found';
  end if;

  if p_source_type = 'manual' and not public.has_org_role(v_org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;
  if p_source_type = 'manual' and p_comment is null then
    raise exception 'comment_required_for_manual_evidence';
  end if;

  insert into public.competency_evidence (org_id, competency_id, learner_id, source_type, source_id, alignment_id, raw_score, level_code, created_by, comment)
  values (v_org_id, p_competency_id, p_learner_id, p_source_type, p_source_id, p_alignment_id, p_raw_score, p_level_code, auth.uid(), p_comment)
  returning * into v_evidence;

  perform public.recompute_competency_mastery(p_competency_id, p_learner_id, v_evidence.id);

  return v_evidence;
end;
$$;

revoke all on function public.record_competency_evidence(uuid, uuid, text, uuid, numeric, text, uuid, text) from public;
grant execute on function public.record_competency_evidence(uuid, uuid, text, uuid, numeric, text, uuid, text) to authenticated;

create or replace function public.void_competency_evidence(p_evidence_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evidence public.competency_evidence;
begin
  select * into v_evidence from public.competency_evidence where id = p_evidence_id;
  if v_evidence.id is null then
    raise exception 'Evidence not found';
  end if;
  if not public.has_org_role(v_evidence.org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  update public.competency_evidence set voided_at = now(), voided_reason = p_reason where id = p_evidence_id;
  perform public.recompute_competency_mastery(v_evidence.competency_id, v_evidence.learner_id, null);
end;
$$;

revoke all on function public.void_competency_evidence(uuid, text) from public;
grant execute on function public.void_competency_evidence(uuid, text) to authenticated;

-- Idempotent & reproducible (CMP acceptance criteria): derives the level
-- purely from the current non-voided evidence set, never from prior state.
create or replace function public.recompute_competency_mastery(p_competency_id uuid, p_learner_id uuid, p_evidence_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_latest public.competency_evidence;
  v_scale_id uuid;
  v_new_level text;
  v_previous text;
begin
  select f.org_id into v_org_id
  from public.competencies c join public.competency_frameworks f on f.id = c.framework_id
  where c.id = p_competency_id;

  select * into v_latest
  from public.competency_evidence
  where competency_id = p_competency_id and learner_id = p_learner_id and voided_at is null
  order by occurred_at desc, created_at desc
  limit 1;

  select id into v_scale_id from public.mastery_scales where org_id = v_org_id and is_default = true limit 1;

  if v_latest.id is null then
    v_new_level := 'not_assessed';
  elsif v_latest.level_code is not null then
    v_new_level := v_latest.level_code;
  elsif v_scale_id is not null and v_latest.raw_score is not null then
    select code into v_new_level
    from public.mastery_scale_levels
    where scale_id = v_scale_id and min_score <= v_latest.raw_score
    order by min_score desc
    limit 1;
    v_new_level := coalesce(v_new_level, 'not_assessed');
  else
    v_new_level := 'not_assessed';
  end if;

  select level_code into v_previous from public.competency_mastery where competency_id = p_competency_id and learner_id = p_learner_id;

  insert into public.competency_mastery (org_id, competency_id, learner_id, scale_id, level_code, computed_at)
  values (v_org_id, p_competency_id, p_learner_id, v_scale_id, v_new_level, now())
  on conflict (competency_id, learner_id)
  do update set level_code = excluded.level_code, scale_id = excluded.scale_id, computed_at = now();

  if v_previous is distinct from v_new_level then
    insert into public.competency_mastery_history (competency_id, learner_id, from_level, to_level, rule_version, reason, evidence_id)
    values (p_competency_id, p_learner_id, v_previous, v_new_level, 1, 'recompute', p_evidence_id);
    perform public.emit_learning_event('competency.mastery_changed', v_org_id, p_learner_id, 'competency', p_competency_id, jsonb_build_object('from', v_previous, 'to', v_new_level));
  end if;
end;
$$;

revoke all on function public.recompute_competency_mastery(uuid, uuid, uuid) from public;
grant execute on function public.recompute_competency_mastery(uuid, uuid, uuid) to authenticated;
