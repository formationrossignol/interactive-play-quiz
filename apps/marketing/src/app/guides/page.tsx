import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { GuidesGrid } from "@/components/GuidesGrid";
import { fetchGuides } from "@/lib/repo";
import { SITE_URL } from "@/lib/siteUrl";
import { ProductGlyph } from "@/components/ProductGlyph";
import styles from "@/components/ResourcePages.module.css";

export const metadata: Metadata = {
  title: "Guides et tutoriels",
  description: "Guides pratiques pour créer, lancer et analyser les contenus Brivia.",
  alternates: { canonical: "/guides" },
};

export default async function GuidesPage() {
  const guides = await fetchGuides();
  const videos = guides.filter((guide) => guide.fmt === "video").length;
  const guideSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Guides Brivia",
    itemListElement: guides.map((guide, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: guide.title,
      url: guide.url ? new URL(guide.url, SITE_URL).toString() : `${SITE_URL}/guides`,
    })),
  };

  return <div className="marketing-shell">
    <Header />
    <main id="main-content" className={`${styles.resourcePage} ${styles.guidesPage}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(guideSchema).replace(/</g, "\\u003c") }} />
      <section className={styles.guidesHero} aria-labelledby="guides-title">
        <div className={styles.guidesHeroInner}>
          <div>
            <p className={styles.eyebrow}>Bibliothèque pratique</p>
            <h1 id="guides-title">Préparez mieux. <span>Animez sereinement.</span></h1>
          </div>
          <div className={styles.guidesBrief}>
            <p>Des ressources courtes, organisées autour du prochain geste à accomplir — de la première question au débrief.</p>
            <div className={styles.guidesMeta}>
              <div><strong>{guides.length}</strong><span>guides publiés</span></div>
              <div><strong>{videos}</strong><span>formats vidéo</span></div>
            </div>
            <a className={styles.resourceAction} href="/builder-start"><span>Créer un contenu</span><i><ProductGlyph name="external" /></i></a>
          </div>
        </div>
      </section>

      <section className={styles.guidesIndex} aria-labelledby="guide-list-title">
        <div className={styles.guidesIndexHeader}>
          <div><span>Index / Ressources</span><h2 id="guide-list-title">Choisissez votre prochain geste.</h2></div>
          <p>Filtrez par niveau ou par format. Chaque ressource annonce sa durée avant de commencer.</p>
        </div>
        <GuidesGrid guides={guides} />
      </section>
    </main>
    <Footer />
  </div>;
}
