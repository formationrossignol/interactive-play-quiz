"use client";

import { useEffect, useState } from "react";
import { ProductGlyph, type ProductGlyphName } from "./ProductGlyph";
import styles from "./CapabilityExplorer.module.css";

const GROUPS: Array<{
  id: string;
  label: string;
  title: string;
  statement: string;
  glyph: ProductGlyphName;
  items: Array<{ title: string; text: string }>;
}> = [
  {
    id: "creation",
    label: "Création",
    title: "Créer sans repartir de zéro",
    statement: "Des outils assez rapides pour une première idée, assez précis pour un dispositif complet.",
    glyph: "creation",
    items: [
      { title: "Modèles prêts à adapter", text: "Quiz, sondages et flashcards démarrent depuis une bibliothèque de scénarios." },
      { title: "Banque de questions", text: "Centralisez les questions, réutilisez-les et importez ou exportez au format Excel." },
      { title: "Mise en page par question", text: "Choisissez la disposition du texte, des réponses et des médias selon le contenu." },
      { title: "Règles ajustables", text: "Temps, points, ordre, rythme et comportements de session restent sous votre contrôle." },
      { title: "Imports structurés", text: "Importez quiz et sondages en YAML ou CSV, puis flashcards et présentations en Markdown." },
      { title: "Génération de cours assistée", text: "Transformez un document en base de cours, puis relisez et adaptez chaque module." },
    ],
  },
  {
    id: "live-sessions",
    label: "Direct",
    title: "Animer une salle en direct",
    statement: "Le participant comprend immédiatement quoi faire. L’animateur garde toute la profondeur de pilotage.",
    glyph: "live",
    items: [
      { title: "Accès par QR ou code", text: "Les participants rejoignent depuis leur navigateur, sans créer de compte." },
      { title: "Pilotage côté animateur", text: "Lancez, mettez en pause, passez une question et affichez les réponses au bon moment." },
      { title: "Réactions et échanges", text: "Activez les réactions pendant la session et le commentaire de fin selon le contexte." },
      { title: "Rythme et ambiance", text: "Compte à rebours, chronomètre, classement, sons et transitions donnent un tempo lisible." },
    ],
  },
  {
    id: "learning-paths",
    label: "Parcours",
    title: "Construire de vrais parcours pédagogiques",
    statement: "Brivia relie le temps fort de la session au temps long de l’apprentissage.",
    glyph: "learning",
    items: [
      { title: "Dix types de leçons", text: "Texte, vidéo, document, iframe, dépôt, quiz, sondage, flashcards, SCORM et H5P." },
      { title: "Imports SCORM et H5P", text: "Réutilisez des modules e-learning existants sans les reconstruire dans un autre outil." },
      { title: "Parcours séquentiels", text: "Ordonnez plusieurs cours et débloquez la suite selon le seuil obtenu." },
      { title: "Certificats de cours", text: "Terminez un parcours avec une preuve de complétion partageable." },
    ],
  },
  {
    id: "assessment",
    label: "Évaluation",
    title: "Évaluer avec le bon niveau de contrôle",
    statement: "Le cadre peut devenir exigeant sans rendre l’expérience opaque ou punitive.",
    glyph: "assessment",
    items: [
      { title: "Examens configurables", text: "Définissez durée, tentatives, fenêtre d’accès, score retenu et moment de publication." },
      { title: "Surveillance graduée", text: "Plein écran, changements d’onglet, webcam, microphone, captures et Safe Exam Browser restent optionnels." },
      { title: "Notation manuelle", text: "Créez un carnet de notes, utilisez des groupes et conservez l’historique des changements." },
      { title: "Décision humaine", text: "Les alertes de surveillance sont à vérifier et ne constituent jamais une preuve automatique." },
    ],
  },
  {
    id: "collaboration",
    label: "Organisation",
    title: "Collaborer et organiser",
    statement: "Les contenus restent simples à trouver, partager et gouverner quand l’équipe grandit.",
    glyph: "collaboration",
    items: [
      { title: "Partage avec permissions", text: "Invitez une personne ou un groupe avec un accès en lecture ou en modification." },
      { title: "Dossiers et recherche globale", text: "Classez chaque format, retrouvez un contenu et accédez rapidement aux éléments récents." },
      { title: "Communauté de contenus", text: "Publiez un contenu, découvrez ceux de la communauté et partez d’une ressource existante." },
      { title: "Organisations et groupes", text: "Gérez les invitations, les groupes d’apprenants et les ressources partagées au même endroit." },
      { title: "Demandes de signature", text: "Envoyez une demande à un groupe, fixez une échéance et suivez les réponses." },
      { title: "Outils autonomes", text: "Utilisez la roue de tirage au sort et le chronomètre sans créer de quiz." },
      { title: "Historique et notifications", text: "Retrouvez l’activité récente et les événements qui demandent une action." },
    ],
  },
  {
    id: "results",
    label: "Résultats",
    title: "Mesurer et transmettre les résultats",
    statement: "Une session ne s’arrête pas au classement : elle produit des décisions et des preuves exploitables.",
    glyph: "results",
    items: [
      { title: "Résultats détaillés", text: "Analysez scores, réponses, progression et difficultés au niveau de la session ou du contenu." },
      { title: "Exports utiles", text: "Téléchargez les résultats live en PDF, Excel, CSV ou JSON." },
      { title: "Tableaux de bord", text: "Suivez l’activité, les créations, les scores et les éléments qui demandent votre attention." },
      { title: "Suivi SCORM et H5P", text: "Retrouvez la progression et les traces des activités intégrées dans les cours." },
    ],
  },
];

export function CapabilityExplorer() {
  const [activeId, setActiveId] = useState(GROUPS[0].id);

  useEffect(() => {
    const syncWithHash = () => {
      const requestedId = window.location.hash.slice(1);
      if (GROUPS.some((group) => group.id === requestedId)) setActiveId(requestedId);
    };
    syncWithHash();
    window.addEventListener("hashchange", syncWithHash);
    return () => window.removeEventListener("hashchange", syncWithHash);
  }, []);

  const moveSelection = (currentIndex: number, direction: number) => {
    const nextIndex = (currentIndex + direction + GROUPS.length) % GROUPS.length;
    const next = GROUPS[nextIndex];
    setActiveId(next.id);
    requestAnimationFrame(() => document.getElementById(`capability-tab-${next.id}`)?.focus());
  };

  return (
    <div className={styles.explorer}>
      <div className={styles.selector} role="tablist" aria-label="Domaines fonctionnels">
        <div className={styles.selectorIntro}>
          <span>06 domaines</span>
          <p>Explorez le produit selon votre objectif.</p>
        </div>
        {GROUPS.map((group, index) => {
          const active = group.id === activeId;
          return (
            <div className={styles.tabRow} key={group.id}>
              <span className={styles.anchorTarget} id={group.id} aria-hidden="true" />
              <button
              type="button"
              role="tab"
              id={`capability-tab-${group.id}`}
              aria-controls={`capability-panel-${group.id}`}
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              className={active ? styles.activeTab : undefined}
              onClick={() => setActiveId(group.id)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowRight") {
                  event.preventDefault();
                  moveSelection(index, 1);
                }
                if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
                  event.preventDefault();
                  moveSelection(index, -1);
                }
              }}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{group.label}</strong>
                <i aria-hidden="true"><ProductGlyph name="arrow" /></i>
              </button>
            </div>
          );
        })}
      </div>

      <div className={styles.panelShell}>
        {GROUPS.map((group, groupIndex) => {
          const active = group.id === activeId;
          return (
            <section
              role="tabpanel"
              id={`capability-panel-${group.id}`}
              aria-labelledby={`capability-tab-${group.id}`}
              className={styles.panel}
              hidden={!active}
              key={group.id}
            >
              <header className={styles.panelHeader}>
                <div className={styles.panelGlyph}><ProductGlyph name={group.glyph} /></div>
                <span>{String(groupIndex + 1).padStart(2, "0")} / {String(GROUPS.length).padStart(2, "0")}</span>
                <h3>{group.title}</h3>
                <p>{group.statement}</p>
              </header>
              <div className={styles.itemGrid}>
                {group.items.map((item, itemIndex) => (
                  <article className={styles.item} key={item.title}>
                    <span>{String(itemIndex + 1).padStart(2, "0")}</span>
                    <strong>{item.title}</strong>
                    <p>{item.text}</p>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
