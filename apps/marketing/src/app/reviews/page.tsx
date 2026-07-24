import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ReviewsView } from "@/components/ReviewsView";
import { fetchReviews } from "@/lib/repo";
import "@/styles/reviews.css";

export const metadata: Metadata = {
  title: "Témoignages",
  description: "Avis vérifiés de formateurs, enseignants et responsables formation qui animent avec Brivia. Note moyenne 4,8/5 sur 312 avis.",
};

export default async function ReviewsPage() {
  const reviews = await fetchReviews();

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Header />
      <main className="lq" style={{ flex: 1 }}>
        <div className="wrap">
          <ReviewsView reviews={reviews} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
