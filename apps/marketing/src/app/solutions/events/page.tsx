import type { Metadata } from "next";
import { AuthorityPage } from "@/components/AuthorityPage";

export const metadata: Metadata = { title: "Brivia pour les événements", description: "Transformez une audience en participants avec des interactions immédiates et un pilotage lisible.", alternates: { canonical: "/solutions/events" } };

export default function EventsSolutionPage() {
  return <AuthorityPage
    layout="stage"
    tone="amber"
    eyebrow="Événements et séminaires"
    title="Une audience devient une"
    accent="présence collective."
    introduction="Créez des moments de participation qui restent simples sur téléphone, lisibles sur grand écran et pilotables en régie."
    signal="Entrée immédiate"
    signalDetail="Un code ou un QR suffit pour rejoindre, sans compte participant ni installation."
    facts={[{ value: "QR", label: "Accès depuis le navigateur" }, { value: "Live", label: "Réactions, questions et classements" }, { value: "Maîtrisé", label: "Ouverture et rythme contrôlés par l’hôte" }]}
    chapters={[
      { index: "01 — Entrée", title: "Réduire la distance en dix secondes.", text: "L’interface participant se concentre sur une seule action à la fois.", points: ["Code court et QR projetable.", "Aucun téléchargement imposé.", "Identité et règles adaptées au contexte." ] },
      { index: "02 — Scène", title: "Donner du relief au direct.", text: "Les transitions, réactions et résultats renforcent le moment sans voler la vedette au contenu.", points: ["Réactions pilotables pendant l’attente.", "Questions plein écran et rythme hôte.", "Résultats instantanés et débrief collectif." ] },
      { index: "03 — Après", title: "Conserver le signal utile.", text: "Exportez les réponses et commentaires pour prolonger la conversation.", points: ["Distribution des réponses.", "Commentaires de fin de session.", "Exports pour le bilan organisateur." ] },
    ]}
    closingTitle="Préparons votre moment fort."
    closingText="Donnez-nous la jauge, le lieu et le conducteur. Nous testerons le scénario qui compte vraiment."
    primaryLabel="Parler de mon événement"
    primaryHref="/contact?intent=event"
  />;
}
