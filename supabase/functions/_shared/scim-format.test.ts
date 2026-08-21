import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseScimPatchBody, scimError, scimGroupResource, scimListResponse, scimUserResource } from "./scim-format.ts";

Deno.test("scimUserResource: real RFC 7643 shape (schemas/id/userName/active/meta)", () => {
  const r = scimUserResource({ id: "u1", externalId: "ext-1", active: true, email: "a@b.test", name: "Ada" }, "https://x.test/scim-users");
  assertEquals(r.schemas, ["urn:ietf:params:scim:schemas:core:2.0:User"]);
  assertEquals(r.id, "u1");
  assertEquals(r.externalId, "ext-1");
  assertEquals(r.userName, "a@b.test");
  assertEquals(r.active, true);
  assertEquals(r.meta.resourceType, "User");
  assertEquals(r.meta.location, "https://x.test/scim-users/u1");
});

Deno.test("scimUserResource: no externalId echoed as a lie — omitted, not empty string", () => {
  const r = scimUserResource({ id: "u1", externalId: null, active: true, email: null, name: null }, "https://x.test/scim-users");
  assertEquals(r.externalId, undefined);
});

Deno.test("scimGroupResource: real RFC 7643 shape (schemas/displayName/members)", () => {
  const r = scimGroupResource({ id: "g1", externalId: null, displayName: "Instructors", memberIds: ["u1", "u2"] }, "https://x.test/scim-groups");
  assertEquals(r.schemas, ["urn:ietf:params:scim:schemas:core:2.0:Group"]);
  assertEquals(r.displayName, "Instructors");
  assertEquals(r.members, [{ value: "u1" }, { value: "u2" }]);
});

Deno.test("scimListResponse: real RFC 7644 ListResponse envelope", () => {
  const r = scimListResponse([{ id: "u1" }], 5, 1, 1);
  assertEquals(r.schemas, ["urn:ietf:params:scim:api:messages:2.0:ListResponse"]);
  assertEquals(r.totalResults, 5);
  assertEquals(r.startIndex, 1);
  assertEquals(r.itemsPerPage, 1);
  assertEquals(r.Resources.length, 1);
});

Deno.test("scimError: real RFC 7644 §3.12 error shape", () => {
  const e = scimError(404, "User not found");
  assertEquals(e.schemas, ["urn:ietf:params:scim:api:messages:2.0:Error"]);
  assertEquals(e.status, "404");
  assertEquals(e.detail, "User not found");
});

Deno.test("parseScimPatchBody: valid RFC 7644 §3.5.2 Operations array accepted", () => {
  const ops = parseScimPatchBody({ Operations: [{ op: "replace", path: "active", value: false }] });
  assertEquals(ops?.length, 1);
  assertEquals(ops?.[0].op, "replace");
  assertEquals(ops?.[0].path, "active");
  assertEquals(ops?.[0].value, false);
});

Deno.test("parseScimPatchBody: missing Operations array rejected (null, not a crash)", () => {
  assertEquals(parseScimPatchBody({}), null);
  assertEquals(parseScimPatchBody(null), null);
  assertEquals(parseScimPatchBody("not an object"), null);
});

Deno.test("parseScimPatchBody: unrecognized op value rejected wholesale, not silently skipped", () => {
  const ops = parseScimPatchBody({ Operations: [{ op: "delete", path: "active" }] });
  assertEquals(ops, null);
});

Deno.test("parseScimPatchBody: malformed individual operation rejects the whole envelope", () => {
  assertEquals(parseScimPatchBody({ Operations: ["not an object"] }), null);
});
