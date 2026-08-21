export const DEFAULT_DISPATCH_CONCURRENCY = 10;
export const DEFAULT_DISPATCH_BATCH_SIZE = 200;

export function resolveDispatchBatchSize(
  rawValue: string | undefined,
  fallback = DEFAULT_DISPATCH_BATCH_SIZE,
  maximum = 1_000,
): number {
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

/**
 * Runs a queue worker in bounded waves. Waiting for each wave before starting
 * the next one keeps outbound HTTP and database pressure predictable while
 * still removing the per-row serial bottleneck.
 *
 * Workers should handle item-level failures and return an outcome. A rejected
 * worker rejects the current drain so callers cannot accidentally hide an
 * unhandled queue-processing error.
 */
export async function mapInBatches<T, R>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency = DEFAULT_DISPATCH_CONCURRENCY,
): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError("concurrency must be a positive integer");
  }

  const results: R[] = [];
  for (let offset = 0; offset < items.length; offset += concurrency) {
    const batch = items.slice(offset, offset + concurrency);
    const batchResults = await Promise.all(
      batch.map((item, batchIndex) => worker(item, offset + batchIndex)),
    );
    results.push(...batchResults);
  }
  return results;
}
