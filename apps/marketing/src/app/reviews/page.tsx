import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ReviewsView } from "@/components/ReviewsView";
import { fetchReviews } from "@/lib/repo";
import styles from "@/components/MarketingPage.module.css";

export const metadata: Metadata = {
  title: "Témoignages",
  description: "Avis publiés de formateurs, enseignants et responsables formation qui utilisent Brivia.",
};

export default async function ReviewsPage() {
  const reviews = await fetchReviews();

  return (
    <div className="marketing-shell">
      <Header />
      <main id="main-content" className={styles.page}>
        <section className={`${styles.hero} ${styles.heroCompact}`} aria-labelledby="reviews-title">
          <div className={`${styles.container} ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <h1 id="reviews-title">Ils animent avec <span>Brivia.</span></h1>
              <p className={styles.heroText}>
                Des retours de terrain publiés après modération.
              </p>
              <div className={styles.actions}>
                <a className={styles.primaryButton} href="/builder-start?type=quiz">
                  Créer gratuitement
                  <ArrowRight size={18} aria-hidden="true" />
                </a>
              </div>
            </div>
            <div className={styles.heroMedia}>
              <Image
                src="/images/brivia-reaction-celebration.jpg"
                alt="Trois participants célèbrent spontanément le résultat d’une activité"
                fill
                priority
                sizes="(max-width: 900px) 100vw, 46vw"
              />
            </div>
          </div>
        </section>

        <ReviewsView reviews={reviews} />
      </main>
      <Footer />
    </div>
  );
}
