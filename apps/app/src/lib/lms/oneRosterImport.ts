export { parseSpreadsheetRows } from "@/lib/importSpreadsheet";

/** OneRoster 1.2 CSV column names (real spec — `users.csv`/`enrollments.csv`),
 *  looked up by header name rather than fixed position: a provider's export
 *  can order columns differently, and OneRoster only guarantees the column
 *  *names*, not their order. */
const USERS_COLUMNS = { sourcedId: "sourcedId", email: "email", status: "status" } as const;
const ENROLLMENTS_COLUMNS = { sourcedId: "sourcedId", userSourcedId: "userSourcedId", classSourcedId: "classSourcedId", status: "status" } as const;

export type OneRosterImportStatus = "ok" | "unmatched" | "duplicate" | "inactive_unknown";

export interface OneRosterUserPreviewRow {
  rowIndex: number;
  sourcedId: string;
  email: string;
  status: string;
  learnerId: string | null;
  outcomeStatus: OneRosterImportStatus;
}

function headerIndex(headerRow: string[], name: string): number {
  return headerRow.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
}

/** Extracts {sourced_id, email} pairs from users.csv's data rows (row 0 =
 *  header), for passing to resolve_oneroster_users(). Rows with no
 *  sourcedId or email are skipped here — they can never resolve to
 *  anything and would just clutter resolve_oneroster_users()'s input. */
export function extractOneRosterUserRows(rawRows: string[][]): Array<{ sourced_id: string; email: string; status: string }> {
  if (rawRows.length === 0) return [];
  const header = rawRows[0];
  const sourcedIdIdx = headerIndex(header, USERS_COLUMNS.sourcedId);
  const emailIdx = headerIndex(header, USERS_COLUMNS.email);
  const statusIdx = headerIndex(header, USERS_COLUMNS.status);
  if (sourcedIdIdx < 0 || emailIdx < 0) return [];
  return rawRows
    .slice(1)
    .map((row) => ({
      sourced_id: (row[sourcedIdIdx] ?? "").trim(),
      email: (row[emailIdx] ?? "").trim(),
      status: statusIdx >= 0 ? (row[statusIdx] ?? "active").trim() : "active",
    }))
    .filter((r) => r.sourced_id && r.email);
}

/** Builds the dry-run preview: per-row outcome BEFORE any write. `resolved`
 *  comes from resolve_oneroster_users() (server-side, real org-membership
 *  check) — this function only assembles the report, it performs no
 *  resolution logic of its own. */
export function buildOneRosterUserPreview(
  rows: Array<{ sourced_id: string; email: string; status: string }>,
  resolved: Array<{ sourced_id: string; email: string; learner_id: string | null; matched: boolean }>,
): OneRosterUserPreviewRow[] {
  const byId = new Map(resolved.map((r) => [r.sourced_id, r]));
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const match = byId.get(row.sourced_id);
    const learnerId = match?.learner_id ?? null;
    if (!match || !match.matched) {
      return { rowIndex: index, sourcedId: row.sourced_id, email: row.email, status: row.status, learnerId: null, outcomeStatus: "unmatched" as const };
    }
    if (seen.has(row.sourced_id)) {
      return { rowIndex: index, sourcedId: row.sourced_id, email: row.email, status: row.status, learnerId, outcomeStatus: "duplicate" as const };
    }
    seen.add(row.sourced_id);
    return { rowIndex: index, sourcedId: row.sourced_id, email: row.email, status: row.status, learnerId, outcomeStatus: "ok" as const };
  });
}

/** Only `ok` rows (matched, not a duplicate) are ever committed —
 *  unmatched/duplicate rows stay report-only, same "never guess" posture
 *  as every other roster-sync path this session built. */
export function importableOneRosterUserRows(preview: OneRosterUserPreviewRow[]): Array<{ sourced_id: string; email: string; learner_id: string }> {
  return preview
    .filter((r): r is OneRosterUserPreviewRow & { learnerId: string } => r.outcomeStatus === "ok" && r.learnerId !== null)
    .map((r) => ({ sourced_id: r.sourcedId, email: r.email, learner_id: r.learnerId }));
}

export interface OneRosterEnrollmentPreviewRow {
  rowIndex: number;
  sourcedId: string;
  userSourcedId: string;
  classSourcedId: string;
  status: string;
  learnerId: string | null;
  sessionId: string | null;
  outcomeStatus: OneRosterImportStatus;
}

export function extractOneRosterEnrollmentRows(rawRows: string[][]): Array<{ sourced_id: string; user_sourced_id: string; class_sourced_id: string; status: string }> {
  if (rawRows.length === 0) return [];
  const header = rawRows[0];
  const sourcedIdIdx = headerIndex(header, ENROLLMENTS_COLUMNS.sourcedId);
  const userIdx = headerIndex(header, ENROLLMENTS_COLUMNS.userSourcedId);
  const classIdx = headerIndex(header, ENROLLMENTS_COLUMNS.classSourcedId);
  const statusIdx = headerIndex(header, ENROLLMENTS_COLUMNS.status);
  if (sourcedIdIdx < 0 || userIdx < 0 || classIdx < 0) return [];
  return rawRows
    .slice(1)
    .map((row) => ({
      sourced_id: (row[sourcedIdIdx] ?? "").trim(),
      user_sourced_id: (row[userIdx] ?? "").trim(),
      class_sourced_id: (row[classIdx] ?? "").trim(),
      status: statusIdx >= 0 ? (row[statusIdx] ?? "active").trim() : "active",
    }))
    .filter((r) => r.sourced_id && r.user_sourced_id && r.class_sourced_id);
}

/** Both the user and the class must already resolve (via
 *  resolve_oneroster_users()/resolve_oneroster_classes()) for an enrollment
 *  row to be importable — an enrollment naming an unknown person or an
 *  unknown class is unmatched, never partially applied. */
export function buildOneRosterEnrollmentPreview(
  rows: Array<{ sourced_id: string; user_sourced_id: string; class_sourced_id: string; status: string }>,
  userMap: Map<string, string>,
  classMap: Map<string, string>,
): OneRosterEnrollmentPreviewRow[] {
  return rows.map((row, index) => {
    const learnerId = userMap.get(row.user_sourced_id) ?? null;
    const sessionId = classMap.get(row.class_sourced_id) ?? null;
    const outcomeStatus: OneRosterImportStatus = learnerId && sessionId ? "ok" : "unmatched";
    return {
      rowIndex: index, sourcedId: row.sourced_id, userSourcedId: row.user_sourced_id,
      classSourcedId: row.class_sourced_id, status: row.status, learnerId, sessionId, outcomeStatus,
    };
  });
}

export function importableOneRosterEnrollmentRows(preview: OneRosterEnrollmentPreviewRow[]): Array<{ sourced_id: string; learner_id: string; session_id: string; status: string }> {
  return preview
    .filter((r): r is OneRosterEnrollmentPreviewRow & { learnerId: string; sessionId: string } => r.outcomeStatus === "ok" && r.learnerId !== null && r.sessionId !== null)
    .map((r) => ({ sourced_id: r.sourcedId, learner_id: r.learnerId, session_id: r.sessionId, status: r.status }));
}
