import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

// Kept server-side deliberately — this is the Qualiopi generation "recipe";
// the client only ever sends the source document, never the prompt.
const SYSTEM_PROMPT = `Tu es un expert en ingénierie pédagogique certifié Qualiopi (Référentiel National Qualité, décret du 6 juin 2019). Tu conçois des formations professionnelles rigoureuses et conformes aux exigences du référentiel.

Exigences Qualiopi à respecter :
— Objectifs pédagogiques rédigés avec des verbes opérationnels de la taxonomie de Bloom (identifier, analyser, évaluer, concevoir, distinguer, appliquer, démontrer…)
— Progression pédagogique logique : du simple vers le complexe, des savoirs vers les savoir-faire
— Contenus structurés : théorie, exemples concrets, points-clés mémorisables
— Évaluation des acquis en fin de chaque module (quiz de validation des compétences)
— Durées réalistes et formatées : 15–30 min par leçon de lecture, 45–90 min par module

Règles impératives de génération :
— Réponds UNIQUEMENT avec du JSON valide, aucun texte avant ou après
— Le champ "content" de chaque leçon doit être du HTML riche :
  • <p>paragraphes</p>
  • <h2>sous-titres de section</h2>
  • <strong>termes clés en gras</strong>
  • <code>éléments techniques</code>
  • <div class="keypoint">💡 Point clé à retenir</div> pour les éléments cruciaux
— Les quiz doivent comporter 5 à 8 questions par module
— Types de questions autorisés : "single-choice" (avec 4 réponses) et "true-false"
— correctAnswer = index 0-based pour single-choice, "true" ou "false" pour true-false
— Maximum 4 modules, maximum 3 leçons de contenu par module (hors quiz)
— Génère du contenu pédagogique substantiel (pas de placeholders)`;

function buildUserPrompt(filename: string): string {
  return `Analyse le document "${filename}" fourni ci-dessus et génère un cours professionnel complet, conforme Qualiopi.

Réponds UNIQUEMENT avec ce JSON (aucun texte avant ou après) :

{
  "title": "Titre du cours",
  "description": "Description concise du cours en 2-3 phrases",
  "prerequisites": "Prérequis nécessaires (connaissances, expérience, équipements)",
  "target_audience": "Public cible de la formation",
  "total_hours": 4,
  "category": "Catégorie (ex: Informatique, Management, Sécurité…)",
  "modules": [
    {
      "title": "Titre du module 1",
      "pedagogical_objective": "À l'issue de ce module, le stagiaire sera capable de [verbe Bloom] [compétence observable et mesurable]",
      "duration_minutes": 60,
      "lessons": [
        {
          "title": "Titre de la leçon",
          "estimated_minutes": 20,
          "content": "<p>Contenu HTML substantiel...</p><h2>Section</h2><p>Suite...</p><div class=\\"keypoint\\">💡 Point clé</div>"
        }
      ],
      "quiz": {
        "title": "Évaluation — Module 1",
        "questions": [
          {
            "question": "Question de validation ?",
            "type": "single-choice",
            "answers": ["Option A", "Option B", "Option C", "Option D"],
            "correctAnswer": 0,
            "points": 100,
            "timeLimit": 30
          },
          {
            "question": "Affirmation vraie ou fausse ?",
            "type": "true-false",
            "answers": ["Vrai", "Faux"],
            "correctAnswer": "true",
            "points": 100,
            "timeLimit": 20
          }
        ]
      }
    }
  ]
}`;
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

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "La génération IA n'est pas configurée sur le serveur." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null) as { content?: unknown[]; filename?: string } | null;
    if (!body || !Array.isArray(body.content) || typeof body.filename !== "string" || !body.filename) {
      return new Response(JSON.stringify({ error: "Requête invalide." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: [...body.content, { type: "text", text: buildUserPrompt(body.filename) }],
        }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      console.error("[generate-course] Anthropic API error:", res.status, errText);
      return new Response(JSON.stringify({ error: `Erreur API (${res.status}) : ${errText}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json() as { content?: Array<{ text?: string }> };
    const text = data.content?.[0]?.text ?? "";

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[generate-course] error:", err);
    return new Response(JSON.stringify({ error: "La génération du cours a échoué." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
