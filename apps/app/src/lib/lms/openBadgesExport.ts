/** Spec 03 — "Export CASE 1.1 / Open Badges" (cross-reference in
 *  03-competencies-outcomes.md never names a concrete artifact or trigger
 *  point; user chose to build a real, working export over documenting the
 *  existing stable-ID scheme). Open Badges 2.0 (JSON-LD, badgr/1EdTech)
 *  chosen over CASE 1.1: CASE models curriculum frameworks as a document
 *  tree with no notion of a learner assertion, so it can't represent
 *  "this learner mastered this competency" on its own — Open Badges maps
 *  directly onto the Achievement (≈ competency) / Assertion (≈
 *  competency_mastery row) split this codebase already has.
 *
 *  No hosted HTTPS badge endpoint exists (would need a public
 *  badge-hosting service this codebase doesn't have), so `id` fields use
 *  `urn:uuid:<competency/mastery id>` — an honest, stable-but-unresolvable
 *  identifier rather than a fake https:// URL that would 404. Recipient
 *  identity is a salted SHA-256 hash of the learner's email, per the OB
 *  2.0 `IdentityObject` spec (`hashed: true`), so the exported JSON never
 *  carries a plaintext email. */

import type { Competency, CompetencyMastery } from './competencies';

const OB_CONTEXT = 'https://w3id.org/openbadges/v2';

async function hashEmail(email: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${email.trim().toLowerCase()}${salt}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `sha256$${hex}`;
}

function downloadJson(payload: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/ld+json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export interface OpenBadgesIssuer {
  orgId: string;
  name: string;
  url: string;
}

/** Achievement (≈ BadgeClass) for one competency — staff-facing, no
 *  learner identity involved. */
export function buildCompetencyAchievement(competency: Competency, title: string, issuer: OpenBadgesIssuer) {
  return {
    '@context': OB_CONTEXT,
    type: 'BadgeClass',
    id: `urn:uuid:${competency.id}`,
    name: title,
    description: `Compétence ${competency.code}`,
    image: undefined,
    criteria: { narrative: `Maîtrise de la compétence « ${title} » (code ${competency.code}).` },
    issuer: {
      type: 'Issuer',
      id: `urn:uuid:${issuer.orgId}`,
      name: issuer.name,
      url: issuer.url,
    },
  };
}

export async function exportCompetencyAchievement(competency: Competency, title: string, issuer: OpenBadgesIssuer): Promise<void> {
  const achievement = buildCompetencyAchievement(competency, title, issuer);
  downloadJson(achievement, `achievement_${competency.code}.json`);
}

/** Assertion (≈ learner badge) for one competency_mastery row. Embeds the
 *  Achievement rather than linking it (same unresolvable-id reasoning as
 *  above — a bare id link would point nowhere without a hosting
 *  endpoint). */
export async function exportMasteryAssertion(
  mastery: CompetencyMastery,
  competency: Competency,
  competencyTitle: string,
  learnerEmail: string,
  issuer: OpenBadgesIssuer,
): Promise<void> {
  const salt = crypto.randomUUID();
  const hashed = await hashEmail(learnerEmail, salt);
  const assertion = {
    '@context': OB_CONTEXT,
    type: 'Assertion',
    id: `urn:uuid:${mastery.id}`,
    recipient: { type: 'email', hashed: true, salt, identity: hashed },
    badge: buildCompetencyAchievement(competency, competencyTitle, issuer),
    issuedOn: mastery.computed_at,
    verification: { type: 'hosted' },
    evidence: undefined,
    extensions: { level_code: mastery.level_code, org_id: mastery.org_id },
  };
  downloadJson(assertion, `badge_${competency.code}.json`);
}
