-- Optional, modular exam proctoring.
-- Candidate writes are intentionally routed through the proctoring-api Edge
-- Function. The browser never receives SEB secrets or direct storage access.

alter table public.exams
  add column if not exists proctoring_config jsonb not null default '{
    "enabled": false,
    "level": "none",
    "sebRequired": false,
    "sebMinVersion": "3.3.2",
    "sebKeyConfigured": false,
    "allowedUrls": [],
    "blockedUrls": [],
    "webcamRequired": false,
    "microphoneRequired": false,
    "audioRecording": false,
    "screenshotMode": "none",
    "screenshotIntervalSeconds": 120,
    "aiAnalysis": false,
    "detectNoFace": false,
    "detectMultipleFaces": false,
    "detectGazeAway": false,
    "detectCameraObstruction": false,
    "detectUnusualAudio": false,
    "maxTabSwitches": 3,
    "maxFullscreenExits": 2,
    "maxOutOfFocusSeconds": 30,
    "violationMessage": "Veuillez rester sur la page de l examen.",
    "autoSubmitAfterViolations": null,
    "retentionDays": 90,
    "consentRequired": true
  }'::jsonb;

create table if not exists public.exam_proctoring_secrets (
  exam_id uuid primary key references public.exams(id) on delete cascade,
  browser_exam_keys text[] not null default '{}',
  config_keys text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.exam_proctoring_secrets enable row level security;
-- No client policies by design. Only the service-role Edge Function can read
-- or mutate raw SEB keys.

create table if not exists public.exam_proctoring_events (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  participant_id text not null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  occurred_at timestamptz not null default now(),
  duration_ms integer,
  occurrence integer not null default 1,
  details jsonb not null default '{}',
  expires_at timestamptz not null
);

create index if not exists exam_proctoring_events_exam_idx
  on public.exam_proctoring_events(exam_id, occurred_at desc);
create index if not exists exam_proctoring_events_attempt_idx
  on public.exam_proctoring_events(attempt_id, occurred_at);

create table if not exists public.exam_proctoring_alerts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  event_id uuid references public.exam_proctoring_events(id) on delete set null,
  alert_type text not null,
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  title text not null,
  details text not null default '',
  occurred_at timestamptz not null default now(),
  review_status text not null default 'pending' check (review_status in ('pending', 'reviewed')),
  expires_at timestamptz not null
);

create index if not exists exam_proctoring_alerts_attempt_idx
  on public.exam_proctoring_alerts(attempt_id, occurred_at);

create table if not exists public.exam_proctoring_captures (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  event_id uuid references public.exam_proctoring_events(id) on delete set null,
  source text not null check (source in ('webcam', 'screen')),
  trigger text not null check (trigger in ('manual', 'periodic', 'event')),
  storage_path text not null unique,
  content_type text not null default 'image/jpeg',
  analysis jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists exam_proctoring_captures_attempt_idx
  on public.exam_proctoring_captures(attempt_id, occurred_at);
create index if not exists exam_proctoring_captures_expiry_idx
  on public.exam_proctoring_captures(expires_at);

create table if not exists public.exam_proctoring_reports (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade unique,
  decision text not null default 'compliant' check (decision in ('compliant', 'review', 'non-compliant')),
  teacher_decision text check (teacher_decision in ('compliant', 'review', 'non-compliant')),
  teacher_note text not null default '',
  validation_status text not null default 'pending' check (validation_status in ('pending', 'reviewed')),
  event_count integer not null default 0,
  alert_count integer not null default 0,
  capture_count integer not null default 0,
  tab_switch_count integer not null default 0,
  fullscreen_exit_count integer not null default 0,
  focus_lost_seconds integer not null default 0,
  generated_at timestamptz not null default now(),
  validated_at timestamptz,
  validated_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null
);

create table if not exists public.exam_proctoring_access_log (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  attempt_id uuid references public.exam_attempts(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  occurred_at timestamptz not null default now(),
  details jsonb not null default '{}',
  expires_at timestamptz not null
);

create index if not exists exam_proctoring_access_exam_idx
  on public.exam_proctoring_access_log(exam_id, occurred_at desc);

alter table public.exam_proctoring_events enable row level security;
alter table public.exam_proctoring_alerts enable row level security;
alter table public.exam_proctoring_captures enable row level security;
alter table public.exam_proctoring_reports enable row level security;
alter table public.exam_proctoring_access_log enable row level security;

grant select, insert, update, delete on table
  public.exam_proctoring_secrets,
  public.exam_proctoring_events,
  public.exam_proctoring_alerts,
  public.exam_proctoring_captures,
  public.exam_proctoring_reports,
  public.exam_proctoring_access_log
to service_role;

create policy proctoring_events_host_read on public.exam_proctoring_events
  for select using (exists (
    select 1 from public.exams e where e.id = exam_id and e.host_id = auth.uid()
  ));
create policy proctoring_alerts_host_read on public.exam_proctoring_alerts
  for select using (exists (
    select 1 from public.exams e where e.id = exam_id and e.host_id = auth.uid()
  ));
create policy proctoring_captures_host_read on public.exam_proctoring_captures
  for select using (exists (
    select 1 from public.exams e where e.id = exam_id and e.host_id = auth.uid()
  ));
create policy proctoring_reports_host_read on public.exam_proctoring_reports
  for select using (exists (
    select 1 from public.exams e where e.id = exam_id and e.host_id = auth.uid()
  ));
create policy proctoring_access_host_read on public.exam_proctoring_access_log
  for select using (exists (
    select 1 from public.exams e where e.id = exam_id and e.host_id = auth.uid()
  ));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exam-proctoring', 'exam-proctoring', false, 5242880, array['image/jpeg', 'image/png', 'audio/webm'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Service role owns writes and signed-URL creation. A host cannot enumerate
-- raw storage objects directly; every access goes through the API and is
-- added to exam_proctoring_access_log.

-- Physical object deletion is performed by proctoring-api/purge-expired so
-- the Storage service removes the private file before its metadata row.
