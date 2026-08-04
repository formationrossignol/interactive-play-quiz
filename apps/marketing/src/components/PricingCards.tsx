"use client";

import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { PlanComparator } from "@/components/PlanComparator";
import { PaymentFaq } from "@/components/PaymentFaq";
import pageStyles from "./MarketingPage.module.css";
import styles from "./PricingCards.module.css";

async function startProCheckout(language: "fr" | "en"): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabaseBrowser.functions.invoke("create-checkout-session", { body: {} });
  if (error || !data?.url) return { ok: false, error: language === "en" ? "Could not prepare the payment." : "Impossible de préparer le paiement." };
  window.location.href = data.url;
  return { ok: true };
}

async function onProClick(language: "fr" | "en") {
  const { data } = await supabaseBrowser.auth.getSession();
  if (!data.session) {
    window.location.href = "/auth";
    return;
  }
  const result = await startProCheckout(language);
  if (!result.ok) toast.error(result.error ?? (language === "en" ? "Error preparing the payment." : "Erreur lors de la préparation du paiement."));
}

const PLANS = {
  fr: [
    {
      name: "Starter",
      description: "Pour essayer Brivia et animer un petit groupe.",
      price: "Gratuit",
      cta: "Créer gratuitement",
      edition: "Pour commencer",
      symbol: "spark",
      features: [
        "5 quiz, sondages, flashcards, présentations et examens",
        "1 cours",
        "20 participants par session",
        "Types de questions classiques",
      ],
      onClick: () => { window.location.href = "/builder-start?type=quiz"; },
      billing: "sans limite de durée",
      highlight: false,
      accent: "--ap-brand",
    },
    {
      name: "Pro",
      description: "Pour produire sans plafond et analyser chaque session.",
      price: "19 €",
      cta: "Passer en Pro",
      edition: "Le choix des équipes",
      symbol: "signal",
      features: [
        "Tous les formats en illimité",
        "200 participants par session",
        "Classement, association, texte à trous et curseur",
        "Rapports détaillés et exports",
      ],
      onClick: () => onProClick("fr"),
      billing: "par mois, sans engagement",
      highlight: true,
      accent: "--ap-brand",
    },
    {
      name: "Entreprise",
      description: "Pour les déploiements qui dépassent le cadre d’une équipe.",
      price: "Sur devis",
      cta: "Nous contacter",
      edition: "Pour déployer",
      symbol: "structure",
      features: [
        "Contenus illimités",
        "Audience sans plafond produit",
        "Cadrage adapté à l’organisation",
        "Accompagnement au déploiement",
        "Revue sécurité et intégrations",
      ],
      onClick: () => { window.location.href = "/contact?intent=enterprise"; },
      billing: "selon vos besoins",
      highlight: false,
      accent: "--ap-brand",
    },
  ],
  en: [
    {
      name: "Starter",
      description: "To try Brivia and run a small group.",
      price: "Free",
      cta: "Create for free",
      edition: "To get started",
      symbol: "spark",
      features: [
        "5 quizzes, polls, flashcards, presentations and exams",
        "1 course",
        "20 participants per session",
        "Classic question types",
      ],
      onClick: () => { window.location.href = "/builder-start?type=quiz"; },
      billing: "no time limit",
      highlight: false,
      accent: "--ap-brand",
    },
    {
      name: "Pro",
      description: "To produce without limits and analyze every session.",
      price: "€19",
      cta: "Upgrade to Pro",
      edition: "The team's choice",
      symbol: "signal",
      features: [
        "All formats, unlimited",
        "200 participants per session",
        "Ranking, matching, fill-in-the-blank and slider",
        "Detailed reports and exports",
      ],
      onClick: () => onProClick("en"),
      billing: "per month, no commitment",
      highlight: true,
      accent: "--ap-brand",
    },
    {
      name: "Enterprise",
      description: "For deployments that go beyond a single team.",
      price: "Custom",
      cta: "Contact us",
      edition: "To deploy",
      symbol: "structure",
      features: [
        "Unlimited content",
        "No product-imposed audience cap",
        "Scoping adapted to your organization",
        "Deployment support",
        "Security and integrations review",
      ],
      onClick: () => { window.location.href = "/en/contact?intent=enterprise"; },
      billing: "based on your needs",
      highlight: false,
      accent: "--ap-brand",
    },
  ],
};

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

const STRINGS = {
  fr: { comparisonTitle: "Les limites, plan par plan.", comparisonSubtitle: "Les capacités ci-dessous correspondent aux règles appliquées dans l’app.", paymentTitle: "Paiement et abonnement.", paymentSubtitle: "Le plan Pro passe par Stripe et reste sans engagement annuel." },
  en: { comparisonTitle: "Limits, plan by plan.", comparisonSubtitle: "The capabilities below match the rules enforced in the app.", paymentTitle: "Payment and subscription.", paymentSubtitle: "The Pro plan runs through Stripe and stays commitment-free." },
} as const;

export function PricingCards({ language = "fr" }: { language?: "fr" | "en" }) {
  const plans = PLANS[language];
  const t = STRINGS[language];
  return (
    <div className={pageStyles.container}>
      <div className={styles.plans}>
        {plans.map((plan) => {
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
              <p className={styles.price}>{plan.price}</p>
              <p className={styles.billing}>{plan.billing}</p>
              <ul className={styles.features}>
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <CheckGlyph />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button type="button" className={styles.button} onClick={plan.onClick}>
                <span>{plan.cta}</span>
                <span className={styles.buttonArrow}><ArrowGlyph /></span>
              </button>
            </article>
          );
        })}
      </div>

      <section className={styles.subsection} aria-labelledby="plans-comparison-title">
        <div className={styles.subsectionHeader}>
          <h2 id="plans-comparison-title">{t.comparisonTitle}</h2>
          <p>{t.comparisonSubtitle}</p>
        </div>
        <PlanComparator plans={plans} language={language} />
      </section>

      <section className={styles.subsection} aria-labelledby="payment-title">
        <div className={styles.subsectionHeader}>
          <h2 id="payment-title">{t.paymentTitle}</h2>
          <p>{t.paymentSubtitle}</p>
        </div>
        <PaymentFaq language={language} />
      </section>
    </div>
  );
}
