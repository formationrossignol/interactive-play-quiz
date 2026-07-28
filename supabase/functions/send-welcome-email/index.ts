import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

interface Body {
  userId: string;
  email: string;
  username: string;
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
    const { userId, email, username }: Body = await req.json();
    if (!userId || !email) return jsonResponse({ error: "invalid_payload" }, 400);

    // Bounds this endpoint from being used to spam arbitrary addresses: the
    // caller must supply a real, just-created user id whose actual account
    // email matches what was given — not just any string they typed in.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || userData.user?.email?.toLowerCase() !== email.toLowerCase()) {
      return jsonResponse({ error: "forbidden" }, 403);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      // No-op when Resend isn't configured (local/CI/preview) — mirrors how
      // VITE_ANTHROPIC_API_KEY is optional elsewhere in the app.
      return jsonResponse({ sent: false, reason: "resend_not_configured" });
    }

    const from = Deno.env.get("RESEND_FROM_EMAIL") ?? "Brivia <onboarding@brivia.app>";
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: email,
        subject: "Bienvenue sur Brivia !",
        html: `<p>Bonjour ${username || ""},</p><p>Bienvenue sur Brivia — votre compte est prêt. Créez votre premier quiz, sondage ou examen dès maintenant.</p>`,
      }),
    });
    if (!resendResponse.ok) {
      console.error("[send-welcome-email] Resend error:", await resendResponse.text());
      return jsonResponse({ sent: false, reason: "resend_error" }, 502);
    }

    return jsonResponse({ sent: true });
  } catch (err) {
    console.error("[send-welcome-email] error:", err);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
