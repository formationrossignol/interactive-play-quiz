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
    <div className="flex min-h-screen flex-col bg-[#F8FAFC]">
      <Header />
      <main className="relative z-10 flex-1">

        <section className="relative mx-auto max-w-5xl px-6 pt-16 pb-20 text-center md:pt-20">
          <h1 className="font-extrabold text-4xl leading-tight text-foreground md:text-6xl">
            {t('featuresTitle')}
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-foreground/70 md:text-lg">
            {t('featuresSubtitle')}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              onClick={() => navigate('/builder-start?type=quiz')}
              className="h-14 rounded-full bg-indigo-600 px-10 text-base font-medium text-white shadow-card hover:bg-indigo-700 hover:-translate-y-0.5 transition-all"
            >
              {t('featuresHeroCta')}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/pricing')}
              className="h-14 rounded-full border-slate-200 bg-white px-10 text-base font-medium text-foreground/80 shadow-card transition-all duration-300 hover:border-indigo-200 hover:text-foreground"
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
                  className="rounded-2xl border border-slate-100 bg-white shadow-card flex flex-col gap-4 p-8 text-left transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-indigo-50 text-indigo-600 shadow-card">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-extrabold text-2xl text-foreground">{feature.title}</h3>
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
