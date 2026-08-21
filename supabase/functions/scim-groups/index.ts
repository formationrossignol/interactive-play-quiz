// SCIM 2.0 Groups endpoint (SCM-004) — same routing/auth shape as
// scim-users. Membership changes via POST/PATCH resolve the group's role
// mapping for real (apply_scim_group_roles(), additive-only — see
// 20260821050000_scim.sql's file header for why membership *removal* does
// not revoke roles here).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { verifyScimBearerToken } from "../_shared/scim-auth.ts";
import { parseScimPatchBody, scimError, scimGroupResource, scimListResponse, type ScimGroupRow } from "../_shared/scim-format.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/scim+json" } });
}

async function loadScimGroupRow(supabase: SupabaseClient, groupId: string, clientId: string): Promise<ScimGroupRow | null> {
  const { data: g } = await supabase.from("scim_groups").select("id, external_id, display_name").eq("id", groupId).eq("client_id", clientId).maybeSingle();
  if (!g) return null;
  const { data: members } = await supabase.from("scim_group_members").select("user_id").eq("group_id", groupId);
  return {
    id: g.id as string,
    externalId: g.external_id as string | null,
    displayName: g.display_name as string,
    memberIds: (members ?? []).map((m) => m.user_id as string),
  };
}

async function addMember(supabase: SupabaseClient, groupId: string, userId: string) {
  await supabase.from("scim_group_members").upsert({ group_id: groupId, user_id: userId }, { onConflict: "group_id,user_id" });
  await supabase.rpc("apply_scim_group_roles", { p_group_id: groupId, p_user_id: userId });
}

async function removeMember(supabase: SupabaseClient, groupId: string, userId: string) {
  await supabase.from("scim_group_members").delete().eq("group_id", groupId).eq("user_id", userId);
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const ctx = await verifyScimBearerToken(req, supabase);
  if (!ctx) return jsonResponse(scimError(401, "Invalid or missing bearer token"), 401);

  const url = new URL(req.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const groupsIdx = segments.indexOf("scim-groups");
  const resourceId = groupsIdx >= 0 ? segments[groupsIdx + 1] : undefined;
  const baseUrl = `${url.origin}${segments.slice(0, groupsIdx + 1).join("/")}`;

  try {
    if (req.method === "GET" && !resourceId) {
      const startIndex = Number(url.searchParams.get("startIndex") ?? "1") || 1;
      const count = Math.min(Number(url.searchParams.get("count") ?? "100") || 100, 200);
      const { data: rows, count: total } = await supabase
        .from("scim_groups").select("id, external_id, display_name", { count: "exact" }).eq("client_id", ctx.clientId)
        .range(startIndex - 1, startIndex - 2 + count);
      const groupIds = (rows ?? []).map((row) => row.id as string);
      const membersByGroup = new Map<string, string[]>();
      if (groupIds.length > 0) {
        const { data: members, error: membersError } = await supabase
          .from("scim_group_members")
          .select("group_id, user_id")
          .in("group_id", groupIds);
        if (membersError) throw membersError;
        for (const member of members ?? []) {
          const groupId = member.group_id as string;
          const groupMembers = membersByGroup.get(groupId) ?? [];
          groupMembers.push(member.user_id as string);
          membersByGroup.set(groupId, groupMembers);
        }
      }
      const resources = (rows ?? []).map((row) => scimGroupResource({
        id: row.id as string,
        externalId: row.external_id as string | null,
        displayName: row.display_name as string,
        memberIds: membersByGroup.get(row.id as string) ?? [],
      }, baseUrl));
      return jsonResponse(scimListResponse(resources, total ?? 0, startIndex, resources.length));
    }

    if (req.method === "GET" && resourceId) {
      const row = await loadScimGroupRow(supabase, resourceId, ctx.clientId);
      if (!row) return jsonResponse(scimError(404, "Group not found"), 404);
      return jsonResponse(scimGroupResource(row, baseUrl));
    }

    if (req.method === "POST" && !resourceId) {
      const body = await req.json().catch(() => null);
      if (typeof body?.displayName !== "string" || !body.displayName) {
        return jsonResponse(scimError(400, "displayName is required"), 400);
      }
      const { data: g, error } = await supabase
        .from("scim_groups")
        .insert({ client_id: ctx.clientId, external_id: body.externalId ?? null, display_name: body.displayName })
        .select("id").single();
      if (error || !g) return jsonResponse(scimError(409, error?.message ?? "Could not create group"), 409);

      const memberIds: string[] = Array.isArray(body.members) ? body.members.map((m: { value?: unknown }) => m.value).filter((v: unknown): v is string => typeof v === "string") : [];
      for (const memberScimUserId of memberIds) {
        const { data: su } = await supabase.from("scim_users").select("user_id").eq("id", memberScimUserId).eq("client_id", ctx.clientId).maybeSingle();
        if (su) await addMember(supabase, g.id as string, su.user_id as string);
      }

      const row = await loadScimGroupRow(supabase, g.id as string, ctx.clientId);
      return jsonResponse(scimGroupResource(row!, baseUrl), 201);
    }

    if ((req.method === "PUT" || req.method === "PATCH") && resourceId) {
      const { data: group } = await supabase.from("scim_groups").select("id").eq("id", resourceId).eq("client_id", ctx.clientId).maybeSingle();
      if (!group) return jsonResponse(scimError(404, "Group not found"), 404);

      const body = await req.json().catch(() => null);
      if (req.method === "PATCH") {
        const ops = parseScimPatchBody(body);
        if (!ops) return jsonResponse(scimError(400, "Malformed PATCH body"), 400);
        for (const op of ops) {
          const values = Array.isArray(op.value) ? op.value : (op.value ? [op.value] : []);
          for (const v of values as { value?: unknown }[]) {
            const scimUserId = typeof v?.value === "string" ? v.value : null;
            if (!scimUserId) continue;
            const { data: su } = await supabase.from("scim_users").select("user_id").eq("id", scimUserId).eq("client_id", ctx.clientId).maybeSingle();
            if (!su) continue;
            if (op.op === "remove") await removeMember(supabase, resourceId, su.user_id as string);
            else await addMember(supabase, resourceId, su.user_id as string);
          }
        }
      } else if (Array.isArray(body?.members)) {
        const desired: string[] = body.members.map((m: { value?: unknown }) => m.value).filter((v: unknown): v is string => typeof v === "string");
        const { data: current } = await supabase.from("scim_group_members").select("user_id").eq("group_id", resourceId);
        const currentScimIds = new Set((current ?? []).map((c) => c.user_id as string));
        for (const scimUserId of desired) {
          const { data: su } = await supabase.from("scim_users").select("user_id").eq("id", scimUserId).eq("client_id", ctx.clientId).maybeSingle();
          if (su && !currentScimIds.has(su.user_id as string)) await addMember(supabase, resourceId, su.user_id as string);
        }
      }

      const row = await loadScimGroupRow(supabase, resourceId, ctx.clientId);
      if (!row) return jsonResponse(scimError(404, "Group not found"), 404);
      return jsonResponse(scimGroupResource(row, baseUrl));
    }

    if (req.method === "DELETE" && resourceId) {
      const { data: group } = await supabase.from("scim_groups").select("id").eq("id", resourceId).eq("client_id", ctx.clientId).maybeSingle();
      if (!group) return jsonResponse(scimError(404, "Group not found"), 404);
      await supabase.from("scim_groups").delete().eq("id", resourceId);
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    return jsonResponse(scimError(405, "Method not allowed"), 405);
  } catch (err) {
    console.error("[scim-groups] error:", err);
    return jsonResponse(scimError(500, "Internal error"), 500);
  }
});
