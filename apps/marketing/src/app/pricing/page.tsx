import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PricingCards } from "@/components/PricingCards";
import styles from "@/components/MarketingPage.module.css";

export const metadata: Metadata = {
  title: "Tarifs",
  description: "Starter gratuit, Pro à 19 € par mois et offre Entreprise sur devis. Comparez les limites Brivia.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <div className="marketing-shell">
      <Header />
      <main id="main-content" className={styles.page}>
        <section className={`${styles.hero} ${styles.heroCompact}`} aria-labelledby="pricing-title">
          <div className={`${styles.container} ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <h1 id="pricing-title">Commencez gratuit. <span>Grandissez ensuite.</span></h1>
              <p className={styles.heroText}>
                Un plan gratuit durable, puis plus de capacité quand vos sessions grandissent.
              </p>
            </div>
            <aside className={styles.heroAside}>
              <strong>Pas de faux avantage annuel.</strong>
              <p>Pro est facturé 19 € par mois, sans engagement. Enterprise est cadré sur vos volumes, votre gouvernance et vos exigences d’intégration.</p>
              <div className={styles.actions}>
                <a className={styles.secondaryButton} href="/enterprise">Découvrir Enterprise</a>
              </div>
            </aside>
          </div>
        </section>

        <section className={styles.section}>
          <PricingCards />
        </section>
      </main>
      <Footer />
    </div>
  );
}
