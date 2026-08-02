import type { Metadata } from "next";
import Image from "next/image";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { fetchStaticPage } from "@/lib/repo";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { STATIC_PAGE_DEFAULTS, mergeStaticPage } from "@/lib/staticPageDefaults";
import styles from "@/components/ResourcePages.module.css";

async function getPage() {
  const data = await fetchStaticPage("about");
  return mergeStaticPage(STATIC_PAGE_DEFAULTS.about, data);
}

export const metadata: Metadata = {
  title: "À propos",
  description: "Découvrez pourquoi Brivia réunit animation, apprentissage et évaluation dans un même outil.",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const page = await getPage();

  return <div className="marketing-shell">
    <Header />
    <main id="main-content" className={`${styles.resourcePage} ${styles.aboutPage}`}>
      <section className={styles.aboutHero} aria-labelledby="about-title">
        <div className={styles.aboutTitle}>
          <p className={styles.eyebrow}>Notre point de vue</p>
          <h1 id="about-title">L’interactivité sert <span>l’apprentissage.</span></h1>
          <p>Brivia rassemble le moment en salle et le travail qui continue après. Une continuité pensée pour les personnes avant les fonctionnalités.</p>
        </div>
        <div className={styles.aboutPortraitShell}>
          <div className={styles.aboutPortrait}>
            <Image src="/images/brivia-learning-roundtable.jpg" alt="Un groupe échange autour d’une table pendant un atelier pédagogique" fill priority sizes="(max-width: 780px) 100vw, 38vw" />
          </div>
        </div>
      </section>

      <section className={styles.aboutThesis} aria-labelledby="mission-title">
        <div className={styles.aboutThesisInner}>
          <div><p className={styles.eyebrow}>Le principe fondateur</p><h2 id="mission-title">Suivre la réalité pédagogique.</h2></div>
          <div className={styles.aboutThesisCopy}>
            <p>Une session peut commencer par un sondage, continuer par un cours et se terminer par un examen. L’outil doit suivre ce mouvement, sans imposer sa propre logique.</p>
            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.body) }} />
          </div>
        </div>
      </section>

      <section className={styles.aboutValues} aria-labelledby="values-title">
        <div className={styles.aboutValuesHeader}>
          <div><p className={styles.eyebrow}>Le produit en pratique</p><h2 id="values-title">Des choix visibles, pas des slogans.</h2></div>
          <p>{page.title}. {page.subtitle}</p>
        </div>
        <div className={styles.aboutValueGrid}>
          {page.blocks.map((value, index) => <article className={styles.aboutValue} key={value.title}>
            <span>0{index + 1}</span><div><h3>{value.title}</h3><p>{value.desc}</p></div>
          </article>)}
        </div>
        <div className={styles.aboutClosing}>
          <p>La meilleure façon de juger cette vision reste de voir le produit fonctionner avec un vrai public.</p>
          <a className={styles.resourceAction} href="/features"><span>Explorer le produit</span><i aria-hidden="true">↗</i></a>
        </div>
      </section>
    </main>
    <Footer />
  </div>;
}
