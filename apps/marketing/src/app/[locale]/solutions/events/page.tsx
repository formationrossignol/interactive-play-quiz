import type { Metadata } from "next";
import { AuthorityPage } from "@/components/AuthorityPage";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  if (locale === "en") {
    return {
      title: "Brivia for events",
      description: "Turn an audience into participants with immediate interactions and clear host control.",
      alternates: { canonical: "/en/solutions/events", languages: { fr: "/solutions/events", en: "/en/solutions/events", "x-default": "/solutions/events" } },
    };
  }

  return {
    title: "Brivia pour les événements",
    description: "Transformez une audience en participants avec des interactions immédiates et un pilotage lisible.",
    alternates: { canonical: "/solutions/events", languages: { fr: "/solutions/events", en: "/en/solutions/events", "x-default": "/solutions/events" } },
  };
}

const FRENCH_CONTENT = {
  layout: "stage" as const,
  tone: "amber" as const,
  eyebrow: "Événements et séminaires",
  title: "Une audience devient une",
  accent: "présence collective.",
  introduction: "Créez des moments de participation qui restent simples sur téléphone, lisibles sur grand écran et pilotables en régie.",
  signal: "Entrée immédiate",
  signalDetail: "Un code ou un QR suffit pour rejoindre, sans compte participant ni installation.",
  facts: [{ value: "QR", label: "Accès depuis le navigateur" }, { value: "Live", label: "Réactions, questions et classements" }, { value: "Maîtrisé", label: "Ouverture et rythme contrôlés par l’hôte" }],
  chapters: [
    { index: "01 — Entrée", title: "Réduire la distance en dix secondes.", text: "L’interface participant se concentre sur une seule action à la fois.", points: ["Code court et QR projetable.", "Aucun téléchargement imposé.", "Identité et règles adaptées au contexte."] },
    { index: "02 — Scène", title: "Donner du relief au direct.", text: "Les transitions, réactions et résultats renforcent le moment sans voler la vedette au contenu.", points: ["Réactions pilotables pendant l’attente.", "Questions plein écran et rythme hôte.", "Résultats instantanés et débrief collectif."] },
    { index: "03 — Après", title: "Conserver le signal utile.", text: "Exportez les réponses et commentaires pour prolonger la conversation.", points: ["Distribution des réponses.", "Commentaires de fin de session.", "Exports pour le bilan organisateur."] },
  ],
  closingTitle: "Préparons votre moment fort.",
  closingText: "Donnez-nous la jauge, le lieu et le conducteur. Nous testerons le scénario qui compte vraiment.",
  primaryLabel: "Parler de mon événement",
  primaryHref: "/contact?intent=event",
};

const ENGLISH_CONTENT = {
  layout: "stage" as const,
  tone: "amber" as const,
  eyebrow: "Events and seminars",
  title: "An audience becomes a",
  accent: "collective presence.",
  introduction: "Create participation moments that stay simple on a phone, readable on a big screen, and controllable from the booth.",
  signal: "Instant entry",
  signalDetail: "A code or QR is enough to join — no participant account, no install.",
  facts: [{ value: "QR", label: "Access from the browser" }, { value: "Live", label: "Reactions, questions and rankings" }, { value: "Controlled", label: "Opening and pace set by the host" }],
  chapters: [
    { index: "01 — Entry", title: "Close the distance in ten seconds.", text: "The participant interface focuses on one action at a time.", points: ["Short code and projectable QR.", "No forced download.", "Identity and rules adapted to the context."] },
    { index: "02 — Stage", title: "Give the live moment depth.", text: "Transitions, reactions and results add weight without stealing the spotlight from the content.", points: ["Reactions controllable during downtime.", "Full-screen questions, host-set pace.", "Instant results and collective debrief."] },
    { index: "03 — After", title: "Keep the signal that matters.", text: "Export answers and comments to extend the conversation.", points: ["Answer distribution.", "End-of-session comments.", "Exports for the organizer's report."] },
  ],
  closingTitle: "Let's prepare your big moment.",
  closingText: "Give us the headcount, venue and run of show. We'll test the scenario that actually matters.",
  primaryLabel: "Talk about my event",
  primaryHref: "/en/contact?intent=event",
};

export default async function EventsSolutionPage({ params }: Props) {
  const { locale } = await params;
  const english = locale === "en";
  const content = english ? ENGLISH_CONTENT : FRENCH_CONTENT;

  return <AuthorityPage language={english ? "en" : "fr"} {...content} />;
}
