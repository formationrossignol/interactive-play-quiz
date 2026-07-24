import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PricingCards } from "@/components/PricingCards";

export const metadata: Metadata = {
  title: "Tarifs",
  description: "Offre gratuite jusqu'à 20 participants, plan Pro à 19 €/mois jusqu'à 200 participants, et formule Entreprise sur devis. Choisissez la formule Brivia adaptée à votre équipe.",
};

export default function PricingPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Header />
      <main style={{ flex: 1 }}>
        <section style={{ maxWidth: 640, margin: "0 auto", padding: "72px 24px 56px", textAlign: "center" }}>
          <h1 className="ap-h1" style={{ fontSize: "clamp(36px,5vw,56px)", marginBottom: "16px" }}>
            Des offres adaptées à chaque équipe
          </h1>
          <p className="ap-lead" style={{ maxWidth: 500, margin: "0 auto" }}>
            Choisissez la formule idéale pour animer des sessions engageantes, du stand-up rapide au grand événement.
          </p>
        </section>

        <PricingCards />
      </main>
      <Footer />
    </div>
  );
}
