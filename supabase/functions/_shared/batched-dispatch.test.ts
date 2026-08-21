import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mapInBatches, resolveDispatchBatchSize } from "./batched-dispatch.ts";

Deno.test("resolveDispatchBatchSize is configurable, capped and has a safe fallback", () => {
  assertEquals(resolveDispatchBatchSize(undefined), 200);
  assertEquals(resolveDispatchBatchSize("500"), 500);
  assertEquals(resolveDispatchBatchSize("5000"), 1000);
  assertEquals(resolveDispatchBatchSize("invalid"), 200);
  assertEquals(resolveDispatchBatchSize("0"), 200);
});

Deno.test("mapInBatches limits active workers to batches of 10 and preserves result order", async () => {
  let active = 0;
  let peak = 0;
  const started: number[] = [];
  const releases: Array<() => void> = [];
  const gates = Array.from(
    { length: 3 },
    () => new Promise<void>((resolve) => releases.push(resolve)),
  );

  const waitForStarted = async (count: number) => {
    while (started.length < count) await Promise.resolve();
  };

  const draining = mapInBatches(
    Array.from({ length: 23 }, (_, index) => index),
    async (item) => {
      active++;
      peak = Math.max(peak, active);
      started.push(item);
      await gates[Math.floor(item / 10)];
      active--;
      return item * 2;
    },
  );

  await waitForStarted(10);
  assertEquals(started, Array.from({ length: 10 }, (_, index) => index));
  releases[0]();

  await waitForStarted(20);
  assertEquals(started, Array.from({ length: 20 }, (_, index) => index));
  releases[1]();

  await waitForStarted(23);
  assertEquals(started, Array.from({ length: 23 }, (_, index) => index));
  releases[2]();

  const results = await draining;
  assertEquals(peak, 10);
  assertEquals(results, Array.from({ length: 23 }, (_, index) => index * 2));
});

Deno.test("mapInBatches rejects an invalid concurrency", async () => {
  await assertRejects(
    () => mapInBatches([1], async (value) => value, 0),
    RangeError,
    "concurrency must be a positive integer",
  );
});
