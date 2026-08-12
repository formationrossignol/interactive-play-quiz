export { parseSpreadsheetRows } from "@/lib/importSpreadsheet";
import type { ResolvedOrgMember } from "./enrollment";

/** ENR-014: "Import prévisualisé avec mapping email/identifiant, détection
 *  des doublons et rapport téléchargeable." Person-matching itself happens
 *  server-side (resolve_org_members_by_identifier() — an identifier can only
 *  resolve to an existing member of the target org, never a new account),
 *  this module turns that resolution plus the raw file into a per-row
 *  report: `unmatched` (identifier didn't resolve), `duplicate` (same
 *  identifier appears twice — only the first counts), `already_enrolled`
 *  (real learner, already has an active enrollment in this session — still
 *  importable, enroll_in_session() is idempotent, but worth surfacing
 *  before import rather than discovering it silently after), `ok`. */

export type EnrollmentImportStatus = "ok" | "unmatched" | "duplicate" | "already_enrolled";

export interface EnrollmentPreviewRow {
  rowIndex: number;
  rawIdentifier: string;
  learnerId: string | null;
  matchedLabel: string | null;
  status: EnrollmentImportStatus;
}

function normalizeIdentifier(value: string): string {
  return value.trim().replace(/^@/, "").toLowerCase();
}

/** Non-empty identifier values from the data rows (row 0 = headers), for
 *  passing to resolve_org_members_by_identifier(). */
export function extractIdentifierColumn(rawRows: string[][], identifierColIndex: number): string[] {
  return rawRows.slice(1).map((row) => (row[identifierColIndex] ?? "").trim()).filter(Boolean);
}

export function buildEnrollmentPreview(
  rawRows: string[][],
  identifierColIndex: number,
  resolved: ResolvedOrgMember[],
  alreadyEnrolledLearnerIds: Set<string>,
): EnrollmentPreviewRow[] {
  const byIdentifier = new Map<string, ResolvedOrgMember>();
  for (const match of resolved) byIdentifier.set(normalizeIdentifier(match.identifier), match);
  const seenLearnerIds = new Set<string>();
  const dataRows = rawRows.slice(1);

  return dataRows.map((row, index) => {
    const rawIdentifier = (row[identifierColIndex] ?? "").trim();
    if (!rawIdentifier) {
      return { rowIndex: index, rawIdentifier, learnerId: null, matchedLabel: null, status: "unmatched" as const };
    }
    const match = byIdentifier.get(normalizeIdentifier(rawIdentifier));
    if (!match) {
      return { rowIndex: index, rawIdentifier, learnerId: null, matchedLabel: null, status: "unmatched" as const };
    }
    const matchedLabel = match.username ? `@${match.username}` : match.identifier;
    if (seenLearnerIds.has(match.learner_id)) {
      return { rowIndex: index, rawIdentifier, learnerId: match.learner_id, matchedLabel, status: "duplicate" as const };
    }
    seenLearnerIds.add(match.learner_id);
    if (alreadyEnrolledLearnerIds.has(match.learner_id)) {
      return { rowIndex: index, rawIdentifier, learnerId: match.learner_id, matchedLabel, status: "already_enrolled" as const };
    }
    return { rowIndex: index, rawIdentifier, learnerId: match.learner_id, matchedLabel, status: "ok" as const };
  });
}

/** Both `ok` and `already_enrolled` get sent to enroll_in_session() — the
 *  latter is a no-op there, this just avoids treating a legitimate
 *  already-active learner as something to exclude from the import run. */
export function importableEnrollmentRows(preview: EnrollmentPreviewRow[]): Array<{ learnerId: string }> {
  return preview
    .filter((row): row is EnrollmentPreviewRow & { learnerId: string } => (row.status === "ok" || row.status === "already_enrolled") && row.learnerId !== null)
    .map((row) => ({ learnerId: row.learnerId }));
}
