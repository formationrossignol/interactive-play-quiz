import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import "./community-pages.css";

type Filter = "all" | "deb" | "int" | "avc" | "video";

const GUIDES = [
  { emoji: "🎬", cover: "--ap-quiz-soft", dur: "▶ 4:32", title: "Créer un quiz de A à Z", lvl: "deb", fmt: "video" },
  { emoji: "🪄", cover: "--ap-brand-soft", dur: "6 min", title: "Générer un quiz par IA depuis un PDF de cours", lvl: "deb", fmt: "article" },
  { emoji: "🎯", cover: "--ap-pres-soft", dur: "8 min", title: "Doser la difficulté : la règle des 70/20/10", lvl: "int", fmt: "article" },
  { emoji: "🎬", cover: "--ap-poll-soft", dur: "▶ 7:15", title: "Animer un groupe de 100+ : rythme, pauses, relances", lvl: "int", fmt: "video" },
  { emoji: "🎓", cover: "--ap-flash-soft", dur: "12 min", title: "Monter un examen blanc certifiant (fenêtres, barème, litiges)", lvl: "avc", fmt: "article" },
  { emoji: "📊", cover: "--ap-pres-soft", dur: "10 min", title: "Exploiter les analytics pour réviser son cours", lvl: "avc", fmt: "article" },
  { emoji: "🧊", cover: "--ap-quiz-soft", dur: "5 min", title: "10 icebreakers qui marchent (même à 8 h 30)", lvl: "deb", fmt: "article" },
  { emoji: "🎬", cover: "--ap-brand-soft", dur: "▶ 5:48", title: "Flashcards & répétition espacée : le mode d'emploi", lvl: "int", fmt: "video" },
] as const;

const LVL_LABEL: Record<string, { cls: string; label: string }> = {
  deb: { cls: "lvl--deb", label: "Débutant" },
  int: { cls: "lvl--int", label: "Intermédiaire" },
  avc: { cls: "lvl--avc", label: "Avancé" },
};

const CHIPS: { f: Filter; label: string }[] = [
  { f: "all", label: "Tous" },
  { f: "deb", label: "Débutant" },
  { f: "int", label: "Intermédiaire" },
  { f: "avc", label: "Avancé" },
  { f: "video", label: "🎬 Vidéos" },
];

const Guides = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  useSEO({
    title: "Guides & tutoriels",
    description: "Des guides courts et concrets pour animer des quiz, sondages et examens en salle — écrits par des formateurs.",
    path: "/guides",
  });

  const visible = (g: (typeof GUIDES)[number]) =>
    filter === "all" || g.lvl === filter || (filter === "video" && g.fmt === "video");

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Header />
      <main className="lq" style={{ flex: 1 }}>
        <div className="wrap">
          <div className="page-hero">
            <span className="eyebrow">Guides &amp; tutoriels</span>
            <h1>Devenez redoutable en salle.</h1>
            <p className="lead">Des guides courts et concrets, écrits par des formateurs — pas par le marketing.</p>
          </div>

          <div className="pathcard">
            <div className="pemo">🚀</div>
            <div>
              <h3>Parcours : votre première session en 30 minutes</h3>
              <p>4 étapes guidées, de la création du compte au débrief analytics. Reprenez où vous en étiez.</p>
              <div className="pathsteps">
                <span className="done">✓ 1. Créer son premier quiz</span>
                <span className="done">✓ 2. Paramétrer le jeu</span>
                <span>3. Animer la session</span>
                <span>4. Lire les analytics</span>
              </div>
            </div>
            <button className="btn btn--quiz" onClick={() => navigate("/builder-start?type=quiz")}>
              Reprendre — étape 3
            </button>
          </div>

          <div className="chips">
            {CHIPS.map((c) => (
              <button
                key={c.f}
                className={`chip${filter === c.f ? " on" : ""}`}
                onClick={() => setFilter(c.f)}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="ggrid">
            {GUIDES.filter(visible).map((g, i) => (
              <article className="card gcard" key={i}>
                <div className="gcover" style={{ background: `var(${g.cover})` }}>
                  {g.emoji}
                  <span className="gdur">{g.dur}</span>
                </div>
                <div className="gbody">
                  <h3>{g.title}</h3>
                  <div className="gmeta">
                    <span className={`lvl ${LVL_LABEL[g.lvl].cls}`}>{LVL_LABEL[g.lvl].label}</span>
                    <span className="fmt">{g.fmt === "video" ? "Vidéo" : "Article"}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Guides;
