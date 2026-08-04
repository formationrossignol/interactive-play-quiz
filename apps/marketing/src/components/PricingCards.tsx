"use client";

import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { PlanComparator, type ComparatorCategory } from "@/components/PlanComparator";
import { PaymentFaq, type PaymentFaqItem } from "@/components/PaymentFaq";
import pageStyles from "./MarketingPage.module.css";
import styles from "./PricingCards.module.css";

export type PricingPlanContent = {
  name: string;
  description: string;
  price?: string;
  priceValue?: number;
  cta: string;
  edition: string;
  symbol: string;
  features: string[];
  billing: string;
  highlight: boolean;
};

type Props = {
  locale: "fr" | "en";
  plans: PricingPlanContent[];
  categories: ComparatorCategory[];
  faqItems: PaymentFaqItem[];
  comparisonTitle: string;
  comparisonSubtitle: string;
  paymentTitle: string;
  paymentSubtitle: string;
  checkoutError: string;
  checkoutGenericError: string;
};

async function startProCheckout(errorText: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabaseBrowser.functions.invoke("create-checkout-session", { body: {} });
  if (error || !data?.url) return { ok: false, error: errorText };
  window.location.href = data.url;
  return { ok: true };
}

async function onProClick(errorText: string, genericErrorText: string) {
  const { data } = await supabaseBrowser.auth.getSession();
  if (!data.session) {
    window.location.href = "/auth";
    return;
  }
  const result = await startProCheckout(errorText);
  if (!result.ok) toast.error(result.error ?? genericErrorText);
}

function planOnClick(name: string, locale: "fr" | "en", errorText: string, genericErrorText: string) {
  if (name === "Starter") return () => { window.location.href = "/builder-start?type=quiz"; };
  if (name === "Pro") return () => onProClick(errorText, genericErrorText);
  return () => { window.location.href = locale === "en" ? "/en/contact?intent=enterprise" : "/contact?intent=enterprise"; };
}

function PlanGlyph({ kind }: { kind: string }) {
  return (
    <svg className={styles.planGlyph} viewBox="0 0 32 32" aria-hidden="true">
      {kind === "spark" && <path d="M16 3.5c.4 7.6 4.9 12.1 12.5 12.5C20.9 16.4 16.4 20.9 16 28.5 15.6 20.9 11.1 16.4 3.5 16 11.1 15.6 15.6 11.1 16 3.5Z" />}
      {kind === "signal" && <><circle cx="16" cy="16" r="3.2" /><path d="M9.7 22.3a8.9 8.9 0 0 1 0-12.6M22.3 9.7a8.9 8.9 0 0 1 0 12.6M5.4 26.6a15 15 0 0 1 0-21.2M26.6 5.4a15 15 0 0 1 0 21.2" /></>}
      {kind === "structure" && <><path d="M5 27V11l11-6 11 6v16M10 27V15h12v12M16 15v12" /><path d="M3 27h26" /></>}
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg className={styles.checkGlyph} viewBox="0 0 18 18" aria-hidden="true">
      <path d="m4.2 9.3 3 3 6.6-6.6" />
    </svg>
  );
}

function ArrowGlyph() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <path d="M4 9h9M9.5 5.5 13 9l-3.5 3.5" />
    </svg>
  );
}

export function PricingCards({
  locale, plans, categories, faqItems,
  comparisonTitle, comparisonSubtitle, paymentTitle, paymentSubtitle,
  checkoutError, checkoutGenericError,
}: Props) {
  const currency = new Intl.NumberFormat(locale === "en" ? "en-US" : "fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const comparatorPlans = plans.map((plan) => ({
    name: plan.name,
    accent: "--ap-brand",
    highlight: plan.highlight,
    cta: plan.cta,
    onClick: planOnClick(plan.name, locale, checkoutError, checkoutGenericError),
  }));

  return (
    <div className={pageStyles.container}>
      <div className={styles.plans}>
        {plans.map((plan, index) => {
          const price = plan.priceValue !== undefined ? currency.format(plan.priceValue) : plan.price;
          return (
            <article className={styles.plan} key={plan.name}>
              <div className={styles.planHeader}>
                <div className={styles.planEyebrow}>
                  <span>{plan.edition}</span>
                  <PlanGlyph kind={plan.symbol} />
                </div>
                <h2 className={styles.planName}>
                  {plan.name}
                </h2>
                <p className={styles.planDescription}>{plan.description}</p>
              </div>
              <p className={styles.price}>{price}</p>
              <p className={styles.billing}>{plan.billing}</p>
              <ul className={styles.features}>
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <CheckGlyph />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button type="button" className={styles.button} onClick={comparatorPlans[index].onClick}>
                <span>{plan.cta}</span>
                <span className={styles.buttonArrow}><ArrowGlyph /></span>
              </button>
            </article>
          );
        })}
      </div>

      <section className={styles.subsection} aria-labelledby="plans-comparison-title">
        <div className={styles.subsectionHeader}>
          <h2 id="plans-comparison-title">{comparisonTitle}</h2>
          <p>{comparisonSubtitle}</p>
        </div>
        <PlanComparator plans={comparatorPlans} categories={categories} />
      </section>

      <section className={styles.subsection} aria-labelledby="payment-title">
        <div className={styles.subsectionHeader}>
          <h2 id="payment-title">{paymentTitle}</h2>
          <p>{paymentSubtitle}</p>
        </div>
        <PaymentFaq items={faqItems} />
      </section>
    </div>
  );
}
