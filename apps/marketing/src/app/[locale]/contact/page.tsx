import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ContactForm } from "@/components/ContactForm";
import { ProductGlyph } from "@/components/ProductGlyph";
import { getLocalizedAlternates } from "@/lib/pageAlternates";
import styles from "@/components/ConversionPages.module.css";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ContactPage" });
  return {
    title: t("meta.title"),
    description: t("meta.description"),
    alternates: { canonical: getLocalizedAlternates("/contact").languages[locale], ...getLocalizedAlternates("/contact") },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: getLocalizedAlternates("/contact").languages[locale],
      locale: locale === "en" ? "en_US" : "fr_FR",
      alternateLocale: [locale === "en" ? "fr_FR" : "en_US"],
    },
  };
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ContactPage" });
  const english = locale === "en";

  return (
    <div className="marketing-shell">
      <Header />
      <main id="main-content" className={styles.conversionPage}>
        <section className={styles.contactStage} aria-labelledby="contact-title">
          <div className={styles.contactStageInner}>
            <div className={styles.contactCopy}>
              <p className={styles.eyebrow}>{t("eyebrow")}</p>
              <h1 id="contact-title">{t("title")}</h1>
              <p>{t("intro")}</p>

              <div className={styles.contactSignals} aria-label={t("signalsLabel")}>
                <a className={styles.contactSignal} href="mailto:contact@brivia.app">
                  <span><span>{t("writeLabel")}</span><strong>contact@brivia.app</strong></span>
                  <i className={styles.arrowMark}><ProductGlyph name="external" /></i>
                </a>
                <a className={styles.contactSignal} href={t("helpHref")}>
                  <span><span>{t("helpLabel")}</span><strong>{t("helpTitle")}</strong></span>
                  <i className={styles.arrowMark}><ProductGlyph name="external" /></i>
                </a>
              </div>
            </div>

            <div className={styles.formBezel}>
              <div className={styles.formSurface}>
                <div className={styles.formHeader}>
                  <div>
                    <p className={styles.eyebrow}>{t("formEyebrow")}</p>
                    <h2>{t("formTitle")}</h2>
                    <p className={styles.privacyNote}>{t("privacyNote")}</p>
                  </div>
                  <span className={styles.formIndex}>{t("formIndex")}</span>
                </div>
                <ContactForm language={english ? "en" : "fr"} />
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
