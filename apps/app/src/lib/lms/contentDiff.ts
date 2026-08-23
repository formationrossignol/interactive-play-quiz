/** CNT-003 — structural comparison between two content_versions snapshots
 *  (additions/removals/moves/parameter changes). Fully client-side: every
 *  content_versions row already carries a full immutable jsonb snapshot
 *  (20260811000000_content_governance.sql), nothing new to store.
 *
 *  This is a *generic* deep diff, not a per-type one. The spec's "vue
 *  adaptée au type" (a quiz-shaped diff view vs a course-shaped one) is not
 *  built — every builder in this codebase has its own JSON shape under
 *  content.data, and guessing a schema per type here would repeat exactly
 *  the mistake this program already made and walked back for competency
 *  tag migration (spec 03) and drag-drop/hotspot (spec 05): assuming a
 *  content shape nothing actually enforces. What IS real: array items
 *  carrying a stable `id` field (true for questions/options across this
 *  codebase's quiz/exam/assessment builders) are matched by id rather than
 *  position, so reordering shows as a move, not as N unrelated
 *  additions+removals — that heuristic degrades to plain positional
 *  diffing when items have no `id`, documented below, not silently wrong. */

export type DiffChange =
  | { kind: "added"; path: string; value: unknown }
  | { kind: "removed"; path: string; value: unknown }
  | { kind: "changed"; path: string; oldValue: unknown; newValue: unknown }
  | { kind: "moved"; path: string; fromIndex: number; toIndex: number };

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k) => Object.prototype.hasOwnProperty.call(bObj, k) && deepEqual(aObj[k], bObj[k]));
  }
  return false;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** True only when every item in both arrays is an object with a string or
 *  number `id` — the gate for id-based (move-aware) array diffing. */
function hasStableIds(arr: unknown[]): arr is Array<Record<string, unknown>> {
  return arr.length > 0 && arr.every((item) => isPlainObject(item) && (typeof item.id === "string" || typeof item.id === "number"));
}

function diffArrays(path: string, a: unknown[], b: unknown[], out: DiffChange[]): void {
  if (hasStableIds(a) && hasStableIds(b)) {
    const aIndexById = new Map(a.map((item, i) => [item.id, i]));
    const bIndexById = new Map(b.map((item, i) => [item.id, i]));

    for (const [id, aIdx] of aIndexById) {
      if (!bIndexById.has(id)) out.push({ kind: "removed", path: `${path}[${aIdx}]`, value: a[aIdx] });
    }
    for (const [id, bIdx] of bIndexById) {
      const aIdx = aIndexById.get(id);
      if (aIdx === undefined) {
        out.push({ kind: "added", path: `${path}[${bIdx}]`, value: b[bIdx] });
        continue;
      }
      if (aIdx !== bIdx) out.push({ kind: "moved", path: `${path}[id=${id}]`, fromIndex: aIdx, toIndex: bIdx });
      diffValue(`${path}[${bIdx}]`, a[aIdx], b[bIdx], out);
    }
    return;
  }

  // No stable ids on both sides: plain positional diff. An insertion in the
  // middle will show as a run of "changed" entries rather than one "added"
  // — a known, documented limitation of the fallback, not a bug.
  const maxLen = Math.max(a.length, b.length);
  for (let i = 0; i < maxLen; i++) {
    if (i >= a.length) { out.push({ kind: "added", path: `${path}[${i}]`, value: b[i] }); continue; }
    if (i >= b.length) { out.push({ kind: "removed", path: `${path}[${i}]`, value: a[i] }); continue; }
    diffValue(`${path}[${i}]`, a[i], b[i], out);
  }
}

function diffValue(path: string, a: unknown, b: unknown, out: DiffChange[]): void {
  if (deepEqual(a, b)) return;

  if (Array.isArray(a) && Array.isArray(b)) {
    diffArrays(path, a, b, out);
    return;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      const childPath = path ? `${path}.${key}` : key;
      if (!(key in a)) { out.push({ kind: "added", path: childPath, value: b[key] }); continue; }
      if (!(key in b)) { out.push({ kind: "removed", path: childPath, value: a[key] }); continue; }
      diffValue(childPath, a[key], b[key], out);
    }
    return;
  }
  // Type mismatch (e.g. object -> string) or differing primitives: a single change.
  out.push({ kind: "changed", path, oldValue: a, newValue: b });
}

export function diffContentSnapshots(a: Record<string, unknown>, b: Record<string, unknown>): DiffChange[] {
  const out: DiffChange[] = [];
  diffValue("", a, b, out);
  return out;
}

const TRUNCATE_AT = 60;
function summarizeValue(v: unknown): string {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > TRUNCATE_AT ? `${s.slice(0, TRUNCATE_AT)}…` : s;
}

/** One line per change, for a plain-text/UI list — not a structured tree,
 *  the flat form is what CNT-012's deployment diff and CNT-003's version
 *  diff both actually need to render. */
export function describeDiffChange(c: DiffChange): string {
  switch (c.kind) {
    case "added": return `+ ${c.path || "(racine)"} : ${summarizeValue(c.value)}`;
    case "removed": return `− ${c.path || "(racine)"} : ${summarizeValue(c.value)}`;
    case "changed": return `~ ${c.path} : ${summarizeValue(c.oldValue)} → ${summarizeValue(c.newValue)}`;
    case "moved": return `⇅ ${c.path} : position ${c.fromIndex} → ${c.toIndex}`;
  }
}
