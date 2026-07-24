"use client";

import { Check, Rocket, Crown, Building2 } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { PlanComparator } from "@/components/PlanComparator";
import { PaymentFaq } from "@/components/PaymentFaq";

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
    description: "Idéal pour découvrir Brivia avec une petite équipe.",
    price: "Gratuit",
    cta: "Créer mon premier quiz",
    icon: Rocket,
    accent: "--ap-pres",
    accentDeep: "--ap-pres-deep",
    features: [
      "Jusqu'à 5 quiz, sondages, jeux de cartes et présentations",
      "1 cours, types de questions classiques uniquement",
      "Jusqu'à 20 participants par session",
    ],
    onClick: () => { window.location.href = "/builder-start?type=quiz"; },
    billing: "par mois",
    highlight: false,
  },
  {
    name: "Pro",
    description: "Pour les animateurs qui veulent personnalisation avancée et analyses détaillées.",
    price: "19 €",
    cta: "Passer en Pro",
    icon: Crown,
    accent: "--ap-brand",
    accentDeep: "--ap-brand-deep",
    features: [
      "Quiz, sondages, flashcards, présentations, examens et cours illimités",
      "Jusqu'à 200 participants en direct, tous les types de questions",
      "Rapports détaillés et exports de performances",
    ],
    onClick: onProClick,
    billing: "par mois",
    highlight: true,
  },
  {
    name: "Entreprise",
    description: "Accompagnement sur-mesure et sécurité renforcée pour les grandes organisations.",
    price: "Sur devis",
    cta: "Contacter les ventes",
    icon: Building2,
    accent: "--ap-poll",
    accentDeep: "--ap-poll-deep",
    features: [
      "Participants et événements illimités",
      "Single sign-on (SSO) et templates personnalisés en marque blanche",
      "Success manager dédié et formations",
    ],
    onClick: () => window.open("mailto:contact@quizmaster.app", "_blank"),
    billing: "Discutons de vos besoins",
    highlight: false,
  },
];

export function PricingCards() {
  return (
    <>
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 96px" }}>
        <div style={{ display: "grid", gap: "24px", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.name}
                className={plan.highlight ? "ap-card ap-card--floaty" : "ap-card ap-card--hover"}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                  padding: "32px",
                  border: plan.highlight ? `2px solid var(${plan.accent})` : undefined,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {plan.highlight && (
                  <span className="ap-badge ap-badge--brand" style={{ position: "absolute", top: 16, right: 16, fontSize: "10px" }}>
                    Populaire
                  </span>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div className="ap-tile__icon" style={{ background: `var(${plan.accent})`, boxShadow: `0 5px 0 var(${plan.accentDeep})`, flexShrink: 0 }}>
                    <Icon className="h-6 w-6" color="#fff" />
                  </div>
                  <div>
                    <h3 className="ap-h3">{plan.name}</h3>
                    <p className="ap-muted" style={{ fontSize: "13px", marginTop: "2px" }}>{plan.description}</p>
                  </div>
                </div>

                <div>
                  <span style={{ fontFamily: "var(--ap-font-display)", fontWeight: 600, fontSize: "36px", color: "var(--ap-ink)", letterSpacing: "-1px" }}>
                    {plan.price}
                  </span>
                  <p className="ap-muted" style={{ fontSize: "13px", marginTop: "2px" }}>{plan.billing}</p>
                </div>

                <ul style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
                  {plan.features.map((feature) => (
                    <li key={feature} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: `var(${plan.accent})` }} />
                      <span style={{ fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: "14px", color: "var(--ap-ink)" }}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={plan.onClick}
                  className={plan.highlight ? "ap-btn ap-btn--pill" : "ap-btn ap-btn--ghost ap-btn--pill"}
                  style={{ width: "100%" }}
                >
                  {plan.cta}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 96px" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h2 className="ap-h2" style={{ marginBottom: "8px" }}>Comparez les formules en détail</h2>
          <p className="ap-muted" style={{ maxWidth: 480, margin: "0 auto" }}>
            Toutes les limites et fonctionnalités, plan par plan.
          </p>
        </div>
        <PlanComparator plans={PLANS} />
      </section>

      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 96px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h2 className="ap-h2" style={{ marginBottom: "8px" }}>Questions sur le paiement</h2>
          <p className="ap-muted">Tout ce qu&apos;il faut savoir avant de passer au plan Pro.</p>
        </div>
        <PaymentFaq />
      </section>
    </>
  );
}
