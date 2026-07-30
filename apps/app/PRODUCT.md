# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Broad, mixed audience — no single fixed org hierarchy is assumed by default. Anyone can host live quiz sessions, build courses, exams, learning paths, flashcards, or polls. Optional org/team structures exist for users who need them: cohorts ("promotions"), groups, and org invitations, used by training managers ("responsable pédagogique") to track a group's results and by learners ("apprenant") who belong to one. Design work should not assume every user has an org — but must not break for the ones who do.

## Product Purpose

An all-in-one interactive training platform: live game-style quiz sessions (host + players in real time), formal exams with proctoring and certificates, courses, learning paths, flashcards, and polls, plus analytics (per-cohort competency tracking, weakest-skills panels, exam pass-rate ranking). Success = a host or training team can run an engaging session or a full training program end-to-end, and learners can complete it and walk away with a verifiable result (score, certificate, skill mastery).

## Positioning

Not a single-purpose live-quiz tool (the Kahoot/Wooclap category). The mechanism: live quiz mode is one surface among many (exams + certificates + courses + learning paths + per-cohort analytics) inside one product, so a team that starts with a fun live quiz can grow into running its whole training program here without switching tools. A neighboring live-quiz-only product could not truthfully copy the exam/certificate/analytics depth; a neighboring LMS could not truthfully copy the live game-session experience.

## Operating Context

- Live sessions: host runs a real-time game (Arcade Pop themed), players join and answer from their own device; time-pressure, leaderboard/race mechanics.
- Exams: proctored, scored (currently client-side per prior audit — treat as a known constraint, not a design decision to relitigate here), produce certificates (`apps/app/src/lib/certificates.ts`, `CourseCertificateDialog.tsx`).
- Courses/learning paths: self-paced structured content, SCORM reporting exists (`CourseScormReport.tsx`).
- Analytics: per-cohort/group comparison, per-question skill tags, weakest-skills panels, worst-pass-rate exam ranking — used by training managers to spot problem modules and by learners to see their own skill mastery.
- Content organization: nested folders, content explorer, trash/restore.
- Community/sharing surfaces: "Shared with me," community pages, discover quizzes.

## Capabilities and Constraints

- French-first: UI copy is primarily French (e.g. "réussite par promotion," "modules problématiques," "vos compétences").
- B2B SaaS with paid tiers: Stripe billing gates features by plan (`pro`, `entreprise`); role/plan checked in `apps/app/src/lib/auth.ts`.
- Multi-tenant: orgs, org invitations, group/cohort membership are real but optional per user.
- Supabase backend (auth, data, edge functions); some analytics/exam-scoring logic still client-side (known technical debt, not to be treated as intentional architecture when redesigning trust-sensitive surfaces like exams/certificates).
- Stack: Vite + React + TypeScript + shadcn-ui + Tailwind, monorepo (Turborepo) alongside `apps/marketing` (Next.js) and `packages/ui` (shared tokens/styles).

## Brand Commitments

- **Material 3 (`data-theme="material"`, `theme-material.css`) is the canonical design authority**, confirmed by the user — role-based color, tonal surfaces, rounded symbols (Roboto Flex + Material Symbols Rounded). Future DESIGN.md / design-system work should treat its tokens as the reference system, even though it is not the code default.
- The app ships 5 selectable site skins (`src/lib/siteTheme.ts`): Arcade Pop (`DEFAULT_SITE_THEME`, still the code default — unchanged by the above), Thales, Innov Campus, Studio, Material 3. This is a live user-facing theme picker, not a migration in progress; do not collapse it without explicit instruction.
- Product name seen in code comments: "Brivia" (`theme-material.css` header) — unconfirmed with the user, note but do not assert as final branding.

## Evidence on Hand

Extensive existing product surface (30+ routes under `apps/app/src/pages`: quiz/exam/course/learning-path builders, live session pages, certificates, grading, analytics, admin, community, tools library). No user testimonials, case studies, or press on hand — do not fabricate any for design work.

## Product Principles

1. Live-session energy and exam/certificate trust are different registers — don't let one surface's tone bleed into the other (playful game UI vs. compliance-grade document).
2. Org/cohort features must stay optional-feeling: the product works for a solo host with no org just as well as for a training team with promotions and groups.
3. Analytics exist to answer two different questions for two different roles (learner: "how am I doing," training manager: "which module is failing people") — design each analytics surface for its actual reader, not a shared generic dashboard.
4. French-first copy and B2B plan-gating are durable facts, not incidental — respect them in any new surface or copy work.

## Accessibility & Inclusion

No product-specific accessibility requirement established yet; follow platform-standard web accessibility baselines (WCAG AA) absent other direction.
