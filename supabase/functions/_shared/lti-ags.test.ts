import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildLtiScorePayload, createLtiLineItem, fetchLtiLineItem, LtiAgsError, postLtiScore } from "./lti-ags.ts";

Deno.test("buildLtiScorePayload: deterministic — the same inputs always produce the same payload (idempotency of what gets sent, not just that something gets sent)", () => {
  const ts = new Date("2026-08-21T12:00:00.000Z");
  const a = buildLtiScorePayload({ externalSubject: "sub-1", scoreGiven: 8, scoreMaximum: 10, timestamp: ts });
  const b = buildLtiScorePayload({ externalSubject: "sub-1", scoreGiven: 8, scoreMaximum: 10, timestamp: ts });
  assertEquals(a, b);
  assertEquals(a.userId, "sub-1");
  assertEquals(a.scoreGiven, 8);
  assertEquals(a.scoreMaximum, 10);
  assertEquals(a.activityProgress, "Completed");
  assertEquals(a.gradingProgress, "FullyGraded");
  assertEquals(a.timestamp, "2026-08-21T12:00:00.000Z");
});

Deno.test("fetchLtiLineItem: reads the platform's own scoreMaximum/label, never invents one", async () => {
  const server = Deno.serve({ port: 0 }, () =>
    new Response(JSON.stringify({ id: "https://platform.example.test/lineitems/1", scoreMaximum: 42, label: "Devoir externe" }), {
      headers: { "Content-Type": "application/vnd.ims.lis.v2.lineitem+json" },
    }));
  const port = (server.addr as Deno.NetAddr).port;
  try {
    const item = await fetchLtiLineItem(`http://127.0.0.1:${port}/lineitems/1`, "svc-token");
    assertEquals(item.scoreMaximum, 42);
    assertEquals(item.label, "Devoir externe");
  } finally {
    await server.shutdown();
  }
});

Deno.test("fetchLtiLineItem: missing scoreMaximum is rejected, not defaulted to a guessed value", async () => {
  const server = Deno.serve({ port: 0 }, () => new Response(JSON.stringify({ id: "x", label: "no max" }), { headers: { "Content-Type": "application/json" } }));
  const port = (server.addr as Deno.NetAddr).port;
  try {
    const err = await assertRejects(() => fetchLtiLineItem(`http://127.0.0.1:${port}/lineitems/1`, "svc-token"), LtiAgsError);
    assertEquals((err as LtiAgsError).reason, "line_item_fetch_failed");
  } finally {
    await server.shutdown();
  }
});

Deno.test("createLtiLineItem: POSTs scoreMaximum/label the caller supplied (real content, never a placeholder) and returns the platform's own new id", async () => {
  let captured: unknown = null;
  const server = Deno.serve({ port: 0 }, async (req) => {
    captured = await req.json();
    return new Response(JSON.stringify({ id: "https://platform.example.test/lineitems/new-1" }), {
      status: 201,
      headers: { "Content-Type": "application/vnd.ims.lis.v2.lineitem+json" },
    });
  });
  const port = (server.addr as Deno.NetAddr).port;
  try {
    const item = await createLtiLineItem(`http://127.0.0.1:${port}/lineitems`, "svc-token", {
      scoreMaximum: 100,
      label: "Quiz Brivia",
      resourceLinkId: "link-77",
    });
    assertEquals(item.id, "https://platform.example.test/lineitems/new-1");
    assertEquals(item.scoreMaximum, 100);
    assertEquals((captured as { scoreMaximum: number }).scoreMaximum, 100);
    assertEquals((captured as { label: string }).label, "Quiz Brivia");
    assertEquals((captured as { resourceLinkId: string }).resourceLinkId, "link-77");
  } finally {
    await server.shutdown();
  }
});

Deno.test("createLtiLineItem: platform rejecting the request is surfaced as line_item_create_failed, not silently ignored", async () => {
  const server = Deno.serve({ port: 0 }, () => new Response("forbidden", { status: 403 }));
  const port = (server.addr as Deno.NetAddr).port;
  try {
    const err = await assertRejects(
      () => createLtiLineItem(`http://127.0.0.1:${port}/lineitems`, "svc-token", { scoreMaximum: 100, label: "x" }),
      LtiAgsError,
    );
    assertEquals((err as LtiAgsError).reason, "line_item_create_failed");
  } finally {
    await server.shutdown();
  }
});

Deno.test("postLtiScore: POSTs to {lineItemUrl}/scores with the score payload", async () => {
  let capturedUrl = "";
  let capturedBody: unknown = null;
  const server = Deno.serve({ port: 0 }, async (req) => {
    capturedUrl = new URL(req.url).pathname;
    capturedBody = await req.json();
    return new Response(null, { status: 200 });
  });
  const port = (server.addr as Deno.NetAddr).port;
  try {
    const payload = buildLtiScorePayload({ externalSubject: "sub-1", scoreGiven: 7, scoreMaximum: 10, timestamp: new Date() });
    await postLtiScore(`http://127.0.0.1:${port}/lineitems/1`, "svc-token", payload);
    assertEquals(capturedUrl, "/lineitems/1/scores");
    assertEquals((capturedBody as { userId: string }).userId, "sub-1");
  } finally {
    await server.shutdown();
  }
});

Deno.test("postLtiScore: platform rejecting the POST is surfaced as score_post_failed, not swallowed as a silent success", async () => {
  const server = Deno.serve({ port: 0 }, () => new Response("server error", { status: 500 }));
  const port = (server.addr as Deno.NetAddr).port;
  try {
    const payload = buildLtiScorePayload({ externalSubject: "sub-1", scoreGiven: 7, scoreMaximum: 10, timestamp: new Date() });
    const err = await assertRejects(() => postLtiScore(`http://127.0.0.1:${port}/lineitems/1`, "svc-token", payload), LtiAgsError);
    assertEquals((err as LtiAgsError).reason, "score_post_failed");
  } finally {
    await server.shutdown();
  }
});
