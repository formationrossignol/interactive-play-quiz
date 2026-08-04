import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PricingCards, type PricingPlanContent } from "@/components/PricingCards";
import type { ComparatorCategory } from "@/components/PlanComparator";
import type { PaymentFaqItem } from "@/components/PaymentFaq";
import { getLocalizedAlternates } from "@/lib/pageAlternates";
import styles from "@/components/ConversionPages.module.css";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PricingPage" });
  return {
    title: t("meta.title"),
    description: t("meta.description"),
    alternates: { canonical: getLocalizedAlternates("/pricing").languages[locale], ...getLocalizedAlternates("/pricing") },
  };
}

export default async function PricingPage({ params }: Props) {
  const { locale } = await params;
  const english = locale === "en";
  const t = await getTranslations({ locale, namespace: "PricingPage" });
  const cards = await getTranslations({ locale, namespace: "PricingCards" });
  const comparator = await getTranslations({ locale, namespace: "PlanComparator" });
  const faq = await getTranslations({ locale, namespace: "PaymentFaq" });

  const plans = cards.raw("plans") as PricingPlanContent[];
  const categories = comparator.raw("categories") as ComparatorCategory[];
  const faqItems = faq.raw("items") as PaymentFaqItem[];
  const currency = new Intl.NumberFormat(english ? "en-US" : "fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const proPlan = plans.find((plan) => plan.name === "Pro");
  const proPrice = proPlan?.priceValue !== undefined ? currency.format(proPlan.priceValue) : "";

  return (
    <div className="marketing-shell">
      <Header />
      <main id="main-content" className={styles.conversionPage}>
        <section className={styles.pricingHero} aria-labelledby="pricing-title">
          <div className={styles.pricingHeroInner}>
            <div className={styles.pricingCopy}>
              <p className={styles.eyebrow}>{t("eyebrow")}</p>
              <h1 id="pricing-title">{t("title")} <span>{t("accent")}</span></h1>
              <p>{t("intro")}</p>
            </div>
            <aside className={styles.pricingLens} aria-label={t("lensLabel")}>
              <span>{t("lensTitle")}</span>
              <div className={styles.pricingScale}>
                <div><small>01</small><strong>Starter</strong><b>{plans[0]?.price}</b></div>
                <div><small>02</small><strong>Pro</strong><b>{proPrice} / {english ? "month" : "mois"}</b></div>
                <div><small>03</small><strong>{plans[2]?.name}</strong><b>{plans[2]?.price}</b></div>
              </div>
              <p className={styles.pricingNote}>{t("lensNote")}</p>
            </aside>
          </div>
        </section>

        <section className={styles.pricingBody} aria-labelledby="pricing-offers-title">
          <div className={styles.pricingBodyIntro}>
            <span>{t("bodyEyebrow")}</span>
            <h2 id="pricing-offers-title">{t("bodyTitle")}</h2>
          </div>
          <PricingCards
            locale={english ? "en" : "fr"}
            plans={plans}
            categories={categories}
            faqItems={faqItems}
            comparisonTitle={cards("comparisonTitle")}
            comparisonSubtitle={cards("comparisonSubtitle")}
            paymentTitle={cards("paymentTitle")}
            paymentSubtitle={cards("paymentSubtitle")}
            checkoutError={cards("checkoutError")}
            checkoutGenericError={cards("checkoutGenericError")}
          />
        </section>
      </main>
      <Footer />
    </div>
  );
}
