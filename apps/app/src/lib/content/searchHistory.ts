// Recent search history for GlobalSearch/CommandPalette — REQ-SRC-004.
// Per-user, capped, most-recent-first. Pure localStorage I/O, kept out of
// the component so it's independently testable.

const MAX_RECENT = 5;
const keyFor = (userId: string) => `recent-searches-${userId}`;

export function getRecentSearches(userId: string): string[] {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(userId: string, query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return getRecentSearches(userId);
  const existing = getRecentSearches(userId).filter((q) => q.toLowerCase() !== trimmed.toLowerCase());
  const next = [trimmed, ...existing].slice(0, MAX_RECENT);
  try { localStorage.setItem(keyFor(userId), JSON.stringify(next)); } catch { /* storage unavailable — non-critical */ }
  return next;
}

export function removeRecentSearch(userId: string, query: string): string[] {
  const next = getRecentSearches(userId).filter((q) => q !== query);
  try { localStorage.setItem(keyFor(userId), JSON.stringify(next)); } catch { /* ignore */ }
  return next;
}
