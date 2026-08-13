-- Small follow-up to 20260813020000_anonymous_grading.sql: the original
-- list_submissions_for_grading() body dropped the `order by updated_at
-- desc` the direct-select it replaced (listAssignmentSubmissions()) used
-- to have. Same function, `create or replace`, only the added order by.
create or replace function public.list_submissions_for_grading(p_assignment_id uuid)
returns table(
  id uuid, assignment_id uuid, learner_id uuid, status text, active_version integer,
  created_at timestamptz, updated_at timestamptz,
  plagiarism_check_status text, plagiarism_check_note text, plagiarism_checked_by uuid, plagiarism_checked_at timestamptz,
  anonymized boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_anonymous boolean;
begin
  select a.org_id, coalesce((a.policy->>'anonymous_grading')::boolean, false)
    into v_org_id, v_anonymous
  from public.assignments a where a.id = p_assignment_id;

  if v_org_id is null then
    raise exception 'assignment_not_found';
  end if;
  if not public.has_org_role(v_org_id, array['trainer','pedago','admin']) then
    raise exception 'Not authorized';
  end if;

  return query
    select
      s.id, s.assignment_id,
      case when v_anonymous and not exists (
        select 1 from public.submission_anonymity_lifts l where l.submission_id = s.id and l.actor_id = auth.uid()
      ) then null::uuid else s.learner_id end,
      s.status, s.active_version, s.created_at, s.updated_at,
      s.plagiarism_check_status, s.plagiarism_check_note, s.plagiarism_checked_by, s.plagiarism_checked_at,
      (v_anonymous and not exists (
        select 1 from public.submission_anonymity_lifts l where l.submission_id = s.id and l.actor_id = auth.uid()
      ))
    from public.submissions s
    where s.assignment_id = p_assignment_id
    order by s.updated_at desc;
end;
$$;
