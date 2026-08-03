"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { HeroMiniQuiz } from "@/components/HeroMiniQuiz";
import { PartnersStrip } from "@/components/PartnersStrip";
import { CompetitorComparison } from "@/components/landing/CompetitorComparison";
import { ProductGlyph, type ProductGlyphName } from "@/components/ProductGlyph";
import { SignatureProductScene } from "@/components/SignatureProductScene";
import { QUESTION_TYPE_PAGES } from "@/lib/questionTypePages";
import type { Partner, Review } from "@/lib/types";
import styles from "./IndexMain.module.css";
import pageStyles from "./MarketingPage.module.css";

const FRENCH_FORMATS = [
  {
    name: "Quiz live",
    description: "Questions chronométrées et classement en direct.",
    href: "/builder-start?type=quiz",
    glyph: "quiz",
  },
  {
    name: "Sondages",
    description: "Opinions, échelles et nuages de mots instantanés.",
    href: "/builder-start?type=poll",
    glyph: "poll",
  },
  {
    name: "Flashcards",
    description: "Révision active, seul ou en session guidée.",
    href: "/builder-start?type=flashcard",
    glyph: "flashcards",
  },
  {
    name: "Présentations",
    description: "Texte, médias, formes, tableaux et mode présentateur.",
    href: "/builder-start?type=slide",
    glyph: "presentation",
  },
  {
    name: "Examens",
    description: "Tentatives, seuils, fenêtres de passage et surveillance.",
    href: "/exam-builder",
    glyph: "exam",
  },
  {
    name: "Cours",
    description: "Vidéo, documents, activités, SCORM, H5P et dépôts.",
    href: "/course-builder",
    glyph: "course",
  },
] as const;

const ENGLISH_FORMATS = [
  { name: "Live quizzes", description: "Timed questions and a live leaderboard.", href: "/builder-start?type=quiz", glyph: "quiz" },
  { name: "Polls", description: "Opinions, scales and instant word clouds.", href: "/builder-start?type=poll", glyph: "poll" },
  { name: "Flashcards", description: "Active recall alone or in a guided session.", href: "/builder-start?type=flashcard", glyph: "flashcards" },
  { name: "Presentations", description: "Text, media, shapes, tables and presenter mode.", href: "/builder-start?type=slide", glyph: "presentation" },
  { name: "Assessments", description: "Attempts, thresholds, windows and monitoring.", href: "/exam-builder", glyph: "exam" },
  { name: "Courses", description: "Video, documents, activities, SCORM, H5P and submissions.", href: "/course-builder", glyph: "course" },
] as const;

const FRENCH_FAQ = [
  {
    question: "Est-ce vraiment gratuit pour commencer ?",
    answer:
      "Oui. Le plan Starter permet de créer jusqu’à 5 contenus et d’accueillir 20 participants par session, sans limite de durée.",
  },
  {
    question: "Les participants doivent-ils créer un compte ?",
    answer:
      "Non. Ils rejoignent avec un code à 6 caractères ou un QR code, directement depuis leur navigateur.",
  },
  {
    question: "Où sont hébergées les données ?",
    answer: "Les données sont hébergées en Europe, conformément au RGPD.",
  },
  {
    question: "Puis-je exporter les résultats ?",
    answer:
      "Oui, à partir du plan Pro. Les rapports détaillés peuvent être exportés pour poursuivre l’analyse.",
  },
] as const;

const ENGLISH_FAQ = [
  {
    question: "Is Brivia really free to start?",
    answer: "Yes. The Starter plan lets you create up to 5 pieces of content and welcome 20 participants per session, with no time limit.",
  },
  {
    question: "Do participants need to create an account?",
    answer: "No. They join with a six-character code or QR code directly from their browser.",
  },
  {
    question: "Where is the data hosted?",
    answer: "Application data is hosted in a European region, as documented in the Trust Center.",
  },
  {
    question: "Can I export the results?",
    answer: "Yes, from the Pro plan. Detailed reports can be exported for further analysis.",
  },
] as const;

const HOME_COPY = {
  fr: {
    invalidCode: "Saisissez les 6 caractères affichés à l’écran.",
    heroTitle: "Du direct aux résultats,",
    heroAccent: "un seul rythme.",
    heroText: "Brivia relie participation, apprentissage et évaluation dans un même système. Simple pour la salle, structuré pour l’organisation.",
    create: "Créer gratuitement",
    demo: "Essayer la démo",
    heroAlt: "Une formatrice anime un quiz interactif pendant un atelier professionnel",
    activeSession: "Brivia / session active",
    collectiveSignal: "Signal collectif",
    mediaTitle: "Voir. Répondre. Comprendre.",
    mediaText: "Le direct produit déjà la suite.",
    proofTitle: "Les preuves restent accessibles.",
    proofText: "Avis, références autorisées et contrôles documentés ont chacun leur source publique.",
    proofNav: "Preuves Brivia",
    reviews: (count: number) => count ? `${count} avis` : "Avis",
    rating: (value: string | null) => value ? `${value}/5 publié` : "Aucune moyenne inventée",
    references: "Références",
    referencesCount: (count: number) => count ? `${count} autorisée${count > 1 ? "s" : ""}` : "Protocole public",
    trust: "Confiance",
    trustDetail: "Contrôles et limites",
    demoTitle: "Une vraie question. Essayez.",
    demoText: "La preuve produit vient avant la promesse marketing.",
    formatsTitle: "Un outil, six formats.",
    formatsText: "Préparez une activité rapide ou un parcours complet sans disperser vos contenus.",
    formatsNav: "Créer un contenu Brivia",
    featuresLink: "Explorer toutes les fonctionnalités",
    audienceTitle: "Du cours au séminaire.",
    audienceText: "Le même geste simple, adapté à la taille et aux exigences de votre session.",
    educatorTitle: "Enseignants et formateurs",
    educatorText: "Démarrez gratuitement avec 20 participants par session et réunissez quiz, flashcards et examens au même endroit.",
    educatorLink: "Découvrir l’enseignement",
    organizationTitle: "Écoles et entreprises",
    organizationText: "Accueillez jusqu’à 200 participants avec Pro, puis exportez les résultats et suivez la progression.",
    organizationLink: "Découvrir Brivia Enterprise",
    questionTitle: "Quinze façons de faire réfléchir.",
    questionText: "Choix, rappel, ordre, association, image, échelles et réponses libres ont chacun leur page pratique.",
    questionAlt: "Une facilitatrice orchestre une question sur un mur de réponses immersif",
    questionNav: "Découvrir les types de questions",
    questionLink: "Voir les 15 types",
    comparisonTitle: "Brivia face aux outils du marché.",
    comparisonText: "Comparez ce qui est natif, ce qui dépend d’un autre produit et ce qui reste limité à un usage précis.",
    comparisonLink: "Voir le comparatif détaillé",
    reviewsTitle: "L’énergie se voit tout de suite.",
    reviewsAlt: "Un groupe de participants réagit ensemble aux résultats d’un quiz",
    ratingSummary: (rating: string, count: number) => `${rating}/5 sur ${count} retours publiés`,
    stars: (count: number) => `${count} étoiles sur 5`,
    emptyReviews: "Les premiers retours seront publiés ici.",
    reviewLink: "Voir les avis",
    faqTitle: "Les réponses avant de vous lancer.",
    helpLink: "Consulter le centre d’aide",
    trustTitle: "Simple pour eux. Solide pour vous.",
    trustFacts: ["Hébergement européen et pratiques documentées publiquement.", "Aucun compte requis pour les participants.", "Aucune carte bancaire pour commencer."],
    trustLink: "Consulter le centre de confiance",
    joinTitle: "Une partie vous attend ?",
    joinText: "Entrez le code affiché à l’écran pour rejoindre la session.",
    codeLabel: "Code de la partie",
    join: "Rejoindre",
    codeHelp: "6 caractères, sans espace.",
    examLink: "J’ai un code d’examen",
    finalCta: "Prêt à animer votre prochaine session ?",
    pricing: "Voir les tarifs",
  },
  en: {
    invalidCode: "Enter the six characters shown on screen.",
    heroTitle: "From live participation to results,",
    heroAccent: "one continuous rhythm.",
    heroText: "Brivia connects participation, learning and assessment in one system. Simple for the room, structured for the organization.",
    create: "Create for free",
    demo: "Try the demo",
    heroAlt: "A facilitator runs an interactive quiz during a professional workshop",
    activeSession: "Brivia / active session",
    collectiveSignal: "Collective signal",
    mediaTitle: "See. Respond. Understand.",
    mediaText: "The live moment already informs what comes next.",
    proofTitle: "The evidence stays accessible.",
    proofText: "Reviews, approved references and documented controls each retain a public source.",
    proofNav: "Brivia evidence",
    reviews: (count: number) => count ? `${count} reviews` : "Reviews",
    rating: (value: string | null) => value ? `${value}/5 published` : "No invented average",
    references: "References",
    referencesCount: (count: number) => count ? `${count} approved` : "Public protocol",
    trust: "Trust",
    trustDetail: "Controls and limitations",
    demoTitle: "A real question. Try it.",
    demoText: "Product evidence comes before the marketing promise.",
    formatsTitle: "One tool, six formats.",
    formatsText: "Prepare a quick activity or a complete learning path without scattering your content.",
    formatsNav: "Create Brivia content",
    featuresLink: "Explore all features",
    audienceTitle: "From the classroom to the company event.",
    audienceText: "The same simple action, adapted to the size and requirements of your session.",
    educatorTitle: "Educators and trainers",
    educatorText: "Start free with 20 participants per session and keep quizzes, flashcards and assessments in one place.",
    educatorLink: "Explore education",
    organizationTitle: "Schools and organizations",
    organizationText: "Welcome up to 200 participants with Pro, then export results and review progress.",
    organizationLink: "Explore Brivia Enterprise",
    questionTitle: "Fifteen ways to make people think.",
    questionText: "Choice, recall, order, matching, images, scales and open answers each support a distinct learning action.",
    questionAlt: "A facilitator leads a question on an immersive wall of responses",
    questionNav: "Explore question types",
    questionLink: "See all 15 types",
    comparisonTitle: "Brivia compared with established tools.",
    comparisonText: "Compare what is native, what depends on another product and what remains limited to a specific use case.",
    comparisonLink: "See the detailed comparison",
    reviewsTitle: "You can see the energy immediately.",
    reviewsAlt: "A group reacts together to the results of an interactive quiz",
    ratingSummary: (rating: string, count: number) => `${rating}/5 from ${count} published reviews`,
    stars: (count: number) => `${count} stars out of 5`,
    emptyReviews: "The first reviews will be published here.",
    reviewLink: "Read reviews",
    faqTitle: "Answers before you get started.",
    helpLink: "Open the help center",
    trustTitle: "Simple for them. Dependable for you.",
    trustFacts: ["European hosting and publicly documented practices.", "No participant account required.", "No payment card required to start."],
    trustLink: "Open the Trust Center",
    joinTitle: "Is a session waiting for you?",
    joinText: "Enter the code shown on screen to join the session.",
    codeLabel: "Session code",
    join: "Join",
    codeHelp: "Six characters, no spaces.",
    examLink: "I have an assessment code",
    finalCta: "Ready to run your next session?",
    pricing: "View pricing",
  },
} as const;

const ENGLISH_QUESTION_LABELS: Record<string, string> = {
  "multiple-choice": "Multiple choice",
  "true-false": "True or false",
  "short-answer": "Short answer",
  ranking: "Ranking",
  matching: "Matching",
  "fill-blank": "Fill in the blank",
  "drag-drop": "Drag and drop",
  hotspot: "Clickable area",
};

const FEATURED_QUESTION_TYPES = QUESTION_TYPE_PAGES.slice(0, 8);

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function IndexMain({
  reviews,
  avgRating,
  partners,
  language = "fr",
}: {
  reviews: Review[];
  avgRating: string | null;
  partners: Partner[];
  language?: "fr" | "en";
}) {
  const copy = HOME_COPY[language];
  const formats = language === "en" ? ENGLISH_FORMATS : FRENCH_FORMATS;
  const faq = language === "en" ? ENGLISH_FAQ : FRENCH_FAQ;
  const english = language === "en";
  const [gameCode, setGameCode] = useState("");
  const [gameError, setGameError] = useState("");
  const featuredReviews = reviews.slice(0, 2);

  const joinQuiz = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = gameCode.trim().toUpperCase();

    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setGameError(copy.invalidCode);
      return;
    }

    setGameError("");
    window.location.href = `/join/${code}`;
  };

  return (
    <main id="main-content" className={styles.home} lang={language}>
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={`${styles.container} ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <h1 id="home-title" className={styles.heroTitle}>
              {copy.heroTitle} <span>{copy.heroAccent}</span>
            </h1>
            <p className={styles.heroText}>
              {copy.heroText}
            </p>
            <div className={styles.heroActions}>
              <a className={styles.primaryButton} href="/builder-start?type=quiz" data-marketing-cta="home_create">
                {copy.create}
                <ProductGlyph name="arrow" />
              </a>
              <button
                className={styles.secondaryButton}
                type="button"
                data-marketing-cta="home_demo"
                onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}
              >
                {copy.demo}
              </button>
            </div>
          </div>

          <div className={styles.heroMedia}>
            <Image
              src="/images/brivia-workshop-editorial-v2.jpg"
              alt={copy.heroAlt}
              fill
              preload
              sizes="(max-width: 900px) 100vw, 52vw"
              className={styles.coverImage}
            />
            <div className={styles.heroLiveTag}>
              <span aria-hidden="true" />
              {copy.activeSession}
            </div>
            <div className={styles.heroMediaCard}>
              <div><ProductGlyph name="live" /><span>{copy.collectiveSignal}</span></div>
              <strong>{copy.mediaTitle}</strong>
              <p>{copy.mediaText}</p>
              <i aria-hidden="true"><b /><b /><b /><b /></i>
            </div>
          </div>
        </div>
      </section>

      <PartnersStrip partners={partners} language={language} />

      <section className={styles.proofRail} aria-labelledby="home-proof-title">
        <div className={`${styles.container} ${styles.proofRailInner}`}>
          <div className={styles.proofRailCopy}>
            <h2 id="home-proof-title">{copy.proofTitle}</h2>
            <p>{copy.proofText}</p>
          </div>
          <nav className={styles.proofRailLinks} aria-label={copy.proofNav}>
            <a href="/reviews">
              <span>{copy.reviews(reviews.length)}</span>
              <small>{copy.rating(avgRating)}</small>
              <ProductGlyph name="arrow" />
            </a>
            <a href="/customers">
              <span>{copy.references}</span>
              <small>{copy.referencesCount(partners.length)}</small>
              <ProductGlyph name="arrow" />
            </a>
            <a href={english ? "/en/security" : "/security"}>
              <span>{copy.trust}</span>
              <small>{copy.trustDetail}</small>
              <ProductGlyph name="arrow" />
            </a>
          </nav>
        </div>
      </section>

      <section id="demo" className={styles.section} aria-labelledby="demo-title">
        <div className={styles.container}>
          <div className={styles.sectionLead}>
            <h2 id="demo-title">{copy.demoTitle}</h2>
            <p>{copy.demoText}</p>
          </div>

          <div className={styles.productGrid}>
            <div className={styles.demoStage}>
              <HeroMiniQuiz language={language} />
            </div>

            <div className={styles.formatIndex}>
              <h3>{copy.formatsTitle}</h3>
              <p>{copy.formatsText}</p>
              <nav aria-label={copy.formatsNav}>
                {formats.map((format) => (
                  <a key={format.name} href={format.href} className={styles.formatLink}>
                    <span className={styles.formatGlyph}>
                      <ProductGlyph name={format.glyph as ProductGlyphName} />
                    </span>
                    <span className={styles.formatCopy}>
                      <strong>{format.name}</strong>
                      <small>{format.description}</small>
                    </span>
                    <ProductGlyph className={styles.linkGlyph} name="arrow" />
                  </a>
                ))}
              </nav>
              <a className={styles.allFeaturesLink} href="/features">
                {copy.featuresLink}
                <ProductGlyph name="arrow" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <SignatureProductScene language={language} />

      <section className={styles.audienceSection} aria-labelledby="audience-title">
        <div className={styles.container}>
          <div className={styles.sectionLead}>
            <h2 id="audience-title">{copy.audienceTitle}</h2>
            <p>{copy.audienceText}</p>
          </div>

          <div className={styles.audienceGrid}>
            <article id="education" className={styles.audienceColumn}>
              <div className={styles.audienceIcon}>
                <ProductGlyph name="learning" />
              </div>
              <h3>{copy.educatorTitle}</h3>
              <p>{copy.educatorText}</p>
              <a href="/solutions/education">
                {copy.educatorLink}
                <ProductGlyph name="arrow" />
              </a>
            </article>

            <article id="organizations" className={styles.audienceColumn}>
              <div className={styles.audienceIcon}>
                <ProductGlyph name="analytics" />
              </div>
              <h3>{copy.organizationTitle}</h3>
              <p>{copy.organizationText}</p>
              <a href={english ? "/en/enterprise" : "/enterprise"}>
                {copy.organizationLink}
                <ProductGlyph name="arrow" />
              </a>
            </article>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.questionSection}`} aria-labelledby="question-types-home-title">
        <div className={`${styles.container} ${styles.questionShowcase}`}>
          <div className={styles.questionShowcaseMedia}>
            <Image
              src="/images/brivia-question-wall-cinematic.jpg"
              alt={copy.questionAlt}
              fill
              sizes="(max-width: 900px) 100vw, 42vw"
              className={styles.coverImage}
            />
          </div>
          <div className={styles.questionShowcaseCopy}>
            <h2 id="question-types-home-title">{copy.questionTitle}</h2>
            <p>{copy.questionText}</p>
            <nav aria-label={copy.questionNav}>
              {FEATURED_QUESTION_TYPES.map((questionType) => (
                <a href={`/features/questions/${questionType.slug}`} key={questionType.slug}>
                  {english ? ENGLISH_QUESTION_LABELS[questionType.slug] ?? questionType.navTitle : questionType.navTitle}
                  <ProductGlyph name="arrow" />
                </a>
              ))}
            </nav>
            <a className={styles.textLink} href="/features#types-de-questions">
              {copy.questionLink}
              <ProductGlyph name="arrow" />
            </a>
          </div>
        </div>
      </section>

      <section className={`${pageStyles.section} ${pageStyles.page}`} aria-labelledby="home-comparison-title">
        <div className={pageStyles.container}>
          <div className={pageStyles.comparisonIntro}>
            <h2 id="home-comparison-title">{copy.comparisonTitle}</h2>
            <p>{copy.comparisonText}</p>
          </div>
          <CompetitorComparison language={language} />
          <div className={styles.comparisonAction}>
            <a className={styles.textLink} href="/features#comparatif">
              {copy.comparisonLink}
              <ProductGlyph name="arrow" />
            </a>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="reviews-title">
        <div className={`${styles.container} ${styles.reviewsGrid}`}>
          <div className={styles.reviewsMedia}>
            <Image
              src="/images/brivia-group-energy.jpg"
              alt={copy.reviewsAlt}
              fill
              sizes="(max-width: 900px) 100vw, 50vw"
              className={styles.coverImage}
            />
          </div>

          <div className={styles.reviewsCopy}>
            <div>
              <h2 id="reviews-title">{copy.reviewsTitle}</h2>
              {avgRating && (
                <p className={styles.rating}>
                  {copy.ratingSummary(avgRating, reviews.length)}
                </p>
              )}
            </div>

            {featuredReviews.length > 0 ? (
              <div className={styles.reviewList}>
                {featuredReviews.map((review) => (
                  <figure key={review.id} className={styles.review}>
                    <div className={styles.stars} aria-label={copy.stars(review.stars)}>
                      {"★★★★★".slice(0, review.stars)}
                    </div>
                    <blockquote lang="fr">{review.text}</blockquote>
                    <figcaption>
                      <span className={styles.avatar} aria-hidden="true">
                        {getInitials(review.name)}
                      </span>
                      <span>
                        <strong>{review.name}</strong>
                        <small>{review.role}</small>
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <div className={styles.emptyReview}>
                <p>{copy.emptyReviews}</p>
                <a href="/reviews">{copy.reviewLink}</a>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.assuranceSection}`} aria-labelledby="faq-title">
        <div className={`${styles.container} ${styles.assuranceGrid}`}>
          <div className={styles.faqColumn}>
            <h2 id="faq-title">{copy.faqTitle}</h2>
            <div className={styles.faqList}>
              {faq.map((item) => (
                <details key={item.question} className={styles.faqItem}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
            <a className={styles.textLink} href="/help">
              {copy.helpLink}
              <ProductGlyph name="arrow" />
            </a>
          </div>

          <aside className={styles.trustPanel} aria-labelledby="trust-title">
            <h2 id="trust-title">{copy.trustTitle}</h2>
            <ul>
              <li>
                <ProductGlyph name="security" />
                {copy.trustFacts[0]}
              </li>
              <li>
                <ProductGlyph name="collaboration" />
                {copy.trustFacts[1]}
              </li>
              <li>
                <ProductGlyph name="check" />
                {copy.trustFacts[2]}
              </li>
            </ul>
            <a className={styles.textLink} href={english ? "/en/security" : "/security"}>
              {copy.trustLink}
              <ProductGlyph name="arrow" />
            </a>
          </aside>
        </div>
      </section>

      <section className={styles.joinSection} aria-labelledby="join-title">
        <div className={`${styles.container} ${styles.joinGrid}`}>
          <div className={styles.joinCopy}>
            <h2 id="join-title">{copy.joinTitle}</h2>
            <p>{copy.joinText}</p>

            <form className={styles.joinForm} onSubmit={joinQuiz} noValidate>
              <label htmlFor="game-code">{copy.codeLabel}</label>
              <div className={styles.joinControls}>
                <input
                  id="game-code"
                  name="game-code"
                  value={gameCode}
                  onChange={(event) => {
                    setGameCode(event.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase());
                    if (gameError) setGameError("");
                  }}
                  inputMode="text"
                  autoComplete="off"
                  maxLength={6}
                  aria-invalid={Boolean(gameError)}
                  aria-describedby={gameError ? "game-code-error" : "game-code-help"}
                />
                <button type="submit">{copy.join}</button>
              </div>
              {gameError ? (
                <p id="game-code-error" className={styles.formError} role="alert">
                  {gameError}
                </p>
              ) : (
                <p id="game-code-help" className={styles.formHelp}>
                  {copy.codeHelp}
                </p>
              )}
            </form>

            <a className={styles.joinExamLink} href="/join-exam">
              {copy.examLink}
            </a>
          </div>

          <div className={styles.finalCta}>
            <p>{copy.finalCta}</p>
            <a href="/pricing">
              <span>{copy.pricing}</span>
              <ProductGlyph name="arrow" />
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
