import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import { useChangelog } from "@/lib/pages/hooks";
import { useChangelogSubscription } from "@/lib/pages/interactionHooks";
import { requireAuth } from "@/lib/pages/requireAuth";
import type { Release } from "@/lib/pages/types";
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

const Changelog = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Kind>("all");
  const { data: releases, isLoading } = useChangelog();
  const sub = useChangelogSubscription();
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
            <button className="btn btn--sm" disabled={sub.isLoading || sub.toggle.isPending} onClick={() => {
              if (!requireAuth(navigate)) return;
              sub.toggle.mutate(sub.isSubscribed);
            }}>
              {sub.isSubscribed ? "Abonné ✓ — se désabonner" : "Recevoir les nouveautés"}
            </button>
          </div>

          <div className="chips">
            {CHIPS.map((c) => (
              <button key={c.key} className={`chip${filter === c.key ? " on" : ""}`} onClick={() => setFilter(c.key)}>
                {c.label}
              </button>
            ))}
          </div>

          <div className="changelog">
            {isLoading || !releases ? (
              <div style={{ opacity: 0.5, padding: "24px 0" }}>Chargement…</div>
            ) : (
              releases.filter(releaseVisible).map((r) => (
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
              ))
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Changelog;
