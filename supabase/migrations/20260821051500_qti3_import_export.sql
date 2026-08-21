-- Spec 04 — Interopérabilité, identité et administration Enterprise
-- (docs/product-specs/2026-08-10-lms-program/04-interoperability-identity.md:77-84).
-- QTI-001 to QTI-004 — import/export against spec 08's item bank
-- (20260810220000_advanced_assessment.sql).
--
-- Real gaps confirmed absent before writing this (this session's own
-- investigation): no external_id/license column anywhere in the item
-- schema, no QTI-specific provenance table (unlike assessment_legacy_
-- question_links for the legacy-quiz-import path), and assessment_item_
-- revisions.prompt has no media field. prompt is already jsonb — a `media`
-- key needs no schema change, just a client-side contract (documented in
-- apps/app/src/lib/lms/qti.ts).
--
-- external_id/license live on assessment_items (the item as a whole, not a
-- revision): the QTI identifier names "the same question" across re-imports
-- and revisions, and a license is a property of the source content, not
-- something that changes per authoring revision.

alter table public.assessment_items add column if not exists external_id text;
alter table public.assessment_items add column if not exists license jsonb;
-- Same (org_id, external_id) pair should resolve to the same Brivia item on
-- re-import (round-trip identity, QTI-004) — null external_id (every
-- non-QTI-imported item) is exempt via the partial index.
create unique index if not exists assessment_items_org_external_id_idx
  on public.assessment_items(org_id, external_id) where external_id is not null;

-- ── qti_import_batches / qti_import_items : provenance + QTI-003's report ──
-- QTI-001 requires "prévisualisation et rapport des interactions supportées,
-- adaptées ou refusées" — QTI-003 requires that report to be real and
-- persisted, not just a client-side toast: an unsupported interaction type
-- must show up as `rejected` with a reason, never silently become `mcq` or
-- any other item_type. One row per QTI item encountered, whether or not it
-- was actually written to assessment_items.
create table public.qti_import_batches (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  assessment_id uuid references public.assessments(id) on delete set null,
  owner_id      uuid not null references auth.users(id) default auth.uid(),
  source_filename text,
  created_at    timestamptz not null default now()
);
create index qti_import_batches_org_idx on public.qti_import_batches(org_id);
alter table public.qti_import_batches enable row level security;
create policy qti_import_batches_owner on public.qti_import_batches
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create table public.qti_import_items (
  id              uuid primary key default gen_random_uuid(),
  batch_id        uuid not null references public.qti_import_batches(id) on delete cascade,
  qti_identifier  text not null,
  title           text,
  qti_interaction text,
  outcome         text not null check (outcome in ('imported','adapted','rejected')),
  reason          text,
  assessment_item_id uuid references public.assessment_items(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index qti_import_items_batch_idx on public.qti_import_items(batch_id);
alter table public.qti_import_items enable row level security;
create policy qti_import_items_owner on public.qti_import_items
  for select using (exists (
    select 1 from public.qti_import_batches b where b.id = batch_id and b.owner_id = auth.uid()
  ));
-- No insert/update policy for authenticated: only import_qti_items() below
-- (security definer) writes these rows — the report is exactly what the
-- transactional import produced, never client-editable after the fact.

-- ── import_qti_items() : one transaction, given already-parsed+classified
-- items ─────────────────────────────────────────────────────────────────
-- Mirrors import_legacy_quiz_as_assessment()'s established shape
-- (20260813190000_assessment_pools_and_legacy_links.sql): client does the
-- zip/XML parsing and QTI-interaction→item_type mapping (apps/app/src/lib/
-- lms/qti.ts), server does one transactional write of the pre-parsed
-- result. `p_items` is a jsonb array; each element:
--   {qti_identifier, title, qti_interaction, outcome, reason,
--    item_type, prompt, correct_answer, scoring_rules, external_id, license}
-- Only outcome in ('imported','adapted') ever produces a real
-- assessment_items row — 'rejected' rows are recorded in the report only,
-- exactly QTI-003's requirement (never coerced into any item_type as a
-- fallback). item_type on an accepted row is still validated by
-- assessment_items' own existing check constraint (defense in depth: this
-- function never trusts the client's outcome classification blindly — an
-- accepted row with a bogus item_type fails the whole transaction rather
-- than silently writing something invalid).
create or replace function public.import_qti_items(
  p_title text,
  p_source_filename text,
  p_items jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_assessment_id uuid;
  v_section_id uuid;
  v_batch_id uuid;
  v_item jsonb;
  v_item_id uuid;
  v_rev_id uuid;
  v_outcome text;
  v_position integer := 0;
begin
  select org_id into v_org_id from public.user_org_roles where user_id = auth.uid() order by created_at limit 1;
  if v_org_id is null then
    raise exception 'User has no LMS organisation';
  end if;

  insert into public.assessments (org_id, owner_id, title)
  values (v_org_id, auth.uid(), coalesce(p_title, 'Import QTI'))
  returning id into v_assessment_id;
  insert into public.assessment_sections (assessment_id, title, position, selection_mode)
  values (v_assessment_id, 'Questions importées', 0, 'fixed')
  returning id into v_section_id;

  insert into public.qti_import_batches (org_id, assessment_id, owner_id, source_filename)
  values (v_org_id, v_assessment_id, auth.uid(), p_source_filename)
  returning id into v_batch_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_outcome := v_item->>'outcome';
    v_item_id := null;

    if v_outcome in ('imported', 'adapted') then
      insert into public.assessment_items (org_id, item_type, owner_id, status, external_id, license)
      values (
        v_org_id,
        v_item->>'item_type',
        auth.uid(),
        'draft',
        v_item->>'external_id',
        v_item->'license'
      )
      returning id into v_item_id;

      insert into public.assessment_item_revisions (item_id, version, prompt, created_by)
      values (v_item_id, 1, coalesce(v_item->'prompt', '{}'::jsonb), auth.uid())
      returning id into v_rev_id;

      insert into public.item_answer_keys (item_revision_id, correct_answer, scoring_rules)
      values (v_rev_id, coalesce(v_item->'correct_answer', '{}'::jsonb), coalesce(v_item->'scoring_rules', '{}'::jsonb));

      v_position := v_position + 1;
      insert into public.assessment_item_refs (section_id, item_revision_id, position)
      values (v_section_id, v_rev_id, v_position);
    end if;

    insert into public.qti_import_items (
      batch_id, qti_identifier, title, qti_interaction, outcome, reason, assessment_item_id
    ) values (
      v_batch_id,
      coalesce(v_item->>'qti_identifier', 'unknown'),
      v_item->>'title',
      v_item->>'qti_interaction',
      v_outcome,
      v_item->>'reason',
      v_item_id
    );
  end loop;

  return v_assessment_id;
end;
$$;
revoke all on function public.import_qti_items(text, text, jsonb) from public;
grant execute on function public.import_qti_items(text, text, jsonb) to authenticated;

-- ── get_item_answer_keys_for_export() : QTI-002 export read path ──────────
-- item_answer_keys has no select policy for `authenticated` at all (see
-- 20260810220000_advanced_assessment.sql's own header comment) — export
-- needs the correct_answer to embed a real QTI <correctResponse>, so this is
-- a narrow security-definer read, scoped exactly like assessment_item_
-- revisions_staff (trainer/pedago/admin of the item's own org) — the same
-- authorization boundary export already crosses to read the prompt/section
-- structure via direct RLS-permitted selects, just extended to the one
-- table that has no policy of its own.
create or replace function public.get_item_answer_keys_for_export(p_item_revision_ids uuid[])
returns table(item_revision_id uuid, correct_answer jsonb, scoring_rules jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select k.item_revision_id, k.correct_answer, k.scoring_rules
  from public.item_answer_keys k
  join public.assessment_item_revisions r on r.id = k.item_revision_id
  join public.assessment_items i on i.id = r.item_id
  where k.item_revision_id = any(p_item_revision_ids)
    and public.has_org_role(i.org_id, array['trainer','pedago','admin']);
$$;
revoke all on function public.get_item_answer_keys_for_export(uuid[]) from public;
grant execute on function public.get_item_answer_keys_for_export(uuid[]) to authenticated;
