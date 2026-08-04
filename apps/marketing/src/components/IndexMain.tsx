"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { HeroMiniQuiz, type HeroMiniQuizContent } from "@/components/HeroMiniQuiz";
import { PartnersStrip } from "@/components/PartnersStrip";
import { CompetitorComparison, type CompetitorComparisonContent } from "@/components/landing/CompetitorComparison";
import { ProductGlyph, type ProductGlyphName } from "@/components/ProductGlyph";
import { SignatureProductScene, type SignatureProductSceneContent } from "@/components/SignatureProductScene";
import { QUESTION_TYPE_PAGES } from "@/lib/questionTypePages";
import type { Partner, Review } from "@/lib/types";
import styles from "./IndexMain.module.css";
import pageStyles from "./MarketingPage.module.css";

type Format = { name: string; description: string; href: string; glyph: string };
type FaqItem = { question: string; answer: string };

export type IndexMainCopy = {
  invalidCode: string;
  heroTitle: string;
  heroAccent: string;
  heroText: string;
  create: string;
  demo: string;
  heroAlt: string;
  activeSession: string;
  collectiveSignal: string;
  mediaTitle: string;
  mediaText: string;
  proofTitle: string;
  proofText: string;
  proofNav: string;
  references: string;
  trust: string;
  trustDetail: string;
  demoTitle: string;
  demoText: string;
  formatsTitle: string;
  formatsText: string;
  formatsNav: string;
  featuresLink: string;
  audienceTitle: string;
  audienceText: string;
  educatorTitle: string;
  educatorText: string;
  educatorLink: string;
  organizationTitle: string;
  organizationText: string;
  organizationLink: string;
  questionTitle: string;
  questionText: string;
  questionAlt: string;
  questionNav: string;
  questionLink: string;
  comparisonTitle: string;
  comparisonText: string;
  comparisonLink: string;
  reviewsTitle: string;
  reviewsAlt: string;
  emptyReviews: string;
  reviewLink: string;
  faqTitle: string;
  helpLink: string;
  trustTitle: string;
  trustFacts: [string, string, string];
  trustLink: string;
  joinTitle: string;
  joinText: string;
  codeLabel: string;
  join: string;
  codeHelp: string;
  examLink: string;
  finalCta: string;
  pricing: string;
  // Pre-resolved via getTranslations server-side (depend on reviews.length/avgRating,
  // known before IndexMain renders — see [locale]/page.tsx).
  reviewsCountText: string;
  ratingValueText: string;
  referencesCountText: string;
  ratingSummaryText: string | null;
};

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
  locale,
  copy,
  formats,
  faq,
  questionLabels,
  partnersMessage,
  heroQuiz,
  signatureScene,
  competitorComparison,
}: {
  reviews: Review[];
  avgRating: string | null;
  partners: Partner[];
  locale: "fr" | "en";
  copy: IndexMainCopy;
  formats: Format[];
  faq: FaqItem[];
  questionLabels: Record<string, string>;
  partnersMessage: string;
  heroQuiz: HeroMiniQuizContent;
  signatureScene: SignatureProductSceneContent;
  competitorComparison: CompetitorComparisonContent;
}) {
  const english = locale === "en";
  const [gameCode, setGameCode] = useState("");
  const [gameError, setGameError] = useState("");
  const featuredReviews = reviews.slice(0, 2);
  const featuredQuestionTypes = QUESTION_TYPE_PAGES.slice(0, 8);

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
    <main id="main-content" className={styles.home} lang={locale}>
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

      <PartnersStrip partners={partners} message={partnersMessage} />

      <section className={styles.proofRail} aria-labelledby="home-proof-title">
        <div className={`${styles.container} ${styles.proofRailInner}`}>
          <div className={styles.proofRailCopy}>
            <h2 id="home-proof-title">{copy.proofTitle}</h2>
            <p>{copy.proofText}</p>
          </div>
          <nav className={styles.proofRailLinks} aria-label={copy.proofNav}>
            <a href="/reviews">
              <span>{copy.reviewsCountText}</span>
              <small>{copy.ratingValueText}</small>
              <ProductGlyph name="arrow" />
            </a>
            <a href="/customers">
              <span>{copy.references}</span>
              <small>{copy.referencesCountText}</small>
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
              <HeroMiniQuiz content={heroQuiz} />
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

      <SignatureProductScene content={signatureScene} />

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
              {featuredQuestionTypes.map((questionType) => (
                <a href={`/features/questions/${questionType.slug}`} key={questionType.slug}>
                  {questionLabels[questionType.slug] ?? questionType.navTitle}
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
          <CompetitorComparison content={competitorComparison} />
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
              {copy.ratingSummaryText && (
                <p className={styles.rating}>
                  {copy.ratingSummaryText}
                </p>
              )}
            </div>

            {featuredReviews.length > 0 ? (
              <div className={styles.reviewList}>
                {featuredReviews.map((review) => (
                  <figure key={review.id} className={styles.review}>
                    <div className={styles.stars} aria-label={english ? `${review.stars} stars out of 5` : `${review.stars} étoiles sur 5`}>
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
