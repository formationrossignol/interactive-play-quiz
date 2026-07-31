import type { Metadata } from "next";
import { ArrowRight, CircleHelp, Mail } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ContactForm } from "@/components/ContactForm";
import styles from "@/components/MarketingPage.module.css";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contactez l’équipe Brivia pour parler du produit, du support ou d’un déploiement dans votre organisation.",
};

export default function ContactPage() {
  return (
    <div className="marketing-shell">
      <Header />
      <main id="main-content" className={styles.page}>
        <section className={`${styles.hero} ${styles.heroCompact}`} aria-labelledby="contact-title">
          <div className={`${styles.container} ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <h1 id="contact-title">Parlons de votre <span>prochaine session.</span></h1>
              <p className={styles.heroText}>
                Support, déploiement ou retour produit : envoyez-nous le contexte et votre objectif.
              </p>
            </div>
            <aside className={styles.heroAside}>
              <strong>Une réponse peut déjà exister.</strong>
              <p>Le centre d’aide couvre la création, le live, les examens, les cours et les résultats.</p>
              <div className={styles.actions}>
                <a className={styles.secondaryButton} href="/help">Consulter l’aide</a>
              </div>
            </aside>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionTint}`}>
          <div className={`${styles.container} ${styles.contactGrid}`}>
            <aside className={styles.contactAside}>
              <article className={styles.panel}>
                <Mail size={24} strokeWidth={1.7} aria-hidden="true" />
                <h3>Email</h3>
                <p>Pour une demande directe ou l’envoi d’un document.</p>
                <div className={styles.actions}>
                  <a href="mailto:contact@quizmaster.app">contact@quizmaster.app</a>
                </div>
              </article>
              <article className={styles.panel}>
                <CircleHelp size={24} strokeWidth={1.7} aria-hidden="true" />
                <h3>Besoin de support</h3>
                <p>Décrivez le format utilisé, le moment du problème et ce que vous attendiez.</p>
                <div className={styles.actions}>
                  <a className={styles.textLink} href="/help">
                    Voir les réponses
                    <ArrowRight size={17} aria-hidden="true" />
                  </a>
                </div>
              </article>
            </aside>

            <div className={styles.formPanel}>
              <div className={styles.sectionLead}>
                <h2>Envoyez votre message.</h2>
                <p>Les détails concrets nous aident à vous répondre plus vite.</p>
              </div>
              <ContactForm />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
