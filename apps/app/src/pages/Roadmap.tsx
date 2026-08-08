import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { MaterialSymbol } from "@/components/MaterialSymbol";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useSEO } from "@/hooks/useSEO";
import { fetchRoadmap, setRoadmapVote, submitRoadmapIdea } from "@/lib/pages/publicRepo";
import type { RoadmapCol, RoadmapView } from "@/lib/pages/types";

const EMPTY: RoadmapView = { idea: [], planned: [], dev: [], shipped: [] };
const COLUMNS: { key: RoadmapCol; label: string; icon: string; tone: string }[] = [
  { key: "idea", label: "À l’étude", icon: "lightbulb", tone: "request" },
  { key: "planned", label: "Planifié", icon: "event_upcoming", tone: "planned" },
  { key: "dev", label: "En développement", icon: "construction", tone: "progress" },
  { key: "shipped", label: "Livré", icon: "task_alt", tone: "complete" },
];

export default function Roadmap() {
  const [view, setView] = useState<RoadmapView>(EMPTY);
  const [remaining, setRemaining] = useState(3);
  const [loading, setLoading] = useState(true);
  const [idea, setIdea] = useState("");
  const [ideaOpen, setIdeaOpen] = useState(false);
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
      setIdeaOpen(false);
      toast.success("Votre idée a été transmise");
    } catch (error) {
      if (error instanceof Error && error.message === "AUTH_REQUIRED") window.location.href = "/auth";
      else toast.error("L’idée n’a pas pu être envoyée");
    }
  };

  return (
    <AppLayout subtitle="Roadmap">
      <div className="product-page product-roadmap-page">
        <PageHeader
          title="Roadmap produit"
          eyebrow="Kanban"
          description="Suivez chaque évolution, de la première idée jusqu’à sa mise en ligne."
          action={<span className="product-roadmap-votes"><MaterialSymbol name="how_to_vote" size={18} /><strong>{remaining}/3</strong><small>votes disponibles</small></span>}
        />

        <section className="ap-card product-kanban-shell" aria-label="Roadmap organisée en kanban">
          <header className="product-kanban-toolbar">
            <div><span className="product-chart-eyebrow">Roadmap collaborative</span><h2>Le travail rendu simple</h2></div>
            <Button onClick={() => setIdeaOpen(true)}><MaterialSymbol name="add" size={18} /> Proposer une idée</Button>
          </header>

          <div className="product-kanban-board">
            {COLUMNS.map(({ key, label, icon, tone }) => (
              <section key={key} className="product-kanban-column" data-tone={tone} aria-labelledby={`roadmap-${key}`}>
                <header className="product-kanban-column__header">
                  <span className="product-kanban-column__dot" />
                  <MaterialSymbol name={icon} size={18} />
                  <strong id={`roadmap-${key}`}>{label}</strong>
                  <span>{view[key].length}</span>
                </header>
                <div className="product-kanban-column__cards">
                  {loading ? Array.from({ length: 2 }, (_, index) => (
                    <article key={index} className="product-kanban-card"><Skeleton className="h-5 w-3/4" /><Skeleton className="mt-3 h-3 w-full" /><Skeleton className="mt-2 h-3 w-2/3" /></article>
                  )) : view[key].length === 0 ? (
                    <button type="button" className="product-kanban-empty" onClick={() => setIdeaOpen(true)}><MaterialSymbol name="add_task" size={22} /><span>Ajouter une idée</span></button>
                  ) : view[key].map((card) => (
                    <article key={card.id} className="product-kanban-card">
                      <div className="product-kanban-card__top">
                        <span className="product-kanban-card__category">{card.cat}</span>
                        {"beta" in card && card.beta && <span className="product-kanban-card__beta">Bêta</span>}
                        <button type="button" aria-label={`Plus d’options pour ${card.title}`} onClick={() => toast.info(`${card.title} · ${label}`)}><MaterialSymbol name="more_vert" size={18} /></button>
                      </div>
                      <h3>{card.title}</h3>
                      {card.sub && <p>{card.sub}</p>}
                      {"tags" in card && card.tags.length > 0 && (
                        <div className="product-kanban-card__tags">
                          {card.tags.slice(0, 3).map((tag) => <span key={tag.label} data-eta={tag.eta || undefined}>{tag.label}</span>)}
                        </div>
                      )}
                      <footer>
                        <span><MaterialSymbol name={key === "shipped" ? "verified" : "schedule"} size={16} />{key === "shipped" ? "Disponible" : "Mise à jour récente"}</span>
                        {"voted" in card ? (
                          <button
                            type="button"
                            data-voted={card.voted || undefined}
                            disabled={pendingId === card.id || card.locked || (!card.voted && remaining === 0)}
                            onClick={() => void vote(card.id, card.voted, card.locked)}
                            aria-label={`${card.votes} votes pour ${card.title}`}
                          >
                            <MaterialSymbol name="arrow_upward" size={15} />{card.votes}
                          </button>
                        ) : <span className="product-kanban-card__votes"><MaterialSymbol name="thumb_up" size={15} />{card.votes}</span>}
                      </footer>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>

        <Dialog open={ideaOpen} onOpenChange={setIdeaOpen}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Proposer une idée</DialogTitle>
              <DialogDescription>Décrivez le besoin utilisateur ; l’équipe produit étudiera sa faisabilité.</DialogDescription>
            </DialogHeader>
            <label className="product-roadmap-idea-label" htmlFor="roadmap-idea">Votre idée<Input id="roadmap-idea" value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="Ex. Exporter les résultats au format…" /></label>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIdeaOpen(false)}>Annuler</Button>
              <Button disabled={!idea.trim()} onClick={() => void submitIdea()}><MaterialSymbol name="send" size={17} /> Envoyer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
