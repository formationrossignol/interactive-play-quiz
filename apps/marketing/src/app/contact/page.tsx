import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ContactForm } from "@/components/ContactForm";
import { ProductGlyph } from "@/components/ProductGlyph";
import styles from "@/components/ConversionPages.module.css";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contactez l’équipe Brivia pour parler du produit, du support ou d’un déploiement dans votre organisation.",
  alternates: { canonical: "/contact", languages: { fr: "/contact", en: "/en/contact", "x-default": "/contact" } },
  openGraph: {
    title: "Contacter l’équipe Brivia",
    description: "Présentez votre projet, votre public et vos contraintes à l’équipe Brivia.",
    url: "/contact",
    locale: "fr_FR",
    alternateLocale: ["en_US"],
  },
};

export default function ContactPage() {
  return (
    <div className="marketing-shell">
      <Header />
      <main id="main-content" className={styles.conversionPage}>
        <section className={styles.contactStage} aria-labelledby="contact-title">
          <div className={styles.contactStageInner}>
            <div className={styles.contactCopy}>
              <p className={styles.eyebrow}>Un échange utile, dès le départ</p>
              <h1 id="contact-title">Parlons du vrai sujet.</h1>
              <p>Votre public, votre contexte, vos contraintes. Donnez-nous la matière nécessaire pour vous répondre avec précision.</p>

              <div className={styles.contactSignals} aria-label="Autres moyens de nous contacter">
                <a className={styles.contactSignal} href="mailto:contact@brivia.app">
                  <span><span>Écrire directement</span><strong>contact@brivia.app</strong></span>
                  <i className={styles.arrowMark}><ProductGlyph name="external" /></i>
                </a>
                <a className={styles.contactSignal} href="/help">
                  <span><span>Trouver une réponse maintenant</span><strong>Centre d’aide Brivia</strong></span>
                  <i className={styles.arrowMark}><ProductGlyph name="external" /></i>
                </a>
              </div>
            </div>

            <div className={styles.formBezel}>
              <div className={styles.formSurface}>
                <div className={styles.formHeader}>
                  <div>
                    <p className={styles.eyebrow}>Votre projet</p>
                    <h2>Quelques détails. Une réponse mieux cadrée.</h2>
                    <p className={styles.privacyNote}>Votre demande est transmise de façon sécurisée.</p>
                  </div>
                  <span className={styles.formIndex}>01 — 06</span>
                </div>
                <ContactForm />
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
