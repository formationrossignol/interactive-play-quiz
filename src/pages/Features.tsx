import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { Sparkles, Users, Layers, BarChart3, Palette, CheckCircle2 } from "lucide-react";

const Features = () => {
  const navigate = useNavigate();

  const coreFeatures = [
    {
      icon: Users,
      title: t('featureCollaborative'),
      description: t('featureCollaborativeDesc'),
    },
    {
      icon: Sparkles,
      title: t('featureInteractive'),
      description: t('featureInteractiveDesc'),
    },
    {
      icon: Palette,
      title: t('featureCustomization'),
      description: t('featureCustomizationDesc'),
    },
    {
      icon: BarChart3,
      title: t('featureAnalytics'),
      description: t('featureAnalyticsDesc'),
    },
    {
      icon: Layers,
      title: t('featureTemplates'),
      description: t('featureTemplatesDesc'),
    },
    {
      icon: CheckCircle2,
      title: t('featureAssessment'),
      description: t('featureAssessmentDesc'),
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="relative z-10 flex-1 overflow-hidden">
        <div className="floating-orb -left-24 top-40 h-72 w-72 bg-[#0f1a3d]/12" />
        <div className="floating-orb -right-32 top-20 h-96 w-96 bg-[#1d2a55]/10" />
        <div className="floating-orb bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 bg-[#0f1a3d]/8" />

        <section className="relative mx-auto max-w-5xl px-6 pt-16 pb-20 text-center md:pt-20">
          <h1 className="font-heading text-4xl leading-tight text-foreground md:text-6xl">
            {t('featuresTitle')}
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-foreground/70 md:text-lg">
            {t('featuresSubtitle')}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              onClick={() => navigate('/builder-start?type=quiz')}
              className="h-14 rounded-full bg-gradient-to-r from-[#0f1a3d] to-[#1d2a55] px-10 text-base font-medium text-white shadow-[0_24px_60px_-30px_rgba(15,26,61,0.8)] hover:-translate-y-0.5"
            >
              {t('featuresHeroCta')}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/pricing')}
              className="h-14 rounded-full border-white/60 bg-white/60 px-10 text-base font-medium text-foreground/80 shadow-[0_22px_60px_-30px_rgba(15,26,61,0.6)] transition-all duration-300 hover:border-[#0f1a3d]/30 hover:text-foreground"
            >
              {t('featuresHeroSecondary')}
            </Button>
          </div>
        </section>

        <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
          <div className="grid gap-6 md:grid-cols-2">
            {coreFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="glass-tile flex flex-col gap-4 p-8 text-left transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/60 bg-white/70 text-foreground/80 shadow-[0_12px_30px_-16px_rgba(15,26,61,0.45)]">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-heading text-2xl text-foreground">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-foreground/70">{feature.description}</p>
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

export default Features;
