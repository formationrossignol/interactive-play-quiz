import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { fetchLtiContextMembership, LtiNrpsError, mapLtiRolesToBriviaRoles } from "./lti-nrps.ts";

Deno.test("fetchLtiContextMembership: parses real members from a real HTTP response", async () => {
  const server = Deno.serve({ port: 0 }, () =>
    new Response(
      JSON.stringify({
        id: "https://platform.example.test/nrps/course-101/members",
        context: { id: "course-101" },
        members: [
          { status: "Active", name: "Ada Lovelace", email: "ada@example.test", user_id: "sub-1", roles: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"] },
          { status: "Active", name: "Grace Hopper", email: "grace@example.test", user_id: "sub-2", roles: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor"] },
        ],
      }),
      { headers: { "Content-Type": "application/vnd.ims.lti-nrps.v2.membershipcontainer+json" } },
    ));
  const port = (server.addr as Deno.NetAddr).port;
  try {
    const members = await fetchLtiContextMembership(`http://127.0.0.1:${port}/members`, "svc-token");
    assertEquals(members.length, 2);
    assertEquals(members[0].userId, "sub-1");
    assertEquals(members[0].name, "Ada Lovelace");
    assertEquals(members[1].roles, ["http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor"]);
  } finally {
    await server.shutdown();
  }
});

Deno.test("fetchLtiContextMembership: a member with no user_id is dropped, not synced as an unidentifiable entry", async () => {
  const server = Deno.serve({ port: 0 }, () =>
    new Response(JSON.stringify({ members: [{ name: "No ID", roles: [] }, { user_id: "sub-3", roles: [] }] }), {
      headers: { "Content-Type": "application/json" },
    }));
  const port = (server.addr as Deno.NetAddr).port;
  try {
    const members = await fetchLtiContextMembership(`http://127.0.0.1:${port}/members`, "svc-token");
    assertEquals(members.length, 1);
    assertEquals(members[0].userId, "sub-3");
  } finally {
    await server.shutdown();
  }
});

Deno.test("fetchLtiContextMembership: platform error surfaced as membership_fetch_failed, not swallowed", async () => {
  const server = Deno.serve({ port: 0 }, () => new Response("forbidden", { status: 403 }));
  const port = (server.addr as Deno.NetAddr).port;
  try {
    const err = await assertRejects(() => fetchLtiContextMembership(`http://127.0.0.1:${port}/members`, "svc-token"), LtiNrpsError);
    assertEquals((err as LtiNrpsError).reason, "membership_fetch_failed");
  } finally {
    await server.shutdown();
  }
});

Deno.test("fetchLtiContextMembership: response with no members array is rejected, not treated as an empty roster", async () => {
  const server = Deno.serve({ port: 0 }, () => new Response(JSON.stringify({ id: "x" }), { headers: { "Content-Type": "application/json" } }));
  const port = (server.addr as Deno.NetAddr).port;
  try {
    const err = await assertRejects(() => fetchLtiContextMembership(`http://127.0.0.1:${port}/members`, "svc-token"), LtiNrpsError);
    assertEquals((err as LtiNrpsError).reason, "membership_fetch_failed");
  } finally {
    await server.shutdown();
  }
});

Deno.test("mapLtiRolesToBriviaRoles: Instructor maps to trainer", () => {
  assertEquals(mapLtiRolesToBriviaRoles(["http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor"]), ["trainer"]);
});

Deno.test("mapLtiRolesToBriviaRoles: TeachingAssistant also maps to trainer", () => {
  assertEquals(mapLtiRolesToBriviaRoles(["http://purl.imsglobal.org/vocab/lis/v2/membership#TeachingAssistant"]), ["trainer"]);
});

Deno.test("mapLtiRolesToBriviaRoles: Learner maps to learner", () => {
  assertEquals(mapLtiRolesToBriviaRoles(["http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"]), ["learner"]);
});

Deno.test("mapLtiRolesToBriviaRoles: Instructor+TeachingAssistant dedupes to a single trainer, not two entries", () => {
  assertEquals(
    mapLtiRolesToBriviaRoles([
      "http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor",
      "http://purl.imsglobal.org/vocab/lis/v2/membership#TeachingAssistant",
    ]),
    ["trainer"],
  );
});

Deno.test("mapLtiRolesToBriviaRoles: an Administrator-shaped role is NEVER mapped — security boundary, not an oversight", () => {
  assertEquals(mapLtiRolesToBriviaRoles(["http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator"]), []);
  assertEquals(mapLtiRolesToBriviaRoles(["http://purl.imsglobal.org/vocab/lis/v2/membership#Administrator"]), []);
});

Deno.test("mapLtiRolesToBriviaRoles: unknown/unmapped role (e.g. ContentDeveloper) resolves to no role, not a guess", () => {
  assertEquals(mapLtiRolesToBriviaRoles(["http://purl.imsglobal.org/vocab/lis/v2/membership#ContentDeveloper"]), []);
});

Deno.test("mapLtiRolesToBriviaRoles: empty roles array resolves to no role", () => {
  assertEquals(mapLtiRolesToBriviaRoles([]), []);
});
