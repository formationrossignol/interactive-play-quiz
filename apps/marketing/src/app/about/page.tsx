import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, Focus, Heart, Layers3, UsersRound } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { fetchStaticPage } from "@/lib/repo";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { STATIC_PAGE_DEFAULTS, mergeStaticPage } from "@/lib/staticPageDefaults";
import styles from "@/components/MarketingPage.module.css";

const VALUE_ICONS = [Focus, UsersRound, Layers3, Heart] as const;

async function getPage() {
  const data = await fetchStaticPage("about");
  return mergeStaticPage(STATIC_PAGE_DEFAULTS.about, data);
}

export const metadata: Metadata = {
  title: "À propos",
  description: "Découvrez pourquoi Brivia réunit animation, apprentissage et évaluation dans un même outil.",
};

export default async function AboutPage() {
  const page = await getPage();

  return (
    <div className="marketing-shell">
      <Header />
      <main id="main-content" className={styles.page}>
        <section className={`${styles.hero} ${styles.heroCompact}`} aria-labelledby="about-title">
          <div className={`${styles.container} ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <h1 id="about-title">L’interactivité sert <span>l’apprentissage.</span></h1>
              <p className={styles.heroText}>
                Brivia rassemble le moment en salle et le travail qui continue après.
              </p>
            </div>
            <aside className={styles.heroAside}>
              <strong>{page.title}</strong>
              <p>{page.subtitle}</p>
            </aside>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionTint}`} aria-labelledby="mission-title">
          <div className={`${styles.container} ${styles.proofGrid}`}>
            <div className={styles.proofMedia}>
              <Image
                src="/images/brivia-group-energy.jpg"
                alt="Un groupe échange autour des résultats d’une activité Brivia"
                fill
                sizes="(max-width: 900px) 100vw, 55vw"
              />
            </div>
            <div>
              <div className={styles.sectionLead}>
                <h2 id="mission-title">Un outil qui suit la réalité pédagogique.</h2>
                <p>Une session peut commencer par un sondage, continuer par un cours et se terminer par un examen. L’outil doit suivre ce mouvement.</p>
              </div>
              <div
                className={styles.legalCopy}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.body) }}
              />
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="values-title">
          <div className={styles.container}>
            <div className={styles.sectionLead}>
              <h2 id="values-title">Les choix qui guident le produit.</h2>
              <p>Moins de friction pour participer, plus de contrôle pour concevoir et analyser.</p>
            </div>
            <div className={styles.valueGrid}>
              {page.blocks.map((value, index) => {
                const Icon = VALUE_ICONS[index % VALUE_ICONS.length];
                return (
                  <article className={styles.value} key={value.title}>
                    <Icon size={25} strokeWidth={1.7} aria-hidden="true" />
                    <h3>{value.title}</h3>
                    <p>{value.desc}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={`${styles.container} ${styles.cta}`}>
            <div>
              <h2>Voyez le produit, pas seulement la promesse.</h2>
              <p>Explorez les formats, les parcours, les outils d’évaluation et les exports déjà disponibles.</p>
            </div>
            <a className={styles.primaryButton} href="/features">
              Voir les fonctionnalités
              <ArrowRight size={18} aria-hidden="true" />
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
