/** Spec 10 — L10N-002: structured segment extraction from a content
 *  snapshot, "sans casser variables, formules, réponses ou mise en forme."
 *
 *  Generic across content types, same posture as contentDiff.ts: this
 *  codebase's builders each have their own JSON shape under content.data,
 *  and this program has repeatedly declined to guess a fixed per-type
 *  schema (competency tag migration, content diffing, reusable blocks).
 *
 *  TRANSLATABLE_KEYS is an *allowlist*, not a denylist — the conservative
 *  choice. An unknown technical field (an id, a type discriminator, a
 *  correct-answer key, a color hex, a storage path) is left untouched
 *  rather than risking translation of something that would silently break
 *  scoring or structure. The cost is real: a text field this codebase
 *  names differently than the list below won't be picked up. That's a
 *  documented limitation, not a silent one — extractTranslationSegments()
 *  only ever touches keys in this set.
 *
 *  Placeholder/variable syntax inside an extracted string (e.g.
 *  "{{name}}") is NOT parsed or protected automatically — preserving it is
 *  the translator's own responsibility when editing translated_text, same
 *  as any manual translation workflow. Automatic placeholder-preservation
 *  checking is a real feature this doesn't build.
 */

const TRANSLATABLE_KEYS: ReadonlySet<string> = new Set([
  'title', 'text', 'content', 'description', 'label', 'prompt', 'body',
  'question', 'answer', 'name', 'overview', 'note', 'message', 'summary',
  'objectives', 'changelog', 'alt_text', 'altText',
]);

export interface ExtractedSegment {
  path: string;
  source_text: string;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function walk(value: unknown, path: string, out: ExtractedSegment[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, i) => walk(item, `${path}[${i}]`, out));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      if (TRANSLATABLE_KEYS.has(key) && typeof child === 'string' && child.trim().length > 0) {
        out.push({ path: childPath, source_text: child });
      } else {
        walk(child, childPath, out);
      }
    }
  }
}

/** Deterministic path order (matches insertion/traversal order) — stable
 *  across repeated calls on the same snapshot, so sync_translation_segments()
 *  diffing against previously-stored paths behaves predictably. */
export function extractTranslationSegments(snapshot: Record<string, unknown>): ExtractedSegment[] {
  const out: ExtractedSegment[] = [];
  walk(snapshot, '', out);
  return out;
}

/** Path syntax: dot for object keys, `[n]` for array indices — e.g.
 *  "modules[0].lessons[2].content". Parses and walks the snapshot to the
 *  addressed location and replaces it in a deep-cloned copy. */
function setAtPath(root: Record<string, unknown>, path: string, value: string): void {
  const tokens = path.match(/[^.[\]]+/g);
  if (!tokens || tokens.length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cursor: any = root;
  for (let i = 0; i < tokens.length - 1; i++) {
    const t = tokens[i];
    const key = /^\d+$/.test(t) ? Number(t) : t;
    if (cursor == null || typeof cursor !== 'object') return;
    cursor = cursor[key];
  }
  const last = tokens[tokens.length - 1];
  const lastKey = /^\d+$/.test(last) ? Number(last) : last;
  if (cursor != null && typeof cursor === 'object') {
    cursor[lastKey] = value;
  }
}

export interface TranslatedSegment {
  path: string;
  translated_text: string | null;
}

/** L10N-005's "validation dans la prévisualisation réelle": rebuilds a full
 *  snapshot with every segment's translated_text substituted in — falls
 *  back to the original (source-language) value wherever a segment hasn't
 *  been translated yet, so a partial translation still previews as valid,
 *  readable content rather than blank gaps. */
export function applyTranslations(snapshot: Record<string, unknown>, segments: TranslatedSegment[]): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>;
  for (const seg of segments) {
    if (seg.translated_text && seg.translated_text.trim().length > 0) {
      setAtPath(clone, seg.path, seg.translated_text);
    }
  }
  return clone;
}
