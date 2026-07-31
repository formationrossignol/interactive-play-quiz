import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Lightbulb, Target } from "lucide-react";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { QuestionTypeDemo } from "@/components/QuestionTypeDemo";
import styles from "@/components/MarketingPage.module.css";
import { QUESTION_TYPE_BY_SLUG, QUESTION_TYPE_PAGES } from "@/lib/questionTypePages";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return QUESTION_TYPE_PAGES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const questionType = QUESTION_TYPE_BY_SLUG.get(slug);
  if (!questionType) return {};

  return {
    title: questionType.title,
    description: `${questionType.description} Découvrez le fonctionnement, les usages et un exemple interactif dans Brivia.`,
  };
}

export default async function QuestionTypePage({ params }: PageProps) {
  const { slug } = await params;
  const questionType = QUESTION_TYPE_BY_SLUG.get(slug);
  if (!questionType) notFound();

  const related = questionType.related
    .map((relatedSlug) => QUESTION_TYPE_BY_SLUG.get(relatedSlug))
    .filter((item) => item !== undefined);

  return (
    <div className="marketing-shell">
      <Header />
      <main id="main-content" className={styles.page}>
        <section className={styles.hero} aria-labelledby="question-type-title">
          <div className={`${styles.container} ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <h1 id="question-type-title">{questionType.title}</h1>
              <p className={styles.heroText}>{questionType.description}</p>
              <div className={styles.actions}>
                <a className={styles.primaryButton} href="/builder-start?type=quiz">
                  Créer une question
                  <ArrowRight size={18} aria-hidden="true" />
                </a>
                <Link className={styles.secondaryButton} href="/features#types-de-questions">
                  Voir les 15 types
                </Link>
              </div>
            </div>
            <div className={styles.heroMedia}>
              <Image
                src={questionType.image}
                alt={questionType.imageAlt}
                fill
                priority
                sizes="(max-width: 900px) 100vw, 46vw"
              />
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionTint}`} aria-labelledby="example-title">
          <div className={`${styles.container} ${styles.demoLayout}`}>
            <div className={styles.demoCopy}>
              <h2 id="example-title">Testez le format.</h2>
              <p>{questionType.detail}</p>
              <dl className={styles.questionFacts}>
                <div>
                  <dt>Usage</dt>
                  <dd>{questionType.mode}</dd>
                </div>
                <div>
                  <dt>Réponse</dt>
                  <dd>{questionType.instruction}</dd>
                </div>
              </dl>
            </div>
            <QuestionTypeDemo questionType={questionType} />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="use-cases-title">
          <div className={styles.container}>
            <div className={styles.sectionLead}>
              <h2 id="use-cases-title">Quand l’utiliser.</h2>
              <p>Choisissez ce format lorsque le geste demandé sert réellement votre objectif pédagogique.</p>
            </div>
            <div className={styles.useCaseGrid}>
              {questionType.bestFor.map((useCase, index) => (
                <article className={styles.useCase} key={useCase.title}>
                  {index === 0 ? <Target size={25} aria-hidden="true" /> : <Lightbulb size={25} aria-hidden="true" />}
                  <h3>{useCase.title}</h3>
                  <p>{useCase.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionTint}`} aria-labelledby="settings-title">
          <div className={styles.container}>
            <div className={styles.sectionLead}>
              <h2 id="settings-title">Les réglages utiles.</h2>
              <p>Le format reste simple pour le participant, avec le niveau de contrôle nécessaire côté animateur.</p>
            </div>
            <div className={styles.settingGrid}>
              {questionType.capabilities.map((capability) => (
                <article className={styles.setting} key={capability.title}>
                  <CheckCircle2 size={22} aria-hidden="true" />
                  <div>
                    <h3>{capability.title}</h3>
                    <p>{capability.text}</p>
                  </div>
                </article>
              ))}
            </div>
            <div className={styles.tipPanel}>
              <h3>Conseils de conception</h3>
              <ul>
                {questionType.tips.map((tip) => <li key={tip}>{tip}</li>)}
              </ul>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="related-title">
          <div className={styles.container}>
            <div className={styles.relatedHeader}>
              <div>
                <h2 id="related-title">Formats complémentaires.</h2>
                <p>Combinez plusieurs gestes pour maintenir l’attention et mieux comprendre les réponses.</p>
              </div>
              <Link href="/features#types-de-questions">
                <ArrowLeft size={17} aria-hidden="true" />
                Tous les types
              </Link>
            </div>
            <div className={styles.relatedGrid}>
              {related.map((item) => (
                <Link href={`/features/questions/${item.slug}`} key={item.slug}>
                  <span>{item.mode}</span>
                  <strong>{item.navTitle}</strong>
                  <p>{item.description}</p>
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={`${styles.container} ${styles.cta}`}>
            <div>
              <h2>Construisez votre première séquence.</h2>
              <p>Créez un quiz ou un sondage, puis choisissez le bon format à chaque étape.</p>
            </div>
            <a className={styles.primaryButton} href="/builder-start?type=quiz">
              Commencer
              <ArrowRight size={18} aria-hidden="true" />
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
