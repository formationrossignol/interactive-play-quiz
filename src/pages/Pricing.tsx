import { useNavigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { t } from "@/lib/i18n";
import { Check, Rocket, Crown, Building2 } from "lucide-react";

const Pricing = () => {
  const navigate = useNavigate();
  usePageTitle("Tarifs");

  const plans = [
    {
      name: t('pricingPlanStarter'),
      description: t('pricingPlanStarterDesc'),
      price: t('pricingPlanStarterPrice'),
      cta: t('pricingPlanStarterCta'),
      icon: Rocket,
      accent: "--ap-pres",
      accentDeep: "--ap-pres-deep",
      accentSoft: "--ap-pres-soft",
      features: [t('pricingStarterFeature1'), t('pricingStarterFeature2'), t('pricingStarterFeature3')],
      onClick: () => navigate('/builder-start?type=quiz'),
      billing: t('pricingPerMonth'),
      highlight: false,
    },
    {
      name: t('pricingPlanPro'),
      description: t('pricingPlanProDesc'),
      price: t('pricingPlanProPrice'),
      cta: t('pricingPlanProCta'),
      icon: Crown,
      accent: "--ap-brand",
      accentDeep: "--ap-brand-deep",
      accentSoft: "--ap-brand-soft",
      features: [t('pricingProFeature1'), t('pricingProFeature2'), t('pricingProFeature3')],
      onClick: () => navigate('/auth'),
      billing: t('pricingPerMonth'),
      highlight: true,
    },
    {
      name: t('pricingPlanEnterprise'),
      description: t('pricingPlanEnterpriseDesc'),
      price: t('pricingPlanEnterprisePrice'),
      cta: t('pricingPlanEnterpriseCta'),
      icon: Building2,
      accent: "--ap-poll",
      accentDeep: "--ap-poll-deep",
      accentSoft: "--ap-poll-soft",
      features: [t('pricingEnterpriseFeature1'), t('pricingEnterpriseFeature2'), t('pricingEnterpriseFeature3')],
      onClick: () => window.open('mailto:contact@quizmaster.app', '_blank'),
      billing: t('pricingContactUs'),
      highlight: false,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--ap-paper)" }}>
      <Header />
      <main style={{ flex: 1 }}>
        {/* Hero */}
        <section style={{ maxWidth: 640, margin: "0 auto", padding: "72px 24px 56px", textAlign: "center" }}>
          <span className="ap-badge ap-badge--brand" style={{ marginBottom: "20px", display: "inline-flex" }}>
            Tarifs
          </span>
          <h1 className="ap-h1" style={{ fontSize: "clamp(36px,5vw,56px)", marginBottom: "16px" }}>
            {t('pricingTitle')}
          </h1>
          <p className="ap-lead" style={{ maxWidth: 500, margin: "0 auto" }}>
            {t('pricingSubtitle')}
          </p>
        </section>

        {/* Pricing cards */}
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 96px" }}>
          <div style={{ display: "grid", gap: "24px", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {plans.map((plan) => {
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
                    <span
                      className="ap-badge ap-badge--brand"
                      style={{
                        position: "absolute", top: 16, right: 16, fontSize: "10px",
                      }}
                    >
                      Populaire
                    </span>
                  )}
                  {/* icon + name */}
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div
                      className="ap-tile__icon"
                      style={{
                        background: `var(${plan.accent})`,
                        boxShadow: `0 5px 0 var(${plan.accentDeep})`,
                        flexShrink: 0,
                      }}
                    >
                      <Icon className="h-6 w-6" color="#fff" />
                    </div>
                    <div>
                      <h3 className="ap-h3">{plan.name}</h3>
                      <p className="ap-muted" style={{ fontSize: "13px", marginTop: "2px" }}>{plan.description}</p>
                    </div>
                  </div>

                  {/* price */}
                  <div>
                    <span
                      style={{
                        fontFamily: "var(--ap-font-display)", fontWeight: 600,
                        fontSize: "36px", color: "var(--ap-ink)", letterSpacing: "-1px",
                      }}
                    >
                      {plan.price}
                    </span>
                    <p className="ap-muted" style={{ fontSize: "13px", marginTop: "2px" }}>{plan.billing}</p>
                  </div>

                  {/* features */}
                  <ul style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
                    {plan.features.map((feature) => (
                      <li key={feature} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                        <Check
                          className="mt-0.5 h-4 w-4 flex-shrink-0"
                          style={{ color: `var(${plan.accent})` }}
                        />
                        <span style={{ fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: "14px", color: "var(--ap-ink)" }}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
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
      </main>
      <Footer />
    </div>
  );
};

export default Pricing;
