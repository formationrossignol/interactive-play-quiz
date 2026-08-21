// Public REST API v1 (spec 04, API-001/API-002). verify_jwt=false
// (config.toml) — this function verifies its OWN bearer credential
// (verifyApiBearerToken, the SHA-256 hash-lookup primitive this session's
// SCIM/OneRoster builds already established and share), not a Supabase
// session JWT — API-002's "aucun jeton utilisateur longue durée" (no
// long-lived user token) is satisfied by construction: there is no code
// path here that accepts a Supabase user JWT at all.
//
// Scope decision, stated plainly: this v1 exposes 4 read-only resources
// (enrollments, grades, completions, certificates) — the ones API-004's own
// event list implies matter to an external integrator, not the entire LMS
// surface. None of them are writable through this API: LTI/SSO/SCIM/
// OneRoster (this session's other spec-04 work) have all consistently only
// ever let an external system touch identity/roster data, never directly
// write academic records (grades, completions, certificates) — a public
// write endpoint for those would be a materially bigger trust decision than
// anything else in spec 04, not attempted here. api_idempotency_keys exists
// in the migration for a future write endpoint to dedupe against; no
// endpoint in this pass exercises it — a real, stated gap, not a fabricated
// POST route built just to tick a box.
//
// Routing: path segment after "api-v1" selects the resource, mirroring
// scim-users/oneroster-sync's established convention in this codebase.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { verifyApiBearerToken, hasApiScope, type ApiTokenAuthContext } from "../_shared/api-token-auth.ts";
import { encodeCursor, decodeCursor } from "../_shared/api-cursor.ts";
import openApiSpec from "./openapi.json" with { type: "json" };

const PAGE_SIZE = 50;

function jsonError(reason: string, status = 400) {
  return new Response(JSON.stringify({ error: reason }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function jsonList(resources: unknown[], nextCursor: string | null) {
  return new Response(JSON.stringify({ data: resources, next_cursor: nextCursor }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Every list endpoint below shares this exact tail: a (cursorField, id)
 *  tuple `.or()` filter, `.limit()`, and the resulting next_cursor
 *  computation — kept as a small helper on the already-built query rather
 *  than a fully generic query-builder (Supabase's typed client doesn't
 *  compose cleanly enough across differently-joined queries to make one
 *  worthwhile; each resource's own `.select()`/`.eq()` chain stays
 *  explicit and readable instead). */
function nextCursorFor(rows: Record<string, unknown>[], cursorField: string): string | null {
  if (rows.length < PAGE_SIZE) return null;
  const last = rows[rows.length - 1];
  return encodeCursor({ createdAt: String(last[cursorField]), id: String(last.id) });
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") {
    return jsonError("method_not_allowed", 405);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const apiIdx = segments.indexOf("api-v1");
  const resource = apiIdx >= 0 ? segments[apiIdx + 1] : undefined;
  const cursorRaw = url.searchParams.get("cursor");

  // API-001's OpenAPI document is public documentation, not a protected
  // resource — served before any auth/rate-limit check, same as every real
  // API's own /openapi.json being fetchable with no credential.
  if (resource === "openapi.json") {
    return new Response(JSON.stringify(openApiSpec), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const ctx: ApiTokenAuthContext | null = await verifyApiBearerToken(req, supabase);
  if (!ctx) return jsonError("Invalid or missing bearer token", 401);

  // API-001: per-org rate limit, checked (and logged) before any resource
  // read — a rejected request costs the caller nothing toward its own next
  // window (see _check_and_log_api_request's own comment), but a served one
  // always counts.
  const { data: underLimit } = await supabase.rpc("_check_and_log_api_request", { p_client_id: ctx.clientId });
  if (underLimit === false) {
    return jsonError("rate_limited", 429);
  }

  try {
    if (resource === "enrollments") {
      if (!hasApiScope(ctx, "api:enrollments:read")) return jsonError("insufficient_scope", 403);
      const cursor = decodeCursor(cursorRaw);
      let query = supabase
        .from("enrollments")
        .select("id, session_id, learner_id, status, source, effective_start_at, effective_due_at, created_at")
        .eq("org_id", ctx.orgId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(PAGE_SIZE);
      if (cursor) query = query.or(`created_at.gt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.gt.${cursor.id})`);
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as unknown as Record<string, unknown>[];
      return jsonList(rows, nextCursorFor(rows, "created_at"));
    }

    if (resource === "grades") {
      if (!hasApiScope(ctx, "api:grades:read")) return jsonError("insufficient_scope", 403);
      // grade_results has no org_id of its own — join through grade_items,
      // and never surface a grade that isn't published (published_at is
      // null): an external integrator seeing a draft/unpublished grade
      // would be a real leak, same gate every internal read of this table
      // already respects.
      const cursor = decodeCursor(cursorRaw);
      let query = supabase
        .from("grade_results")
        .select("id, grade_item_id, learner_id, status, points, published_at, created_at, grade_items!inner(org_id)")
        .eq("grade_items.org_id", ctx.orgId)
        .not("published_at", "is", null)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(PAGE_SIZE);
      if (cursor) query = query.or(`created_at.gt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.gt.${cursor.id})`);
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as unknown as Record<string, unknown>[];
      const nextCursor = nextCursorFor(rows, "created_at");
      const cleaned = rows.map(({ grade_items: _omit, ...rest }) => rest);
      return jsonList(cleaned, nextCursor);
    }

    if (resource === "completions") {
      if (!hasApiScope(ctx, "api:completions:read")) return jsonError("insufficient_scope", 403);
      const cursor = decodeCursor(cursorRaw);
      let query = supabase
        .from("enrollment_completion_results")
        .select("id, enrollment_id, policy_set_id, policy_version, satisfied, computed_at, enrollments!inner(org_id, learner_id)")
        .eq("enrollments.org_id", ctx.orgId)
        .order("computed_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(PAGE_SIZE);
      // This table has computed_at, not created_at — cursor field name
      // ("createdAt") is a shared wire-format label, not tied to any one
      // table's actual column name.
      if (cursor) query = query.or(`computed_at.gt.${cursor.createdAt},and(computed_at.eq.${cursor.createdAt},id.gt.${cursor.id})`);
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as unknown as Record<string, unknown>[];
      const nextCursor = nextCursorFor(rows, "computed_at");
      const cleaned = rows.map(({ enrollments, ...rest }) => {
        const rel = Array.isArray(enrollments) ? enrollments[0] : enrollments;
        return { ...rest, learner_id: (rel as { learner_id?: string } | undefined)?.learner_id };
      });
      return jsonList(cleaned, nextCursor);
    }

    if (resource === "certificates") {
      if (!hasApiScope(ctx, "api:certificates:read")) return jsonError("insufficient_scope", 403);
      // certificates has no org_id (confirmed absent from its own schema) —
      // scope via actual org membership (user_org_roles), not the "first
      // org by created_at" fallback the webhook trigger uses (that
      // shortcut exists only because a single-event webhook needs exactly
      // one org to attribute to; a list endpoint can and should join on
      // real membership instead, which is strictly more correct here).
      const cursor = decodeCursor(cursorRaw);
      let query = supabase
        .from("certificates")
        .select("id, user_id, course_id, course_title, certificate_number, issued_at, user_org_roles!inner(org_id)")
        .eq("user_org_roles.org_id", ctx.orgId)
        .order("issued_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(PAGE_SIZE);
      if (cursor) query = query.or(`issued_at.gt.${cursor.createdAt},and(issued_at.eq.${cursor.createdAt},id.gt.${cursor.id})`);
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as unknown as Record<string, unknown>[];
      const nextCursor = nextCursorFor(rows, "issued_at");
      const cleaned = rows.map(({ user_org_roles: _omit, ...rest }) => rest);
      return jsonList(cleaned, nextCursor);
    }

    return jsonError("unknown_resource", 404);
  } catch (err) {
    console.error("[api-v1] error:", err);
    return jsonError("internal_error", 500);
  }
});
