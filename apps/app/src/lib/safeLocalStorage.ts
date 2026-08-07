import { StorageQuotaError } from './errorTaxonomy';

function isQuotaExceeded(e: unknown): boolean {
  return e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);
}

/** Frees space by dropping stale `quiz-`/`poll-` one-shot play-cache entries
 *  (written by quizStorage.ts's setQuizPlayCache) — these accumulate forever,
 *  one per quiz/poll ever launched on this device, and are the most common
 *  cause of localStorage filling up on a long-lived browser profile.
 *  Duplicated here rather than imported from quizStorage.ts to keep this
 *  module free of quizStorage's auth -> supabase dependency chain, same
 *  reasoning as errorTaxonomy.ts's StorageQuotaError. */
function purgeStalePlayCaches(): void {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && (k.startsWith('quiz-') || k.startsWith('poll-'))) localStorage.removeItem(k);
  }
}

/** Quota-safe localStorage write for any JSON-serializable value: on
 *  QuotaExceededError, purges stale play caches and retries once before
 *  raising an actionable StorageQuotaError instead of letting a raw
 *  DOMException reach the UI as an unclassified crash. */
export function safeSetItem(key: string, value: unknown, quotaMessage?: string): void {
  const payload = JSON.stringify(value);
  try {
    localStorage.setItem(key, payload);
  } catch (e) {
    if (!isQuotaExceeded(e)) throw e;
    purgeStalePlayCaches();
    try {
      localStorage.setItem(key, payload);
    } catch {
      throw new StorageQuotaError(quotaMessage);
    }
  }
}
