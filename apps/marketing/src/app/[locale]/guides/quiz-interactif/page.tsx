import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { HeroMiniQuiz, type HeroMiniQuizContent } from "@/components/HeroMiniQuiz";
import { ProductGlyph } from "@/components/ProductGlyph";
import { SITE_URL } from "@/lib/siteUrl";
import styles from "@/components/GuideArticle.module.css";

export const metadata: Metadata = {
  title: "Comment créer un quiz interactif utile",
  description: "Une méthode concrète pour définir l’objectif, choisir les questions, rythmer la session et exploiter les réponses d’un quiz interactif.",
  alternates: { canonical: "/guides/quiz-interactif" },
  openGraph: {
    title: "Comment créer un quiz interactif utile",
    description: "La méthode Brivia pour passer d’une animation agréable à une activité qui produit un résultat exploitable.",
    url: "/guides/quiz-interactif",
    type: "article",
  },
};

const UPDATED_AT = "2026-08-02";

const FAQ = [
  { question: "Combien de questions faut-il prévoir ?", answer: "Le bon nombre dépend du temps disponible et du rôle du quiz. Commencez par une question par décision pédagogique importante, puis retirez tout ce qui ne produit ni discussion, ni vérification, ni action." },
  { question: "Faut-il toujours chronométrer les réponses ?", answer: "Non. Un temps court convient au rappel rapide. Une question d’analyse ou de classement demande davantage de lecture. Le chronomètre doit servir le geste demandé, pas créer une difficulté artificielle." },
  { question: "Quand afficher la bonne réponse ?", answer: "Affichez-la immédiatement si le débrief fait partie de l’apprentissage. Différez-la lorsque plusieurs questions doivent mesurer une compréhension indépendante avant toute correction." },
  { question: "Que faut-il analyser après le quiz ?", answer: "Regardez les erreurs dominantes, les réponses dispersées, les questions trop faciles et les abandons. Ces signaux indiquent ce qu’il faut expliquer, reformuler ou approfondir." },
] as const;

const CHECKLIST = [
  "Une seule intention mesurable pour la séquence.",
  "Un type de question adapté au raisonnement attendu.",
  "Des consignes compréhensibles sans explication orale.",
  "Un temps de réponse cohérent avec la charge de lecture.",
  "Un débrief ou une action prévue pour chaque résultat important.",
] as const;

export function generateStaticParams() {
  return [{ locale: "fr" }];
}

type Props = { params: Promise<{ locale: string }> };

export default async function InteractiveQuizGuidePage({ params }: Props) {
  const { locale } = await params;
  if (locale !== "fr") notFound();

  const quizT = await getTranslations({ locale: "fr", namespace: "HeroMiniQuiz" });
  const heroQuiz: HeroMiniQuizContent = {
    ariaLabel: quizT("ariaLabel"),
    defaultHint: quizT("defaultHint"),
    almostHint: quizT("almostHint"),
    timeUpHint: quizT("timeUpHint"),
    finalScore: quizT("finalScore"),
    playAgain: quizT("playAgain"),
    questions: quizT.raw("questions"),
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Comment créer un quiz interactif utile",
    description: "Une méthode concrète pour concevoir, animer et analyser un quiz interactif.",
    inLanguage: "fr",
    datePublished: UPDATED_AT,
    dateModified: UPDATED_AT,
    mainEntityOfPage: `${SITE_URL}/guides/quiz-interactif`,
    author: { "@type": "Organization", name: "Équipe pédagogique Brivia", url: SITE_URL },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })),
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE_URL}/guides` },
      { "@type": "ListItem", position: 3, name: "Quiz interactif", item: `${SITE_URL}/guides/quiz-interactif` },
    ],
  };

  return (
    <div className="marketing-shell">
      <Header />
      <main id="main-content" className={styles.articlePage}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([articleSchema, faqSchema, breadcrumbSchema]).replace(/</g, "\\u003c") }} />
        <article>
          <header className={styles.articleHero}>
            <nav aria-label="Fil d’Ariane"><Link href="/guides">Guides</Link><span>/</span><span>Quiz interactif</span></nav>
            <h1>Comment créer un quiz interactif utile.</h1>
            <p className={styles.articleDeck}>Une méthode concrète pour transformer une série de questions en activité qui aide vraiment à décider, apprendre ou expliquer.</p>
            <div className={styles.articleMeta}><span>Équipe pédagogique Brivia</span><span>Mis à jour le 2 août 2026</span><span>Lecture : 8 minutes</span></div>
          </header>

          <section className={styles.definitionBlock} aria-labelledby="guide-definition-title">
            <span>Réponse directe</span>
            <div><h2 id="guide-definition-title">Qu’est-ce qu’un quiz interactif utile ?</h2><p>Un quiz interactif utile pose des questions liées à un objectif explicite, donne à chaque participant une façon simple de répondre et prévoit l’usage des résultats. Il ne se limite pas à distribuer des points : il révèle une compréhension, déclenche une discussion ou oriente la suite de la session.</p></div>
          </section>

          <div className={styles.articleBody}>
            <aside className={styles.articleNav} aria-label="Dans ce guide">
              <strong>Dans ce guide</strong>
              <a href="#objectif">Partir de l’objectif</a><a href="#format">Choisir le format</a><a href="#rythme">Construire le rythme</a><a href="#test">Tester la séquence</a><a href="#analyse">Analyser les réponses</a>
            </aside>

            <div className={styles.prose}>
              <section id="objectif">
                <h2>Commencez par la décision attendue.</h2>
                <p>Avant d’écrire la première question, formulez ce que le résultat doit permettre de faire. Vérifier un prérequis, faire émerger une opinion et entraîner un rappel ne demandent ni les mêmes questions ni le même débrief.</p>
                <div className={styles.answerPattern}><strong>Formulation utile</strong><p>« À la fin de cette séquence, je dois savoir si le groupe peut distinguer les trois situations à risque. »</p></div>
                <p>Cette phrase rend les choix suivants plus simples. Une question qui ne contribue pas à cette décision peut être retirée.</p>
              </section>

              <section id="format">
                <h2>Choisissez le geste avant l’apparence.</h2>
                <p>Le type de question doit correspondre à l’opération mentale demandée. Le choix multiple sert à reconnaître. L’ordre sert à reconstruire une procédure. L’association sert à relier des concepts. La réponse libre sert à produire, pas seulement à identifier.</p>
                <div className={styles.formatTable} role="table" aria-label="Choisir un type de question">
                  <div role="row"><strong role="columnheader">Objectif</strong><strong role="columnheader">Format conseillé</strong><strong role="columnheader">Signal observé</strong></div>
                  <div role="row"><span role="cell">Vérifier un rappel</span><span role="cell">Choix ou réponse courte</span><span role="cell">Exactitude immédiate</span></div>
                  <div role="row"><span role="cell">Reconstituer une méthode</span><span role="cell">Mise en ordre</span><span role="cell">Compréhension de la séquence</span></div>
                  <div role="row"><span role="cell">Faire émerger une perception</span><span role="cell">Sondage ou échelle</span><span role="cell">Répartition des opinions</span></div>
                </div>
              </section>

              <section id="rythme">
                <h2>Alternez réponse, lecture et débrief.</h2>
                <p>Une session devient fatigante lorsque toutes les questions sollicitent le même geste. Alternez une réponse rapide, une situation à analyser et un moment d’explication. Le rythme vient de la variété cognitive, pas d’un chronomètre toujours plus court.</p>
                <div className={styles.liveExample}><div><strong>Testez une question.</strong><p>Cette démonstration utilise un véritable composant du produit.</p></div><HeroMiniQuiz content={heroQuiz} /></div>
              </section>

              <section id="test">
                <h2>Testez la séquence comme un participant.</h2>
                <p>Lisez chaque consigne sans le contexte oral prévu le jour de la session. Vérifiez la longueur sur téléphone, les ambiguïtés, le temps de lecture et la façon dont le résultat sera expliqué. Une question comprise uniquement par son auteur n’est pas prête.</p>
                <div className={styles.checklist}><h3>Contrôle avant lancement</h3>{CHECKLIST.map((item) => <p key={item}><ProductGlyph name="check" /><span>{item}</span></p>)}</div>
              </section>

              <section id="analyse">
                <h2>Analysez ce qui change la suite.</h2>
                <p>Après la session, ne vous arrêtez pas au classement. Une majorité d’erreurs sur le même distracteur peut révéler une confusion précise. Des réponses très dispersées peuvent signaler une consigne ambiguë ou un concept encore instable.</p>
                <p>Notez l’ajustement décidé : expliquer autrement, ajouter un exemple, modifier une question ou proposer une activité de rappel. Le quiz devient utile lorsque ses résultats modifient l’action.</p>
              </section>
            </div>
          </div>

          <section className={styles.faqSection} aria-labelledby="guide-faq-title">
            <div><h2 id="guide-faq-title">Questions fréquentes.</h2><p>Des réponses courtes aux décisions qui reviennent pendant la conception.</p></div>
            <div>{FAQ.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div>
          </section>

          <section className={styles.guideClosing}>
            <div><h2>Construisez la première séquence.</h2><p>Commencez par l’objectif, puis testez chaque question dans le vrai parcours participant.</p></div>
            <a href="/builder-start?type=quiz" data-marketing-cta="guide_quiz_create">Créer un quiz <ProductGlyph name="arrow" /></a>
          </section>
        </article>
      </main>
      <Footer />
    </div>
  );
}
