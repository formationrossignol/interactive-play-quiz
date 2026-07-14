import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import "./roadmap-pages.css";

type Kind = "all" | "new" | "imp" | "fix";

const CHIPS: { key: Kind; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "new", label: "✦ Nouveau" },
  { key: "imp", label: "↑ Amélioré" },
  { key: "fix", label: "🔧 Corrigé" },
];

const KIND_LABEL: Record<string, { cls: string; label: string }> = {
  new: { cls: "reltag--new", label: "Nouveau" },
  imp: { cls: "reltag--imp", label: "Amélioré" },
  fix: { cls: "reltag--fix", label: "Corrigé" },
};

type Item = { t: Kind; text: string; fromVotes?: boolean };
type Release = { v: string; title: string; date: string; intro?: string; media?: string; items: Item[] };

const RELEASES: Release[] = [
  {
    v: "v2.15",
    title: "Le mode équipes entre en bêta",
    date: "10 juillet 2026",
    intro: "La fonctionnalité la plus votée de l'histoire de la roadmap (143 voix) arrive : jouez par tables, scores cumulés, podium d'équipes.",
    media: "🏆🤝",
    items: [
      { t: "new", text: "Mode équipes en session live : jusqu'à 12 équipes, répartition automatique ou par choix des joueurs.", fromVotes: true },
      { t: "imp", text: "Le lobby affiche désormais un compte à rebours de lancement paramétrable (10-60 s)." },
      { t: "fix", text: "Le podium n'affichait pas les ex æquo dans le bon ordre au-delà de la 3ᵉ place." },
    ],
  },
  {
    v: "v2.14",
    title: "Analytics : le rapport PDF fait peau neuve",
    date: "24 juin 2026",
    items: [
      { t: "new", text: "Rapport PDF par session : réussite par question, questions à retravailler, classement — prêt à joindre à votre bilan de formation.", fromVotes: true },
      { t: "imp", text: "L'export CSV inclut désormais le temps de réponse moyen par question." },
      { t: "imp", text: "Les noms longs ne sont plus tronqués dans les exports (merci au ticket #1246 !)." },
    ],
  },
  {
    v: "v2.13",
    title: "Génération de quiz par IA",
    date: "5 juin 2026",
    intro: "Déposez un PDF de cours, obtenez une proposition de quiz calibrée — chaque question reste validée par vous avant publication.",
    items: [
      { t: "new", text: "Génération IA depuis PDF, DOCX et Markdown : 5 générations/mois en Gratuit, illimité en Pro.", fromVotes: true },
      { t: "new", text: "Réglage du niveau de difficulté cible avant génération (règle 70/20/10 appliquée par défaut)." },
      { t: "fix", text: "Les caractères accentués s'affichaient mal dans les questions importées depuis certains CSV." },
    ],
  },
  {
    v: "v2.12",
    title: "Examens : surveillance renforcée",
    date: "12 mai 2026",
    items: [
      { t: "new", text: "Alertes de sortie d'onglet horodatées, visibles dans le détail de chaque copie." },
      { t: "new", text: "Blocage automatique de la connexion simultanée depuis un second appareil." },
      { t: "imp", text: "La fenêtre de passage accepte désormais les fuseaux horaires — utile pour les candidats à distance." },
      { t: "fix", text: "L'auto-soumission à la fin du temps pouvait perdre la dernière réponse saisie." },
    ],
  },
];

const Changelog = () => {
  const [filter, setFilter] = useState<Kind>("all");
  useSEO({
    title: "Nouveautés produit",
    description: "Toutes les nouveautés, améliorations et corrections de Ludiq, mois par mois — et d'où elles viennent.",
    path: "/changelog",
  });

  const releaseVisible = (r: Release) => filter === "all" || r.items.some((it) => it.t === filter);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Header />
      <main className="lq" style={{ flex: 1 }}>
        <div className="wrap">
          <div className="page-hero">
            <span className="eyebrow">Nouveautés produit</span>
            <h1>Ludiq s'améliore chaque mois.</h1>
            <p className="lead">Toutes les nouveautés, améliorations et corrections — et d'où elles viennent.</p>
          </div>

          <div className="subscribe">
            <input type="email" placeholder="votre@email.fr" />
            <button className="btn btn--sm">Recevoir les nouveautés</button>
          </div>

          <div className="chips">
            {CHIPS.map((c) => (
              <button key={c.key} className={`chip${filter === c.key ? " on" : ""}`} onClick={() => setFilter(c.key)}>
                {c.label}
              </button>
            ))}
          </div>

          <div className="changelog">
            {RELEASES.filter(releaseVisible).map((r) => (
              <div className="release" key={r.v}>
                <div className="card rel-card">
                  <div className="rel-head">
                    <span className="vtag">{r.v}</span>
                    <h3>{r.title}</h3>
                    <span className="rel-date">{r.date}</span>
                  </div>
                  {r.intro && <p>{r.intro}</p>}
                  {r.media && <div className="rel-media">{r.media}</div>}
                  {r.items
                    .filter((it) => filter === "all" || it.t === filter)
                    .map((it, i) => (
                      <div className="rel-item" key={i}>
                        <span className={`reltag ${KIND_LABEL[it.t].cls}`}>{KIND_LABEL[it.t].label}</span>
                        <span>
                          {it.text}
                          {it.fromVotes && <span className="fromvotes">▲ issue de vos votes</span>}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Changelog;
