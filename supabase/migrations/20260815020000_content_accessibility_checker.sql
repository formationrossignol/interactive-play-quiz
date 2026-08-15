-- Spec 05 — Accessibilité, inclusion et aménagements individuels
-- (docs/product-specs/2026-08-10-lms-program/05-accessibility-accommodations.md).
--
-- A11Y-007/009/010: `content_accessibility_checks` was posed since
-- 20260810190000 with zero analyzer — this is the first thing that ever
-- writes to it. Scope, stated explicitly:
--   - Alt-text (A11Y-007) is checkable for the first time only because
--     `imageAlt`/`imageIsDecorative` now exist on question prompts
--     (questionTypes.ts, this same pass) — before this migration there was
--     no field to check, every image-bearing question would have failed
--     with no way to fix it.
--   - Language (A11Y-009, partial) checks `content.data.language` — no
--     inference, an absent field is flagged, never guessed from question
--     text.
--   - Keyboard alternative (A11Y-013) is flagged as a standing warning for
--     drag-drop/hotspot items, not fixed here — the actual keyboard-
--     operable equivalent is a player-side rework this migration does not
--     attempt (real WCAG remediation, not a metadata check).
--   - Contrast (A11Y-009) is NOT covered — theme color field shapes vary
--     enough across content types that a wrong guess would produce false
--     "passes", worse than no check at all. Not attempted.
--   - A11Y-011 ("publication bloquée sur erreur critique selon la
--     politique") is NOT wired to the existing is_public toggle — that
--     toggle is a direct client update with no per-org policy concept
--     anywhere in this schema; hardcoding a global block would be
--     guessing a policy the spec explicitly says must be configurable.
--     This migration makes findings visible and manageable, not blocking.
--
-- Findings are upserted keyed on (content_id, rule_code, location) — a
-- re-run never duplicates a still-open finding, an operator's 'ignored'
-- status survives re-runs (only auto-flips to 'fixed' when the finding
-- itself disappears, never silently reopened by rerunning the checker
-- while still ignored).
alter table public.content_accessibility_checks
  alter column location set default 'content';
update public.content_accessibility_checks set location = 'content' where location is null;
alter table public.content_accessibility_checks alter column location set not null;
create unique index content_accessibility_checks_unique_idx
  on public.content_accessibility_checks(content_id, rule_code, location);

create or replace function public.check_content_accessibility(p_content_id uuid)
returns setof public.content_accessibility_checks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_content public.content;
  v_question jsonb;
  v_idx integer;
  v_location text;
  v_keys text[] := '{}';
begin
  select * into v_content from public.content where id = p_content_id;
  if v_content.id is null then
    raise exception 'Content not found';
  end if;
  if v_content.user_id <> auth.uid()
     and not (v_content.org_id is not null and public.has_org_role(v_content.org_id, array['trainer','pedago','admin'])) then
    raise exception 'Not authorized';
  end if;

  -- content.data.language (A11Y-009, partial)
  if v_content.data->>'language' is null or trim(v_content.data->>'language') = '' then
    insert into public.content_accessibility_checks (content_id, rule_code, severity, location, message)
    values (p_content_id, 'no_language_declared', 'warning', 'content', 'Aucune langue déclarée pour ce contenu.')
    on conflict (content_id, rule_code, location) do update set
      severity = excluded.severity, message = excluded.message, checked_at = now(),
      status = case when content_accessibility_checks.status = 'ignored' then 'ignored' else 'open' end;
    v_keys := array_append(v_keys, 'no_language_declared|content');
  end if;

  -- per-question checks (quiz/poll/exam share the same questions[] shape)
  if jsonb_typeof(v_content.data->'questions') = 'array' then
    for v_idx, v_question in select ordinality - 1, value from jsonb_array_elements(v_content.data->'questions') with ordinality
    loop
      v_location := 'questions[' || v_idx || ']';

      if v_question->>'image' is not null and trim(v_question->>'image') <> ''
         and coalesce((v_question->>'imageIsDecorative')::boolean, false) = false
         and (v_question->>'imageAlt' is null or trim(v_question->>'imageAlt') = '') then
        insert into public.content_accessibility_checks (content_id, rule_code, severity, location, message)
        values (p_content_id, 'missing_alt_text', 'error', v_location,
          'Image sans texte alternatif ni déclaration décorative (question ' || (v_idx + 1) || ').')
        on conflict (content_id, rule_code, location) do update set
          severity = excluded.severity, message = excluded.message, checked_at = now(),
          status = case when content_accessibility_checks.status = 'ignored' then 'ignored' else 'open' end;
        v_keys := array_append(v_keys, 'missing_alt_text|' || v_location);
      end if;

      if v_question->>'type' in ('drag-drop', 'hotspot') then
        insert into public.content_accessibility_checks (content_id, rule_code, severity, location, message)
        values (p_content_id, 'no_keyboard_alternative', 'warning', v_location,
          'Interaction ' || (v_question->>'type') || ' sans mode clavier connu (question ' || (v_idx + 1) || ') — A11Y-013, non résolu automatiquement.')
        on conflict (content_id, rule_code, location) do update set
          severity = excluded.severity, message = excluded.message, checked_at = now(),
          status = case when content_accessibility_checks.status = 'ignored' then 'ignored' else 'open' end;
        v_keys := array_append(v_keys, 'no_keyboard_alternative|' || v_location);
      end if;
    end loop;
  end if;

  -- anything previously open that this run no longer finds is resolved —
  -- an 'ignored' row is left alone (an operator's dismissal isn't
  -- reopened just because the run order changed).
  update public.content_accessibility_checks
  set status = 'fixed', checked_at = now()
  where content_id = p_content_id and status = 'open'
    and not ((rule_code || '|' || location) = any(v_keys));

  return query select * from public.content_accessibility_checks where content_id = p_content_id order by severity, location;
end;
$$;

revoke all on function public.check_content_accessibility(uuid) from public;
grant execute on function public.check_content_accessibility(uuid) to authenticated;

-- ── set_content_accessibility_check_status() : owner/staff dismiss or reopen ─
create or replace function public.set_content_accessibility_check_status(p_check_id uuid, p_status text)
returns public.content_accessibility_checks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_check public.content_accessibility_checks;
  v_content public.content;
  v_result public.content_accessibility_checks;
begin
  if p_status not in ('open', 'ignored') then
    raise exception 'invalid_status';
  end if;
  select * into v_check from public.content_accessibility_checks where id = p_check_id;
  if v_check.id is null then
    raise exception 'Check not found';
  end if;
  select * into v_content from public.content where id = v_check.content_id;
  if v_content.user_id <> auth.uid()
     and not (v_content.org_id is not null and public.has_org_role(v_content.org_id, array['trainer','pedago','admin'])) then
    raise exception 'Not authorized';
  end if;

  update public.content_accessibility_checks set status = p_status where id = p_check_id returning * into v_result;
  return v_result;
end;
$$;

revoke all on function public.set_content_accessibility_check_status(uuid, text) from public;
grant execute on function public.set_content_accessibility_check_status(uuid, text) to authenticated;
