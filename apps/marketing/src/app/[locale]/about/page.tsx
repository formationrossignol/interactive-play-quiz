import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { fetchStaticPage } from "@/lib/repo";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { STATIC_PAGE_DEFAULTS, mergeStaticPage } from "@/lib/staticPageDefaults";
import { getLocalizedAlternates } from "@/lib/pageAlternates";
import styles from "@/components/ResourcePages.module.css";
import { ProductGlyph } from "@/components/ProductGlyph";

type Props = { params: Promise<{ locale: string }> };
type Value = { title: string; desc: string };

async function getPage() {
  const data = await fetchStaticPage("about");
  return mergeStaticPage(STATIC_PAGE_DEFAULTS.about, data);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AboutPage" });
  return {
    title: t("meta.title"),
    description: t("meta.description"),
    alternates: { canonical: getLocalizedAlternates("/about").languages[locale], ...getLocalizedAlternates("/about") },
  };
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  const english = locale === "en";
  const t = await getTranslations({ locale, namespace: "AboutPage" });

  // English content is a static translation snapshot, NOT sourced from the
  // CMS (fetchStaticPage("about") stays FR-only — no `locale` column on
  // `static_pages` today). Will drift from FR edits until a CMS
  // localization project ships.
  const page = english ? null : await getPage();
  const values = english ? (t.raw("values") as Value[]) : page!.blocks;

  return <div className="marketing-shell">
    <Header />
    <main id="main-content" className={`${styles.resourcePage} ${styles.aboutPage}`}>
      <section className={styles.aboutHero} aria-labelledby="about-title">
        <div className={styles.aboutTitle}>
          <p className={styles.eyebrow}>{t("eyebrow")}</p>
          <h1 id="about-title">{t("title")} <span>{t("accent")}</span></h1>
          <p>{t("intro")}</p>
        </div>
        <div className={styles.aboutPortraitShell}>
          <div className={styles.aboutPortrait}>
            <Image src="/images/brivia-learning-roundtable.jpg" alt={t("heroImageAlt")} fill priority sizes="(max-width: 780px) 100vw, 38vw" />
          </div>
        </div>
      </section>

      <section className={styles.aboutThesis} aria-labelledby="mission-title">
        <div className={styles.aboutThesisInner}>
          <div><p className={styles.eyebrow}>{t("missionEyebrow")}</p><h2 id="mission-title">{t("missionTitle")}</h2></div>
          <div className={styles.aboutThesisCopy}>
            <p>{t("missionIntro")}</p>
            {english ? <>
              <p>{t("missionExtra1")}</p>
              <p>{t("missionExtra2")}</p>
            </> : <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(page!.body) }} />}
          </div>
        </div>
      </section>

      <section className={styles.aboutValues} aria-labelledby="values-title">
        <div className={styles.aboutValuesHeader}>
          <div><p className={styles.eyebrow}>{t("valuesEyebrow")}</p><h2 id="values-title">{t("valuesTitle")}</h2></div>
          <p>{english ? t("valuesSummary") : `${page!.title}. ${page!.subtitle}`}</p>
        </div>
        <div className={styles.aboutValueGrid}>
          {values.map((value, index) => <article className={styles.aboutValue} key={value.title}>
            <span>0{index + 1}</span><div><h3>{value.title}</h3><p>{value.desc}</p></div>
          </article>)}
        </div>
        <div className={styles.aboutClosing}>
          <p>{t("closingText")}</p>
          <a className={styles.resourceAction} href={t("exploreHref")}><span>{t("exploreCta")}</span><i><ProductGlyph name="external" /></i></a>
        </div>
      </section>
    </main>
    <Footer />
  </div>;
}
