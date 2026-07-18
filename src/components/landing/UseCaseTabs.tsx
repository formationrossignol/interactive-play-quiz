import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";

type Persona = "education" | "entreprise";

/** Bullets grounded in real product surfaces (ExamBuilder/ExamRoom timed
 *  auto-submit) and real plan caps from PlanComparator.tsx — no invented
 *  figures or features. */
const PANELS: Record<Persona, { title: string; bullets: string[]; cta: string; route: string }> = {
  education: {
    title: "Pour les enseignants et formateurs",
    bullets: [
      "Élèves et stagiaires rejoignent par code ou QR code, sans compte à créer",
      "Quiz, flashcards et examens chronométrés à soumission automatique, dans le même outil",
      "Gratuit jusqu'à 20 participants par session, sans limite de durée",
    ],
    cta: "Créer mon premier quiz",
    route: "/builder-start?type=quiz",
  },
  entreprise: {
    title: "Pour les entreprises et écoles",
    bullets: [
      "Jusqu'à 200 participants simultanés en plan Pro, illimité en plan Entreprise",
      "Rapports de performance détaillés et export des résultats",
      "SSO, marque blanche et success manager dédié en plan Entreprise",
    ],
    cta: "Voir les formules",
    route: "/pricing",
  },
};

export const UseCaseTabs = () => {
  const navigate = useNavigate();
  const [persona, setPersona] = useState<Persona>("education");
  const panel = PANELS[persona];

  return (
    <div className="ap-card ap-card--floaty" style={{ padding: "32px 36px" }}>
      <div className="ap-seg" style={{ maxWidth: 360, margin: "0 auto 28px" }}>
        <button
          type="button"
          className={persona === "education" ? "is-on" : undefined}
          onClick={() => setPersona("education")}
        >
          Éducation
        </button>
        <button
          type="button"
          className={persona === "entreprise" ? "is-on" : undefined}
          onClick={() => setPersona("entreprise")}
        >
          Entreprise
        </button>
      </div>

      <h3 className="ap-h3" style={{ textAlign: "center", marginBottom: "20px" }}>{panel.title}</h3>

      <ul style={{ listStyle: "none", display: "grid", gap: "14px", maxWidth: 560, margin: "0 auto 28px", padding: 0 }}>
        {panel.bullets.map((bullet) => (
          <li key={bullet} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <Check style={{ width: 18, height: 18, color: "var(--ap-brand)", flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontFamily: "var(--ap-font-body)", fontSize: "14.5px", color: "var(--ap-ink)", lineHeight: 1.5 }}>{bullet}</span>
          </li>
        ))}
      </ul>

      <div style={{ textAlign: "center" }}>
        <button className="ap-btn ap-btn--pill" onClick={() => navigate(panel.route)}>
          {panel.cta}
        </button>
      </div>
    </div>
  );
};
