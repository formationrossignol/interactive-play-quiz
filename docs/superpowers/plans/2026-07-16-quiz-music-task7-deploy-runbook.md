# Task 7 — Deploy runbook: propagate quiz ambiance to players

**Feature:** Quiz music system (see `docs/superpowers/plans/2026-07-14-quiz-music-system.md`).
**Status:** Code committed & pushed. Backend deploy **not done** (deferred).
**Goal:** Make the host-chosen ambiance reach players by writing `ambianceId` into `quiz_data`.

---

## Why it's deferred (read first)

Two independent blockers hit on 2026-07-16:

- **Supabase Management API → `Unauthorized`.** Legacy personal-access-token (`sbp_`) auth
  is being decommissioned mid platform-migration. `supabase link`, `db push`, and
  `functions deploy` all fail from the CLI.
- **Direct Postgres unreachable from the dev machine.** `psql` to the session pooler
  (`:5432`), transaction pooler (`:6543`), and direct host (`db.<ref>.supabase.co:5432`)
  all time out.

**Cosmetically moot for now:** all three ambiances (`arcade`/`chill`/`epic`) currently
point at the same two shared beds (`ludiq-calm.mp3` / `ludiq-intense.mp3`), so propagating
the ambiance changes **nothing audible** until distinct per-ambiance audio exists.
Do this deploy when you add distinct audio, not before.

Without this deploy players fall back to `arcade` — **graceful, no errors.** The host
screen, phase music, and SFX all already work without it.

---

## What the deploy changes

1. **DB migration** — `create_session_atomic` gains a 5th arg `p_ambiance_id`
   (default `'arcade'`, backward-compatible) and writes `ambianceId` into `quiz_data`.
   File: `supabase/migrations/20260714120000_create_session_ambiance.sql`.
2. **Edge function** — `create-session` reads `ambiance_id` from the request body and
   forwards it to the RPC. File: `supabase/functions/create-session/index.ts` (already committed).

**Order is critical:** migration **first**, then function. The updated function calls the
5-arg RPC — deploying it before the migration means it calls a signature that doesn't
exist yet (runtime error on every session create).

---

## Method A — CLI (once Supabase auth is fixed)

Prereqs: `SUPABASE_ACCESS_TOKEN` valid on the new platform, DB password, network to Postgres.

```bash
export SUPABASE_DB_PASSWORD='<db-password>'
npx supabase@latest login --token <PAT>          # or set SUPABASE_ACCESS_TOKEN
npx supabase@latest link --project-ref lwwfgdebmggxjuvlazwf
npx supabase@latest db push                       # applies the migration
npx supabase@latest functions deploy create-session
```

Project ref: `lwwfgdebmggxjuvlazwf` (project "quizz", region eu-west-1).

## Method B — Dashboard (works today, bypasses both blockers)

Everything runs in the browser against the project, so neither the CLI auth nor the
local network matters.

### B1. Migration — Dashboard → SQL Editor → paste → Run

```sql
drop function if exists create_session_atomic(text, text, jsonb, jsonb);

create or replace function create_session_atomic(
  p_game_code text,
  p_title text,
  p_public_questions jsonb,
  p_private_questions jsonb,
  p_ambiance_id text default 'arcade'
) returns void
language plpgsql
as $$
begin
  insert into session_quiz_answers (game_code, questions, created_at)
  values (p_game_code, p_private_questions, now())
  on conflict (game_code) do update
    set questions = excluded.questions, created_at = excluded.created_at;

  insert into session_state (
    game_code, players, game_state, current_question_index,
    time_left, question_started_at, quiz_data, updated_at
  )
  values (
    p_game_code, '[]'::jsonb, 'waiting', 0,
    0, null,
    jsonb_build_object('title', p_title, 'questions', p_public_questions, 'ambianceId', p_ambiance_id),
    now()
  )
  on conflict (game_code) do update
    set players = '[]'::jsonb,
        game_state = 'waiting',
        current_question_index = 0,
        time_left = 0,
        question_started_at = null,
        quiz_data = excluded.quiz_data,
        updated_at = now();
end;
$$;
```

### B2. Edge function — Dashboard → Edge Functions → `create-session` → Edit → Deploy

Paste the committed `supabase/functions/create-session/index.ts`. The only diff vs the
live version: the body type gains `ambiance_id?: string`, it's destructured, and passed to
the RPC as `p_ambiance_id: ambiance_id ?? "arcade"`.

---

## Verify

After both steps, launch a live quiz whose ambiance is not `arcade`, then in SQL Editor:

```sql
select game_code, quiz_data->>'ambianceId' as ambiance
from session_state
order by updated_at desc
limit 1;
```

Expected: the column shows the host-chosen ambiance (not `arcade`). In the app, a player
joining that session should load that ambiance (verified via `setAmbianceId` in
`src/components/PlayerView.tsx`).

---

## Rollback

The migration is idempotent (`create or replace`). To revert to the pre-ambiance version,
re-run the original 4-arg definition from
`supabase/migrations/20260712130000_create_session_atomic.sql` (drop the 5-arg first).
The old edge function ignores `ambiance_id`, so an un-redeployed function is safe with the
new RPC (extra arg has a default).

---

## Security note

During the 2026-07-16 attempt a PAT and the DB password were exposed in a session
transcript. Rotate both: token at dashboard → Account → Access Tokens; DB password at
Project Settings → Database → Reset database password.
