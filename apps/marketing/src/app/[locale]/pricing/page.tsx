import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PricingCards } from "@/components/PricingCards";
import styles from "@/components/ConversionPages.module.css";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  if (locale === "en") {
    return {
      title: "Pricing",
      description: "Free Starter, Pro at €19/month and a custom Enterprise plan. Compare Brivia's limits.",
      alternates: { canonical: "/en/pricing", languages: { fr: "/pricing", en: "/en/pricing", "x-default": "/pricing" } },
    };
  }

  return {
    title: "Tarifs",
    description: "Starter gratuit, Pro à 19 € par mois et offre Entreprise sur devis. Comparez les limites Brivia.",
    alternates: { canonical: "/pricing", languages: { fr: "/pricing", en: "/en/pricing", "x-default": "/pricing" } },
  };
}

export default async function PricingPage({ params }: Props) {
  const { locale } = await params;
  const english = locale === "en";

  return (
    <div className="marketing-shell">
      <Header />
      <main id="main-content" className={styles.conversionPage}>
        <section className={styles.pricingHero} aria-labelledby="pricing-title">
          <div className={styles.pricingHeroInner}>
            <div className={styles.pricingCopy}>
              <p className={styles.eyebrow}>{english ? "Simple by design" : "Simple par conception"}</p>
              <h1 id="pricing-title">{english ? <>Your ambition, <span>at the right level.</span></> : <>Votre ambition, <span>au bon niveau.</span></>}</h1>
              <p>{english ? "Start freely. Scale when usage demands it — no hidden annual commitment, no unreadable pricing architecture." : "Commencez librement. Passez à l’échelle quand l’usage le demande — sans engagement annuel dissimulé ni architecture tarifaire illisible."}</p>
            </div>
            <aside className={styles.pricingLens} aria-label={english ? "Plan overview" : "Vue d’ensemble des offres"}>
              <span>{english ? "One path, three levels" : "Une trajectoire, trois niveaux"}</span>
              <div className={styles.pricingScale}>
                <div><small>01</small><strong>Starter</strong><b>{english ? "€0" : "0 €"}</b></div>
                <div><small>02</small><strong>Pro</strong><b>{english ? "€19 / month" : "19 € / mois"}</b></div>
                <div><small>03</small><strong>{english ? "Enterprise" : "Entreprise"}</strong><b>{english ? "Custom" : "Sur devis"}</b></div>
              </div>
              <p className={styles.pricingNote}>{english ? "You stay in control at every step." : "Vous gardez le contrôle à chaque étape."}</p>
            </aside>
          </div>
        </section>

        <section className={styles.pricingBody} aria-labelledby="pricing-offers-title">
          <div className={styles.pricingBodyIntro}>
            <span>{english ? "Choose your level" : "Choisir son niveau"}</span>
            <h2 id="pricing-offers-title">{english ? "The same product. More reach when you need it." : "Le même produit. Plus de portée lorsque vous en avez besoin."}</h2>
          </div>
          <PricingCards language={english ? "en" : "fr"} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
