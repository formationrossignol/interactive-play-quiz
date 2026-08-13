-- Spec 03 — Compétences, résultats d'apprentissage et preuves
-- (docs/product-specs/2026-08-10-lms-program/03-competencies-outcomes.md),
-- "Migration des tags existants" section.
--
-- Spec text (verbatim): "Inventaire des libellés normalisés par
-- organisation. Proposition de regroupements, sans création automatique
-- définitive. Écran de mapping : tag → compétence existante, nouvelle
-- compétence ou ignoré. Les anciennes tentatives produisent des preuves
-- seulement après confirmation et conservent la mention « import
-- historique »."
--
-- Two real constraints found before writing anything:
--   1. "Par organisation" doesn't hold structurally: existing skill tags
--      live in `content.data.questions[].skills` and
--      `exams.questions_public[].skills` — neither `content` nor `exams`
--      has an `org_id` column at all (grep confirmed), only `user_id`/
--      `host_id`. RLS on `content` is owner-scoped
--      (`content_owner`/`content_public_read`), so a pedago/admin cannot
--      read another org member's private draft content to inventory
--      their tags either. The *discovery* step (scanning for tags) is
--      therefore necessarily scoped to the staff member's own authored
--      content — this migration doesn't touch that RLS boundary. What
--      *is* org-scoped is the decision this table stores: once a tag is
--      mapped or ignored by one pedago/admin, every other org staff
--      member sees the same decision (org_id-scoped read/write), so the
--      governance outcome is genuinely org-wide even though inventory
--      discovery is necessarily per-owner.
--   2. "Anciennes tentatives produisent des preuves" implies backfilling
--      competency_evidence from historical exam/quiz attempts per
--      learner — this needs a join to attempt-level response data with a
--      scoring formula the spec never defines (what counts as "mastered"
--      from a raw correct/incorrect ratio? what raw_score?), and it's
--      the exact kind of legacy-quiz-to-competency-system reconciliation
--      RESTE-A-FAIRE.md's own "Réconciliation" section already flags as
--      a separate, explicitly-left-open data-migration project ("Banque
--      d'items... sans lien vers les questions de quiz existantes...
--      projet de migration de données à part entière"). Not attempted
--      here — this migration delivers the mapping/decision screen only;
--      evidence backfill from historical attempts stays open.
create table public.competency_tag_mappings (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  tag           text not null,
  decision      text not null default 'pending' check (decision in ('pending', 'mapped', 'ignored')),
  competency_id uuid references public.competencies(id) on delete set null,
  decided_by    uuid references auth.users(id),
  decided_at    timestamptz,
  created_at    timestamptz not null default now(),
  unique (org_id, tag)
);

alter table public.competency_tag_mappings enable row level security;

create policy competency_tag_mappings_read on public.competency_tag_mappings
  for select using (public.has_org_role(org_id, array['trainer', 'pedago', 'registrar', 'admin']));
create policy competency_tag_mappings_manage on public.competency_tag_mappings
  for all using (public.has_org_role(org_id, array['pedago', 'admin']))
  with check (public.has_org_role(org_id, array['pedago', 'admin']));
