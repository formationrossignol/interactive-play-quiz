// SCIM 2.0 Users endpoint (SCM-001, SCM-003) — GET/POST/PUT/PATCH/DELETE
// routed by path segment after the function name (Supabase edge functions
// route an entire `/functions/v1/scim-users/*` prefix to this one function;
// no existing multi-route precedent found in this repo to mirror, so this
// follows the routing shape most Deno.serve SCIM implementations use:
// parse `req.url`'s pathname tail as the resource id).
//
// verify_jwt=false (config.toml) — this function verifies its OWN bearer
// credential (verifyScimBearerToken, SHA-256 hash lookup against
// api_tokens), not a Supabase session JWT. Every handler below re-checks
// the SCIM token before touching anything; there is no unauthenticated path.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { verifyScimBearerToken } from "../_shared/scim-auth.ts";
import { parseScimPatchBody, scimError, scimListResponse, scimUserResource, type ScimUserRow } from "../_shared/scim-format.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/scim+json" },
  });
}

async function loadScimUserRow(supabase: SupabaseClient, scimUserId: string, clientId: string): Promise<ScimUserRow | null> {
  const { data: su } = await supabase.from("scim_users").select("id, user_id, external_id, active").eq("id", scimUserId).eq("client_id", clientId).maybeSingle();
  if (!su) return null;
  const { data: userResult } = await supabase.auth.admin.getUserById(su.user_id as string);
  return {
    id: su.id as string,
    externalId: su.external_id as string | null,
    active: su.active as boolean,
    email: userResult?.user?.email ?? null,
    name: (userResult?.user?.user_metadata as { name?: string } | undefined)?.name ?? null,
  };
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const ctx = await verifyScimBearerToken(req, supabase);
  if (!ctx) return jsonResponse(scimError(401, "Invalid or missing bearer token"), 401);

  const url = new URL(req.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const usersIdx = segments.indexOf("scim-users");
  const resourceId = usersIdx >= 0 ? segments[usersIdx + 1] : undefined;
  const baseUrl = `${url.origin}${segments.slice(0, usersIdx + 1).join("/")}`;

  try {
    if (req.method === "GET" && !resourceId) {
      const startIndex = Number(url.searchParams.get("startIndex") ?? "1") || 1;
      const count = Math.min(Number(url.searchParams.get("count") ?? "100") || 100, 200);
      const { data: rows, error } = await supabase.rpc("_list_scim_users_service", {
        p_client_id: ctx.clientId,
        p_offset: startIndex - 1,
        p_limit: count,
      });
      if (error) throw error;
      const resources = (rows ?? []).map((row: Record<string, unknown>) => scimUserResource({
        id: row.id as string,
        externalId: row.external_id as string | null,
        active: row.active as boolean,
        email: row.email as string | null,
        name: row.name as string | null,
      }, baseUrl));
      let total = Number(rows?.[0]?.total_count ?? 0);
      // A window query has no row on an out-of-range SCIM page. Preserve the
      // protocol's exact totalResults in that uncommon case with one bounded
      // count query; normal pages stay a single round-trip.
      if ((rows ?? []).length === 0 && startIndex > 1) {
        const { count: exactTotal, error: countError } = await supabase
          .from("scim_users")
          .select("id", { count: "exact", head: true })
          .eq("client_id", ctx.clientId);
        if (countError) throw countError;
        total = exactTotal ?? 0;
      }
      return jsonResponse(scimListResponse(resources, total, startIndex, resources.length));
    }

    if (req.method === "GET" && resourceId) {
      const row = await loadScimUserRow(supabase, resourceId, ctx.clientId);
      if (!row) return jsonResponse(scimError(404, "User not found"), 404);
      return jsonResponse(scimUserResource(row, baseUrl));
    }

    if (req.method === "POST" && !resourceId) {
      const body = await req.json().catch(() => null);
      const rawEmail = typeof body?.userName === "string" ? body.userName : (typeof body?.emails?.[0]?.value === "string" ? body.emails[0].value : null);
      const email = rawEmail?.trim().toLowerCase() ?? null;
      if (!email) return jsonResponse(scimError(400, "userName (email) is required"), 400);

      // SCM-001: real account creation — this IS the provisioning event, not
      // a claim to be verified against a pre-existing identity (see
      // 20260821050000_scim.sql's file header for why this differs from
      // this session's SSO/LTI "never auto-provision" posture).
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: typeof body?.displayName === "string" ? { name: body.displayName } : {},
      });
      if (createErr || !created?.user) {
        // Most common real-world case: the email already has a Brivia
        // account — link to it rather than failing, same "resolve, don't
        // duplicate" posture as every CSV-import flow elsewhere in this app.
        const { data: existingUserId, error: lookupError } = await supabase.rpc("_find_auth_user_by_email_service", { p_email: email });
        if (lookupError) throw lookupError;
        if (!existingUserId) return jsonResponse(scimError(409, createErr?.message ?? "Could not create user"), 409);
        const { data: su, error: suErr } = await supabase
          .from("scim_users")
          .upsert({ client_id: ctx.clientId, user_id: existingUserId, external_id: body?.externalId ?? null, active: true }, { onConflict: "client_id,user_id" })
          .select("id").single();
        if (suErr || !su) return jsonResponse(scimError(500, "Failed to link existing user"), 500);
        await supabase.from("user_org_roles").upsert({ user_id: existingUserId, org_id: ctx.orgId, role: "learner" }, { onConflict: "user_id,org_id,role", ignoreDuplicates: true });
        const row = await loadScimUserRow(supabase, su.id as string, ctx.clientId);
        return jsonResponse(scimUserResource(row!, baseUrl), 201);
      }

      const { data: su, error: suErr } = await supabase
        .from("scim_users")
        .insert({ client_id: ctx.clientId, user_id: created.user.id, external_id: body?.externalId ?? null, active: true })
        .select("id").single();
      if (suErr || !su) return jsonResponse(scimError(500, "User created but SCIM mapping failed"), 500);
      await supabase.from("user_org_roles").upsert({ user_id: created.user.id, org_id: ctx.orgId, role: "learner" }, { onConflict: "user_id,org_id,role", ignoreDuplicates: true });
      const row = await loadScimUserRow(supabase, su.id as string, ctx.clientId);
      return jsonResponse(scimUserResource(row!, baseUrl), 201);
    }

    if ((req.method === "PUT" || req.method === "PATCH") && resourceId) {
      const { data: su } = await supabase.from("scim_users").select("id, user_id, active").eq("id", resourceId).eq("client_id", ctx.clientId).maybeSingle();
      if (!su) return jsonResponse(scimError(404, "User not found"), 404);

      let desiredActive: boolean | null = null;
      if (req.method === "PATCH") {
        const body = await req.json().catch(() => null);
        const ops = parseScimPatchBody(body);
        if (!ops) return jsonResponse(scimError(400, "Malformed PATCH body"), 400);
        for (const op of ops) {
          if (op.path === "active" || (op.path === undefined && typeof (op.value as { active?: unknown })?.active === "boolean")) {
            desiredActive = typeof op.value === "boolean" ? op.value : Boolean((op.value as { active?: unknown })?.active);
          }
        }
      } else {
        const body = await req.json().catch(() => null);
        if (typeof body?.active === "boolean") desiredActive = body.active;
      }

      // SCM-003: deactivation removes active access, never deletes anything
      // — deactivate_scim_user() (20260821050000_scim.sql) only ever writes
      // scim_users.active and deletes user_org_roles rows, by construction
      // (no reference to grade_results/certificates/auth.users anywhere in
      // its body).
      if (desiredActive === false && su.active) {
        await supabase.rpc("deactivate_scim_user", { p_scim_user_id: su.id });
      } else if (desiredActive === true && !su.active) {
        await supabase.from("scim_users").update({ active: true }).eq("id", su.id);
        await supabase.from("user_org_roles").upsert({ user_id: su.user_id, org_id: ctx.orgId, role: "learner" }, { onConflict: "user_id,org_id,role", ignoreDuplicates: true });
      }

      const row = await loadScimUserRow(supabase, resourceId, ctx.clientId);
      if (!row) return jsonResponse(scimError(404, "User not found"), 404);
      return jsonResponse(scimUserResource(row, baseUrl));
    }

    if (req.method === "DELETE" && resourceId) {
      // SCIM-conventional soft-deactivate, per SCM-003 — never a real delete.
      const { data: su } = await supabase.from("scim_users").select("id").eq("id", resourceId).eq("client_id", ctx.clientId).maybeSingle();
      if (!su) return jsonResponse(scimError(404, "User not found"), 404);
      await supabase.rpc("deactivate_scim_user", { p_scim_user_id: su.id });
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    return jsonResponse(scimError(405, "Method not allowed"), 405);
  } catch (err) {
    console.error("[scim-users] error:", err);
    return jsonResponse(scimError(500, "Internal error"), 500);
  }
});
