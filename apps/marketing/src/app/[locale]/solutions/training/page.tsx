import type { Metadata } from "next";
import { AuthorityPage } from "@/components/AuthorityPage";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  if (locale === "en") {
    return {
      title: "Brivia for corporate training",
      description: "Run a training session, measure understanding and structure the follow-up without stacking tools.",
      alternates: { canonical: "/en/solutions/training", languages: { fr: "/solutions/training", en: "/en/solutions/training", "x-default": "/solutions/training" } },
    };
  }

  return {
    title: "Brivia pour la formation",
    description: "Animez une formation, mesurez la compréhension et structurez la suite sans multiplier les outils.",
    alternates: { canonical: "/solutions/training", languages: { fr: "/solutions/training", en: "/en/solutions/training", "x-default": "/solutions/training" } },
  };
}

const FRENCH_CONTENT = {
  layout: "timeline" as const,
  eyebrow: "Formation professionnelle",
  title: "L’attention devient un",
  accent: "signal exploitable.",
  introduction: "Concevez une session vivante, détectez ce qui doit être réexpliqué et transmettez une preuve de progression à vos clients.",
  signal: "Une continuité pédagogique",
  signalDetail: "Le même espace relie animation, supports, exercices, résultats et suivi.",
  facts: [{ value: "Live", label: "Questions et réactions en temps réel" }, { value: "Async", label: "Cours, flashcards et examens" }, { value: "Exports", label: "Résultats à partager et analyser" }],
  chapters: [
    { index: "01 — Concevoir", title: "Préparer sans dupliquer.", text: "Transformez une base existante en formats adaptés aux différents temps de la formation.", points: ["Banque de questions et modèles réutilisables.", "Import de contenus structurés.", "Cours mêlant texte, vidéo, fichiers, SCORM et H5P."] },
    { index: "02 — Animer", title: "Maintenir un rythme humain.", text: "Le produit s’efface au profit du groupe et rend chaque transition lisible.", points: ["Entrée immédiate par QR ou code.", "Rythme contrôlé par le formateur.", "Débrief à partir des réponses réelles."] },
    { index: "03 — Prouver", title: "Restituer ce qui s’est passé.", text: "Les résultats ne restent pas enfermés dans la session.", points: ["Analyse détaillée et exports.", "Parcours et seuils de progression.", "Certificats de complétion partageables."] },
  ],
  closingTitle: "Montrez-nous une formation réelle.",
  closingText: "Nous construirons la démonstration à partir de vos contraintes de contenu, de groupe et de restitution.",
  primaryLabel: "Préparer ma démonstration",
  primaryHref: "/contact?intent=training",
};

const ENGLISH_CONTENT = {
  layout: "timeline" as const,
  eyebrow: "Corporate training",
  title: "Attention becomes a",
  accent: "usable signal.",
  introduction: "Design a lively session, spot what needs re-explaining, and hand your clients proof of progress.",
  signal: "A teaching continuity",
  signalDetail: "The same space links delivery, materials, exercises, results and follow-up.",
  facts: [{ value: "Live", label: "Real-time questions and reactions" }, { value: "Async", label: "Courses, flashcards and exams" }, { value: "Exports", label: "Results to share and analyze" }],
  chapters: [
    { index: "01 — Design", title: "Prepare without duplicating.", text: "Turn an existing base into formats suited to each moment of the training.", points: ["Reusable question bank and templates.", "Import structured content.", "Courses mixing text, video, files, SCORM and H5P."] },
    { index: "02 — Deliver", title: "Keep a human pace.", text: "The product steps back for the group and makes every transition readable.", points: ["Instant entry by QR or code.", "Pace controlled by the trainer.", "Debrief built from real answers."] },
    { index: "03 — Prove", title: "Report what actually happened.", text: "Results don't stay locked inside the session.", points: ["Detailed analysis and exports.", "Learning paths and progress thresholds.", "Shareable completion certificates."] },
  ],
  closingTitle: "Show us a real training session.",
  closingText: "We'll build the demonstration around your content, group and reporting constraints.",
  primaryLabel: "Prepare my demonstration",
  primaryHref: "/en/contact?intent=training",
};

export default async function TrainingSolutionPage({ params }: Props) {
  const { locale } = await params;
  const english = locale === "en";
  const content = english ? ENGLISH_CONTENT : FRENCH_CONTENT;

  return <AuthorityPage language={english ? "en" : "fr"} {...content} />;
}
