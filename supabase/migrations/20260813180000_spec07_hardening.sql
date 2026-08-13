-- Spec 07 hardening (no AI): metric lineage/freshness, safe report
-- scheduling, and an explicit human relaunch action for risk signals.

alter table public.metric_definitions
  add column if not exists source_relation text,
  add column if not exists freshness_sla interval,
  add column if not exists last_computed_at timestamptz,
  add column if not exists filter_schema jsonb not null default '{}'::jsonb;

create table public.analytics_metric_lineage (
  id uuid primary key default gen_random_uuid(),
  metric_id uuid not null references public.metric_definitions(id) on delete cascade,
  source_relation text not null,
  source_columns text[] not null default '{}',
  transformation text not null,
  created_at timestamptz not null default now(),
  unique (metric_id, source_relation)
);
alter table public.analytics_metric_lineage enable row level security;
create policy analytics_metric_lineage_read on public.analytics_metric_lineage
  for select using (exists (select 1 from public.metric_definitions m
    where m.id = metric_id and (m.org_id is null or public.has_org_role(m.org_id, array['trainer','pedago','registrar','admin']))));
create policy analytics_metric_lineage_manage on public.analytics_metric_lineage
  for all using (exists (select 1 from public.metric_definitions m
    where m.id = metric_id and m.org_id is not null and public.has_org_role(m.org_id, array['pedago','admin'])))
  with check (exists (select 1 from public.metric_definitions m
    where m.id = metric_id and m.org_id is not null and public.has_org_role(m.org_id, array['pedago','admin'])));

create or replace function public.schedule_saved_report(
  p_report_id uuid, p_frequency text, p_recipients uuid[] default '{}', p_next_run_at timestamptz default now()
) returns public.report_schedules
language plpgsql security definer set search_path = public as $$
declare v_report public.saved_reports; v_result public.report_schedules;
begin
  select * into v_report from public.saved_reports where id = p_report_id and owner_id = auth.uid();
  if v_report.id is null then raise exception 'Report not found'; end if;
  if p_frequency not in ('daily','weekly','monthly') then raise exception 'Invalid frequency'; end if;
  if exists (select 1 from unnest(coalesce(p_recipients, '{}')) r where not exists (select 1 from public.user_org_roles u where u.org_id = v_report.org_id and u.user_id = r)) then
    raise exception 'Recipients must belong to the report organisation';
  end if;
  insert into public.report_schedules(report_id, frequency, recipients, next_run_at)
  values (p_report_id, p_frequency, coalesce(p_recipients, '{}'), coalesce(p_next_run_at, now()))
  returning * into v_result;
  return v_result;
end;
$$;
revoke all on function public.schedule_saved_report(uuid,text,uuid[],timestamptz) from public;
grant execute on function public.schedule_saved_report(uuid,text,uuid[],timestamptz) to authenticated;

-- Human-triggered relaunch: creates an in-app notification and keeps the
-- decision auditable; no automatic punitive action is ever taken.
create or replace function public.relaunch_risk_signal(p_signal_id uuid, p_message text)
returns void language plpgsql security definer set search_path = public as $$
declare s public.risk_signals;
begin
  select * into s from public.risk_signals where id = p_signal_id;
  if s.id is null or not public.has_org_role(s.org_id, array['trainer','pedago','admin']) then raise exception 'Not authorized'; end if;
  insert into public.notifications(user_id, category, title, body, metadata)
  values (s.learner_id, 'system', 'Suivi pédagogique', coalesce(nullif(trim(p_message), ''), 'Un suivi pédagogique est attendu.'),
    jsonb_build_object('risk_signal_id', s.id, 'rule_code', s.rule_code, 'window_start', s.window_start, 'window_end', s.window_end));
end;
$$;
revoke all on function public.relaunch_risk_signal(uuid,text) from public;
grant execute on function public.relaunch_risk_signal(uuid,text) to authenticated;
