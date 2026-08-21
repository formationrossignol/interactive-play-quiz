import { supabase } from "@/lib/supabase";
import { buildOneRosterResultsRows, csvEscape, type OneRosterResultRecord } from "./oneRosterResultsCsv";
export { buildOneRosterResultsRows } from "./oneRosterResultsCsv";

/** ROS-005: outbound gradebook export in OneRoster 1.2's own `results.csv`
 *  shape (sourcedId/status/dateLastModified/lineItemSourcedId/
 *  studentSourcedId/scoreStatus/score/scoreDate/comment — the real OneRoster
 *  column set, not this app's own gradebook display columns) — enabled
 *  per-org via oneroster_export_settings (20260821060000_oneroster.sql),
 *  read directly through RLS (no RPC needed, same convention
 *  analytics_privacy_settings already uses for a staff-readable per-org
 *  settings row). `lineItemSourcedId`/`studentSourcedId` reuse the same
 *  external_mappings.external_id namespacing (`<org_id>:<sourced_id>`)
 *  written by resolve/commit — a grade_item/learner without a prior
 *  OneRoster sourcedId falls back to Brivia's own uuid, still stable and
 *  unique, just not something the receiving SIS will recognize as "its
 *  own" until that entity has gone through an import once. */

export interface OneRosterExportSettings {
  org_id: string;
  enabled: boolean;
  scope: string[];
  updated_at: string;
}

export async function getOneRosterExportSettings(orgId: string): Promise<OneRosterExportSettings | null> {
  const { data, error } = await supabase.from("oneroster_export_settings").select("*").eq("org_id", orgId).maybeSingle();
  if (error) throw error;
  return data as OneRosterExportSettings | null;
}

export async function setOneRosterExportSettings(orgId: string, enabled: boolean, scope: string[]): Promise<void> {
  const { error } = await supabase.from("oneroster_export_settings").upsert({ org_id: orgId, enabled, scope });
  if (error) throw error;
}

function downloadCsv(rows: string[][], filename: string) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Builds and downloads a OneRoster-shaped results.csv for every published
 *  grade_result under org_id's lti-and-non-lti grade_items alike (ROS-005
 *  doesn't scope by source_type — a gradebook export is every real grade
 *  this org has, regardless of where the grade_item itself came from).
 *  Row-building itself lives in oneRosterResultsCsv.ts (independently
 *  testable without a live Supabase connection). */
export async function exportOneRosterResults(orgId: string): Promise<void> {
  const { data: gradeResults, error } = await supabase
    .from("grade_results")
    .select("grade_item_id, learner_id, points, published_at, grade_items!inner(org_id, max_points)")
    .eq("grade_items.org_id", orgId)
    .not("published_at", "is", null)
    .not("points", "is", null);
  if (error) throw error;

  const learnerIds = [...new Set((gradeResults ?? []).map((r) => r.learner_id as string))];

  // No mapping lookup for grade_items: this pass's OneRoster sync never
  // writes a `('oneroster','class', ...)` mapping for a grade_item (classes
  // are resolve-only against course_sessions, see 20260821060000_oneroster.
  // sql's scope decision) — lineItemSourcedId always falls back to Brivia's
  // own grade_item id below, honestly, rather than querying a mapping
  // nothing in this pass ever populates.
  const { data: userMappings } = await supabase
    .from("external_mappings")
    .select("internal_id, external_id")
    .eq("system", "oneroster").eq("object_type", "user").in("internal_id", learnerIds);
  const userExtMap = new Map((userMappings ?? []).map((m) => [m.internal_id as string, m.external_id as string]));

  const records: OneRosterResultRecord[] = (gradeResults ?? []).map((r) => ({
    gradeItemId: r.grade_item_id as string,
    gradeItemExternalId: null,
    learnerId: r.learner_id as string,
    learnerExternalId: userExtMap.get(r.learner_id as string) ?? null,
    points: r.points as number,
    maxPoints: (r as unknown as { grade_items: { max_points: number } }).grade_items.max_points,
    publishedAt: r.published_at as string,
  }));

  downloadCsv(buildOneRosterResultsRows(records), "results.csv");
}
