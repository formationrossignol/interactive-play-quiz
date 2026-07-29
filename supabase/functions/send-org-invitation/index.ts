import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

interface Body {
  invitationId: string;
  inviteUrl: string;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const { invitationId, inviteUrl }: Body = await req.json();
    if (!invitationId || !inviteUrl) return jsonResponse({ error: "invalid_payload" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Bounds this endpoint the same way send-welcome-email bounds itself:
    // the caller must supply a real, pending invitation id, not an arbitrary
    // email to spam.
    const { data: invitation, error: invitationError } = await supabase
      .from("org_invitations")
      .select("email, role, status, org_id")
      .eq("id", invitationId)
      .single();
    if (invitationError || !invitation || invitation.status !== "pending") {
      return jsonResponse({ error: "forbidden" }, 403);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return jsonResponse({ sent: false, reason: "resend_not_configured" });
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", invitation.org_id)
      .single();
    const orgName = org?.name ?? "Brivia";
    const roleLabels: Record<string, string> = {
      learner: "apprenant",
      trainer: "formateur",
      pedago: "responsable pédagogique",
      registrar: "gestionnaire de scolarité",
      admin: "administrateur",
    };

    const from = Deno.env.get("RESEND_FROM_EMAIL") ?? "Brivia <onboarding@brivia.app>";
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: invitation.email,
        subject: `Invitation à rejoindre ${orgName} sur Brivia`,
        html: `<p>Bonjour,</p><p>Vous avez été invité(e) à rejoindre <strong>${orgName}</strong> sur Brivia en tant que <strong>${roleLabels[invitation.role] ?? invitation.role}</strong>.</p><p><a href="${inviteUrl}">Accepter l'invitation</a></p><p>Ce lien expire dans 7 jours.</p>`,
      }),
    });
    if (!resendResponse.ok) {
      console.error("[send-org-invitation] Resend error:", await resendResponse.text());
      return jsonResponse({ sent: false, reason: "resend_error" }, 502);
    }

    return jsonResponse({ sent: true });
  } catch (err) {
    console.error("[send-org-invitation] error:", err);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
