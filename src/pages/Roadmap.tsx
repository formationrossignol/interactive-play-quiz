import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import { ChevronUp } from "lucide-react";
import "./roadmap-pages.css";

type Cat = "all" | "live" | "exams" | "analytics" | "integrations";

const CHIPS: { key: Cat; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "live", label: "Sessions live" },
  { key: "exams", label: "Examens" },
  { key: "analytics", label: "Analytics" },
  { key: "integrations", label: "Intégrations" },
];

type Card = {
  id: string;
  votes: number;
  title: string;
  sub: string;
  tags?: { label: string; eta?: boolean }[];
  cat: Cat | "builder" | "a11y" | "orga";
  locked?: boolean; // "En développement" — vote locked on
  beta?: boolean;
};

const COLUMNS: {
  key: string;
  head: string;
  headStyle: React.CSSProperties;
  cards: Card[];
  shipped?: boolean;
}[] = [
  {
    key: "idea",
    head: "👀 À l'étude",
    headStyle: { background: "var(--ap-paper-2)", borderColor: "var(--ap-line-2)", color: "var(--ap-muted)" },
    cards: [
      { id: "img", votes: 64, title: "Questions avec images et schémas", sub: "Insérer un visuel dans l'énoncé et les réponses.", tags: [{ label: "Builder" }], cat: "builder" },
      { id: "offline", votes: 41, title: "Mode hors-ligne pour l'hôte", sub: "Animer une session sans réseau fiable en salle.", tags: [{ label: "Sessions live" }], cat: "live" },
      { id: "coedit", votes: 27, title: "Co-édition de quiz à plusieurs", sub: "Travailler un même quiz en équipe de formateurs.", tags: [{ label: "Builder" }], cat: "builder" },
      { id: "captions", votes: 19, title: "Sous-titres live pour l'accessibilité", sub: "Transcription des questions lues à voix haute.", tags: [{ label: "Accessibilité" }], cat: "a11y" },
    ],
  },
  {
    key: "planned",
    head: "🗓 Planifié",
    headStyle: { background: "var(--ap-poll-soft)", borderColor: "var(--ap-poll)", color: "var(--ap-poll-deep)" },
    cards: [
      { id: "moodle", votes: 98, title: "Intégration Moodle / LMS (SCORM)", sub: "Exporter quiz et résultats vers votre LMS.", tags: [{ label: "Intégrations" }, { label: "ETA T4 2026", eta: true }], cat: "integrations" },
      { id: "reports", votes: 73, title: "Rapports analytics automatiques par email", sub: "Le débrief de session dans votre boîte mail.", tags: [{ label: "Analytics" }, { label: "ETA T4 2026", eta: true }], cat: "analytics" },
      { id: "shared-bank", votes: 55, title: "Banque de questions partagée en équipe", sub: "Un référentiel commun pour plusieurs formateurs.", tags: [{ label: "Organisation" }, { label: "ETA T1 2027", eta: true }], cat: "orga" },
    ],
  },
  {
    key: "dev",
    head: "🔨 En développement",
    headStyle: { background: "var(--ap-flash-soft)", borderColor: "var(--ap-flash)", color: "var(--ap-flash-deep)" },
    cards: [
      { id: "teams", votes: 143, title: "Mode équipes", sub: "Scores cumulés par table pour les ateliers en sous-groupes.", tags: [{ label: "Sessions live" }], cat: "live", locked: true, beta: true },
      { id: "manual-grade", votes: 87, title: "Correction manuelle des réponses libres", sub: "Interface de correction copie par copie pour les examens.", tags: [{ label: "Examens" }], cat: "exams", locked: true },
    ],
  },
];

const SHIPPED: { votes: number; title: string; sub: string; link?: boolean; cat: Cat | "builder" }[] = [
  { votes: 126, title: "Génération de quiz par IA", sub: "Livré en juin · ", link: true, cat: "builder" },
  { votes: 84, title: "Alertes de sortie d'onglet (examens)", sub: "Livré en mai", cat: "exams" },
  { votes: 61, title: "Export PDF des résultats", sub: "Livré en avril", cat: "analytics" },
];

const Roadmap = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Cat>("all");
  const [voted, setVoted] = useState<Record<string, boolean>>({});
  const [remaining, setRemaining] = useState(1);
  const [shake, setShake] = useState<string | null>(null);
  useSEO({
    title: "Roadmap publique",
    description: "Votez pour les prochaines fonctionnalités de Ludiq. Les idées les plus votées passent en développement — et vous êtes prévenu quand elles sortent.",
    path: "/roadmap",
  });

  const match = (cat: string) => filter === "all" || cat === filter;

  const toggleVote = (id: string) => {
    const on = !!voted[id];
    if (!on && remaining === 0) {
      setShake(id);
      setTimeout(() => setShake(null), 240);
      return;
    }
    setVoted((v) => ({ ...v, [id]: !on }));
    setRemaining((r) => r + (on ? 1 : -1));
  };

  const usedDots = 3 - remaining;

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
            {COLUMNS.map((col) => {
              const cards = col.cards.filter((c) => match(c.cat));
              return (
                <div className="rcol" key={col.key}>
                  <div className="rcol-head" style={col.headStyle}>
                    {col.head}
                    <span className="cnt">{cards.length}</span>
                  </div>
                  {cards.map((card) => {
                    const on = card.locked || !!voted[card.id];
                    return (
                      <div
                        className="card rcard"
                        key={card.id}
                        style={col.key === "dev" ? { borderColor: "var(--ap-flash)" } : undefined}
                      >
                        <button
                          className={`vote${on ? " on" : ""}`}
                          disabled={card.locked}
                          onClick={() => !card.locked && toggleVote(card.id)}
                          style={shake === card.id ? { animation: "lq-shake .24s" } : undefined}
                        >
                          <ChevronUp size={13} strokeWidth={3} />
                          <span>{card.votes + (voted[card.id] ? 1 : 0)}</span>
                        </button>
                        <div className="rt">
                          <b>{card.title}</b>
                          <small>{card.sub}</small>
                          {card.tags && (
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
              <div
                className="rcol-head"
                style={{ background: "var(--ap-pres-soft)", borderColor: "var(--ap-pres)", color: "var(--ap-pres-deep)" }}
              >
                ✅ Livré
                <span className="cnt">{SHIPPED.filter((s) => match(s.cat)).length}</span>
              </div>
              {SHIPPED.filter((s) => match(s.cat)).map((s, i) => (
                <div className="card rcard" key={i}>
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
          </div>

          <div className="card submit-idea">
            <div>
              <h3 style={{ fontSize: "16px", marginBottom: "4px" }}>Une idée qui n'est pas dans la liste ?</h3>
              <input placeholder="Décrivez-la en une phrase… on vérifie qu'elle n'existe pas déjà" />
            </div>
            <button className="btn" onClick={() => navigate("/contact")}>Proposer l'idée</button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Roadmap;
