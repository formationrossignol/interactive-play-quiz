import {
  ArrowUpDown,
  Check,
  GripVertical,
  Link2,
  MessageSquareText,
  Star,
} from "lucide-react";
import type { PollQuestionType, QuizQuestionType } from "@/lib/questionTypes";

type QuestionType = QuizQuestionType | PollQuestionType;

const cardStyle: React.CSSProperties = {
  background: "var(--ap-card)",
  border: "var(--ap-border-w) solid var(--ap-line)",
  borderRadius: "var(--ap-r-md)",
  boxShadow: "var(--ap-shadow-soft)",
};

const examples: Record<QuestionType, { eyebrow: string; question: string }> = {
  "multiple-choice": { eyebrow: "Choix multiples", question: "Quelle option choisiriez-vous ?" },
  "single-choice": { eyebrow: "Choix unique", question: "Quelle proposition vous correspond le mieux ?" },
  "true-false": { eyebrow: "Vrai / Faux", question: "Cette affirmation est-elle correcte ?" },
  "short-answer": { eyebrow: "Réponse courte", question: "Quel mot complète cette définition ?" },
  ranking: { eyebrow: "Classement", question: "Classez ces priorités de la plus importante à la moins importante." },
  matching: { eyebrow: "Association", question: "Associez chaque notion à sa définition." },
  "fill-blank": { eyebrow: "Texte à trous", question: "Complétez la phrase avec le terme manquant." },
  "drag-drop": { eyebrow: "Glisser-déposer", question: "Déplacez chaque élément dans la bonne zone." },
  hotspot: { eyebrow: "Zone cliquable", question: "Cliquez sur la zone correcte de l’image." },
  slider: { eyebrow: "Curseur", question: "Positionnez le curseur sur votre réponse." },
  "likert-scale": { eyebrow: "Échelle de Likert", question: "Dans quelle mesure êtes-vous d’accord ?" },
  "frequency-scale": { eyebrow: "Échelle de fréquence", question: "À quelle fréquence réalisez-vous cette action ?" },
  "star-rating": { eyebrow: "Notation", question: "Comment évaluez-vous cette expérience ?" },
  "open-text": { eyebrow: "Question ouverte", question: "Quelle amélioration proposeriez-vous ?" },
  "nps-scale": { eyebrow: "Échelle NPS", question: "Recommanderiez-vous cette expérience à un collègue ?" },
};

function ChoiceExample({ multiple }: { multiple: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {["Première option", "Deuxième option", "Troisième option", "Autre réponse"].map((label, index) => (
        <div key={label} style={{ ...cardStyle, padding: "15px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 22, height: 22, borderRadius: multiple ? 6 : "50%", border: `2px solid ${index === 0 ? "var(--ap-brand)" : "var(--ap-line-2)"}`, background: index === 0 ? "var(--ap-brand)" : "transparent", display: "grid", placeItems: "center", flexShrink: 0 }}>
            {index === 0 && <Check size={14} color="#fff" strokeWidth={3} />}
          </span>
          <b style={{ fontSize: 13 }}>{label}</b>
        </div>
      ))}
    </div>
  );
}

function ScaleExample({ type }: { type: QuestionType }) {
  if (type === "star-rating") {
    return (
      <div style={{ ...cardStyle, display: "flex", justifyContent: "center", gap: 12, padding: 26 }}>
        {[0, 1, 2, 3, 4].map((index) => <Star key={index} size={34} fill={index < 4 ? "var(--ap-flash)" : "transparent"} color="var(--ap-flash)" />)}
      </div>
    );
  }
  const labels = type === "frequency-scale"
    ? ["Jamais", "Rarement", "Parfois", "Souvent", "Toujours"]
    : type === "nps-scale"
      ? Array.from({ length: 11 }, (_, index) => String(index))
      : ["Pas du tout", "Plutôt non", "Neutre", "Plutôt oui", "Tout à fait"];
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))`, gap: type === "nps-scale" ? 5 : 8 }}>
        {labels.map((label, index) => (
          <div key={label} style={{ ...cardStyle, minHeight: type === "nps-scale" ? 40 : 64, padding: type === "nps-scale" ? 8 : 10, display: "grid", placeItems: "center", textAlign: "center", fontSize: type === "nps-scale" ? 12 : 11, fontWeight: 800, color: index === Math.floor(labels.length / 2) ? "#fff" : "var(--ap-ink)", background: index === Math.floor(labels.length / 2) ? "var(--ap-brand)" : "var(--ap-card)" }}>
            {label}
          </div>
        ))}
      </div>
      {type === "nps-scale" && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 9, fontSize: 11, fontWeight: 700, color: "var(--ap-muted)" }}>
          <span>Pas du tout probable</span><span>Très probable</span>
        </div>
      )}
    </div>
  );
}

function TypeSpecificExample({ type }: { type: QuestionType }) {
  if (type === "multiple-choice" || type === "single-choice") return <ChoiceExample multiple={type === "multiple-choice"} />;
  if (type === "true-false") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ ...cardStyle, padding: 24, textAlign: "center", color: "var(--ap-pres-deep)", background: "var(--ap-pres-soft)", fontWeight: 900 }}>Vrai</div>
        <div style={{ ...cardStyle, padding: 24, textAlign: "center", color: "var(--ap-quiz-deep)", background: "var(--ap-quiz-soft)", fontWeight: 900 }}>Faux</div>
      </div>
    );
  }
  if (type === "likert-scale" || type === "frequency-scale" || type === "star-rating" || type === "nps-scale") return <ScaleExample type={type} />;
  if (type === "slider") {
    return (
      <div style={{ ...cardStyle, padding: "26px 28px" }}>
        <div style={{ height: 8, borderRadius: 999, background: "linear-gradient(90deg, var(--ap-brand) 58%, var(--ap-line) 58%)", position: "relative" }}>
          <span style={{ position: "absolute", left: "58%", top: "50%", width: 30, height: 30, borderRadius: "50%", background: "var(--ap-brand)", border: "4px solid #fff", transform: "translate(-50%, -50%)", boxShadow: "0 2px 8px rgba(0,0,0,.2)" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18, fontSize: 12, fontWeight: 800, color: "var(--ap-muted)" }}><span>0</span><span>100</span></div>
      </div>
    );
  }
  if (type === "ranking") {
    return (
      <div style={{ display: "grid", gap: 9 }}>
        {["Priorité principale", "Deuxième priorité", "Troisième priorité"].map((label, index) => (
          <div key={label} style={{ ...cardStyle, padding: "12px 15px", display: "flex", alignItems: "center", gap: 10 }}>
            <GripVertical size={16} color="var(--ap-muted)" /><b style={{ color: "var(--ap-brand)" }}>{index + 1}</b><span style={{ fontSize: 13, fontWeight: 750 }}>{label}</span>
          </div>
        ))}
      </div>
    );
  }
  if (type === "matching") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center" }}>
        {["Concept A", "Définition A", "Concept B", "Définition B"].map((label, index) => (
          <div key={label} style={index % 2 === 0 ? { display: "contents" } : undefined}>
            {index % 2 === 0 && <div style={{ ...cardStyle, padding: 13, fontSize: 13, fontWeight: 800 }}>{label}</div>}
            {index % 2 === 0 && <Link2 size={16} color="var(--ap-brand)" />}
            {index % 2 === 0 && <div style={{ ...cardStyle, padding: 13, fontSize: 13, fontWeight: 800 }}>{index === 0 ? "Définition A" : "Définition B"}</div>}
          </div>
        ))}
      </div>
    );
  }
  if (type === "fill-blank") {
    return <div style={{ ...cardStyle, padding: 26, textAlign: "center", fontSize: 20, fontWeight: 800 }}>La capitale de la France est <span style={{ display: "inline-block", minWidth: 110, borderBottom: "3px solid var(--ap-brand)", color: "var(--ap-brand)" }}>Paris</span>.</div>;
  }
  if (type === "open-text" || type === "short-answer") {
    return (
      <div style={{ ...cardStyle, padding: 18, minHeight: type === "open-text" ? 118 : 64, color: "var(--ap-muted)", display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13 }}>
        <MessageSquareText size={19} /><span>{type === "open-text" ? "Les participants écrivent ici une réponse libre…" : "Saisissez votre réponse…"}</span>
      </div>
    );
  }
  return (
    <div style={{ ...cardStyle, minHeight: 130, display: "grid", placeItems: "center", color: "var(--ap-muted)", fontWeight: 800 }}>
      <ArrowUpDown size={28} />
    </div>
  );
}

export function QuestionTypeExample({ type }: { type: QuestionType }) {
  const example = examples[type];
  return (
    <div aria-live="polite" style={{ maxWidth: 760, margin: "0 auto", height: "100%", minHeight: 500, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <span style={{ display: "inline-flex", padding: "6px 11px", borderRadius: 999, background: "var(--ap-brand-soft)", color: "var(--ap-brand-deep)", fontSize: 11, fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase" }}>{example.eyebrow}</span>
        <h2 style={{ margin: "14px auto 7px", maxWidth: 650, fontSize: 25, lineHeight: 1.25, fontWeight: 900, color: "var(--ap-ink)" }}>{example.question}</h2>
        <p style={{ margin: 0, color: "var(--ap-muted)", fontSize: 13, fontWeight: 650 }}>Aperçu générique — sélectionnez ce type pour le personnaliser</p>
      </div>
      <TypeSpecificExample type={type} />
    </div>
  );
}
