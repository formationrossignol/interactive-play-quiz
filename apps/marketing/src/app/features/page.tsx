import type { Metadata } from "next";
import Image from "next/image";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CapabilityExplorer } from "@/components/CapabilityExplorer";
import { ProductGlyph, type ProductGlyphName } from "@/components/ProductGlyph";
import { CompetitorComparison } from "@/components/landing/CompetitorComparison";
import { QUESTION_TYPE_PAGES } from "@/lib/questionTypePages";
import styles from "@/components/MarketingPage.module.css";

const FORMATS = [
  {
    id: "format-quiz",
    name: "Quiz",
    description: "Neuf types de questions, points, chronomètre, correction et classement en direct.",
    href: "/builder-start?type=quiz",
    glyph: "quiz" as ProductGlyphName,
    meta: "Évaluer en direct",
  },
  {
    id: "format-polls",
    name: "Sondages",
    description: "Choix, Likert, NPS, étoiles, priorisation et réponses ouvertes sans logique de bonne réponse.",
    href: "/builder-start?type=poll",
    glyph: "poll" as ProductGlyphName,
    meta: "Faire émerger l’opinion",
  },
  {
    id: "format-flashcards",
    name: "Flashcards",
    description: "Cartes recto-verso, images et séances de mémorisation à son rythme.",
    href: "/builder-start?type=flashcard",
    glyph: "flashcards" as ProductGlyphName,
    meta: "Mémoriser durablement",
  },
  {
    id: "format-presentations",
    name: "Présentations",
    description: "Un vrai éditeur de slides avec texte riche, images, vidéos, formes, tableaux et mode présentateur.",
    href: "/builder-start?type=slide",
    glyph: "presentation" as ProductGlyphName,
    meta: "Présenter et faire agir",
  },
  {
    id: "format-exams",
    name: "Examens",
    description: "Fenêtres de passage, tentatives, seuils, résultats différés et surveillance configurable.",
    href: "/exam-builder",
    glyph: "exam" as ProductGlyphName,
    meta: "Certifier les acquis",
  },
  {
    id: "format-courses",
    name: "Cours",
    description: "Modules mêlant texte, vidéo, fichiers, quiz, sondages, SCORM, H5P et dépôts de travaux.",
    href: "/course-builder",
    glyph: "course" as ProductGlyphName,
    meta: "Structurer un parcours",
  },
] as const;

export const metadata: Metadata = {
  title: "Fonctionnalités",
  description: "Quiz, sondages, flashcards, présentations, examens, cours, parcours, SCORM, H5P, analytics et exports dans Brivia.",
};

export default function FeaturesPage() {
  const quizQuestionTypes = QUESTION_TYPE_PAGES.filter((item) => item.mode !== "Sondage");
  const pollQuestionTypes = QUESTION_TYPE_PAGES.filter((item) => item.mode === "Sondage");

  return (
    <div className="marketing-shell">
      <Header />
      <main id="main-content" className={styles.page}>
        <section className={styles.hero} aria-labelledby="features-title">
          <div className={`${styles.container} ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <h1 id="features-title">
                Bien plus qu’un <span>quiz live.</span>
              </h1>
              <p className={styles.heroText}>
                Créez, animez, évaluez et suivez un parcours complet dans le même espace.
              </p>
              <div className={styles.actions}>
                <a className={styles.primaryButton} href="/builder-start?type=quiz">
                  Créer gratuitement
                  <ProductGlyph name="arrow" />
                </a>
                <a className={styles.secondaryButton} href="#comparatif">
                  Comparer les outils
                </a>
              </div>
            </div>
            <div className={styles.heroMedia}>
              <Image
                src="/images/brivia-platform-control.jpg"
                alt="Un concepteur pédagogique pilote ses contenus depuis un poste de travail"
                fill
                priority
                sizes="(max-width: 900px) 100vw, 46vw"
              />
            </div>
          </div>
        </section>

        <nav className={styles.productIndex} aria-label="Parcourir les fonctionnalités">
          <div className={`${styles.container} ${styles.productIndexInner}`}>
            <span>Explorer le produit</span>
            <a href="#formats"><b>01</b> Formats</a>
            <a href="#types-de-questions"><b>02</b> Questions</a>
            <a href="#capabilities"><b>03</b> Capacités</a>
            <a href="#comparatif"><b>04</b> Comparatif</a>
          </div>
        </nav>

        <section id="formats" className={`${styles.section} ${styles.sectionTint}`} aria-labelledby="formats-title">
          <div className={styles.container}>
            <div className={styles.sectionLead}>
              <h2 id="formats-title">Six formats natifs, un seul espace.</h2>
              <p>Chaque format a son propre éditeur et partage la même organisation, les mêmes accès et le même suivi.</p>
            </div>
            <div className={styles.formatGrid}>
              {FORMATS.map(({ id, name, description, href, glyph, meta }) => (
                <a id={id} className={styles.formatCard} href={href} key={name}>
                  <ProductGlyph name={glyph} className={styles.productGlyph} />
                  <div>
                    <h3>{name}</h3>
                    <p>{description}</p>
                  </div>
                  <span className={styles.formatMeta}>
                    {meta}
                    <ProductGlyph name="arrow" />
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section id="types-de-questions" className={styles.section} aria-labelledby="question-types-title">
          <div className={styles.container}>
            <div className={styles.sectionLead}>
              <h2 id="question-types-title">Le bon geste pour chaque question.</h2>
              <p>Quinze formats documentés, avec leur usage, leurs réglages et un exemple interactif.</p>
            </div>
            <div className={styles.questionTypeGroups}>
              <section className={styles.questionTypeGroup}>
                <div className={styles.questionTypeImage}>
                  <Image
                    src="/images/brivia-learner-session.jpg"
                    alt="Un apprenant répond à une question pendant une formation"
                    fill
                    sizes="(max-width: 900px) 100vw, 34vw"
                  />
                </div>
                <div>
                  <h3>Évaluer les connaissances</h3>
                  <p>Rappel, choix, ordre, association, repérage et estimation.</p>
                  <nav aria-label="Types de questions de quiz">
                    {quizQuestionTypes.map((questionType) => (
                      <a href={`/features/questions/${questionType.slug}`} key={questionType.slug}>
                        <span>
                          <strong>{questionType.navTitle}</strong>
                          <small>{questionType.description}</small>
                        </span>
                        <ProductGlyph name="arrow" />
                      </a>
                    ))}
                  </nav>
                </div>
              </section>

              <section className={styles.questionTypeGroup}>
                <div className={styles.questionTypeImage}>
                  <Image
                    src="/images/brivia-analytics-review.jpg"
                    alt="Deux responsables analysent ensemble les données d’une session"
                    fill
                    sizes="(max-width: 900px) 100vw, 34vw"
                  />
                </div>
                <div>
                  <h3>Recueillir l’opinion</h3>
                  <p>Préférences, accord, fréquence, satisfaction et verbatims.</p>
                  <nav aria-label="Types de questions de sondage">
                    {pollQuestionTypes.map((questionType) => (
                      <a href={`/features/questions/${questionType.slug}`} key={questionType.slug}>
                        <span>
                          <strong>{questionType.navTitle}</strong>
                          <small>{questionType.description}</small>
                        </span>
                        <ProductGlyph name="arrow" />
                      </a>
                    ))}
                  </nav>
                </div>
              </section>
            </div>
          </div>
        </section>

        <section id="capabilities" className={`${styles.section} ${styles.capabilitySection}`} aria-labelledby="capabilities-title">
          <div className={styles.container}>
            <div className={styles.capabilityLead}>
              <span>Le système Brivia</span>
              <h2 id="capabilities-title">Ce que l’app fait déjà.</h2>
              <p>Inventaire fondé sur les éditeurs, outils, exports et parcours présents dans Brivia.</p>
            </div>
            <CapabilityExplorer />
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionTint}`} aria-labelledby="workflow-proof-title">
          <div className={`${styles.container} ${styles.proofGrid}`}>
            <div className={styles.proofMedia}>
              <Image
                src="/images/brivia-live-entry-cinematic.jpg"
                alt="Une participante rejoint une session depuis son téléphone face à la projection"
                fill
                sizes="(max-width: 900px) 100vw, 55vw"
              />
            </div>
            <div>
              <div className={styles.sectionLead}>
                <h2 id="workflow-proof-title">Puissant côté animateur. Direct côté participant.</h2>
                <p>L’expérience reste légère pour la salle, même quand le scénario pédagogique devient plus exigeant.</p>
              </div>
              <div className={styles.proofList}>
                <article className={styles.proofItem}>
                  <ProductGlyph name="qr" className={styles.productGlyph} />
                  <div><h3>Un scan suffit</h3><p>Pas de compte participant, pas d’installation et pas de parcours d’inscription.</p></div>
                </article>
                <article className={styles.proofItem}>
                  <ProductGlyph name="controls" className={styles.productGlyph} />
                  <div><h3>Le contrôle reste chez vous</h3><p>Vous choisissez le rythme, les règles, le moment de la correction et les résultats visibles.</p></div>
                </article>
                <article className={styles.proofItem}>
                  <ProductGlyph name="analytics" className={styles.productGlyph} />
                  <div><h3>Le débrief est déjà prêt</h3><p>Les réponses et scores restent disponibles pour analyser, exporter et faire progresser.</p></div>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section id="comparatif" className={styles.section} aria-labelledby="comparison-title">
          <div className={styles.container}>
            <div className={styles.comparisonIntro}>
              <h2 id="comparison-title">Brivia face aux outils du marché.</h2>
              <p>
                Kahoot, Mentimeter et Wooclap sont solides sur leur terrain. Brivia réunit animation, révision,
                présentation, examen et cours dans un seul environnement.
              </p>
            </div>
            <CompetitorComparison />
          </div>
        </section>

        <section className={styles.section}>
          <div className={`${styles.container} ${styles.cta}`}>
            <div>
              <h2>Commencez par une question.</h2>
              <p>Le plan Starter accueille jusqu’à 20 participants et ne demande aucune carte bancaire.</p>
            </div>
            <a className={styles.primaryButton} href="/builder-start?type=quiz">
              Créer gratuitement
              <ProductGlyph name="arrow" />
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
