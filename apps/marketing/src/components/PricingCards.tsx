"use client";

import { Building2, Check, Crown, Rocket } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { PlanComparator } from "@/components/PlanComparator";
import { PaymentFaq } from "@/components/PaymentFaq";
import pageStyles from "./MarketingPage.module.css";
import styles from "./PricingCards.module.css";

async function startProCheckout(): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabaseBrowser.functions.invoke("create-checkout-session", { body: {} });
  if (error || !data?.url) return { ok: false, error: "Impossible de préparer le paiement." };
  window.location.href = data.url;
  return { ok: true };
}

async function onProClick() {
  const { data } = await supabaseBrowser.auth.getSession();
  if (!data.session) {
    window.location.href = "/auth";
    return;
  }
  const result = await startProCheckout();
  if (!result.ok) toast.error(result.error ?? "Erreur lors de la préparation du paiement.");
}

const PLANS = [
  {
    name: "Starter",
    description: "Pour essayer Brivia et animer un petit groupe.",
    price: "Gratuit",
    cta: "Créer gratuitement",
    icon: Rocket,
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
    icon: Crown,
    features: [
      "Tous les formats en illimité",
      "200 participants par session",
      "Classement, association, texte à trous et curseur",
      "Rapports détaillés et exports",
    ],
    onClick: onProClick,
    billing: "par mois, sans engagement",
    highlight: true,
    accent: "--ap-brand",
  },
  {
    name: "Entreprise",
    description: "Pour les déploiements qui dépassent le cadre d’une équipe.",
    price: "Sur devis",
    cta: "Nous contacter",
    icon: Building2,
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
];

export function PricingCards() {
  return (
    <div className={pageStyles.container}>
      <div className={styles.plans}>
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          return (
            <article className={styles.plan} key={plan.name}>
              <div className={styles.planHeader}>
                <h2 className={styles.planName}>
                  <Icon size={22} strokeWidth={1.7} aria-hidden="true" />
                  {plan.name}
                </h2>
                <p className={styles.planDescription}>{plan.description}</p>
              </div>
              <p className={styles.price}>{plan.price}</p>
              <p className={styles.billing}>{plan.billing}</p>
              <ul className={styles.features}>
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <Check size={17} strokeWidth={2.2} aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button type="button" className={styles.button} onClick={plan.onClick}>
                {plan.cta}
              </button>
            </article>
          );
        })}
      </div>

      <section className={styles.subsection} aria-labelledby="plans-comparison-title">
        <div className={styles.subsectionHeader}>
          <h2 id="plans-comparison-title">Les limites, plan par plan.</h2>
          <p>Les capacités ci-dessous correspondent aux règles appliquées dans l’app.</p>
        </div>
        <PlanComparator plans={PLANS} />
      </section>

      <section className={styles.subsection} aria-labelledby="payment-title">
        <div className={styles.subsectionHeader}>
          <h2 id="payment-title">Paiement et abonnement.</h2>
          <p>Le plan Pro passe par Stripe et reste sans engagement annuel.</p>
        </div>
        <PaymentFaq />
      </section>
    </div>
  );
}
