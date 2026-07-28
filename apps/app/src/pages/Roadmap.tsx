import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Check, ChevronUp, Hammer, Lightbulb, Send } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { ExplorerEmptyState } from "@/components/content/ExplorerEmptyState";
import { useSEO } from "@/hooks/useSEO";
import { fetchRoadmap, setRoadmapVote, submitRoadmapIdea } from "@/lib/pages/publicRepo";
import type { RoadmapCol, RoadmapView } from "@/lib/pages/types";

const EMPTY: RoadmapView = { idea: [], planned: [], dev: [], shipped: [] };
const COLUMNS: { key: RoadmapCol; label: string; icon: typeof Lightbulb; color: string }[] = [
  { key: "idea", label: "À l’étude", icon: Lightbulb, color: "var(--ap-muted)" },
  { key: "planned", label: "Planifié", icon: CalendarDays, color: "var(--ap-poll)" },
  { key: "dev", label: "En développement", icon: Hammer, color: "var(--ap-flash-deep)" },
  { key: "shipped", label: "Livré", icon: Check, color: "var(--ap-pres)" },
];

export default function Roadmap() {
  const [view, setView] = useState<RoadmapView>(EMPTY);
  const [remaining, setRemaining] = useState(3);
  const [loading, setLoading] = useState(true);
  const [idea, setIdea] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  useSEO({ title: "Roadmap", description: "Votez pour les prochaines fonctionnalités de Brivia.", path: "/roadmap" });

  const refresh = useCallback(async () => {
    try {
      const data = await fetchRoadmap();
      setView(data.view);
      setRemaining(data.remaining);
    } catch {
      toast.error("Impossible de charger la roadmap");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const vote = async (id: string, voted: boolean, locked: boolean) => {
    if (locked || pendingId || (!voted && remaining === 0)) return;
    setPendingId(id);
    try {
      await setRoadmapVote(id, voted);
      await refresh();
    } catch (error) {
      if (error instanceof Error && error.message === "AUTH_REQUIRED") window.location.href = "/auth";
      else toast.error("Le vote n’a pas pu être enregistré");
    } finally {
      setPendingId(null);
    }
  };

  const submitIdea = async () => {
    if (!idea.trim()) return;
    try {
      await submitRoadmapIdea(idea.trim());
      setIdea("");
      toast.success("Votre idée a été transmise");
    } catch (error) {
      if (error instanceof Error && error.message === "AUTH_REQUIRED") window.location.href = "/auth";
      else toast.error("L’idée n’a pas pu être envoyée");
    }
  };

  return (
    <AppLayout subtitle="Roadmap">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 28 }}>
          <div>
            <h1 className="ap-h2" style={{ fontSize: 26, marginBottom: 4 }}>Roadmap produit</h1>
            <p className="ap-muted" style={{ fontSize: 14 }}>Votez pour les fonctionnalités qui comptent pour vous.</p>
          </div>
          <span className="ap-pill" style={{ padding: "8px 12px", fontSize: 12 }}>{remaining}/3 votes disponibles</span>
        </div>
        {!loading && COLUMNS.every((column) => view[column.key].length === 0) ? (
          <ExplorerEmptyState icon={<Lightbulb size={27} />} title="La roadmap est vide" body="Les prochaines évolutions apparaîtront ici." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(230px, 1fr))", gap: 14, overflowX: "auto", paddingBottom: 6 }}>
            {COLUMNS.map(({ key, label, icon: Icon, color }) => (
              <section key={key} style={{ minWidth: 230 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "9px 11px", borderRadius: "var(--ap-r-md)", border: "var(--ap-border-w) solid var(--ap-line)", background: "var(--ap-paper-2)", color }}>
                  <Icon size={16} /><strong style={{ fontSize: 13 }}>{label}</strong><span className="ap-pill" style={{ marginLeft: "auto", fontSize: 11 }}>{view[key].length}</span>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {view[key].map((card) => (
                    <article key={card.id} className="ap-card" style={{ padding: 14 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <button className={`ap-btn ap-btn--sm ${"voted" in card && card.voted ? "" : "ap-btn--ghost"}`} disabled={pendingId === card.id || !("voted" in card) || card.locked} onClick={() => "voted" in card && void vote(card.id, card.voted, card.locked)} style={{ minWidth: 42, display: "grid", gap: 1, padding: "6px 8px" }}>
                          <ChevronUp size={14} /><span>{card.votes}</span>
                        </button>
                        <div>
                          <strong style={{ display: "block", fontSize: 14, lineHeight: 1.35 }}>{card.title}</strong>
                          <p className="ap-muted" style={{ margin: "5px 0 0", fontSize: 12.5, lineHeight: 1.45 }}>{card.sub}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
        <div className="ap-card" style={{ marginTop: 22, padding: 18, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 300px" }}>
            <strong style={{ display: "block", marginBottom: 3 }}>Une idée à proposer ?</strong>
            <input className="ap-input" value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="Décrivez votre besoin en une phrase…" style={{ width: "100%", marginTop: 8 }} />
          </div>
          <button className="ap-btn ap-btn--sm" disabled={!idea.trim()} onClick={() => void submitIdea()}><Send size={15} /> Envoyer</button>
        </div>
      </div>
    </AppLayout>
  );
}
