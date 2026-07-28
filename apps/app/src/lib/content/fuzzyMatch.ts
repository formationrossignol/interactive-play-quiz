/** Pure Levenshtein edit distance — no I/O, small strings only (query/title
 *  lengths), so the classic O(n*m) DP table is plenty fast. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,        // deletion
        curr[j - 1] + 1,    // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

const normalize = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Typo-tolerant match score for `query` against `title` — REQ-SRC-005.
 * Lower is better; `null` means "not a match". An exact substring hit
 * always scores 0 (best); otherwise the query is compared against the
 * title as a whole and against each individual word, tolerating up to
 * ~1 edit per 3 characters (so "quizz" still finds "quiz", "shema" finds
 * "schéma").
 */
export function fuzzyScore(query: string, title: string): number | null {
  const q = normalize(query);
  const t = normalize(title);
  if (!q) return null;
  if (t.includes(q)) return 0;

  const threshold = Math.max(1, Math.floor(q.length / 3));
  let best = levenshtein(q, t.length > q.length + 4 ? t.slice(0, q.length + 4) : t);
  for (const word of t.split(/\s+/)) {
    if (!word) continue;
    const d = levenshtein(q, word);
    if (d < best) best = d;
  }
  return best <= threshold ? best : null;
}
