import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type ContactPayload = {
  name?: unknown;
  email?: unknown;
  organization?: unknown;
  role?: unknown;
  requestType?: unknown;
  teamSize?: unknown;
  message?: unknown;
  sourcePath?: unknown;
  website?: unknown;
};

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  let body: ContactPayload;
  try {
    body = await request.json() as ContactPayload;
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }

  // Honeypots receive the same neutral response and are never persisted.
  if (text(body.website, 200)) return Response.json({ ok: true });

  const lead = {
    name: text(body.name, 120),
    email: text(body.email, 254).toLowerCase(),
    organization: text(body.organization, 160),
    role: text(body.role, 120),
    requestType: text(body.requestType, 60),
    teamSize: text(body.teamSize, 60),
    message: text(body.message, 4000),
    sourcePath: text(body.sourcePath, 300),
  };

  if (lead.name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email) || lead.message.length < 20) {
    return Response.json({ error: "Vérifiez votre nom, votre e-mail et votre message." }, { status: 422 });
  }

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipHash = await sha256(`${forwarded || "unknown"}:${process.env.CONTACT_RATE_LIMIT_SALT || "brivia-contact"}`);
  const userAgent = request.headers.get("user-agent") || "";

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("[marketing-contact] SUPABASE_SERVICE_ROLE_KEY is not configured");
    return Response.json(
      { error: "Le formulaire est temporairement indisponible. Écrivez à contact@brivia.app." },
      { status: 503 },
    );
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(5000) }) },
  });

  const { data: leadId, error } = await supabase.rpc("submit_marketing_lead", {
    p_name: lead.name,
    p_email: lead.email,
    p_organization: lead.organization,
    p_role: lead.role,
    p_request_type: lead.requestType || "general",
    p_team_size: lead.teamSize,
    p_message: lead.message,
    p_source_path: lead.sourcePath,
    p_ip_hash: ipHash,
    p_user_agent: userAgent,
  });

  if (error) {
    const rateLimited = error.message.includes("rate_limit");
    console.error("[marketing-contact] persistence failed", { code: error.code, rateLimited });
    return Response.json(
      { error: rateLimited ? "Trop de demandes. Réessayez dans une heure." : "Le message n’a pas pu être transmis. Écrivez à contact@brivia.app." },
      { status: rateLimited ? 429 : 503 },
    );
  }

  const webhookUrl = process.env.CONTACT_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: leadId, ...lead }),
        signal: AbortSignal.timeout(4000),
      });
    } catch (webhookError) {
      console.error("[marketing-contact] notification failed", webhookError);
    }
  }

  return Response.json({ ok: true }, { status: 201 });
}
