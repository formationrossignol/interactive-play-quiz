// LTI-003 — Names and Role Provisioning Service: the real HTTP primitive
// against a platform's NRPS endpoint (roster GET), and the LTI role URN →
// Brivia role mapping. Mirrors _shared/lti-ags.ts's shape: pure functions
// taking an already-fetched Bearer access token (from fetchLtiServiceToken(),
// _shared/lti-signing.ts) — no signing/token logic duplicated here.
const MEMBERSHIP_CONTENT_TYPE = "application/vnd.ims.lti-nrps.v2.membershipcontainer+json";

export interface LtiRosterMember {
  userId: string;
  status: string | null;
  name: string | null;
  email: string | null;
  roles: string[];
}

export type LtiNrpsErrorReason = "membership_fetch_failed";

export class LtiNrpsError extends Error {
  constructor(public reason: LtiNrpsErrorReason, message: string) {
    super(message);
  }
}

/** GET the platform's context membership container (IMS NRPS 2.0) — real
 *  HTTP, never mocked. `userId` (the member's own `sub` at that platform) is
 *  the only field required per-member; a member row missing it is dropped
 *  rather than surfaced as a synced-but-unidentifiable roster entry. */
export async function fetchLtiContextMembership(contextMembershipsUrl: string, accessToken: string): Promise<LtiRosterMember[]> {
  const resp = await fetch(contextMembershipsUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: MEMBERSHIP_CONTENT_TYPE },
  });
  if (!resp.ok) {
    throw new LtiNrpsError("membership_fetch_failed", `Membership GET returned ${resp.status}`);
  }
  const json = await resp.json().catch(() => null) as { members?: unknown } | null;
  if (!json || !Array.isArray(json.members)) {
    throw new LtiNrpsError("membership_fetch_failed", "Membership response had no members array");
  }
  const members: LtiRosterMember[] = [];
  for (const raw of json.members as Record<string, unknown>[]) {
    if (typeof raw.user_id !== "string" || !raw.user_id) continue;
    members.push({
      userId: raw.user_id,
      status: typeof raw.status === "string" ? raw.status : null,
      name: typeof raw.name === "string" ? raw.name : null,
      email: typeof raw.email === "string" ? raw.email : null,
      roles: Array.isArray(raw.roles) ? raw.roles.filter((r): r is string => typeof r === "string") : [],
    });
  }
  return members;
}

export type BriviaRole = "learner" | "trainer" | "pedago" | "registrar" | "admin";

// LTI's context-role vocabulary (IMS LIS v2 membership) → Brivia's own role
// enum. Deliberately narrow and conservative:
//   - Instructor/TeachingAssistant → trainer (the course-scoped teaching
//     role Brivia already has — the closest real match).
//   - Learner → learner.
//   - Everything else (ContentDeveloper, Mentor, Manager, and critically any
//     *Administrator* role at context or institution level) maps to
//     nothing — no Brivia role is granted for it. This is a deliberate
//     security boundary, not an oversight: 'admin' in Brivia controls
//     billing and every org's data; a roster entry claiming an
//     Administrator-shaped LTI role must never be able to silently grant
//     platform-admin access to a Brivia account via an automated sync. If
//     that mapping is ever wanted, it has to be a deliberate, reviewed
//     product decision — not inferred here from an external platform's own
//     (unverifiable, from this tool's point of view) role claim.
const LTI_ROLE_TO_BRIVIA_ROLE: Record<string, BriviaRole> = {
  "http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor": "trainer",
  "http://purl.imsglobal.org/vocab/lis/v2/membership#TeachingAssistant": "trainer",
  "http://purl.imsglobal.org/vocab/lis/v2/membership#Learner": "learner",
};

/** A member can carry several LTI role URNs at once — resolves to every
 *  distinct Brivia role any of them maps to (deduped), never more than one
 *  role per URN, never an Administrator-shaped mapping (see above). Returns
 *  an empty array (not a guess) for a member whose roles are entirely
 *  outside the mapped set — e.g. ContentDeveloper-only. */
export function mapLtiRolesToBriviaRoles(ltiRoles: string[]): BriviaRole[] {
  const resolved = new Set<BriviaRole>();
  for (const role of ltiRoles) {
    const mapped = LTI_ROLE_TO_BRIVIA_ROLE[role];
    if (mapped) resolved.add(mapped);
  }
  return [...resolved];
}
