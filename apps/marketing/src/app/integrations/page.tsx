import type { Metadata } from "next";
import { AuthorityPage } from "@/components/AuthorityPage";

export const metadata: Metadata = {
  title: "Intégrations et formats",
  description: "Connectez Brivia à vos contenus et flux de travail avec SCORM, H5P, imports, exports et options Enterprise.",
  alternates: { canonical: "/integrations" },
};

export default function IntegrationsPage() {
  return <AuthorityPage
    layout="constellation"
    tone="amber"
    eyebrow="Écosystème Brivia"
    title="Vos contenus ne devraient pas vivre en"
    accent="vase clos."
    introduction="Importez ce qui existe, enrichissez-le dans Brivia et restituez les résultats dans des formats exploitables. Chaque connecteur affiche un statut honnête."
    signal="Interopérabilité lisible"
    signalDetail="Disponible aujourd’hui, en préparation ou étudié sur demande — sans transformer une roadmap en fonctionnalité."
    facts={[
      { value: "SCORM", label: "Modules intégrables dans les parcours" },
      { value: "H5P", label: "Activités interactives réutilisables" },
      { value: "4×", label: "PDF, Excel, CSV et JSON pour les résultats live" },
    ]}
    chapters={[
      { index: "01 — Disponible", title: "Importer sans reconstruire.", text: "Les formats déjà pris en charge couvrent la création, le e-learning et la restitution.", points: ["Quiz et sondages via YAML ou CSV.", "Flashcards et présentations via Markdown.", "Modules SCORM et activités H5P dans les cours.", "Exports de résultats en PDF, Excel, CSV et JSON." ] },
      { index: "02 — Organisation", title: "Relier les bonnes personnes.", text: "Les espaces d’organisation structurent les groupes, les contenus et les permissions.", points: ["Invitations et groupes d’apprenants.", "Partage en lecture ou en modification.", "Bibliothèque, dossiers et recherche transversale." ] },
      { index: "03 — Enterprise", title: "Qualifier avant d’intégrer.", text: "Les connexions identitaires et LMS dépendent de votre environnement et de vos exigences.", points: ["SSO et fédération d’identité : cadrage Enterprise.", "LTI et connecteurs LMS : évaluation selon le contexte.", "Provisionnement automatisé : spécification avec l’organisation."], note: "Ces trois capacités sont présentées comme options à qualifier, pas comme intégrations disponibles en libre-service." },
    ]}
    closingTitle="Parlons de votre écosystème réel."
    closingText="Indiquez votre LMS, votre fournisseur d’identité et vos formats existants pour obtenir une réponse précise."
    primaryLabel="Qualifier une intégration"
    primaryHref="/contact?intent=integration"
    secondaryLabel="Voir les fonctionnalités"
    secondaryHref="/features"
  />;
}
