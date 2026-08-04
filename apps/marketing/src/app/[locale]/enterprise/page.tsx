import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ProductGlyph, type ProductGlyphName } from "@/components/ProductGlyph";
import { getLocalizedAlternates } from "@/lib/pageAlternates";
import styles from "@/components/TrustPages.module.css";

type Props = { params: Promise<{ locale: string }> };

type Area = { label: string; title: string; detail: string; href: string; glyph: ProductGlyphName };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "EnterprisePage" });
  return {
    title: t("meta.title"),
    description: t("meta.description"),
    alternates: { canonical: getLocalizedAlternates("/enterprise").languages[locale], ...getLocalizedAlternates("/enterprise") },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: getLocalizedAlternates("/enterprise").languages[locale],
      locale: locale === "en" ? "en_US" : "fr_FR",
      alternateLocale: [locale === "en" ? "fr_FR" : "en_US"],
    },
  };
}

export default async function EnterprisePage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "EnterprisePage" });
  const areas = t.raw("areas") as Area[];
  const deployment = t.raw("deployment") as [string, string][];

  return (
    <div className="marketing-shell">
      <Header />
      <main id="main-content" className={styles.enterprisePage}>
        <section className={styles.enterpriseHero} aria-labelledby="enterprise-title">
          <div className={styles.enterpriseHeroCopy}>
            <p className={styles.enterpriseEyebrow}>{t("eyebrow")}</p>
            <h1 id="enterprise-title">{t("title")}</h1>
            <p>{t("intro")}</p>
            <div className={styles.enterpriseActions}>
              <Link className={styles.enterprisePrimary} href="#decision-title" data-marketing-cta="enterprise_criteria">
                {t("criteriaCta")} <ProductGlyph name="arrow" />
              </Link>
              <Link className={styles.enterpriseSecondary} href={locale === "en" ? "/en/security" : "/security"} data-marketing-cta="enterprise_trust">{t("trustCta")}</Link>
            </div>
          </div>
          <div className={styles.enterpriseHeroMedia}>
            <Image
              src="/images/brivia-platform-control.jpg"
              alt={t("heroImageAlt")}
              fill
              priority
              sizes="(max-width: 900px) 100vw, 50vw"
            />
            <div className={styles.enterpriseMediaCaption}>
              <span>{t("heroCaptionEyebrow")}</span>
              <strong>{t("heroCaptionText")}</strong>
            </div>
          </div>
        </section>

        <section className={styles.decisionSection} aria-labelledby="decision-title">
          <div className={styles.decisionHeading}>
            <h2 id="decision-title">{t("decisionTitle")}</h2>
            <p>{t("decisionText")}</p>
          </div>
          <div className={styles.decisionGrid}>
            {areas.map((area) => (
              <Link href={area.href} key={area.label} className={styles.decisionArea}>
                <div className={styles.decisionAreaTop}>
                  <span>{area.label}</span>
                  <ProductGlyph name={area.glyph} />
                </div>
                <h3>{area.title}</h3>
                <p>{area.detail}</p>
                <b>{t("explore")} <ProductGlyph name="arrow" /></b>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.enterpriseProof} aria-labelledby="enterprise-proof-title">
          <div className={styles.enterpriseProofIntro}>
            <h2 id="enterprise-proof-title">{t("proofTitle")}</h2>
            <p>{t("proofText")}</p>
          </div>
          <div className={styles.enterpriseProofList}>
            <article>
              <span>01</span>
              <div><strong>{t("proofAccess")}</strong><p>{t("proofAccessText")}</p></div>
              <b>{t("proofAccessStatus")}</b>
            </article>
            <article>
              <span>02</span>
              <div><strong>{t("proofData")}</strong><p>{t("proofDataText")}</p></div>
              <b>{t("proofDataStatus")}</b>
            </article>
            <article>
              <span>03</span>
              <div><strong>{t("proofSso")}</strong><p>{t("proofSsoText")}</p></div>
              <b className={styles.proofContract}>{t("proofSsoStatus")}</b>
            </article>
          </div>
        </section>

        <section className={styles.deploymentSection} aria-labelledby="deployment-title">
          <div className={styles.deploymentTitle}>
            <h2 id="deployment-title">{t("deploymentTitle")}</h2>
          </div>
          <div className={styles.deploymentFlow}>
            {deployment.map(([title, text]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.enterpriseClosing}>
          <div>
            <ProductGlyph name="controls" />
            <h2>{t("closingTitle")}</h2>
            <p>{t("closingText")}</p>
          </div>
          <Link href={locale === "en" ? "/en/contact?intent=enterprise" : "/contact?intent=enterprise"} data-marketing-cta="enterprise_demo">{t("closingCta")} <ProductGlyph name="arrow" /></Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
