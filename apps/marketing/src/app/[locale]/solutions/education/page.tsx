import type { Metadata } from "next";
import { AuthorityPage } from "@/components/AuthorityPage";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  if (locale === "en") {
    return {
      title: "Brivia for education",
      description: "Engage the room, verify understanding and extend learning within one environment.",
      alternates: { canonical: "/en/solutions/education", languages: { fr: "/solutions/education", en: "/en/solutions/education", "x-default": "/solutions/education" } },
    };
  }

  return {
    title: "Brivia pour l’enseignement",
    description: "Faites participer, vérifier les acquis et prolonger l’apprentissage dans un même environnement.",
    alternates: { canonical: "/solutions/education", languages: { fr: "/solutions/education", en: "/en/solutions/education", "x-default": "/solutions/education" } },
  };
}

const FRENCH_CONTENT = {
  layout: "studio" as const,
  tone: "blue" as const,
  eyebrow: "Enseignement supérieur et écoles",
  title: "Une salle active laisse des",
  accent: "traces utiles.",
  introduction: "Sondez avant d’expliquer, vérifiez pendant le cours et transformez les réponses en décisions pédagogiques après la session.",
  signal: "Du direct au suivi",
  signalDetail: "Quiz, flashcards, cours et examens partagent un même fil pédagogique.",
  facts: [{ value: "Sans compte", label: "Participation publique depuis un téléphone" }, { value: "15", label: "Formats de questions documentés" }, { value: "1 espace", label: "Direct, révision, cours et évaluation" }],
  chapters: [
    { index: "01 — Avant", title: "Révéler le point de départ.", text: "Une activité courte permet d’ajuster le cours avant que les incompréhensions s’installent.", points: ["Sondage d’ouverture et nuage de mots.", "Questions diagnostiques sans installation.", "Contenus préparés et réutilisables par l’équipe."] },
    { index: "02 — Pendant", title: "Faire réfléchir toute la salle.", text: "Alternez présentation, question et discussion sans casser le rythme.", points: ["Accès par code ou QR.", "Affichage progressif et pilotage animateur.", "Réactions, classement ou anonymat selon le contexte."] },
    { index: "03 — Après", title: "Prolonger au-delà du direct.", text: "Les résultats deviennent un point de départ pour réviser, accompagner et évaluer.", points: ["Résultats par question et exports.", "Flashcards et parcours séquentiels.", "Examens configurables et notation manuelle."] },
  ],
  closingTitle: "Construisons votre scénario pédagogique.",
  closingText: "Présentez-nous un cours, un public et une contrainte. Nous montrerons le parcours complet plutôt qu’une démo générique.",
  primaryLabel: "Demander une démonstration",
  primaryHref: "/contact?intent=education",
};

const ENGLISH_CONTENT = {
  layout: "studio" as const,
  tone: "blue" as const,
  eyebrow: "Higher education and schools",
  title: "An active room leaves",
  accent: "useful traces.",
  introduction: "Poll before explaining, check understanding during class, and turn answers into teaching decisions afterward.",
  signal: "From live to follow-up",
  signalDetail: "Quizzes, flashcards, courses and exams share one teaching thread.",
  facts: [{ value: "No account", label: "Public participation from a phone" }, { value: "15", label: "Documented question formats" }, { value: "1 space", label: "Live, review, courses and assessment" }],
  chapters: [
    { index: "01 — Before", title: "Reveal the starting point.", text: "A short activity lets you adjust the class before misunderstandings settle in.", points: ["Opening poll and word cloud.", "Diagnostic questions, no install needed.", "Reusable content prepared by the team."] },
    { index: "02 — During", title: "Get the whole room thinking.", text: "Alternate presentation, question and discussion without breaking the pace.", points: ["Join by code or QR.", "Progressive display and host control.", "Reactions, ranking or anonymity depending on context."] },
    { index: "03 — After", title: "Extend beyond the live session.", text: "Results become a starting point to review, coach and assess.", points: ["Per-question results and exports.", "Flashcards and sequential paths.", "Configurable exams with manual grading."] },
  ],
  closingTitle: "Let's build your teaching scenario.",
  closingText: "Show us a class, an audience and a constraint. We'll walk through the full flow, not a generic demo.",
  primaryLabel: "Request a demonstration",
  primaryHref: "/en/contact?intent=education",
};

export default async function EducationSolutionPage({ params }: Props) {
  const { locale } = await params;
  const english = locale === "en";
  const content = english ? ENGLISH_CONTENT : FRENCH_CONTENT;

  return <AuthorityPage language={english ? "en" : "fr"} {...content} />;
}
