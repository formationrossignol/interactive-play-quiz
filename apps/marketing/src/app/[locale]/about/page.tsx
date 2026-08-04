import type { Metadata } from "next";
import Image from "next/image";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { fetchStaticPage } from "@/lib/repo";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { STATIC_PAGE_DEFAULTS, mergeStaticPage } from "@/lib/staticPageDefaults";
import styles from "@/components/ResourcePages.module.css";
import { ProductGlyph } from "@/components/ProductGlyph";

type Props = { params: Promise<{ locale: string }> };

async function getPage() {
  const data = await fetchStaticPage("about");
  return mergeStaticPage(STATIC_PAGE_DEFAULTS.about, data);
}

// English content below is a static translation snapshot, NOT sourced from
// the CMS (fetchStaticPage("about") stays FR-only — no `locale` column on
// `static_pages` today). Will drift from FR edits until a CMS localization
// project ships.
const ENGLISH_VALUES = [
  { title: "Innovation", desc: "We keep pushing for experiences that feel more engaging and more intuitive." },
  { title: "Collaboration", desc: "We make teamwork easier and encourage sharing what people learn." },
  { title: "Simplicity", desc: "Powerful tools that stay simple to use, for everyone." },
  { title: "Commitment", desc: "We care about what we build and invest fully in your success." },
] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  if (locale === "en") {
    return {
      title: "About",
      description: "Why Brivia brings hosting, learning and assessment together in one tool.",
      alternates: { canonical: "/en/about", languages: { fr: "/about", en: "/en/about", "x-default": "/about" } },
    };
  }

  return {
    title: "À propos",
    description: "Découvrez pourquoi Brivia réunit animation, apprentissage et évaluation dans un même outil.",
    alternates: { canonical: "/about", languages: { fr: "/about", en: "/en/about", "x-default": "/about" } },
  };
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  const english = locale === "en";
  const page = english ? null : await getPage();
  const values = english ? ENGLISH_VALUES : page!.blocks;

  return <div className="marketing-shell">
    <Header />
    <main id="main-content" className={`${styles.resourcePage} ${styles.aboutPage}`}>
      <section className={styles.aboutHero} aria-labelledby="about-title">
        <div className={styles.aboutTitle}>
          <p className={styles.eyebrow}>{english ? "Our point of view" : "Notre point de vue"}</p>
          <h1 id="about-title">{english ? <>Interactivity serves <span>learning.</span></> : <>L’interactivité sert <span>l’apprentissage.</span></>}</h1>
          <p>{english ? "Brivia brings the moment in the room together with the work that continues after. A continuity designed around people, not features." : "Brivia rassemble le moment en salle et le travail qui continue après. Une continuité pensée pour les personnes avant les fonctionnalités."}</p>
        </div>
        <div className={styles.aboutPortraitShell}>
          <div className={styles.aboutPortrait}>
            <Image src="/images/brivia-learning-roundtable.jpg" alt={english ? "A group talks around a table during a learning workshop" : "Un groupe échange autour d’une table pendant un atelier pédagogique"} fill priority sizes="(max-width: 780px) 100vw, 38vw" />
          </div>
        </div>
      </section>

      <section className={styles.aboutThesis} aria-labelledby="mission-title">
        <div className={styles.aboutThesisInner}>
          <div><p className={styles.eyebrow}>{english ? "The founding principle" : "Le principe fondateur"}</p><h2 id="mission-title">{english ? "Follow the teaching reality." : "Suivre la réalité pédagogique."}</h2></div>
          <div className={styles.aboutThesisCopy}>
            <p>{english ? "A session can start with a poll, continue as a course and end with an exam. The tool should follow that movement instead of imposing its own logic." : "Une session peut commencer par un sondage, continuer par un cours et se terminer par un examen. L’outil doit suivre ce mouvement, sans imposer sa propre logique."}</p>
            {english ? <>
              <p>We believe learning and engagement should be dynamic, collaborative and enjoyable. That's why we built Brivia, an all-in-one platform that lets educators, trainers and hosts design interactive experiences people actually remember.</p>
              <p>Whether you're running a classroom quiz, a company poll, or flashcards for revision, Brivia gives you the tools to hold your audience's attention and measure the impact in real time.</p>
            </> : <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(page!.body) }} />}
          </div>
        </div>
      </section>

      <section className={styles.aboutValues} aria-labelledby="values-title">
        <div className={styles.aboutValuesHeader}>
          <div><p className={styles.eyebrow}>{english ? "The product in practice" : "Le produit en pratique"}</p><h2 id="values-title">{english ? "Visible choices, not slogans." : "Des choix visibles, pas des slogans."}</h2></div>
          <p>{english ? "Brivia. Live participation, learning and assessment in one interactive platform." : `${page!.title}. ${page!.subtitle}`}</p>
        </div>
        <div className={styles.aboutValueGrid}>
          {values.map((value, index) => <article className={styles.aboutValue} key={value.title}>
            <span>0{index + 1}</span><div><h3>{value.title}</h3><p>{value.desc}</p></div>
          </article>)}
        </div>
        <div className={styles.aboutClosing}>
          <p>{english ? "The best way to judge this vision is still to see the product run in front of a real audience." : "La meilleure façon de juger cette vision reste de voir le produit fonctionner avec un vrai public."}</p>
          <a className={styles.resourceAction} href={english ? "/en" : "/features"}><span>{english ? "Explore the product" : "Explorer le produit"}</span><i><ProductGlyph name="external" /></i></a>
        </div>
      </section>
    </main>
    <Footer />
  </div>;
}
