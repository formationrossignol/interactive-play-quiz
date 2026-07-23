import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Zap, Users, Target, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { useStaticPage } from "@/lib/pages/hooks";
import { STATIC_PAGE_DEFAULTS, mergeStaticPage } from "@/lib/pages/staticPageDefaults";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import "./static-pages.css";

const ICONS = [Zap, Users, Target, Heart];
const accents = [
  { accent: "--ap-brand", accentDeep: "--ap-brand-deep" },
  { accent: "--ap-poll", accentDeep: "--ap-poll-deep" },
  { accent: "--ap-pres", accentDeep: "--ap-pres-deep" },
  { accent: "--ap-quiz", accentDeep: "--ap-quiz-deep" },
];

const About = () => {
  const navigate = useNavigate();
  useSEO({
    title: "À propos",
    description: "Brivia est l'outil de quiz et sondages interactifs conçu pour les formateurs et enseignants. Notre mission : rendre chaque session de formation engageante et mémorable.",
    path: "/about",
  });
  const { data } = useStaticPage("about");
  const page = mergeStaticPage(STATIC_PAGE_DEFAULTS.about, data);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="mx-auto max-w-5xl px-6 py-16">
          {/* Hero */}
          <div style={{ textAlign: "center", marginBottom: "64px" }}>
            <h1 className="ap-h1" style={{ fontSize: "clamp(36px,5vw,52px)", marginBottom: "20px" }}>
              À propos de <span style={{ color: "var(--ap-brand)" }}>{page.title}</span>
            </h1>
            <p className="ap-lead" style={{ maxWidth: 600, margin: "0 auto" }}>
              {page.subtitle}
            </p>
          </div>

          {/* Mission */}
          <div
            className="ap-card ap-card--floaty about-mission"
            style={{ marginBottom: "56px", padding: "36px 40px" }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.body) }}
          />

          {/* Values */}
          <div style={{ marginBottom: "56px" }}>
            <h2 className="ap-h2" style={{ fontSize: "32px", textAlign: "center", marginBottom: "32px" }}>
              Nos valeurs
            </h2>
            <div style={{ display: "grid", gap: "20px", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
              {page.blocks.map((val, i) => {
                const Icon = ICONS[i % ICONS.length];
                const { accent, accentDeep } = accents[i % accents.length];
                return (
                  <div key={i} className="ap-card ap-card--hover" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div className="ap-tile__icon" style={{ background: `var(${accent})`, boxShadow: `0 5px 0 var(${accentDeep})` }}>
                      <Icon className="h-6 w-6" color="#fff" />
                    </div>
                    <h3 className="ap-h3">{val.title}</h3>
                    <p className="ap-muted" style={{ fontSize: "14px", lineHeight: 1.55 }}>{val.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTA banner */}
          <div style={{ background: "var(--ap-brand)", borderRadius: "var(--ap-r-xl)", padding: "40px 40px", textAlign: "center", position: "relative", overflow: "hidden" }}>
            <span style={{ position: "absolute", width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.07)", right: -60, top: -60, pointerEvents: "none" }} />
            <h2 className="ap-h2" style={{ fontSize: "28px", color: "#fff", marginBottom: "12px" }}>
              Rejoignez la communauté Brivia
            </h2>
            <p style={{ color: "rgba(255,255,255,0.8)", fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: "15px", marginBottom: "28px" }}>
              Des milliers d'éducateurs, formateurs et animateurs créent déjà des expériences inoubliables.
            </p>
            <button
              className="ap-btn ap-btn--lg ap-btn--pill"
              style={{ background: "#fff", color: "var(--ap-brand)", boxShadow: "0 5px 0 var(--ap-brand-deep)" }}
              onClick={() => navigate("/auth")}
            >
              Commencer gratuitement
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default About;
