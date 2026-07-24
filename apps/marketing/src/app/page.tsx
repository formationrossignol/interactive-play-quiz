import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PartnersStrip } from "@/components/PartnersStrip";
import { IndexMain } from "@/components/IndexMain";
import { fetchReviews } from "@/lib/repo";
import { fetchPartners } from "@/lib/siteSettings";

// Mirrors the default (path: "/", no title/description override) case of
// apps/app/src/hooks/useSEO.ts + apps/app/src/lib/seo.ts's DEFAULT_TITLE/
// DEFAULT_DESCRIPTION.
export const metadata: Metadata = {
  title: "Brivia — Quiz et sondages interactifs en temps réel",
  description: "Créez des quiz multijoueurs, sondages live et présentations interactives. QR code, classement instantané et ambiance arcade — sans rien sacrifier en puissance.",
};

export default async function HomePage() {
  const [reviews, partners] = await Promise.all([fetchReviews(), fetchPartners()]);
  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div style={{ minHeight: "100vh" }}>
      <Header />
      <IndexMain reviews={reviews} avgRating={avgRating} />
      <PartnersStrip partners={partners} />
      <Footer />
    </div>
  );
}
