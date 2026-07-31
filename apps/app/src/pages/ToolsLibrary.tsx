import { useNavigate } from "react-router-dom";
import { Dices, Timer } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useSEO } from "@/hooks/useSEO";

interface ToolCard {
  path: string;
  icon: typeof Dices;
  title: string;
  description: string;
  accent: string;
}

// Growing standalone-tools library — independent mini-apps usable without a
// course/quiz behind them (classroom utilities). More cards join this list
// as tools ship.
const TOOLS: ToolCard[] = [
  {
    path: "/tools/wheel",
    icon: Dices,
    title: "Roue de tirage au sort",
    description: "Ajoutez des noms ou options et laissez la roue désigner un gagnant au hasard.",
    accent: "var(--ap-quiz)",
  },
  {
    path: "/tools/chronometre",
    icon: Timer,
    title: "Chronomètre",
    description: "Démarrez, mettez en pause, enregistrez des tours.",
    accent: "var(--ap-poll)",
  },
];

const ToolsLibrary = () => {
  const navigate = useNavigate();
  useSEO({
    title: "Outils",
    description: "Une bibliothèque d'outils autonomes pour la classe : roue de tirage au sort, et bientôt plus.",
    path: "/tools",
  });

  return (
    <AppLayout subtitle="Outils">
      <div className="product-page">
        <div className="product-page-heading">
          <div>
          <h1>Outils de classe</h1>
          <p>
            Des mini-outils autonomes à utiliser en classe, sans quiz ni compte requis.
          </p>
          </div>
        </div>

        <div className="product-tool-grid">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.path}
                type="button"
                className="product-tool-card"
                onClick={() => navigate(tool.path)}
              >
                <div
                  className="product-tool-card__visual"
                  style={{ background: `color-mix(in srgb, ${tool.accent} 14%, var(--ap-paper-2))` }}
                >
                  <Icon style={{ width: 40, height: 40, color: tool.accent, opacity: 0.8 }} />
                </div>
                <div className="product-tool-card__body">
                  <h3>{tool.title}</h3>
                  <p>{tool.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default ToolsLibrary;
