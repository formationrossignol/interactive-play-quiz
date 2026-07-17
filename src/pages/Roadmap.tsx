import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import { ChevronUp } from "lucide-react";
import { useRoadmap } from "@/lib/pages/hooks";
import { useVote, useSubmitIdea } from "@/lib/pages/interactionHooks";
import { requireAuth } from "@/lib/pages/requireAuth";
import type { RoadmapCard } from "@/lib/pages/types";
import "./roadmap-pages.css";

type Cat = "all" | "live" | "exams" | "analytics" | "integrations";

const CHIPS: { key: Cat; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "live", label: "Sessions live" },
  { key: "exams", label: "Examens" },
  { key: "analytics", label: "Analytics" },
  { key: "integrations", label: "Intégrations" },
];

const COLS: { key: 'idea' | 'planned' | 'dev'; head: string; headStyle: React.CSSProperties }[] = [
  { key: 'idea', head: "👀 À l'étude", headStyle: { background: "var(--ap-paper-2)", borderColor: "var(--ap-line-2)", color: "var(--ap-muted)" } },
  { key: 'planned', head: "🗓 Planifié", headStyle: { background: "var(--ap-poll-soft)", borderColor: "var(--ap-poll)", color: "var(--ap-poll-deep)" } },
  { key: 'dev', head: "🔨 En développement", headStyle: { background: "var(--ap-flash-soft)", borderColor: "var(--ap-flash)", color: "var(--ap-flash-deep)" } },
];

const Roadmap = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Cat>("all");
  const { data: roadmap, isLoading } = useRoadmap();
  const view = roadmap?.view;
  const remaining = roadmap?.remaining ?? 3;
  const vote = useVote();
  const submitIdea = useSubmitIdea();
  const [ideaText, setIdeaText] = useState("");
  const [ideaSent, setIdeaSent] = useState(false);
  const usedDots = 3 - remaining;
  const [shake, setShake] = useState<string | null>(null);
  useSEO({
    title: "Roadmap publique",
    description: "Votez pour les prochaines fonctionnalités de Brivia. Les idées les plus votées passent en développement — et vous êtes prévenu quand elles sortent.",
    path: "/roadmap",
  });

  const match = (cat: string) => filter === "all" || cat === filter;

  const onVote = (card: { id: string; voted: boolean; locked: boolean }) => {
    if (card.locked) return;
    if (!requireAuth(navigate)) return;
    if (!card.voted && remaining === 0) {
      setShake(card.id);
      setTimeout(() => setShake(null), 240);
      return;
    }
    vote.mutate({ itemId: card.id, voted: card.voted });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Header />
      <main className="lq" style={{ flex: 1 }}>
        <div className="wrap">
          <div className="page-hero">
            <span className="eyebrow">Roadmap publique</span>
            <h1>C'est vous qui décidez de la suite.</h1>
            <p className="lead">
              Votez pour les fonctionnalités qui comptent pour vous. Les plus votées passent en développement — et vous êtes prévenu quand elles sortent.
            </p>
            <div className="quota">
              Vos votes disponibles
              <span className="qdots">
                {[0, 1, 2].map((i) => (
                  <i key={i} className={i < usedDots ? "used" : ""} />
                ))}
              </span>
              <span style={{ color: "var(--ap-muted)" }}>
                {remaining}/3 restant{remaining > 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <div className="chips">
            {CHIPS.map((c) => (
              <button key={c.key} className={`chip${filter === c.key ? " on" : ""}`} onClick={() => setFilter(c.key)}>
                {c.label}
              </button>
            ))}
          </div>

          <div className="rboard">
            {isLoading || !view ? (
              <div className="rcol" style={{ opacity: 0.5 }}>Chargement…</div>
            ) : (
              <>
                {COLS.map((col) => {
                  const cards = view[col.key].filter((c) => match(c.cat));
                  return (
                    <div className="rcol" key={col.key}>
                      <div className="rcol-head" style={col.headStyle}>
                        {col.head}
                        <span className="cnt">{cards.length}</span>
                      </div>
                      {cards.map((card: RoadmapCard) => {
                        return (
                          <div className="card rcard" key={card.id}
                            style={col.key === "dev" ? { borderColor: "var(--ap-flash)" } : undefined}>
                            <button className={`vote${card.locked || card.voted ? " on" : ""}`} disabled={card.locked || vote.isPending}
                              onClick={() => onVote(card)}
                              style={shake === card.id ? { animation: "lq-shake .24s" } : undefined}>
                              <ChevronUp size={13} strokeWidth={3} />
                              <span>{card.votes}</span>
                            </button>
                            <div className="rt">
                              <b>{card.title}</b>
                              <small>{card.sub}</small>
                              {card.tags.length > 0 && (
                                <div className="rtags">
                                  {card.tags.map((t, i) => (
                                    <span key={i} className={`rtag${t.eta ? " rtag--eta" : ""}`}>{t.label}</span>
                                  ))}
                                  {card.beta && <span className="betapill">Bêta ouverte</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                <div className="rcol">
                  <div className="rcol-head" style={{ background: "var(--ap-pres-soft)", borderColor: "var(--ap-pres)", color: "var(--ap-pres-deep)" }}>
                    ✅ Livré
                    <span className="cnt">{view.shipped.filter((s) => match(s.cat)).length}</span>
                  </div>
                  {view.shipped.filter((s) => match(s.cat)).map((s) => (
                    <div className="card rcard" key={s.id}>
                      <span className="shipvote">✓<span style={{ fontSize: "11px" }}>{s.votes}</span></span>
                      <div className="rt">
                        <b>{s.title}</b>
                        <small>
                          {s.sub}
                          {s.link && (
                            <a href="/changelog" onClick={(e) => { e.preventDefault(); navigate("/changelog"); }}>voir la nouveauté →</a>
                          )}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="card submit-idea">
            <div>
              <h3 style={{ fontSize: "16px", marginBottom: "4px" }}>Une idée qui n'est pas dans la liste ?</h3>
              <input value={ideaText} onChange={(e) => setIdeaText(e.target.value)}
                placeholder="Décrivez-la en une phrase… on vérifie qu'elle n'existe pas déjà" />
            </div>
            <button className="btn" disabled={submitIdea.isPending || !ideaText.trim()} onClick={() => {
              if (!requireAuth(navigate)) return;
              submitIdea.mutate(ideaText.trim(), {
                onSuccess: () => { setIdeaText(""); setIdeaSent(true); setTimeout(() => setIdeaSent(false), 3000); },
              });
            }}>{ideaSent ? "Merci !" : "Proposer l'idée"}</button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Roadmap;
