import { useNavigate } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { t } from "@/lib/i18n";
import { Sparkles, Users, Layers, BarChart3, Palette, CheckCircle2 } from "lucide-react";
import { useStaticPage } from "@/lib/pages/hooks";
import { STATIC_PAGE_DEFAULTS, mergeStaticPage } from "@/lib/pages/staticPageDefaults";

const ICONS = [Users, Sparkles, Palette, BarChart3, Layers, CheckCircle2];
const featureAccents = ["--ap-quiz", "--ap-brand", "--ap-pres", "--ap-poll", "--ap-flash", "--ap-quiz"];
const featureAccentsDeep = ["--ap-quiz-deep", "--ap-brand-deep", "--ap-pres-deep", "--ap-poll-deep", "--ap-flash-deep", "--ap-quiz-deep"];

const Features = () => {
  const navigate = useNavigate();
  useSEO({
    title: "Fonctionnalités",
    description: "Quiz multijoueurs, sondages live, flashcards et présentations interactives dans un seul outil. Classement en temps réel, QR code, export des résultats.",
    path: "/features",
  });
  const { data } = useStaticPage("features");
  const page = mergeStaticPage(STATIC_PAGE_DEFAULTS.features, data);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Header />
      <main style={{ flex: 1 }}>
        {/* Hero */}
        <section style={{ maxWidth: 800, margin: "0 auto", padding: "72px 24px 56px", textAlign: "center" }}>
          <span className="ap-badge ap-badge--brand" style={{ marginBottom: "20px", display: "inline-flex" }}>
            Fonctionnalités
          </span>
          <h1 className="ap-h1" style={{ fontSize: "clamp(36px,5vw,56px)", marginBottom: "20px" }}>
            {page.title}
          </h1>
          <p className="ap-lead" style={{ maxWidth: 620, margin: "0 auto 36px" }}>
            {page.subtitle}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", justifyContent: "center" }}>
            <button className="ap-btn ap-btn--lg ap-btn--pill" onClick={() => navigate('/builder-start?type=quiz')}>
              {t('featuresHeroCta')}
            </button>
            <button className="ap-btn ap-btn--lg ap-btn--ghost ap-btn--pill" onClick={() => navigate('/pricing')}>
              {t('featuresHeroSecondary')}
            </button>
          </div>
        </section>

        {/* Feature cards */}
        <section style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 96px" }}>
          <div style={{ display: "grid", gap: "24px", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
            {page.blocks.map((feature, i) => {
              const Icon = ICONS[i % ICONS.length];
              const accent = featureAccents[i % featureAccents.length];
              const accentDeep = featureAccentsDeep[i % featureAccentsDeep.length];
              return (
                <div key={i} className="ap-card ap-card--hover" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div className="ap-tile__icon" style={{ background: `var(${accent})`, boxShadow: `0 5px 0 var(${accentDeep})` }}>
                    <Icon className="h-6 w-6" color="#fff" />
                  </div>
                  <h3 className="ap-h3">{feature.title}</h3>
                  <p className="ap-muted" style={{ fontSize: "14px", lineHeight: 1.55 }}>{feature.desc}</p>
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
