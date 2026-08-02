import type { Metadata } from "next";
import { AuthorityPage } from "@/components/AuthorityPage";

export const metadata: Metadata = { title: "Brivia pour l’enseignement", description: "Faites participer, vérifier les acquis et prolonger l’apprentissage dans un même environnement.", alternates: { canonical: "/solutions/education" } };

export default function EducationSolutionPage() {
  return <AuthorityPage
    layout="studio"
    tone="blue"
    eyebrow="Enseignement supérieur et écoles"
    title="Une salle active laisse des"
    accent="traces utiles."
    introduction="Sondez avant d’expliquer, vérifiez pendant le cours et transformez les réponses en décisions pédagogiques après la session."
    signal="Du direct au suivi"
    signalDetail="Quiz, flashcards, cours et examens partagent un même fil pédagogique."
    facts={[{ value: "Sans compte", label: "Participation publique depuis un téléphone" }, { value: "15", label: "Formats de questions documentés" }, { value: "1 espace", label: "Direct, révision, cours et évaluation" }]}
    chapters={[
      { index: "01 — Avant", title: "Révéler le point de départ.", text: "Une activité courte permet d’ajuster le cours avant que les incompréhensions s’installent.", points: ["Sondage d’ouverture et nuage de mots.", "Questions diagnostiques sans installation.", "Contenus préparés et réutilisables par l’équipe." ] },
      { index: "02 — Pendant", title: "Faire réfléchir toute la salle.", text: "Alternez présentation, question et discussion sans casser le rythme.", points: ["Accès par code ou QR.", "Affichage progressif et pilotage animateur.", "Réactions, classement ou anonymat selon le contexte." ] },
      { index: "03 — Après", title: "Prolonger au-delà du direct.", text: "Les résultats deviennent un point de départ pour réviser, accompagner et évaluer.", points: ["Résultats par question et exports.", "Flashcards et parcours séquentiels.", "Examens configurables et notation manuelle." ] },
    ]}
    closingTitle="Construisons votre scénario pédagogique."
    closingText="Présentez-nous un cours, un public et une contrainte. Nous montrerons le parcours complet plutôt qu’une démo générique."
    primaryLabel="Demander une démonstration"
    primaryHref="/contact?intent=education"
  />;
}
