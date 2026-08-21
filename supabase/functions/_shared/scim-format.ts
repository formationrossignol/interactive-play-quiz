// SCIM 2.0 wire-format helpers (RFC 7643 core schema, RFC 7644 protocol) —
// real IdP interop (Okta/Azure AD/etc validate against the actual RFC, not
// an approximation) needs these exact shapes, not a loose "close enough"
// JSON structure.
const USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
const GROUP_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:Group";
const LIST_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:ListResponse";
const ERROR_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:Error";

export interface ScimUserRow {
  id: string;
  externalId: string | null;
  active: boolean;
  email: string | null;
  name: string | null;
}

export function scimUserResource(row: ScimUserRow, baseUrl: string) {
  return {
    schemas: [USER_SCHEMA],
    id: row.id,
    externalId: row.externalId ?? undefined,
    userName: row.email ?? row.id,
    displayName: row.name ?? undefined,
    active: row.active,
    emails: row.email ? [{ value: row.email, primary: true }] : [],
    // baseUrl already ends at .../scim-users (the actual routed path
    // segment, per scim-users/index.ts's own resourceId parsing) — an
    // extra literal "/Users/" here would double up and produce a location
    // the routing layer doesn't actually serve. Caught by this file's own
    // test (scim-format.test.ts) before this ever reached an edge function.
    meta: { resourceType: "User", location: `${baseUrl}/${row.id}` },
  };
}

export interface ScimGroupRow {
  id: string;
  externalId: string | null;
  displayName: string;
  memberIds: string[];
}

export function scimGroupResource(row: ScimGroupRow, baseUrl: string) {
  return {
    schemas: [GROUP_SCHEMA],
    id: row.id,
    externalId: row.externalId ?? undefined,
    displayName: row.displayName,
    members: row.memberIds.map((id) => ({ value: id })),
    // Same reasoning as scimUserResource's meta.location above.
    meta: { resourceType: "Group", location: `${baseUrl}/${row.id}` },
  };
}

export function scimListResponse(resources: unknown[], totalResults: number, startIndex: number, itemsPerPage: number) {
  return {
    schemas: [LIST_SCHEMA],
    totalResults,
    startIndex,
    itemsPerPage,
    Resources: resources,
  };
}

export function scimError(status: number, detail: string, scimType?: string) {
  return {
    schemas: [ERROR_SCHEMA],
    status: String(status),
    detail,
    ...(scimType ? { scimType } : {}),
  };
}

export interface ScimPatchOp {
  op: "add" | "remove" | "replace";
  path?: string;
  value?: unknown;
}

/** Parses RFC 7644 §3.5.2's PATCH body ({schemas, Operations:[{op,path,value}]}).
 *  Returns null (caller responds 400) if the envelope itself is malformed —
 *  unrecognized individual operations are the caller's job to reject or
 *  ignore per-operation, this only validates the envelope shape. */
export function parseScimPatchBody(body: unknown): ScimPatchOp[] | null {
  if (!body || typeof body !== "object") return null;
  const ops = (body as { Operations?: unknown }).Operations;
  if (!Array.isArray(ops)) return null;
  const parsed: ScimPatchOp[] = [];
  for (const raw of ops) {
    if (!raw || typeof raw !== "object") return null;
    const op = (raw as { op?: unknown }).op;
    if (op !== "add" && op !== "remove" && op !== "replace") return null;
    parsed.push({
      op,
      path: typeof (raw as { path?: unknown }).path === "string" ? (raw as { path: string }).path : undefined,
      value: (raw as { value?: unknown }).value,
    });
  }
  return parsed;
}
