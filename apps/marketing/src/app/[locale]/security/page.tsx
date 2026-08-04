import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ProductGlyph } from "@/components/ProductGlyph";
import { getLocalizedAlternates } from "@/lib/pageAlternates";
import styles from "@/components/TrustPages.module.css";

type Props = { params: Promise<{ locale: string }> };

type Control = { area: string; title: string; text: string; status: string };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "SecurityPage" });
  return {
    title: t("meta.title"),
    description: t("meta.description"),
    alternates: { canonical: getLocalizedAlternates("/security").languages[locale], ...getLocalizedAlternates("/security") },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: getLocalizedAlternates("/security").languages[locale],
      locale: locale === "en" ? "en_US" : "fr_FR",
      alternateLocale: [locale === "en" ? "fr_FR" : "en_US"],
    },
  };
}

export default async function SecurityPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "SecurityPage" });
  const controls = t.raw("controls") as Control[];
  const limits = t.raw("limits") as string[];

  return (
    <div className="marketing-shell">
      <Header />
      <main id="main-content" className={styles.securityPage}>
        <section className={styles.securityHero} aria-labelledby="security-title">
          <div className={styles.securityHeroCopy}>
            <p className={styles.securityEyebrow}>{t("eyebrow")}</p>
            <h1 id="security-title">{t("title")}</h1>
            <p>{t("intro")}</p>
            <div className={styles.securityActions}>
              <Link href="#controls-title" data-marketing-cta="security_controls">{t("controlsCta")} <ProductGlyph name="arrow" /></Link>
              <Link href="/confidentialite">{t("privacyCta")}</Link>
            </div>
          </div>
          <div className={styles.trustSeal} aria-label={t("trustSealLabel")}>
            <div className={styles.trustSealCore}>
              <ProductGlyph name="security" />
              <strong>{t("trustSealLabel")}</strong>
              <span>{t("trustSealText")}</span>
            </div>
            <span className={styles.trustOrbitOne} aria-hidden="true" />
            <span className={styles.trustOrbitTwo} aria-hidden="true" />
          </div>
        </section>

        <section className={styles.controlSection} aria-labelledby="controls-title">
          <div className={styles.controlHeading}>
            <h2 id="controls-title">{t("controlsTitle")}</h2>
            <p>{t("controlsText")}</p>
          </div>
          <div className={styles.controlTable} role="list">
            {controls.map((control) => (
              <article key={control.title} role="listitem">
                <span>{control.area}</span>
                <div><h3>{control.title}</h3><p>{control.text}</p></div>
                <strong>{control.status}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.trustDocuments} aria-labelledby="documents-title">
          <div className={styles.documentIntro}>
            <h2 id="documents-title">{t("documentsTitle")}</h2>
            <p>{t("documentsText")}</p>
          </div>
          <div className={styles.documentLinks}>
            <Link href="/confidentialite">
              <span>{t("docPrivacy")}</span><strong>{t("docPrivacyTitle")}</strong><ProductGlyph name="external" />
            </Link>
            <Link href="/accessibility">
              <span>{t("docAccessibility")}</span><strong>{t("docAccessibilityTitle")}</strong><ProductGlyph name="external" />
            </Link>
            <Link href="/cgu">
              <span>{t("docTerms")}</span><strong>{t("docTermsTitle")}</strong><ProductGlyph name="external" />
            </Link>
          </div>
        </section>

        <section className={styles.limitSection} aria-labelledby="limits-title">
          <div>
            <h2 id="limits-title">{t("limitsTitle")}</h2>
            <p>{t("limitsText")}</p>
          </div>
          <ul>
            {limits.map((limit) => <li key={limit}><ProductGlyph name="partial" /><span>{limit}</span></li>)}
          </ul>
        </section>

        <section className={styles.securityClosing}>
          <div>
            <h2>{t("closingTitle")}</h2>
            <p>{t("closingText")}</p>
          </div>
          <Link href={locale === "en" ? "/en/contact?intent=security" : "/contact?intent=security"} data-marketing-cta="security_questionnaire">{t("closingCta")} <ProductGlyph name="arrow" /></Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
