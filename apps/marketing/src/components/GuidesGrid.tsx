"use client";

import { useState } from "react";
import type { Guide } from "@/lib/types";
import styles from "./GuidesGrid.module.css";

type Filter = "all" | "deb" | "int" | "avc" | "video";

const LEVELS: Record<string, string> = {
  deb: "Débutant",
  int: "Intermédiaire",
  avc: "Avancé",
};

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "deb", label: "Débutant" },
  { value: "int", label: "Intermédiaire" },
  { value: "avc", label: "Avancé" },
  { value: "video", label: "Vidéos" },
];

function GuideGlyph({ video }: { video: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    {video
      ? <><circle cx="12" cy="12" r="8.5" /><path d="m10 8.7 5.2 3.3-5.2 3.3Z" /></>
      : <><path d="M7 3.8h7l3 3V20H7Z" /><path d="M14 3.8V7h3M9.5 11h5M9.5 14h5M9.5 17h3" /></>}
  </svg>;
}

export function GuidesGrid({ guides }: { guides: Guide[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const visible = guides.filter((guide) =>
    filter === "all" ? true : filter === "video" ? guide.fmt === "video" : guide.lvl === filter,
  );

  return (
    <>
      <div className={styles.filters} role="group" aria-label="Filtrer les guides">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`${styles.filter} ${filter === item.value ? styles.active : ""}`}
            onClick={() => setFilter(item.value)}
            aria-pressed={filter === item.value}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={styles.grid}>
        {visible.length > 0 ? visible.map((guide) => {
          const content = (
            <>
              <span className={styles.guideIcon}>
                <GuideGlyph video={guide.fmt === "video"} />
              </span>
              <div>
                <h3>{guide.title}</h3>
                <div className={styles.meta}>
                  <span>{LEVELS[guide.lvl]}</span>
                  <span>{guide.fmt === "video" ? "Vidéo" : "Article"}</span>
                  <span>{guide.dur}</span>
                </div>
              </div>
            </>
          );

          return guide.url ? (
            <a className={styles.guide} href={guide.url} key={guide.id}>
              {content}
            </a>
          ) : (
            <article className={styles.guide} key={guide.id}>
              {content}
            </article>
          );
        }) : (
          <p className={styles.empty}>Aucun guide disponible pour ce filtre.</p>
        )}
      </div>
    </>
  );
}
