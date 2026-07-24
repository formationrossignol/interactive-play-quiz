"use client";

import { useState } from "react";
import type { Guide } from "@/lib/types";

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

export function GuidesGrid({ guides }: { guides: Guide[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const visible = guides.filter((g) =>
    filter === "all" ? true : filter === "video" ? g.fmt === "video" : g.lvl === filter,
  );

  return (
    <>
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
        {visible.length === 0 ? (
          <p style={{ opacity: 0.5 }}>Aucun guide pour ce filtre.</p>
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
    </>
  );
}
