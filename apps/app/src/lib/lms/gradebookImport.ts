/** GBK-006: "Import CSV/XLSX avec prévisualisation, correspondance des
 *  personnes, validation et rapport d'erreurs." Person-matching and the
 *  preview happen entirely client-side against the session roster the
 *  caller already holds (RLS already scoped it to this session) — no new
 *  identity-resolution endpoint. import_gradebook_csv() (the RPC this feeds)
 *  re-validates enrollment/points server-side regardless; this module's job
 *  is turning a messy uploaded file into a reviewable, per-row report before
 *  a single byte reaches the network. */

export { parseSpreadsheetRows } from "@/lib/importSpreadsheet";

export interface RosterMatchEntry {
  learnerId: string;
  username: string | null;
}

export type ImportRowStatus = "ok" | "unmatched" | "duplicate" | "invalid_points";

export interface ImportPreviewRow {
  rowIndex: number;
  rawIdentifier: string;
  rawPoints: string;
  learnerId: string | null;
  matchedLabel: string | null;
  points: number | null;
  status: ImportRowStatus;
}

function normalizeIdentifier(value: string): string {
  return value.trim().replace(/^@/, "").toLowerCase();
}

function parsePoints(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (normalized === "") return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Builds one preview row per data row (excludes the header row at index 0).
 *  Duplicate identifiers: only the first occurrence is `ok`, later ones are
 *  flagged `duplicate` rather than silently overwriting the first — GBK-006
 *  explicitly asks for doublons to surface, not resolve themselves. */
export function buildImportPreview(
  rawRows: string[][],
  identifierColIndex: number,
  pointsColIndex: number,
  roster: RosterMatchEntry[],
  maxPoints: number,
): ImportPreviewRow[] {
  const byUsername = new Map<string, RosterMatchEntry>();
  for (const entry of roster) {
    if (entry.username) byUsername.set(normalizeIdentifier(entry.username), entry);
  }
  const seenLearnerIds = new Set<string>();
  const dataRows = rawRows.slice(1);

  return dataRows.map((row, index) => {
    const rawIdentifier = row[identifierColIndex] ?? "";
    const rawPoints = row[pointsColIndex] ?? "";
    const match = byUsername.get(normalizeIdentifier(rawIdentifier));
    const points = parsePoints(rawPoints);

    if (!match) {
      return { rowIndex: index, rawIdentifier, rawPoints, learnerId: null, matchedLabel: null, points, status: "unmatched" as const };
    }
    if (seenLearnerIds.has(match.learnerId)) {
      return { rowIndex: index, rawIdentifier, rawPoints, learnerId: match.learnerId, matchedLabel: `@${match.username}`, points, status: "duplicate" as const };
    }
    if (points === null || points < 0 || points > maxPoints) {
      return { rowIndex: index, rawIdentifier, rawPoints, learnerId: match.learnerId, matchedLabel: `@${match.username}`, points, status: "invalid_points" as const };
    }
    seenLearnerIds.add(match.learnerId);
    return { rowIndex: index, rawIdentifier, rawPoints, learnerId: match.learnerId, matchedLabel: `@${match.username}`, points, status: "ok" as const };
  });
}

export function validImportRows(preview: ImportPreviewRow[]): Array<{ learnerId: string; points: number }> {
  return preview
    .filter((row): row is ImportPreviewRow & { learnerId: string; points: number } => row.status === "ok" && row.learnerId !== null && row.points !== null)
    .map((row) => ({ learnerId: row.learnerId, points: row.points }));
}
