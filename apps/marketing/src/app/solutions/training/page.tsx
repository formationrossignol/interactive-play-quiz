import type { Metadata } from "next";
import { AuthorityPage } from "@/components/AuthorityPage";

export const metadata: Metadata = { title: "Brivia pour la formation", description: "Animez une formation, mesurez la compréhension et structurez la suite sans multiplier les outils.", alternates: { canonical: "/solutions/training" } };

export default function TrainingSolutionPage() {
  return <AuthorityPage
    layout="timeline"
    eyebrow="Formation professionnelle"
    title="L’attention devient un"
    accent="signal exploitable."
    introduction="Concevez une session vivante, détectez ce qui doit être réexpliqué et transmettez une preuve de progression à vos clients."
    signal="Une continuité pédagogique"
    signalDetail="Le même espace relie animation, supports, exercices, résultats et suivi."
    facts={[{ value: "Live", label: "Questions et réactions en temps réel" }, { value: "Async", label: "Cours, flashcards et examens" }, { value: "Exports", label: "Résultats à partager et analyser" }]}
    chapters={[
      { index: "01 — Concevoir", title: "Préparer sans dupliquer.", text: "Transformez une base existante en formats adaptés aux différents temps de la formation.", points: ["Banque de questions et modèles réutilisables.", "Import de contenus structurés.", "Cours mêlant texte, vidéo, fichiers, SCORM et H5P." ] },
      { index: "02 — Animer", title: "Maintenir un rythme humain.", text: "Le produit s’efface au profit du groupe et rend chaque transition lisible.", points: ["Entrée immédiate par QR ou code.", "Rythme contrôlé par le formateur.", "Débrief à partir des réponses réelles." ] },
      { index: "03 — Prouver", title: "Restituer ce qui s’est passé.", text: "Les résultats ne restent pas enfermés dans la session.", points: ["Analyse détaillée et exports.", "Parcours et seuils de progression.", "Certificats de complétion partageables." ] },
    ]}
    closingTitle="Montrez-nous une formation réelle."
    closingText="Nous construirons la démonstration à partir de vos contraintes de contenu, de groupe et de restitution."
    primaryLabel="Préparer ma démonstration"
    primaryHref="/contact?intent=training"
  />;
}
