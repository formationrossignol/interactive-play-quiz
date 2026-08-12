-- Spec 01/05 — regression fix.
--
-- 20260812150000_submission_file_uploads.sql based its submit_assignment()
-- rewrite on the pre-accommodation version (20260810160000) instead of the
-- one actually current in prod (20260811040000_accommodation_effective_dates.sql),
-- which made lateness accommodation-aware (effective_assignment_due_at(),
-- honoring extended_deadline/no_time_limit) and emitted
-- 'submission.submitted' via emit_learning_event() on finalize. That
-- migration silently overwrote both — a learner with an extended-deadline
-- or no-time-limit accommodation would have been incorrectly marked late
-- again, and finalized submissions would have stopped emitting the
-- learning event generate_risk_signals()'s 'overdue' rule and analytics
-- depend on. Caught by re-reading the migration history after deploying,
-- not before — this restores the correct body (same as
-- 20260811040000/20260811070000's copies) with p_files layered on top,
-- nothing else changed.

drop function if exists public.submit_assignment(uuid, text, text, text, boolean);

create or replace function public.submit_assignment(
  p_assignment_id uuid,
  p_kind text,
  p_text_content text default null,
  p_url text default null,
  p_finalize boolean default true,
  p_files jsonb default null
)
returns public.submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.assignments;
  v_submission public.submissions;
  v_due timestamptz;
  v_next_version integer;
  v_is_late boolean := false;
  v_version_id uuid;
  v_file jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_assignment from public.assignments where id = p_assignment_id and status = 'published';
  if v_assignment.id is null then
    raise exception 'Assignment not found';
  end if;
  if not public.assignment_visible_to_learner(p_assignment_id, auth.uid()) then
    raise exception 'Not authorized';
  end if;

  if p_files is not null then
    for v_file in select * from jsonb_array_elements(p_files)
    loop
      if split_part(v_file->>'storage_path', '/', 1) <> auth.uid()::text then
        raise exception 'file_path_ownership_mismatch';
      end if;
    end loop;
  end if;

  insert into public.submissions (assignment_id, learner_id, status)
  values (p_assignment_id, auth.uid(), 'draft')
  on conflict (assignment_id, learner_id) do update set assignment_id = excluded.assignment_id
  returning * into v_submission;

  if v_submission.status in ('graded','void') then
    raise exception 'submission_locked';
  end if;

  v_due := public.effective_assignment_due_at(p_assignment_id, auth.uid());

  if p_finalize then
    v_is_late := v_due is not null and now() > v_due;
  end if;

  select coalesce(max(version), 0) + 1 into v_next_version from public.submission_versions where submission_id = v_submission.id;

  insert into public.submission_versions (submission_id, version, kind, text_content, url, is_draft, is_late, submitted_at)
  values (v_submission.id, v_next_version, p_kind, p_text_content, p_url, not p_finalize, v_is_late, now())
  returning id into v_version_id;

  if p_files is not null then
    insert into public.submission_files (submission_version_id, storage_path, file_name, mime_type, size_bytes)
    select v_version_id, f->>'storage_path', f->>'file_name', f->>'mime_type', nullif(f->>'size_bytes', '')::bigint
    from jsonb_array_elements(p_files) as f;
  end if;

  update public.submissions
  set active_version = v_next_version,
      status = case when not p_finalize then 'draft' when v_is_late then 'late' else 'submitted' end
  where id = v_submission.id
  returning * into v_submission;

  if p_finalize then
    perform public.emit_learning_event('submission.submitted', v_assignment.org_id, auth.uid(), 'submission', v_submission.id, jsonb_build_object('assignment_id', p_assignment_id, 'late', v_is_late));
  end if;

  return v_submission;
end;
$$;

revoke all on function public.submit_assignment(uuid, text, text, text, boolean, jsonb) from public;
grant execute on function public.submit_assignment(uuid, text, text, text, boolean, jsonb) to authenticated;
