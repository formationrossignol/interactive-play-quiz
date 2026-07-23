import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import { useGuides } from "@/lib/pages/hooks";
import type { Guide } from "@/lib/pages/types";
import "./community-pages.css";

type Filter = "all" | "deb" | "int" | "avc" | "video";

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
  const { data: guides, isLoading } = useGuides();
  useSEO({
    title: "Guides & tutoriels",
    description: "Des guides courts et concrets pour animer des quiz, sondages et examens en salle — écrits par des formateurs.",
    path: "/guides",
  });

  const visible = (guides ?? []).filter((g: Guide) =>
    filter === "all" ? true : filter === "video" ? g.fmt === "video" : g.lvl === filter,
  );

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
            {isLoading ? (
              <div style={{ opacity: 0.5 }}>Chargement…</div>
            ) : (
              visible.map((g) => (
                <article className="card gcard" key={g.id}>
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
              ))
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Guides;
