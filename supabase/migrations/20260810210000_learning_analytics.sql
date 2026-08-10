-- Spec 07 — Analytics pédagogiques, psychométrie et signaux de risque
-- (docs/product-specs/2026-08-10-lms-program/07-learning-analytics.md).
--
-- `learning_events` and `emit_learning_event()` already exist (see
-- 20260810150000_enrollment_roster.sql — introduced there as the shared
-- foundation every spec's RPCs write to). This migration adds the
-- definition/report layer on top. Daily activity/item/competency/session
-- projections (ANA "Architecture des données") are a scheduled job reading
-- learning_events, not a database migration — out of scope here.

create table public.metric_definitions (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid references public.organizations(id) on delete cascade,
  key              text not null,
  title            text not null,
  formula_description text not null,
  scope            text not null check (scope in ('activity','item','competency','course','session','program')),
  version          integer not null default 1,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (org_id, key, version)
);
create index metric_definitions_org_idx on public.metric_definitions(org_id);

-- ANA-013: rule-based signals only in V1 — no ML, no automatic decision.
create table public.risk_signals (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  learner_id   uuid not null references auth.users(id) on delete cascade,
  rule_code    text not null check (rule_code in ('inactivity','overdue','repeated_failure','progress_drop','blocking_prereq')),
  factors      jsonb not null default '{}'::jsonb,
  window_start date not null,
  window_end   date not null,
  status       text not null default 'open' check (status in ('open','acknowledged','resolved')),
  resolution   text,
  resolved_by  uuid references auth.users(id),
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index risk_signals_org_idx on public.risk_signals(org_id, status);
create index risk_signals_learner_idx on public.risk_signals(learner_id);

create table public.saved_reports (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  owner_id   uuid not null references auth.users(id) default auth.uid(),
  title      text not null,
  filters    jsonb not null default '{}'::jsonb,
  columns    text[] not null default '{}',
  audience   text not null default 'self' check (audience in ('self','org')),
  created_at timestamptz not null default now()
);
create index saved_reports_org_idx on public.saved_reports(org_id);

create table public.report_schedules (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references public.saved_reports(id) on delete cascade,
  frequency    text not null check (frequency in ('daily','weekly','monthly')),
  recipients   uuid[] not null default '{}',
  next_run_at  timestamptz,
  created_at   timestamptz not null default now()
);

create table public.report_runs (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references public.saved_reports(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','success','failed')),
  row_count    integer,
  file_url     text,
  generated_at timestamptz not null default now()
);
create index report_runs_report_idx on public.report_runs(report_id, generated_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.metric_definitions enable row level security;
alter table public.risk_signals enable row level security;
alter table public.saved_reports enable row level security;
alter table public.report_schedules enable row level security;
alter table public.report_runs enable row level security;

create policy metric_definitions_read on public.metric_definitions
  for select using (org_id is null or public.has_org_role(org_id, array['trainer','pedago','registrar','admin']));
create policy metric_definitions_manage on public.metric_definitions
  for all using (org_id is not null and public.has_org_role(org_id, array['pedago','admin']))
  with check (org_id is not null and public.has_org_role(org_id, array['pedago','admin']));

-- ANA-015: a human resolves — read/ack/resolve is trainer/pedago/admin only.
create policy risk_signals_staff on public.risk_signals
  for select using (public.has_org_role(org_id, array['trainer','pedago','admin']));
create policy risk_signals_resolve on public.risk_signals
  for update using (public.has_org_role(org_id, array['trainer','pedago','admin']))
  with check (public.has_org_role(org_id, array['trainer','pedago','admin']));

create policy saved_reports_owner on public.saved_reports
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy saved_reports_org_read on public.saved_reports
  for select using (audience = 'org' and public.has_org_role(org_id, array['pedago','admin']));

create policy report_schedules_owner on public.report_schedules
  for all using (exists (select 1 from public.saved_reports r where r.id = report_id and r.owner_id = auth.uid()))
  with check (exists (select 1 from public.saved_reports r where r.id = report_id and r.owner_id = auth.uid()));

create policy report_runs_owner_read on public.report_runs
  for select using (
    exists (
      select 1 from public.saved_reports r where r.id = report_id
      and (r.owner_id = auth.uid() or (r.audience = 'org' and public.has_org_role(r.org_id, array['pedago','admin'])))
    )
  );

-- ── resolve_risk_signal() : audited status transition, human-in-the-loop ──
create or replace function public.resolve_risk_signal(p_signal_id uuid, p_resolution text)
returns public.risk_signals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_signal public.risk_signals;
  v_result public.risk_signals;
begin
  select * into v_signal from public.risk_signals where id = p_signal_id;
  if v_signal.id is null then
    raise exception 'Signal not found';
  end if;
  if not public.has_org_role(v_signal.org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  update public.risk_signals
  set status = 'resolved', resolution = p_resolution, resolved_by = auth.uid(), resolved_at = now()
  where id = p_signal_id
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.resolve_risk_signal(uuid, text) from public;
grant execute on function public.resolve_risk_signal(uuid, text) to authenticated;
