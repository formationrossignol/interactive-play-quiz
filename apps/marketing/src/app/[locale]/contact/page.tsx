import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ContactForm } from "@/components/ContactForm";
import { ProductGlyph } from "@/components/ProductGlyph";
import styles from "@/components/ConversionPages.module.css";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  if (locale === "en") {
    return {
      title: "Contact the Brivia team",
      description: "Tell the Brivia team about your audience, project, deployment requirements or security review.",
      alternates: { canonical: "/en/contact", languages: { fr: "/contact", en: "/en/contact", "x-default": "/contact" } },
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
  }

  return {
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
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  const english = locale === "en";

  return (
    <div className="marketing-shell">
      <Header />
      <main id="main-content" className={styles.conversionPage}>
        <section className={styles.contactStage} aria-labelledby="contact-title">
          <div className={styles.contactStageInner}>
            <div className={styles.contactCopy}>
              <p className={styles.eyebrow}>{english ? "A useful conversation from the start" : "Un échange utile, dès le départ"}</p>
              <h1 id="contact-title">{english ? "Start with the real context." : "Parlons du vrai sujet."}</h1>
              <p>{english ? "Your audience, workflow and constraints give us what we need to answer precisely." : "Votre public, votre contexte, vos contraintes. Donnez-nous la matière nécessaire pour vous répondre avec précision."}</p>

              <div className={styles.contactSignals} aria-label={english ? "Other ways to contact Brivia" : "Autres moyens de nous contacter"}>
                <a className={styles.contactSignal} href="mailto:contact@brivia.app">
                  <span><span>{english ? "Write directly" : "Écrire directement"}</span><strong>contact@brivia.app</strong></span>
                  <i className={styles.arrowMark}><ProductGlyph name="external" /></i>
                </a>
                <a className={styles.contactSignal} href={english ? "/en/security" : "/help"}>
                  <span><span>{english ? "Review current controls" : "Trouver une réponse maintenant"}</span><strong>{english ? "Brivia Trust Center" : "Centre d’aide Brivia"}</strong></span>
                  <i className={styles.arrowMark}><ProductGlyph name="external" /></i>
                </a>
              </div>
            </div>

            <div className={styles.formBezel}>
              <div className={styles.formSurface}>
                <div className={styles.formHeader}>
                  <div>
                    <p className={styles.eyebrow}>{english ? "Your project" : "Votre projet"}</p>
                    <h2>{english ? "A few details. A better answer." : "Quelques détails. Une réponse mieux cadrée."}</h2>
                    <p className={styles.privacyNote}>{english ? "Your request is transmitted securely." : "Votre demande est transmise de façon sécurisée."}</p>
                  </div>
                  <span className={styles.formIndex}>{english ? "01 / 06" : "01 — 06"}</span>
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
