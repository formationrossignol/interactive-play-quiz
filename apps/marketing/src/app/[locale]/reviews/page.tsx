import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ReviewsView } from "@/components/ReviewsView";
import { fetchReviews } from "@/lib/repo";
import styles from "@/components/ResourcePages.module.css";

export const metadata: Metadata = {
  title: "Témoignages",
  description: "Avis publiés de formateurs, enseignants et responsables formation qui utilisent Brivia.",
  alternates: { canonical: "/reviews" },
};

export function generateStaticParams() {
  return [{ locale: "fr" }];
}

type Props = { params: Promise<{ locale: string }> };

export default async function ReviewsPage({ params }: Props) {
  const { locale } = await params;
  if (locale !== "fr") notFound();

  const reviews = await fetchReviews();
  const average = reviews.length > 0
    ? (reviews.reduce((total, review) => total + review.stars, 0) / reviews.length).toFixed(1).replace(".", ",")
    : "—";
  const contexts = new Set(reviews.map((review) => review.p)).size;
  const reviewSchema = reviews.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Brivia",
    applicationCategory: "EducationalApplication",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: Number(average.replace(",", ".")),
      reviewCount: reviews.length,
      bestRating: 5,
      worstRating: 1,
    },
  } : null;

  return <div className="marketing-shell">
    <Header />
    <main id="main-content" className={`${styles.resourcePage} ${styles.reviewsPage}`}>
      {reviewSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewSchema).replace(/</g, "\\u003c") }} />}
      <section className={styles.reviewsHero} aria-labelledby="reviews-title">
        <p className={styles.eyebrow}>Paroles publiées</p>
        <h1 id="reviews-title">La preuve commence par des <span>voix vérifiables.</span></h1>
        <div className={styles.reviewsDeck}>
          <p>Des retours de terrain publiés après modération. Aucun nom décoratif, aucune note extrapolée, aucun logo insinué.</p>
          <div className={styles.reviewsPolicy}><strong>Une politique simple</strong><span>La connexion vérifie l’origine. La modération protège la qualité. La publication reste fidèle au témoignage.</span></div>
        </div>
      </section>

      <section className={styles.reviewMetrics} aria-label="Repères des avis publiés">
        <div className={styles.reviewMetric}><strong>{reviews.length}</strong><span>{reviews.length > 1 ? "avis publiés" : "avis publié"}</span></div>
        <div className={styles.reviewMetric}><strong>{average}</strong><span>{reviews.length > 0 ? "note moyenne sur 5" : "aucune moyenne sans avis"}</span></div>
        <div className={styles.reviewMetric}><strong>{contexts || "—"}</strong><span>{contexts > 0 ? "contextes représentés" : "contextes à documenter"}</span></div>
      </section>

      <div className={styles.reviewExperience}><ReviewsView reviews={reviews} /></div>
    </main>
    <Footer />
  </div>;
}
