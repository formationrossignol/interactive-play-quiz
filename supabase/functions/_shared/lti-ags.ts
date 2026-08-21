// LTI-004 — Assignment and Grade Services: the real HTTP primitives against
// a platform's AGS endpoints (LineItem read/create, Score POST). Pure
// functions taking an already-fetched Bearer access token (from
// fetchLtiServiceToken(), _shared/lti-signing.ts) — no signing/token logic
// duplicated here, this file only knows the AGS resource shapes and content
// types (IMS Names and Role Provisioning / Assignment and Grade Services
// spec, 1EdTech), not how to get authorized to call them.
//
// scoreMaximum is never invented here: fetchLtiLineItem() reads the
// platform's own declared value for an already-existing line item;
// createLtiLineItem() requires the caller to supply one (this tool creating
// a line item means THIS TOOL is declaring what it's grading out of — that
// number has to come from real Brivia content, never a placeholder).
const LINEITEM_CONTENT_TYPE = "application/vnd.ims.lis.v2.lineitem+json";
const SCORE_CONTENT_TYPE = "application/vnd.ims.lis.v1.score+json";

export interface LtiLineItem {
  id: string;
  scoreMaximum: number;
  label: string;
}

export type LtiAgsErrorReason = "line_item_fetch_failed" | "line_item_create_failed" | "score_post_failed";

export class LtiAgsError extends Error {
  constructor(public reason: LtiAgsErrorReason, message: string) {
    super(message);
  }
}

/** GET an already-existing LineItem resource — used when the platform sent
 *  (or this tool previously created) a concrete `line_item_url`, so this
 *  tool can learn the platform's own scoreMaximum/label rather than
 *  guessing them. */
export async function fetchLtiLineItem(lineItemUrl: string, accessToken: string): Promise<LtiLineItem> {
  const resp = await fetch(lineItemUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: LINEITEM_CONTENT_TYPE },
  });
  if (!resp.ok) {
    throw new LtiAgsError("line_item_fetch_failed", `LineItem GET returned ${resp.status}`);
  }
  const json = await resp.json().catch(() => null) as Partial<LtiLineItem> | null;
  if (!json || typeof json.scoreMaximum !== "number") {
    throw new LtiAgsError("line_item_fetch_failed", "LineItem response had no numeric scoreMaximum");
  }
  return { id: lineItemUrl, scoreMaximum: json.scoreMaximum, label: typeof json.label === "string" ? json.label : "" };
}

/** POST to the platform's lineitems collection to create a new LineItem —
 *  the actual "création de line item" LTI-004 requires. `scoreMaximum` and
 *  `label` must come from real Brivia content the caller is actually
 *  grading; this function does not default or invent either. */
export async function createLtiLineItem(
  lineItemsUrl: string,
  accessToken: string,
  body: { scoreMaximum: number; label: string; resourceLinkId?: string },
): Promise<LtiLineItem> {
  const resp = await fetch(lineItemsUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": LINEITEM_CONTENT_TYPE,
    },
    body: JSON.stringify({
      scoreMaximum: body.scoreMaximum,
      label: body.label,
      ...(body.resourceLinkId ? { resourceLinkId: body.resourceLinkId } : {}),
    }),
  });
  if (!resp.ok) {
    throw new LtiAgsError("line_item_create_failed", `LineItem POST returned ${resp.status}`);
  }
  const json = await resp.json().catch(() => null) as Partial<LtiLineItem> | null;
  if (!json || typeof json.id !== "string") {
    throw new LtiAgsError("line_item_create_failed", "LineItem creation response had no id (the new lineitem's URL)");
  }
  return { id: json.id, scoreMaximum: body.scoreMaximum, label: body.label };
}

export interface LtiScorePayload {
  userId: string;
  scoreGiven: number;
  scoreMaximum: number;
  activityProgress: "Initialized" | "Started" | "InProgress" | "Submitted" | "Completed";
  gradingProgress: "FullyGraded" | "Pending" | "PendingManual" | "Failed" | "NotReady";
  timestamp: string;
}

/** Builds the Score resource payload — pure, unit-testable without a
 *  network call. Kept separate from the POST itself so the idempotency
 *  property ("the same queued row always produces the same payload") is
 *  something a test can assert directly. */
export function buildLtiScorePayload(args: {
  externalSubject: string;
  scoreGiven: number;
  scoreMaximum: number;
  timestamp: Date;
}): LtiScorePayload {
  return {
    userId: args.externalSubject,
    scoreGiven: args.scoreGiven,
    scoreMaximum: args.scoreMaximum,
    activityProgress: "Completed",
    gradingProgress: "FullyGraded",
    timestamp: args.timestamp.toISOString(),
  };
}

/** POSTs a Score resource to `{lineItemUrl}/scores`. The AGS spec defines
 *  Score submission as create-only (each POST is a new, timestamped Score
 *  record — there is no "update" verb): idempotency at THIS layer means
 *  "the same logical grade change is never enqueued as two different queue
 *  rows" (lti_ags_score_queue's unique(grade_item_id, learner_id) + upsert,
 *  20260821030000_lti_ags.sql), not "posting twice is harmless" — a queued
 *  row must transition atomically out of 'pending' so a retry-after-success
 *  can't resend, which is the caller's (dispatch-lti-ags-scores) job, not
 *  this function's. */
export async function postLtiScore(
  lineItemUrl: string,
  accessToken: string,
  payload: LtiScorePayload,
  signal?: AbortSignal,
): Promise<void> {
  const resp = await fetch(`${lineItemUrl}/scores`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": SCORE_CONTENT_TYPE,
    },
    body: JSON.stringify(payload),
    signal,
  });
  if (!resp.ok) {
    throw new LtiAgsError("score_post_failed", `Score POST returned ${resp.status}`);
  }
}
