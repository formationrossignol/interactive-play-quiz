/** Pure OneRoster results.csv row-building (ROS-005) — split out of
 *  oneRosterExport.ts so it's testable without a live Supabase client:
 *  oneRosterExport.ts imports `@/lib/supabase` at module scope, which
 *  constructs a real client (and throws without env vars) purely as an
 *  import side effect, unrelated to what this function actually needs. */

export function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export interface OneRosterResultRecord {
  gradeItemId: string;
  gradeItemExternalId: string | null;
  learnerId: string;
  learnerExternalId: string | null;
  points: number;
  maxPoints: number;
  publishedAt: string;
}

/** OneRoster 1.2's real `results.csv` column set — sourcedId/status/
 *  dateLastModified/lineItemSourcedId/studentSourcedId/scoreStatus/score/
 *  scoreDate/comment — never this app's own gradebook display columns.
 *  Falls back to Brivia's own ids when no external_mappings row exists for
 *  a given grade_item/learner, never invents a fake sourcedId. */
export function buildOneRosterResultsRows(records: OneRosterResultRecord[]): string[][] {
  const header = ["sourcedId", "status", "dateLastModified", "lineItemSourcedId", "studentSourcedId", "scoreStatus", "score", "scoreDate", "comment"];
  const rows = records.map((r) => [
    `${r.gradeItemId}:${r.learnerId}`,
    "active",
    r.publishedAt,
    r.gradeItemExternalId ?? r.gradeItemId,
    r.learnerExternalId ?? r.learnerId,
    "fully graded",
    String(r.points),
    r.publishedAt,
    "",
  ]);
  return [header, ...rows];
}
