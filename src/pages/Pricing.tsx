import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Check, Rocket, Crown, Building2 } from "lucide-react";

const Pricing = () => {
  const navigate = useNavigate();

  const plans = [
    {
      name: t('pricingPlanStarter'),
      description: t('pricingPlanStarterDesc'),
      price: t('pricingPlanStarterPrice'),
      cta: t('pricingPlanStarterCta'),
      icon: Rocket,
      features: [
        t('pricingStarterFeature1'),
        t('pricingStarterFeature2'),
        t('pricingStarterFeature3'),
      ],
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
      features: [
        t('pricingProFeature1'),
        t('pricingProFeature2'),
        t('pricingProFeature3'),
      ],
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
      features: [
        t('pricingEnterpriseFeature1'),
        t('pricingEnterpriseFeature2'),
        t('pricingEnterpriseFeature3'),
      ],
      onClick: () => window.open('mailto:contact@quizmaster.app', '_blank'),
      billing: t('pricingContactUs'),
      highlight: false,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="relative z-10 flex-1 overflow-hidden">
        <div className="floating-orb -left-24 top-40 h-72 w-72 bg-[#0f1a3d]/12" />
        <div className="floating-orb -right-32 top-20 h-96 w-96 bg-[#1d2a55]/10" />
        <div className="floating-orb bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 bg-[#0f1a3d]/8" />

        <section className="relative mx-auto max-w-4xl px-6 pt-16 pb-20 text-center md:pt-20">
          <h1 className="font-heading text-4xl leading-tight text-foreground md:text-6xl">{t('pricingTitle')}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-foreground/70 md:text-lg">
            {t('pricingSubtitle')}
          </p>
        </section>

        <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => {
              const Icon = plan.icon;
              return (
                <div
                  key={plan.name}
                  className={cn(
                    'glass-tile flex h-full flex-col gap-6 p-8 text-left transition-transform duration-300 hover:-translate-y-1',
                    plan.highlight && 'border-2 border-[#1d2a55]/40 shadow-[0_24px_60px_-30px_rgba(15,26,61,0.65)]'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/60 bg-white/70 text-foreground/80 shadow-[0_12px_30px_-16px_rgba(15,26,61,0.45)]">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-heading text-2xl text-foreground">{plan.name}</h3>
                      <p className="text-sm text-foreground/60">{plan.description}</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-3xl font-semibold text-foreground">{plan.price}</span>
                    <p className="text-sm text-foreground/50">{plan.billing}</p>
                  </div>
                  <ul className="space-y-3 text-sm text-foreground/70">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#1d2a55]" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={plan.onClick}
                    className={cn(
                      'mt-auto h-12 rounded-full transition-all duration-300',
                      plan.highlight
                        ? 'bg-gradient-to-r from-[#0f1a3d] to-[#1d2a55] text-white hover:-translate-y-0.5'
                        : 'border-white/60 bg-white/70 text-foreground/80 hover:border-[#0f1a3d]/30 hover:text-foreground'
                    )}
                    variant={plan.highlight ? 'default' : 'outline'}
                  >
                    {plan.cta}
                  </Button>
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
