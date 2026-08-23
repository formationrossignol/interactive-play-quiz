import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

// Spec 08 "IA d'assistance" — never sees item_answer_keys (no select policy
// for `authenticated` at all, 20260810220000). Distractors/bias checks only
// get the visible prompt/options; the correct answer stays server-only.
type SuggestionType = "generation" | "distractors" | "bias_check";

interface ItemContext {
  itemType: string;
  promptText: string;
  options?: string[];
}

interface RequestBody {
  itemId?: string;
  suggestionType?: SuggestionType;
  sourceExcerpt?: string;
  itemContext?: ItemContext;
}

const SYSTEM_PROMPTS: Record<SuggestionType, string> = {
  generation: `Tu es un concepteur pédagogique. À partir d'un extrait source fourni par l'auteur, propose un brouillon d'item d'évaluation ancré dans ce texte.
Réponds UNIQUEMENT avec du JSON valide, aucun texte avant ou après :
{
  "item_type": "single_choice|mcq|true_false|short_answer",
  "prompt_text": "énoncé de la question",
  "options": ["option 1", "option 2", "..."] ,
  "suggested_correct": "la bonne réponse ou l'option correcte, en texte",
  "difficulty": "facile|moyen|difficile",
  "cognitive_level": "niveau taxonomie de Bloom (ex. analyser, appliquer)",
  "citations": ["extrait exact de la source utilisé pour justifier la question"]
}
"options" est un tableau vide si item_type est "short_answer" ou "true_false". C'est un brouillon : reste factuel, base-toi uniquement sur l'extrait fourni, ne jamais inventer d'information absente de la source.`,
  distractors: `Tu es un concepteur pédagogique. On te donne l'énoncé et les options existantes d'un item (jamais la réponse correcte, elle reste confidentielle). Propose 3 à 5 distracteurs supplémentaires plausibles — des réponses fausses mais crédibles, qui ne trahissent aucun indice involontaire.
Réponds UNIQUEMENT avec du JSON valide :
{
  "distractors": [
    { "label": "texte du distracteur", "rationale": "pourquoi il est plausible mais faux" }
  ]
}`,
  bias_check: `Tu es un relecteur qualité d'items d'évaluation. On te donne l'énoncé et les options existantes d'un item (jamais la réponse correcte). Vérifie : doublon probable, indice involontaire dans la formulation, ambiguïté, biais (culturel, de genre, socio-économique...), et incohérence apparente de barème.
Réponds UNIQUEMENT avec du JSON valide :
{
  "issues": [
    { "type": "duplicate|unintended_hint|ambiguity|bias|scoring_incoherence", "severity": "low|medium|high", "description": "...", "suggestion": "..." }
  ]
}
Si aucun problème n'est détecté, renvoie "issues": [].`,
};

function buildUserPrompt(type: SuggestionType, body: RequestBody): string {
  if (type === "generation") {
    return `Extrait source :\n"""\n${body.sourceExcerpt}\n"""\n\nPropose un brouillon d'item conforme au format demandé.`;
  }
  const ctx = body.itemContext;
  const optionsList = ctx?.options?.length ? ctx.options.map((o, i) => `${i + 1}. ${o}`).join("\n") : "(aucune option)";
  return `Type d'item : ${ctx?.itemType ?? "inconnu"}\nÉnoncé : ${ctx?.promptText ?? ""}\nOptions existantes :\n${optionsList}\n\nRéponds au format demandé.`;
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null) as RequestBody | null;
    if (!body || !body.itemId || !body.suggestionType || !(body.suggestionType in SYSTEM_PROMPTS)) {
      return new Response(JSON.stringify({ error: "Requête invalide." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.suggestionType === "generation" && !body.sourceExcerpt?.trim()) {
      return new Response(JSON.stringify({ error: "Un extrait source est requis pour la génération." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reserves the row and enforces org controls (fournisseur/désactivation/
    // budget) server-side, on the caller's own JWT — never bypassed by this
    // function.
    const { data: reserved, error: reserveError } = await supabaseUser.rpc("request_item_ai_suggestion", {
      p_item_id: body.itemId,
      p_suggestion_type: body.suggestionType,
      p_source_excerpt: body.sourceExcerpt ?? null,
    });
    if (reserveError || !reserved) {
      return new Response(JSON.stringify({ error: reserveError?.message ?? "Suggestion refusée." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const suggestionId = (reserved as { id: string }).id;

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      const { data: failed } = await supabaseUser.rpc("complete_item_ai_suggestion", {
        p_suggestion_id: suggestionId, p_output: { error: "not_configured" }, p_model: null, p_failed: true,
      });
      return new Response(JSON.stringify({ error: "Les suggestions IA ne sont pas configurées sur le serveur.", suggestion: failed }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: SYSTEM_PROMPTS[body.suggestionType],
        messages: [{ role: "user", content: buildUserPrompt(body.suggestionType, body) }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      console.error("[generate-item-ai-suggestion] Anthropic API error:", res.status, errText);
      const { data: failed } = await supabaseUser.rpc("complete_item_ai_suggestion", {
        p_suggestion_id: suggestionId, p_output: { error: errText }, p_model: MODEL, p_failed: true,
      });
      return new Response(JSON.stringify({ error: `Erreur API (${res.status})`, suggestion: failed }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json() as { content?: Array<{ text?: string }> };
    const text = data.content?.[0]?.text ?? "";
    let output: unknown;
    try {
      output = JSON.parse(text);
    } catch {
      const { data: failed } = await supabaseUser.rpc("complete_item_ai_suggestion", {
        p_suggestion_id: suggestionId, p_output: { error: "invalid_json", raw: text.slice(0, 2000) }, p_model: MODEL, p_failed: true,
      });
      return new Response(JSON.stringify({ error: "Réponse du modèle non exploitable.", suggestion: failed }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: completed, error: completeError } = await supabaseUser.rpc("complete_item_ai_suggestion", {
      p_suggestion_id: suggestionId, p_output: output, p_model: MODEL, p_failed: false,
    });
    if (completeError) {
      return new Response(JSON.stringify({ error: completeError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(completed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[generate-item-ai-suggestion] error:", err);
    return new Response(JSON.stringify({ error: "Erreur interne." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
