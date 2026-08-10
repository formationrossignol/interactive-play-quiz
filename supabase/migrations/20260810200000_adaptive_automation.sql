-- Spec 06 — Parcours adaptatifs, conditions et automatisations
-- (docs/product-specs/2026-08-10-lms-program/06-adaptive-automation.md).
--
-- The rule JSON is a closed DSL — no SQL/JS expression is ever evaluated
-- from it (spec: "aucune expression SQL ou JavaScript libre"). Nodes are
-- either {"op": "and"|"or", "children": [...]} or a leaf
-- {"source": "activity_completed", "target_id": "<uuid>", ...}. Only
-- 'activity_completed' leaves are traversed for dependency/cycle analysis
-- in this foundation; other sources (date, score, competency…) are stored
-- and rendered but don't participate in the prerequisite graph yet.

create table public.rule_sets (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  target_type       text not null check (target_type in ('course','module','activity','path','assignment','exam')),
  target_id         uuid not null,
  mode              text not null default 'access' check (mode in ('access','automation')),
  status            text not null default 'draft' check (status in ('draft','published','archived')),
  published_version integer not null default 0,
  created_by        uuid not null references auth.users(id) default auth.uid(),
  created_at        timestamptz not null default now(),
  unique (org_id, target_type, target_id)
);
create index rule_sets_org_idx on public.rule_sets(org_id);

create table public.rule_set_versions (
  id          uuid primary key default gen_random_uuid(),
  rule_set_id uuid not null references public.rule_sets(id) on delete cascade,
  version     integer not null,
  definition  jsonb not null,
  created_by  uuid not null references auth.users(id) default auth.uid(),
  created_at  timestamptz not null default now(),
  unique (rule_set_id, version)
);

create table public.release_state (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  target_type  text not null,
  target_id    uuid not null,
  learner_id   uuid not null references auth.users(id) on delete cascade,
  effect       text not null check (effect in ('hidden','locked','unlocked','recommended')),
  reason       text,
  rule_version integer,
  computed_at  timestamptz not null default now(),
  unique (target_type, target_id, learner_id)
);
create index release_state_learner_idx on public.release_state(learner_id);

create table public.automation_rules (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  trigger_type      text not null check (trigger_type in ('enrollment','due_soon','overdue','inactivity','completion','failure','mastery_gained','mastery_expired')),
  status            text not null default 'draft' check (status in ('draft','published','archived')),
  published_version integer not null default 0,
  created_by        uuid not null references auth.users(id) default auth.uid(),
  created_at        timestamptz not null default now()
);
create index automation_rules_org_idx on public.automation_rules(org_id);

create table public.automation_rule_versions (
  id                  uuid primary key default gen_random_uuid(),
  automation_rule_id  uuid not null references public.automation_rules(id) on delete cascade,
  version             integer not null,
  config              jsonb not null,
  created_by          uuid not null references auth.users(id) default auth.uid(),
  created_at          timestamptz not null default now(),
  unique (automation_rule_id, version)
);

-- AUT-005 / acceptance: "rejouer un événement ne duplique aucune action" —
-- idempotency_key is the enforcement point.
create table public.automation_runs (
  id                 uuid primary key default gen_random_uuid(),
  automation_rule_id uuid not null references public.automation_rules(id) on delete cascade,
  version             integer not null,
  triggered_by        text not null,
  idempotency_key      text not null unique,
  status               text not null default 'success' check (status in ('success','error')),
  error_message        text,
  ran_at               timestamptz not null default now()
);
create index automation_runs_rule_idx on public.automation_runs(automation_rule_id, ran_at desc);

create table public.automation_actions (
  id                uuid primary key default gen_random_uuid(),
  run_id            uuid not null references public.automation_runs(id) on delete cascade,
  target_learner_id uuid not null references auth.users(id) on delete cascade,
  action_type       text not null,
  result            text not null default 'applied' check (result in ('applied','skipped','failed')),
  detail            jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);
create index automation_actions_run_idx on public.automation_actions(run_id);

create table public.follow_up_tasks (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations(id) on delete cascade,
  automation_rule_id uuid references public.automation_rules(id) on delete set null,
  assignee_id        uuid not null references auth.users(id),
  learner_id         uuid not null references auth.users(id),
  title              text not null,
  status             text not null default 'open' check (status in ('open','done','dismissed')),
  created_at         timestamptz not null default now()
);
create index follow_up_tasks_assignee_idx on public.follow_up_tasks(assignee_id, status);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.rule_sets enable row level security;
alter table public.rule_set_versions enable row level security;
alter table public.release_state enable row level security;
alter table public.automation_rules enable row level security;
alter table public.automation_rule_versions enable row level security;
alter table public.automation_runs enable row level security;
alter table public.automation_actions enable row level security;
alter table public.follow_up_tasks enable row level security;

create policy rule_sets_staff_read on public.rule_sets
  for select using (public.has_org_role(org_id, array['trainer','pedago','registrar','admin']));
create policy rule_sets_manage on public.rule_sets
  for all using (public.has_org_role(org_id, array['pedago','admin']))
  with check (public.has_org_role(org_id, array['pedago','admin']));

create policy rule_set_versions_staff_read on public.rule_set_versions
  for select using (exists (select 1 from public.rule_sets rs where rs.id = rule_set_id and public.has_org_role(rs.org_id, array['trainer','pedago','registrar','admin'])));
-- no direct insert policy: publish_rule_set_version() (security definer) is the only writer.

create policy release_state_learner_read on public.release_state
  for select using (learner_id = auth.uid());
create policy release_state_staff_read on public.release_state
  for select using (public.has_org_role(org_id, array['trainer','pedago','registrar','admin']));

create policy automation_rules_staff_read on public.automation_rules
  for select using (public.has_org_role(org_id, array['pedago','admin']));
create policy automation_rules_manage on public.automation_rules
  for all using (public.has_org_role(org_id, array['pedago','admin']))
  with check (public.has_org_role(org_id, array['pedago','admin']));

create policy automation_rule_versions_staff_read on public.automation_rule_versions
  for select using (exists (select 1 from public.automation_rules r where r.id = automation_rule_id and public.has_org_role(r.org_id, array['pedago','admin'])));
create policy automation_rule_versions_manage on public.automation_rule_versions
  for insert with check (exists (select 1 from public.automation_rules r where r.id = automation_rule_id and public.has_org_role(r.org_id, array['pedago','admin'])));

create policy automation_runs_staff_read on public.automation_runs
  for select using (exists (select 1 from public.automation_rules r where r.id = automation_rule_id and public.has_org_role(r.org_id, array['pedago','admin'])));
create policy automation_actions_staff_read on public.automation_actions
  for select using (
    exists (select 1 from public.automation_runs run join public.automation_rules r on r.id = run.automation_rule_id where run.id = run_id and public.has_org_role(r.org_id, array['pedago','admin']))
  );

create policy follow_up_tasks_assignee on public.follow_up_tasks
  for select using (assignee_id = auth.uid() or public.has_org_role(org_id, array['pedago','admin']));
create policy follow_up_tasks_manage on public.follow_up_tasks
  for update using (assignee_id = auth.uid() or public.has_org_role(org_id, array['pedago','admin']))
  with check (assignee_id = auth.uid() or public.has_org_role(org_id, array['pedago','admin']));

-- ── rule DSL helpers ────────────────────────────────────────────────────
-- ADP-003: depth-limited, closed grammar (no free code).
create or replace function public.rule_definition_depth(p_node jsonb, p_current integer default 1)
returns integer
language plpgsql
immutable
as $$
declare
  v_child jsonb;
  v_max integer := p_current;
  v_child_depth integer;
begin
  if jsonb_typeof(p_node->'children') = 'array' then
    for v_child in select * from jsonb_array_elements(p_node->'children')
    loop
      v_child_depth := public.rule_definition_depth(v_child, p_current + 1);
      if v_child_depth > v_max then
        v_max := v_child_depth;
      end if;
    end loop;
  end if;
  return v_max;
end;
$$;

create or replace function public.rule_definition_targets(p_definition jsonb)
returns uuid[]
language sql
stable
as $$
  with recursive nodes as (
    select p_definition as node
    union all
    select child
    from nodes, jsonb_array_elements(case when jsonb_typeof(nodes.node->'children') = 'array' then nodes.node->'children' else '[]'::jsonb end) as child
  )
  select coalesce(array_agg(distinct (node->>'target_id')::uuid), '{}'::uuid[])
  from nodes
  where node->>'source' = 'activity_completed' and node->>'target_id' is not null;
$$;

-- ADP-003 acceptance: "les règles cycliques sont refusées avant publication".
-- Real cycle detection over the prerequisite graph formed by every
-- currently-published rule_set in the org, plus the edges the candidate
-- definition would add.
create or replace function public.would_create_cycle(p_org_id uuid, p_from_target uuid, p_new_deps uuid[])
returns boolean
language sql
stable
as $$
  with recursive latest_versions as (
    select rs.target_id as src, rv.definition
    from public.rule_sets rs
    join public.rule_set_versions rv on rv.rule_set_id = rs.id and rv.version = rs.published_version
    where rs.org_id = p_org_id and rs.status = 'published'
  ),
  edges as (
    select src as from_target, unnest(public.rule_definition_targets(definition)) as to_target
    from latest_versions
    union all
    select p_from_target, unnest(p_new_deps)
  ),
  reach as (
    select to_target as node from edges where from_target = p_from_target
    union
    select e.to_target from edges e join reach r on e.from_target = r.node
  )
  select exists (select 1 from reach where node = p_from_target);
$$;

create or replace function public.publish_rule_set_version(p_rule_set_id uuid, p_definition jsonb)
returns public.rule_set_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule_set public.rule_sets;
  v_deps uuid[];
  v_next_version integer;
  v_result public.rule_set_versions;
begin
  select * into v_rule_set from public.rule_sets where id = p_rule_set_id for update;
  if v_rule_set.id is null then
    raise exception 'Rule set not found';
  end if;
  if not public.has_org_role(v_rule_set.org_id, array['pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  if public.rule_definition_depth(p_definition) > 6 then
    raise exception 'rule_too_deep';
  end if;

  v_deps := public.rule_definition_targets(p_definition);
  if v_rule_set.target_id = any(v_deps) then
    raise exception 'cycle_detected';
  end if;
  if public.would_create_cycle(v_rule_set.org_id, v_rule_set.target_id, v_deps) then
    raise exception 'cycle_detected';
  end if;

  select coalesce(max(version), 0) + 1 into v_next_version from public.rule_set_versions where rule_set_id = p_rule_set_id;

  insert into public.rule_set_versions (rule_set_id, version, definition)
  values (p_rule_set_id, v_next_version, p_definition)
  returning * into v_result;

  update public.rule_sets set status = 'published', published_version = v_next_version where id = p_rule_set_id;

  return v_result;
end;
$$;

revoke all on function public.publish_rule_set_version(uuid, jsonb) from public;
grant execute on function public.publish_rule_set_version(uuid, jsonb) to authenticated;

-- ── record_automation_run() : idempotent run + actions in one transaction ─
create or replace function public.record_automation_run(
  p_automation_rule_id uuid,
  p_idempotency_key text,
  p_triggered_by text,
  p_actions jsonb default '[]'::jsonb
)
returns public.automation_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule public.automation_rules;
  v_run public.automation_runs;
  v_action jsonb;
begin
  select * into v_rule from public.automation_rules where id = p_automation_rule_id;
  if v_rule.id is null then
    raise exception 'Automation rule not found';
  end if;
  if not public.has_org_role(v_rule.org_id, array['pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  select * into v_run from public.automation_runs where idempotency_key = p_idempotency_key;
  if v_run.id is not null then
    return v_run; -- acceptance: replaying an event duplicates nothing.
  end if;

  insert into public.automation_runs (automation_rule_id, version, triggered_by, idempotency_key)
  values (p_automation_rule_id, v_rule.published_version, p_triggered_by, p_idempotency_key)
  returning * into v_run;

  for v_action in select * from jsonb_array_elements(coalesce(p_actions, '[]'::jsonb))
  loop
    insert into public.automation_actions (run_id, target_learner_id, action_type, result, detail)
    values (v_run.id, (v_action->>'learner_id')::uuid, v_action->>'action_type', coalesce(v_action->>'result', 'applied'), coalesce(v_action->'detail', '{}'::jsonb));
  end loop;

  return v_run;
end;
$$;

revoke all on function public.record_automation_run(uuid, text, text, jsonb) from public;
grant execute on function public.record_automation_run(uuid, text, text, jsonb) to authenticated;
