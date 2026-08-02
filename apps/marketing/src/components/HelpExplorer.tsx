"use client";

import { useMemo, useState } from "react";
import type { FaqGroup } from "@/lib/types";
import styles from "./ResourcePages.module.css";

export function HelpExplorer({ groups }: { groups: FaqGroup[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Toutes");

  const normalizedQuery = query.trim().toLocaleLowerCase("fr");
  const visibleGroups = useMemo(() => groups
    .filter((group) => category === "Toutes" || group.category === category)
    .map((group) => ({
      ...group,
      questions: group.questions.filter((item) => !normalizedQuery
        || `${item.q} ${item.a}`.toLocaleLowerCase("fr").includes(normalizedQuery)),
    }))
    .filter((group) => group.questions.length > 0), [category, groups, normalizedQuery]);

  const resultCount = visibleGroups.reduce((total, group) => total + group.questions.length, 0);
  const categories = ["Toutes", ...groups.map((group) => group.category)];

  return <section className={styles.helpExplorer} aria-labelledby="help-results-title">
    <div className={styles.helpSearchShell}>
      <label className={styles.helpSearch} htmlFor="help-search">
        <span aria-hidden="true">⌕</span>
        <input
          id="help-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher une action, un problème, un format…"
          autoComplete="off"
        />
        <small>Recherche instantanée</small>
      </label>
    </div>

    <div className={styles.helpCategories} role="group" aria-label="Filtrer les réponses par catégorie">
      {categories.map((item) => <button
        type="button"
        key={item}
        className={category === item ? styles.helpCategoryActive : undefined}
        aria-pressed={category === item}
        onClick={() => setCategory(item)}
      >{item}</button>)}
    </div>

    <div className={styles.helpResultHeader}>
      <h2 id="help-results-title">Les réponses utiles.</h2>
      <p>{resultCount} {resultCount > 1 ? "réponses disponibles" : "réponse disponible"}</p>
    </div>

    {visibleGroups.length > 0 ? <div className={styles.helpGroups}>
      {visibleGroups.map((group) => <section className={styles.helpGroup} key={group.category}>
        <h3>{group.category}</h3>
        {group.questions.map((item) => <details className={styles.helpItem} key={item.q}>
          <summary>{item.q}</summary>
          <p>{item.a}</p>
        </details>)}
      </section>)}
    </div> : <div className={styles.helpEmpty}>
      <p>Aucune réponse ne correspond à cette recherche.</p>
      <button type="button" onClick={() => { setQuery(""); setCategory("Toutes"); }}>Réinitialiser la recherche</button>
    </div>}

    <aside className={styles.helpAssist}>
      <div><strong>Le problème résiste ?</strong><p>Décrivez le contexte et le résultat attendu : l’équipe reprendra avec vous.</p></div>
      <a href="/contact?intent=support">Contacter l’équipe</a>
    </aside>
  </section>;
}
