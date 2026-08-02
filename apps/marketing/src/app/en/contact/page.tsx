import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ProductGlyph } from "@/components/ProductGlyph";
import styles from "@/components/ConversionPages.module.css";

export const metadata: Metadata = {
  title: "Contact the Brivia team",
  description: "Tell the Brivia team about your audience, project, deployment requirements or security review.",
  alternates: {
    canonical: "/en/contact",
    languages: { fr: "/contact", en: "/en/contact", "x-default": "/contact" },
  },
  openGraph: {
    title: "Contact the Brivia team",
    description: "Tell us about your audience, project, deployment requirements or security review.",
    url: "/en/contact",
    locale: "en_US",
    alternateLocale: ["fr_FR"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact the Brivia team",
    description: "Tell us about your audience, project, deployment requirements or security review.",
    images: ["/opengraph-image"],
  },
};

export default function EnglishContactPage() {
  return (
    <div className="marketing-shell" lang="en">
      <Header />
      <main id="main-content" className={styles.conversionPage}>
        <section className={styles.contactStage} aria-labelledby="contact-title">
          <div className={styles.contactStageInner}>
            <div className={styles.contactCopy}>
              <p className={styles.eyebrow}>A useful conversation from the start</p>
              <h1 id="contact-title">Start with the real context.</h1>
              <p>Your audience, workflow and constraints give us what we need to answer precisely.</p>
              <div className={styles.contactSignals} aria-label="Other ways to contact Brivia">
                <a className={styles.contactSignal} href="mailto:contact@brivia.app">
                  <span><span>Write directly</span><strong>contact@brivia.app</strong></span>
                  <i className={styles.arrowMark}><ProductGlyph name="external" /></i>
                </a>
                <a className={styles.contactSignal} href="/en/security">
                  <span><span>Review current controls</span><strong>Brivia Trust Center</strong></span>
                  <i className={styles.arrowMark}><ProductGlyph name="external" /></i>
                </a>
              </div>
            </div>
            <div className={styles.formBezel}>
              <div className={styles.formSurface}>
                <div className={styles.formHeader}>
                  <div>
                    <p className={styles.eyebrow}>Your project</p>
                    <h2>A few details. A better answer.</h2>
                    <p className={styles.privacyNote}>Your request is transmitted securely.</p>
                  </div>
                  <span className={styles.formIndex}>01 / 06</span>
                </div>
                <ContactForm language="en" />
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
