-- Spec 01 — Devoirs, remises et carnet de notes
-- (docs/product-specs/2026-08-10-lms-program/01-assignments-gradebook.md).
--
-- RESTE-A-FAIRE.md §01: "UI : remise fichier/audio/vidéo — seul le mode
-- texte est câblé côté client" and "URLs de téléchargement signées courte
-- durée pour les fichiers" — building the first without the second would
-- have meant a private bucket with no way to actually read from it, and
-- building signed-URL plumbing with nothing ever uploaded would have been
-- dead code; they're one feature.
--
-- submission_files existed (20260810160000) with owner/staff SELECT
-- policies but zero writer — no RPC, no RLS INSERT policy, nothing. This
-- migration:
--   - creates the 'assignment-submissions' storage bucket, PRIVATE (a
--     submission can be a confidential answer — public getPublicUrl(), the
--     pattern the presentation-media/avatars buckets use, is wrong here).
--   - storage.objects RLS: path convention <learner_id>/<assignment_id>/
--     <filename>. Insert/select for the owning learner is a plain
--     first-folder-segment check (avatars-bucket pattern); staff select
--     resolves the second segment to assignments.org_id. This is the actual
--     access gate for the bytes — signed URLs created client-side via
--     createSignedUrl() are checked against it independently of whatever
--     submission_files says, so even a submit_assignment() call passing a
--     path the caller doesn't own can never produce a working signed URL
--     for someone else's file.
--   - submit_assignment() gains p_files: uploads must happen (via the
--     storage RLS above) before this call — the file bytes need to exist
--     first — then this attaches their metadata to the submission_version
--     it creates, atomically. Ownership double-checked here too (fail
--     fast with a clear error rather than a silently dangling reference).
--   - "URLs signées courte durée": no new DB surface — createSignedUrl()
--     is a client-side Storage API call, gated by the RLS above.

insert into storage.buckets (id, name, public)
values ('assignment-submissions', 'assignment-submissions', false)
on conflict (id) do nothing;

create policy assignment_submissions_owner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'assignment-submissions' and (storage.foldername(name))[1] = auth.uid()::text);

create policy assignment_submissions_owner_read on storage.objects
  for select to authenticated
  using (bucket_id = 'assignment-submissions' and (storage.foldername(name))[1] = auth.uid()::text);

create policy assignment_submissions_staff_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'assignment-submissions'
    and exists (
      select 1 from public.assignments a
      where a.id = (storage.foldername(name))[2]::uuid
        and public.has_org_role(a.org_id, array['trainer','pedago','admin'])
    )
  );

-- Postgres overloads functions by parameter *types*, not names/defaults —
-- create or replace with an extra parameter would leave the old 5-arg
-- version in place as a second, now-redundant overload rather than
-- replacing it. Drop it explicitly so there is exactly one
-- submit_assignment() again. Safe for existing callers: gradebook.ts
-- already calls this via named RPC parameters (PostgREST resolves by
-- name), so omitting p_files just uses its default of null.
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

  -- ASG-004: a per-learner target override wins over the assignment default.
  select due_override into v_due
  from public.assignment_targets
  where assignment_id = p_assignment_id and target_type = 'learner' and target_id = auth.uid() and due_override is not null
  limit 1;
  v_due := coalesce(v_due, v_assignment.due_at);

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

  return v_submission;
end;
$$;

revoke all on function public.submit_assignment(uuid, text, text, text, boolean, jsonb) from public;
grant execute on function public.submit_assignment(uuid, text, text, text, boolean, jsonb) to authenticated;
