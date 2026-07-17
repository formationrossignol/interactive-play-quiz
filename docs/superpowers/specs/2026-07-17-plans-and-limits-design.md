# Plans (Starter / Pro / Entreprise) & limit enforcement

## Context

`Plan` (`perso` | `pro` | `entreprise`) already exists in `auth.ts`, stored in Supabase
`user_metadata.plan`, with an unused `PLAN_META` block already stubbed into
`ProfilePage.tsx`. None of it is enforced anywhere, and it disagrees with the
marketing copy on `Pricing.tsx` (participant numbers match; quiz-count and
feature-list numbers don't). No billing/Stripe integration exists in this
codebase — plan changes today can only happen via a manual Supabase
`user_metadata` edit.

This spec turns the plan concept into something real: concrete per-plan
limits, enforced at the point of use, with Starter users able to see their
own usage against those limits, and upsell prompts pointing at `/pricing`
when a limit is hit.

## Goals

- Single source of truth for plan limits (creation caps per content kind,
  live-audience cap).
- Enforce those limits at the actual creation/join/attempt points, not just
  in marketing copy.
- Starter users can see "X / cap" for everything they're capped on, from
  their profile.
- Reconcile `Pricing.tsx` copy with what's actually enforced.

## Non-goals

- No real payment/checkout (Stripe etc.). "Upgrade to Pro" still just routes
  to `/pricing`, unchanged from today.
- No functional SSO. Entreprise's SSO/"advanced compliance" bullet stays
  marketing copy, same as it is today — nothing in this codebase implements
  SSO.
- No gating of poll/flashcard/exam question types, branding/theme controls,
  or export/report features. Only the numeric creation caps, the live
  participant cap, and quiz question-type gating (classic vs. advanced) are
  enforced.
- No changes to how the Trash/favorites/duplication systems work beyond the
  cap check itself.

## Plan model — `src/lib/plans.ts` (new file)

Single source of truth, imported by every enforcement point and by the
Profile/Pricing UI.

```ts
export type Plan = 'starter' | 'pro' | 'entreprise';

export type ContentKind = 'quiz' | 'poll' | 'flashcard' | 'slide' | 'exam' | 'course';

// Creation caps per plan per content kind. null = unlimited.
export const CONTENT_CAPS: Record<Plan, Record<ContentKind, number | null>> = {
  starter:    { quiz: 5, poll: 5, flashcard: 5, slide: 5, exam: 5, course: 1 },
  pro:        { quiz: null, poll: null, flashcard: null, slide: null, exam: null, course: null },
  entreprise: { quiz: null, poll: null, flashcard: null, slide: null, exam: null, course: null },
};

// "How many people can experience this content" — live quiz/poll rooms AND
// exam attempts (distinct participants), same numbers, two different
// mechanisms. null = unlimited.
export const AUDIENCE_CAP: Record<Plan, number | null> = {
  starter: 20,
  pro: 200,
  entreprise: null,
};

// Quiz-builder-only question-type gating. Poll/flashcard/exam question
// types are unaffected.
export const ADVANCED_QUIZ_TYPES = ['ranking', 'matching', 'fill-blank', 'slider'] as const;

export const DEFAULT_PLAN: Plan = 'starter';

export function getPlan(user: { plan?: Plan } | null): Plan;
export function getContentUsage(userId: string, kind: ContentKind): { used: number; cap: number | null };
export function canCreateContent(userId: string, kind: ContentKind): boolean;
export function isQuestionTypeLocked(type: string, plan: Plan): boolean;
```

`Plan` moves here from `auth.ts`; `auth.ts` re-exports it so existing imports
(`import type { Plan } from '@/lib/auth'`) keep working.

## Rename `perso` → `starter`

Only 5 literal references today (`auth.ts` type + fallback, `ProfilePage.tsx`
`PLAN_META` key, two `useState`/comparison sites). No live user has
`plan` set in Supabase metadata yet (`u.user_metadata?.plan` is always
`undefined` today), so the fallback-to-`starter` behavior is what every
existing user already gets — no data migration needed.

## Creation caps: 6 content kinds, 3 enforcement surfaces

| Kind | Storage | Starter cap | Entry point (blocker) | Safety net |
|---|---|---|---|---|
| quiz | `quizStorage.ts` (`type:'quiz'`) | 5 | `QuizBuilderStart.tsx` | `saveQuiz()` / `duplicateQuiz()` |
| poll | `quizStorage.ts` (`type:'poll'`) | 5 | `QuizBuilderStart.tsx` | `saveQuiz()` / `duplicateQuiz()` |
| flashcard | `quizStorage.ts` (`type:'flashcard'`) | 5 | `QuizBuilderStart.tsx` | `saveQuiz()` / `duplicateQuiz()` |
| slide | `quizStorage.ts` (`type:'slide'`) | 5 | `QuizBuilderStart.tsx` | `saveQuiz()` / `duplicateQuiz()` |
| exam | `examStorage.ts` | 5 | `ExamBuilder.tsx` | `createExam()` |
| course | `courseStorage.ts` | **1** | `CourseBuilder.tsx` | `createCourse()` |

`QuizBuilderStart.tsx` already branches on a `quizType` query param
(`quiz`/`poll`/`flashcard`/`slide`) to render the right template picker —
one change there (a blocker screen, styled like `JoinQuiz.tsx`'s existing
"salle verrouillée" screen, shown instead of the picker when
`canCreateContent(userId, quizType)` is false) covers 4 of the 6 kinds.
`ExamBuilder.tsx` and `CourseBuilder.tsx` each get their own equivalent
check before allowing a new (non-edit) creation to proceed.

The storage-layer checks (`saveQuiz`/`duplicateQuiz`/`createExam`/
`createCourse`) are the authoritative safety net for any path that
bypasses the builder-start screen (e.g. duplicating from a list view).

## Live audience cap (20 / 200 / unlimited)

**Quiz + Poll** share one mechanism — confirmed they run through the same
`createLiveSession()` call site and the same `/quiz/:gameCode` route/
`session_state` table:

- `createLiveSession()` sends `max_participants` (derived from the host's
  plan via `AUDIENCE_CAP`) alongside the existing `ambiance_id`.
- A new migration extends `create_session_atomic(...)` with a
  `p_max_participants` param (same pattern as the `p_ambiance_id` addition),
  stored in `quiz_data.maxParticipants`.
- `JoinQuiz.tsx` — which already polls room-lock state every 3s — adds the
  same check for `players.length >= quiz_data.maxParticipants`, showing a
  "Session complète" screen (same visual treatment as the existing lock
  screen).

**Exam** works differently — no live room, just `Attempt` records keyed by
`participantId`, and exams already have their own `maxAttempts` (a
per-participant retake limit, unrelated to this cap). The audience cap here
is **distinct participants**, not raw attempt count, so a participant's
legitimate retakes under `exam.maxAttempts` are never blocked by this cap:

- `startAttempt()` in `examStorage.ts` counts distinct `participantId`s
  already in `getAttemptsForExam(exam.id)`. If the incoming
  `participantId` is new (has no existing attempt) and that count is
  already at the plan's `AUDIENCE_CAP`, block with the same "limit
  reached" messaging used elsewhere. Existing participants resuming/
  retaking are never affected.

**Course**: no participant concept — not gated.

## Quiz question-type gating (unchanged from prior round)

`QuizBuilder.tsx`'s `getAvailableTypes()`/type-picker dropdown keeps
showing all 7 quiz types; `ADVANCED_QUIZ_TYPES` (`ranking`, `matching`,
`fill-blank`, `slider`) render disabled with a "Pro" badge for Starter,
selecting one shows an upsell toast instead of switching. Scoped to the
quiz builder only.

## Profile page

`PLAN_META` gets corrected numbers (currently wrong — says "10 quiz/30
joueurs"). A new "Utilisation" block shows, for Starter, a progress bar per
capped kind (quiz X/5, poll X/5, flashcard X/5, slide X/5, exam X/5,
course X/1) using `getContentUsage()`. Pro/Entreprise show "illimité"
badges instead of bars. Existing "Passer à Pro/Entreprise" CTA is
unchanged — still routes to `/pricing`.

## Pricing.tsx / i18n copy

Rewritten to state the real enforced numbers instead of the current
self-contradictory copy (Starter currently claims "unlimited drafts and
templates" while `PLAN_META` claims a 10-quiz cap). Entreprise bullets gain
SSO + custom templating/branding mentions (marketing-only, consistent with
the "no functional SSO" non-goal above).

## Open risk

`session_state`'s schema isn't tracked by any "create table" migration in
this repo (per prior project notes, it was hand-built directly in prod) —
only `alter table` migrations touch it. The `create_session_atomic`
extension will follow the same `alter`/`create or replace function`
pattern already used for `ambiance_id` and `control`, so this is
consistent with how the table has been evolved so far, but the migration
can't be verified against a full `create table session_state` locally the
way the other tables can.
