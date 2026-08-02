-- Durable, write-only intake for the public marketing contact form.
-- Visitors can execute the constrained RPC but cannot read or mutate leads.
create table if not exists public.marketing_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  organization text,
  role text,
  request_type text not null,
  team_size text,
  message text not null,
  source_path text,
  ip_hash text not null,
  user_agent text,
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'closed')),
  created_at timestamptz not null default now(),
  constraint marketing_leads_name_length check (char_length(name) between 2 and 120),
  constraint marketing_leads_email_length check (char_length(email) between 5 and 254),
  constraint marketing_leads_message_length check (char_length(message) between 20 and 4000)
);

create index if not exists marketing_leads_created_at_idx
  on public.marketing_leads (created_at desc);
create index if not exists marketing_leads_ip_created_idx
  on public.marketing_leads (ip_hash, created_at desc);

alter table public.marketing_leads enable row level security;
revoke all on public.marketing_leads from anon, authenticated;

create or replace function public.submit_marketing_lead(
  p_name text,
  p_email text,
  p_organization text,
  p_role text,
  p_request_type text,
  p_team_size text,
  p_message text,
  p_source_path text,
  p_ip_hash text,
  p_user_agent text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if (
    select count(*)
    from public.marketing_leads
    where ip_hash = p_ip_hash and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'rate_limit';
  end if;

  insert into public.marketing_leads (
    name, email, organization, role, request_type, team_size, message,
    source_path, ip_hash, user_agent
  ) values (
    trim(p_name), lower(trim(p_email)), nullif(trim(p_organization), ''),
    nullif(trim(p_role), ''), trim(p_request_type), nullif(trim(p_team_size), ''),
    trim(p_message), nullif(trim(p_source_path), ''), p_ip_hash,
    left(nullif(trim(p_user_agent), ''), 500)
  ) returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.submit_marketing_lead(text,text,text,text,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_marketing_lead(text,text,text,text,text,text,text,text,text,text) to service_role;
