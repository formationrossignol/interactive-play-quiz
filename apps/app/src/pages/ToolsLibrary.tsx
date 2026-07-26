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
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div style={{ marginBottom: "32px" }}>
          <h1 className="ap-h2" style={{ fontSize: "26px", marginBottom: "4px" }}>Outils</h1>
          <p className="ap-muted" style={{ fontSize: "14px" }}>
            Des mini-outils autonomes à utiliser en classe, sans quiz ni compte requis.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.path}
                type="button"
                className="ap-card ap-card--hover"
                onClick={() => navigate(tool.path)}
                style={{ textAlign: "left", display: "flex", flexDirection: "column", cursor: "pointer", overflow: "hidden", padding: 0 }}
              >
                <div
                  className="relative h-52 w-full flex-shrink-0 flex items-center justify-center"
                  style={{ background: `color-mix(in srgb, ${tool.accent} 14%, var(--ap-paper-2))` }}
                >
                  <Icon style={{ width: 40, height: 40, color: tool.accent, opacity: 0.8 }} />
                </div>
                <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <h3 className="ap-h3" style={{ fontSize: "16px" }}>{tool.title}</h3>
                  <p className="ap-muted" style={{ fontSize: "13px", margin: 0 }}>{tool.description}</p>
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
