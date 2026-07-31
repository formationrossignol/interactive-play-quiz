"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  Check,
  PencilLine,
  QrCode,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { HeroMiniQuiz } from "@/components/HeroMiniQuiz";
import { PartnersStrip } from "@/components/PartnersStrip";
import { CompetitorComparison } from "@/components/landing/CompetitorComparison";
import { QUESTION_TYPE_PAGES } from "@/lib/questionTypePages";
import type { Partner, Review } from "@/lib/types";
import styles from "./IndexMain.module.css";
import pageStyles from "./MarketingPage.module.css";

const FORMATS = [
  {
    name: "Quiz live",
    description: "Questions chronométrées et classement en direct.",
    href: "/builder-start?type=quiz",
  },
  {
    name: "Sondages",
    description: "Opinions, échelles et nuages de mots instantanés.",
    href: "/builder-start?type=poll",
  },
  {
    name: "Flashcards",
    description: "Révision active, seul ou en session guidée.",
    href: "/builder-start?type=flashcard",
  },
  {
    name: "Présentations",
    description: "Texte, médias, formes, tableaux et mode présentateur.",
    href: "/builder-start?type=slide",
  },
  {
    name: "Examens",
    description: "Tentatives, seuils, fenêtres de passage et surveillance.",
    href: "/exam-builder",
  },
  {
    name: "Cours",
    description: "Vidéo, documents, activités, SCORM, H5P et dépôts.",
    href: "/course-builder",
  },
] as const;

const WORKFLOW = [
  {
    icon: PencilLine,
    title: "Composez",
    description: "Partez de zéro ou adaptez un contenu existant en quelques minutes.",
  },
  {
    icon: QrCode,
    title: "Lancez",
    description: "Affichez le code ou le QR. Tout le monde rejoint depuis son navigateur.",
  },
  {
    icon: BarChart3,
    title: "Analysez",
    description: "Suivez les réponses en direct et retrouvez les résultats après la session.",
  },
] as const;

const FAQ = [
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
}: {
  reviews: Review[];
  avgRating: string | null;
  partners: Partner[];
}) {
  const [gameCode, setGameCode] = useState("");
  const [gameError, setGameError] = useState("");
  const featuredReviews = reviews.slice(0, 2);

  const joinQuiz = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = gameCode.trim().toUpperCase();

    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setGameError("Saisissez les 6 caractères affichés à l’écran.");
      return;
    }

    setGameError("");
    window.location.href = `/join/${code}`;
  };

  return (
    <main id="main-content" className={styles.home}>
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={`${styles.container} ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <h1 id="home-title" className={styles.heroTitle}>
              Faites participer <span>toute la salle.</span>
            </h1>
            <p className={styles.heroText}>
              Créez des quiz, sondages et présentations que vos participants rejoignent en un scan, sans compte ni installation.
            </p>
            <div className={styles.heroActions}>
              <a className={styles.primaryButton} href="/builder-start?type=quiz">
                Créer gratuitement
                <ArrowRight size={18} strokeWidth={1.8} aria-hidden="true" />
              </a>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}
              >
                Essayer la démo
              </button>
            </div>
          </div>

          <div className={styles.heroMedia}>
            <Image
              src="/images/brivia-workshop-hero.jpg"
              alt="Un formateur anime un atelier interactif avec des participants équipés de leur téléphone"
              fill
              preload
              sizes="(max-width: 900px) 100vw, 48vw"
              className={styles.coverImage}
            />
          </div>
        </div>
      </section>

      <PartnersStrip partners={partners} />

      <section id="demo" className={styles.section} aria-labelledby="demo-title">
        <div className={styles.container}>
          <div className={styles.sectionLead}>
            <h2 id="demo-title">Une vraie question. Essayez.</h2>
            <p>La preuve produit vient avant la promesse marketing.</p>
          </div>

          <div className={styles.productGrid}>
            <div className={styles.demoStage}>
              <HeroMiniQuiz />
            </div>

            <div className={styles.formatIndex}>
              <h3>Un outil, six formats.</h3>
              <p>
                Préparez une activité rapide ou un parcours complet sans disperser vos contenus.
              </p>
              <nav aria-label="Créer un contenu Brivia">
                {FORMATS.map((format) => (
                  <a key={format.name} href={format.href} className={styles.formatLink}>
                    <span>
                      <strong>{format.name}</strong>
                      <small>{format.description}</small>
                    </span>
                    <ArrowRight size={19} strokeWidth={1.8} aria-hidden="true" />
                  </a>
                ))}
              </nav>
              <a className={styles.allFeaturesLink} href="/features">
                Explorer toutes les fonctionnalités
                <ArrowRight size={18} strokeWidth={1.8} aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.workflowSection}`} aria-labelledby="workflow-title">
        <div className={`${styles.container} ${styles.workflowGrid}`}>
          <div className={styles.workflowMedia}>
            <Image
              src="/images/brivia-join-qr.jpg"
              alt="Une participante scanne le QR code projeté au début d’une formation"
              fill
              sizes="(max-width: 900px) 100vw, 52vw"
              className={styles.coverImage}
            />
          </div>

          <div className={styles.workflowCopy}>
            <h2 id="workflow-title">Du premier clic aux résultats.</h2>
            <p className={styles.sectionText}>
              Brivia garde le parcours court pour vous laisser vous concentrer sur le groupe.
            </p>
            <div className={styles.workflowList}>
              {WORKFLOW.map(({ icon: Icon, title, description }) => (
                <article key={title} className={styles.workflowItem}>
                  <Icon size={23} strokeWidth={1.7} aria-hidden="true" />
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.audienceSection} aria-labelledby="audience-title">
        <div className={styles.container}>
          <div className={styles.sectionLead}>
            <h2 id="audience-title">Du cours au séminaire.</h2>
            <p>Le même geste simple, adapté à la taille et aux exigences de votre session.</p>
          </div>

          <div className={styles.audienceGrid}>
            <article className={styles.audienceColumn}>
              <div className={styles.audienceIcon}>
                <UsersRound size={25} strokeWidth={1.7} aria-hidden="true" />
              </div>
              <h3>Enseignants et formateurs</h3>
              <p>
                Démarrez gratuitement avec 20 participants par session et réunissez quiz, flashcards et examens au même endroit.
              </p>
              <a href="/builder-start?type=quiz">
                Créer mon premier quiz
                <ArrowRight size={17} strokeWidth={1.8} aria-hidden="true" />
              </a>
            </article>

            <article className={styles.audienceColumn}>
              <div className={styles.audienceIcon}>
                <BarChart3 size={25} strokeWidth={1.7} aria-hidden="true" />
              </div>
              <h3>Écoles et entreprises</h3>
              <p>
                Accueillez jusqu’à 200 participants avec Pro, puis exportez les résultats et suivez la progression.
              </p>
              <a href="/pricing">
                Comparer les formules
                <ArrowRight size={17} strokeWidth={1.8} aria-hidden="true" />
              </a>
            </article>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.questionSection}`} aria-labelledby="question-types-home-title">
        <div className={`${styles.container} ${styles.questionShowcase}`}>
          <div className={styles.questionShowcaseMedia}>
            <Image
              src="/images/brivia-quiz-authoring.jpg"
              alt="Un formateur prépare les questions de sa prochaine session"
              fill
              sizes="(max-width: 900px) 100vw, 42vw"
              className={styles.coverImage}
            />
          </div>
          <div className={styles.questionShowcaseCopy}>
            <h2 id="question-types-home-title">Quinze façons de faire réfléchir.</h2>
            <p>Choix, rappel, ordre, association, image, échelles et réponses libres ont chacun leur page pratique.</p>
            <nav aria-label="Découvrir les types de questions">
              {FEATURED_QUESTION_TYPES.map((questionType) => (
                <a href={`/features/questions/${questionType.slug}`} key={questionType.slug}>
                  {questionType.navTitle}
                  <ArrowRight size={16} aria-hidden="true" />
                </a>
              ))}
            </nav>
            <a className={styles.textLink} href="/features#types-de-questions">
              Voir les 15 types
              <ArrowRight size={17} strokeWidth={1.8} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <section className={`${pageStyles.section} ${pageStyles.page}`} aria-labelledby="home-comparison-title">
        <div className={pageStyles.container}>
          <div className={pageStyles.comparisonIntro}>
            <h2 id="home-comparison-title">Brivia face aux outils du marché.</h2>
            <p>
              Comparez ce qui est natif, ce qui dépend d’un autre produit et ce qui reste limité à un usage précis.
            </p>
          </div>
          <CompetitorComparison />
          <div className={styles.comparisonAction}>
            <a className={styles.textLink} href="/features#comparatif">
              Voir le comparatif détaillé
              <ArrowRight size={17} strokeWidth={1.8} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="reviews-title">
        <div className={`${styles.container} ${styles.reviewsGrid}`}>
          <div className={styles.reviewsMedia}>
            <Image
              src="/images/brivia-group-energy.jpg"
              alt="Un groupe de participants réagit ensemble aux résultats d’un quiz"
              fill
              sizes="(max-width: 900px) 100vw, 50vw"
              className={styles.coverImage}
            />
          </div>

          <div className={styles.reviewsCopy}>
            <div>
              <h2 id="reviews-title">L’énergie se voit tout de suite.</h2>
              {avgRating && (
                <p className={styles.rating}>
                  {avgRating}/5 sur {reviews.length} avis vérifiés
                </p>
              )}
            </div>

            {featuredReviews.length > 0 ? (
              <div className={styles.reviewList}>
                {featuredReviews.map((review) => (
                  <figure key={review.id} className={styles.review}>
                    <div className={styles.stars} aria-label={`${review.stars} étoiles sur 5`}>
                      {"★★★★★".slice(0, review.stars)}
                    </div>
                    <blockquote>{review.text}</blockquote>
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
                <p>Les premiers retours seront publiés ici.</p>
                <a href="/reviews">Voir les avis</a>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.assuranceSection}`} aria-labelledby="faq-title">
        <div className={`${styles.container} ${styles.assuranceGrid}`}>
          <div className={styles.faqColumn}>
            <h2 id="faq-title">Les réponses avant de vous lancer.</h2>
            <div className={styles.faqList}>
              {FAQ.map((item) => (
                <details key={item.question} className={styles.faqItem}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
            <a className={styles.textLink} href="/help">
              Consulter le centre d’aide
              <ArrowRight size={17} strokeWidth={1.8} aria-hidden="true" />
            </a>
          </div>

          <aside className={styles.trustPanel} aria-labelledby="trust-title">
            <h2 id="trust-title">Simple pour eux. Solide pour vous.</h2>
            <ul>
              <li>
                <ShieldCheck size={21} strokeWidth={1.7} aria-hidden="true" />
                Données hébergées en Europe et conformité RGPD.
              </li>
              <li>
                <UsersRound size={21} strokeWidth={1.7} aria-hidden="true" />
                Aucun compte requis pour les participants.
              </li>
              <li>
                <Check size={21} strokeWidth={1.9} aria-hidden="true" />
                Aucune carte bancaire pour commencer.
              </li>
            </ul>
          </aside>
        </div>
      </section>

      <section className={styles.joinSection} aria-labelledby="join-title">
        <div className={`${styles.container} ${styles.joinGrid}`}>
          <div className={styles.joinCopy}>
            <h2 id="join-title">Une partie vous attend ?</h2>
            <p>Entrez le code affiché à l’écran pour rejoindre la session.</p>

            <form className={styles.joinForm} onSubmit={joinQuiz} noValidate>
              <label htmlFor="game-code">Code de la partie</label>
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
                <button type="submit">Rejoindre</button>
              </div>
              {gameError ? (
                <p id="game-code-error" className={styles.formError} role="alert">
                  {gameError}
                </p>
              ) : (
                <p id="game-code-help" className={styles.formHelp}>
                  6 caractères, sans espace.
                </p>
              )}
            </form>

            <a className={styles.joinExamLink} href="/join-exam">
              J’ai un code d’examen
            </a>
          </div>

          <div className={styles.finalCta}>
            <p>Prêt à animer votre prochaine session ?</p>
            <a href="/builder-start?type=quiz">
              Créer gratuitement
              <ArrowRight size={18} strokeWidth={1.8} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
