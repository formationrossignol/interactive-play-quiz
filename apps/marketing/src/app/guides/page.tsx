import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { GuidesGrid } from "@/components/GuidesGrid";
import { fetchGuides } from "@/lib/repo";
import styles from "@/components/MarketingPage.module.css";

export const metadata: Metadata = {
  title: "Guides et tutoriels",
  description: "Guides pratiques pour créer, lancer et analyser les contenus Brivia.",
};

export default async function GuidesPage() {
  const guides = await fetchGuides();

  return (
    <div className="marketing-shell">
      <Header />
      <main id="main-content" className={styles.page}>
        <section className={`${styles.hero} ${styles.heroCompact}`} aria-labelledby="guides-title">
          <div className={`${styles.container} ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <h1 id="guides-title">Préparez mieux. <span>Animez sereinement.</span></h1>
              <p className={styles.heroText}>
                Des ressources courtes pour passer de l’idée au débrief.
              </p>
              <div className={styles.actions}>
                <a className={styles.primaryButton} href="/builder-start">
                  Créer un contenu
                  <ArrowRight size={17} aria-hidden="true" />
                </a>
              </div>
            </div>
            <div className={styles.heroMedia}>
              <Image
                src="/images/brivia-quiz-authoring.jpg"
                alt="Un formateur prépare le déroulé de sa prochaine session"
                fill
                priority
                sizes="(max-width: 900px) 100vw, 46vw"
              />
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionTint}`} aria-labelledby="guide-list-title">
          <div className={styles.container}>
            <div className={styles.sectionLead}>
              <h2 id="guide-list-title">Choisissez votre prochain geste.</h2>
              <p>Filtrez selon votre niveau ou le format que vous préférez consulter.</p>
            </div>
            <GuidesGrid guides={guides} />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
