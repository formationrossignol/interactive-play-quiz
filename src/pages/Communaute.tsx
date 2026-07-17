import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import { ChevronUp, MessageCircle } from "lucide-react";
import "./community-pages.css";

const CATS = [
  { emoji: "📣", bg: "--ap-brand-soft", title: "Annonces", sub: "Nouveautés produit · 34 sujets" },
  { emoji: "🤝", bg: "--ap-pres-soft", title: "Entraide", sub: "Questions & réponses · 612 sujets" },
  { emoji: "🎁", bg: "--ap-quiz-soft", title: "Partage de quiz", sub: "Vos créations publiques · 287 sujets" },
  { emoji: "💡", bg: "--ap-flash-soft", title: "Idées & votes", sub: "La feuille de route, décidée avec vous · 96 idées" },
];

const THREADS = [
  { av: "🧑‍🏫", title: "Comment gérer les retardataires sans casser le rythme ?", meta: "Entraide · par Julien P. · il y a 2 h", solved: true, likes: null, replies: 14 },
  { av: "👩‍💻", title: "[Partage] Pack 40 questions Kubernetes CKA, niveau examen", meta: "Partage de quiz · par Nadia B. · il y a 5 h", solved: false, likes: 28, replies: 9 },
  { av: "🧔", title: "Session à 180 joueurs hier : mon retour d'expérience complet", meta: "Entraide · par Karim T. · hier", solved: false, likes: 41, replies: 22 },
  { av: "📣", title: "Nouveauté juillet : le mode équipes arrive en bêta", meta: "Annonces · par l'équipe Brivia · il y a 3 j", solved: false, likes: 96, replies: 37 },
  { av: "👩‍🏫", title: "Examens : que répondre à un étudiant qui conteste une alerte onglet ?", meta: "Entraide · par Sarah M. · il y a 4 j", solved: true, likes: null, replies: 11 },
];

const IDEAS = [
  { base: 142, title: "Mode équipes (scores cumulés par table)", sub: "Pour les ateliers en sous-groupes", st: "idst--dev", stLabel: "🔨 En développement" },
  { base: 98, title: "Intégration Moodle / LMS (export SCORM)", sub: "Pour les établissements", st: "idst--plan", stLabel: "🗓 Planifié — T4 2026" },
  { base: 64, title: "Questions avec images et schémas", sub: "Indispensable en sciences et technique", st: "idst--new", stLabel: "👀 À l'étude" },
];

const TOP = [
  { rank: 1, who: "🧔 Karim T.", badge: "Mentor" },
  { rank: 2, who: "👩‍🏫 Sarah M.", badge: "Mentor" },
  { rank: 3, who: "👩‍💻 Nadia B.", badge: "Créatrice" },
];

const Communaute = () => {
  const navigate = useNavigate();
  const [voted, setVoted] = useState<Record<number, boolean>>({});
  useSEO({
    title: "Communauté",
    description: "2 400 formateurs qui s'entraident : posez vos questions, partagez vos quiz et votez pour les prochaines fonctionnalités.",
    path: "/community",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Header />
      <main className="lq" style={{ flex: 1 }}>
        <div className="wrap">
          <div className="page-hero">
            <span className="eyebrow">Communauté</span>
            <h1>2 400 formateurs qui s'entraident.</h1>
            <p className="lead">Posez vos questions, partagez vos quiz, votez pour les prochaines fonctionnalités.</p>
          </div>

          <div className="ccats">
            {CATS.map((c) => (
              <div className="card ccat" key={c.title}>
                <span className="cemo" style={{ background: `var(${c.bg})` }}>{c.emoji}</span>
                <div>
                  <b>{c.title}</b>
                  <small>{c.sub}</small>
                </div>
              </div>
            ))}
          </div>

          <div className="comm-grid">
            <div className="card" style={{ overflow: "hidden", position: "relative" }}>
              <div style={{ padding: "16px 18px 8px", display: "flex", alignItems: "center", gap: "10px" }}>
                <h3 style={{ fontSize: "16px" }}>Discussions récentes</h3>
                <span style={{ flex: 1 }} />
                <button className="btn btn--sm" onClick={() => navigate("/contact")}>Nouveau sujet</button>
              </div>
              {THREADS.map((th, i) => (
                <div className="threadrow" key={i}>
                  <span className="tav">{th.av}</span>
                  <div className="tt">
                    <b>{th.title}</b>
                    <small>{th.meta}</small>
                  </div>
                  {th.solved && <span className="solved">✓ Résolu</span>}
                  <div className="tstats">
                    {th.likes != null && <span>❤ {th.likes}</span>}
                    <span><MessageCircle size={12} strokeWidth={2.4} />{th.replies}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div className="card" style={{ padding: "16px 18px", position: "relative" }}>
                <h3 style={{ fontSize: "15px", marginBottom: "8px" }}>💡 Idées les plus votées</h3>
                {IDEAS.map((idea, i) => {
                  const on = !!voted[i];
                  return (
                    <div className="iderow" key={i}>
                      <button
                        className={`vote${on ? " on" : ""}`}
                        aria-pressed={on}
                        onClick={() => setVoted((v) => ({ ...v, [i]: !v[i] }))}
                      >
                        <ChevronUp size={13} strokeWidth={3} />
                        <span>{idea.base + (on ? 1 : 0)}</span>
                      </button>
                      <div className="it">
                        <b>{idea.title}</b>
                        <small>{idea.sub}</small>
                        <span className={`idst ${idea.st}`}>{idea.stLabel}</span>
                      </div>
                    </div>
                  );
                })}
                <a
                  href="/contact"
                  onClick={(e) => { e.preventDefault(); navigate("/contact"); }}
                  style={{ display: "block", textAlign: "center", fontSize: "13px", marginTop: "10px" }}
                >
                  Proposer une idée →
                </a>
              </div>

              <div className="card" style={{ padding: "16px 18px" }}>
                <h3 style={{ fontSize: "15px", marginBottom: "6px" }}>🏆 Top contributeurs du mois</h3>
                {TOP.map((c) => (
                  <div className="toprow" key={c.rank}>
                    <span className="rank">{c.rank}</span>{c.who}
                    <span className="tbadge">{c.badge}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Communaute;
