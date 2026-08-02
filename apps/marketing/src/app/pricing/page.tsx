import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PricingCards } from "@/components/PricingCards";
import styles from "@/components/ConversionPages.module.css";

export const metadata: Metadata = {
  title: "Tarifs",
  description: "Starter gratuit, Pro à 19 € par mois et offre Entreprise sur devis. Comparez les limites Brivia.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <div className="marketing-shell">
      <Header />
      <main id="main-content" className={styles.conversionPage}>
        <section className={styles.pricingHero} aria-labelledby="pricing-title">
          <div className={styles.pricingHeroInner}>
            <div className={styles.pricingCopy}>
              <p className={styles.eyebrow}>Simple par conception</p>
              <h1 id="pricing-title">Votre ambition, <span>au bon niveau.</span></h1>
              <p>Commencez librement. Passez à l’échelle quand l’usage le demande — sans engagement annuel dissimulé ni architecture tarifaire illisible.</p>
            </div>
            <aside className={styles.pricingLens} aria-label="Vue d’ensemble des offres">
              <span>Une trajectoire, trois niveaux</span>
              <div className={styles.pricingScale}>
                <div><small>01</small><strong>Starter</strong><b>0 €</b></div>
                <div><small>02</small><strong>Pro</strong><b>19 € / mois</b></div>
                <div><small>03</small><strong>Entreprise</strong><b>Sur devis</b></div>
              </div>
              <p className={styles.pricingNote}>Vous gardez le contrôle à chaque étape.</p>
            </aside>
          </div>
        </section>

        <section className={styles.pricingBody} aria-labelledby="pricing-offers-title">
          <div className={styles.pricingBodyIntro}>
            <span>Choisir son niveau</span>
            <h2 id="pricing-offers-title">Le même produit. Plus de portée lorsque vous en avez besoin.</h2>
          </div>
          <PricingCards />
        </section>
      </main>
      <Footer />
    </div>
  );
}
