import type { Metadata } from "next";
import { AuthorityPage } from "@/components/AuthorityPage";

export const metadata: Metadata = {
  title: "Brivia pour les organisations",
  description: "Déployez des expériences interactives, des parcours et des évaluations avec un cadre adapté à votre organisation.",
  alternates: { canonical: "/enterprise" },
};

export default function EnterprisePage() {
  return <AuthorityPage
    layout="split"
    eyebrow="Brivia pour les organisations"
    title="L’engagement devient une"
    accent="infrastructure."
    introduction="Un espace cohérent pour concevoir, animer, évaluer et transmettre les résultats — avec un déploiement cadré autour de vos usages, de vos équipes et de vos exigences."
    signal="Un seul système"
    signalDetail="Du premier sondage à l’évaluation structurée, sans disperser les contenus et les résultats."
    facts={[
      { value: "01", label: "Espace pour le direct, les cours et l’évaluation" },
      { value: "UE", label: "Données applicatives hébergées en Europe" },
      { value: "0", label: "Compte participant requis pour rejoindre une session publique" },
    ]}
    chapters={[
      { index: "01 — Déploiement", title: "Un cadre avant les écrans.", text: "Le déploiement commence par vos rôles, vos flux de contenu et les preuves que vous devez restituer.", points: ["Cartographier les animateurs, administrateurs et participants.", "Définir les formats, volumes et règles de conservation utiles.", "Préparer l’adoption avec un interlocuteur et un plan de lancement."], note: "Les engagements contractuels, le support et les volumes sont définis dans la proposition Enterprise." },
      { index: "02 — Gouvernance", title: "Le contrôle reste lisible.", text: "Organisez les contenus et les accès sans transformer chaque session en projet technique.", points: ["Organisations, groupes, invitations et permissions de partage.", "Bibliothèque commune et réutilisation des contenus.", "Exports et résultats pour poursuivre l’analyse dans vos outils." ] },
      { index: "03 — Confiance", title: "Chaque affirmation doit être vérifiable.", text: "Le dossier de confiance distingue clairement ce qui est disponible, prévu ou soumis à validation.", points: ["Documentation sécurité et traitement des données.", "Revue des besoins d’intégration et d’authentification.", "Décision humaine conservée pour les alertes de surveillance."], note: "Brivia ne revendique actuellement aucune certification ISO ou SOC non obtenue." },
    ]}
    closingTitle="Préparons un déploiement qui tient la route."
    closingText="Décrivez vos équipes, votre audience et votre calendrier. La démonstration sera construite autour de votre cas réel."
    primaryLabel="Préparer une démonstration"
    primaryHref="/contact?intent=enterprise"
    secondaryLabel="Consulter la sécurité"
    secondaryHref="/security"
  />;
}
