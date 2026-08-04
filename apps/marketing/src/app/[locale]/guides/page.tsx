import type { Metadata } from "next";
import { notFound } from "next/navigation";
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

export function generateStaticParams() {
  return [{ locale: "fr" }];
}

type Props = { params: Promise<{ locale: string }> };

export default async function GuidesPage({ params }: Props) {
  const { locale } = await params;
  if (locale !== "fr") notFound();

  const guides = await fetchGuides();
  const videos = guides.filter((guide) => guide.fmt === "video").length;
  const guideSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Guides Brivia",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Comment créer un quiz interactif utile",
        url: `${SITE_URL}/guides/quiz-interactif`,
      },
      ...guides.map((guide, index) => ({
        "@type": "ListItem",
        position: index + 2,
        name: guide.title,
        url: guide.url ? new URL(guide.url, SITE_URL).toString() : `${SITE_URL}/guides`,
      })),
    ],
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
              <div><strong>{guides.length + 1}</strong><span>guides publiés</span></div>
              <div><strong>{videos}</strong><span>formats vidéo</span></div>
            </div>
            <a className={styles.resourceAction} href="/builder-start"><span>Créer un contenu</span><i><ProductGlyph name="external" /></i></a>
          </div>
        </div>
      </section>

      <section className={styles.ownerGuide} aria-labelledby="owner-guide-title">
        <div>
          <span>Méthode Brivia</span>
          <h2 id="owner-guide-title">Comment créer un quiz interactif utile.</h2>
          <p>Objectif, formats, rythme, test et analyse. Un guide complet pour produire autre chose qu’un simple classement.</p>
          <a href="/guides/quiz-interactif">Lire le guide <ProductGlyph name="arrow" /></a>
        </div>
        <ol aria-label="Contenu du guide">
          <li><span>Objectif</span><strong>Décider avant d’écrire</strong></li>
          <li><span>Conception</span><strong>Choisir le bon geste</strong></li>
          <li><span>Analyse</span><strong>Transformer le résultat</strong></li>
        </ol>
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
