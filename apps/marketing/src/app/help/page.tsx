import type { Metadata } from "next";
import { ArrowRight, BookOpenCheck, CircleHelp, MessageCircleMore } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { fetchFaq } from "@/lib/repo";
import styles from "@/components/MarketingPage.module.css";

export const metadata: Metadata = {
  title: "Centre d’aide",
  description: "Aide pour créer, lancer et analyser vos quiz, sondages, examens, cours et présentations Brivia.",
};

export default async function HelpPage() {
  const faq = await fetchFaq();

  return (
    <div className="marketing-shell">
      <Header />
      <main id="main-content" className={styles.page}>
        <section className={`${styles.hero} ${styles.heroCompact}`} aria-labelledby="help-title">
          <div className={`${styles.container} ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <h1 id="help-title">Trouvez la réponse. <span>Reprenez votre session.</span></h1>
              <p className={styles.heroText}>
                Des réponses organisées selon ce que vous essayez de faire dans Brivia.
              </p>
            </div>
            <aside className={styles.heroAside}>
              <strong>Besoin d’un humain ?</strong>
              <p>Le formulaire de contact reste disponible si la réponse ne figure pas encore ici.</p>
              <div className={styles.actions}>
                <a className={styles.secondaryButton} href="/contact">Nous contacter</a>
              </div>
            </aside>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionTint}`} aria-labelledby="quick-start-title">
          <div className={styles.container}>
            <div className={styles.sectionLead}>
              <h2 id="quick-start-title">Commencer par le bon endroit.</h2>
              <p>Accédez directement au produit ou prenez quelques minutes pour préparer votre première animation.</p>
            </div>
            <div className={styles.twoColumn}>
              <article className={styles.panel}>
                <BookOpenCheck size={25} strokeWidth={1.7} aria-hidden="true" />
                <h3>Créer un premier contenu</h3>
                <p>Choisissez un quiz, un sondage, des flashcards, une présentation, un examen ou un cours.</p>
                <div className={styles.actions}>
                  <a className={styles.textLink} href="/builder-start">
                    Ouvrir le sélecteur
                    <ArrowRight size={17} aria-hidden="true" />
                  </a>
                </div>
              </article>
              <article className={styles.panel}>
                <MessageCircleMore size={25} strokeWidth={1.7} aria-hidden="true" />
                <h3>Préparer une animation</h3>
                <p>Retrouvez les guides de lancement, de gestion de salle et d’analyse des résultats.</p>
                <div className={styles.actions}>
                  <a className={styles.textLink} href="/guides">
                    Consulter les guides
                    <ArrowRight size={17} aria-hidden="true" />
                  </a>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="faq-title">
          <div className={`${styles.container} ${styles.faqGrid}`}>
            <h2 id="faq-title">Questions fréquentes.</h2>
            <div className={styles.faqGroups}>
              {faq.length > 0 ? (
                faq.map((group) => (
                  <section className={styles.faqGroup} key={group.category}>
                    <h3>{group.category}</h3>
                    {group.questions.map((item) => (
                      <details className={styles.faqItem} key={item.q}>
                        <summary>{item.q}</summary>
                        <p>{item.a}</p>
                      </details>
                    ))}
                  </section>
                ))
              ) : (
                <div className={styles.emptyState}>
                  <CircleHelp size={28} aria-hidden="true" />
                  <p>La base d’aide n’est pas disponible pour le moment.</p>
                  <a className={styles.textLink} href="/contact">Contacter l’équipe</a>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
