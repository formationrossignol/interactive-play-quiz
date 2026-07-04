import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Zap, Users, Target, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";

const values = [
  {
    icon: Zap,
    title: "Innovation",
    desc: "Nous innovons constamment pour offrir des expériences toujours plus engageantes et intuitives.",
    accent: "--ap-brand",
    accentDeep: "--ap-brand-deep",
  },
  {
    icon: Users,
    title: "Collaboration",
    desc: "Nous facilitons le travail d'équipe et encourageons le partage de connaissances.",
    accent: "--ap-poll",
    accentDeep: "--ap-poll-deep",
  },
  {
    icon: Target,
    title: "Simplicité",
    desc: "Des outils puissants mais simples d'utilisation, accessibles à tous.",
    accent: "--ap-pres",
    accentDeep: "--ap-pres-deep",
  },
  {
    icon: Heart,
    title: "Passion",
    desc: "Nous aimons ce que nous faisons et nous nous investissons pleinement pour votre succès.",
    accent: "--ap-quiz",
    accentDeep: "--ap-quiz-deep",
  },
];

const About = () => {
  const navigate = useNavigate();
  usePageTitle("À propos");
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--ap-paper)" }}>
      <Header />

      <main style={{ flex: 1 }}>
        <div className="mx-auto max-w-5xl px-6 py-16">

          {/* Hero */}
          <div style={{ textAlign: "center", marginBottom: "64px" }}>
            <span className="ap-badge ap-badge--brand" style={{ marginBottom: "20px", display: "inline-flex" }}>
              À propos
            </span>
            <h1 className="ap-h1" style={{ fontSize: "clamp(36px,5vw,52px)", marginBottom: "20px" }}>
              À propos de <span style={{ color: "var(--ap-brand)" }}>QuizMaster</span>
            </h1>
            <p className="ap-lead" style={{ maxWidth: 600, margin: "0 auto" }}>
              QuizMaster est né de la volonté de transformer l'apprentissage et l'engagement
              en expériences interactives et mémorables.
            </p>
          </div>

          {/* Mission */}
          <div className="ap-card ap-card--floaty" style={{ marginBottom: "56px", padding: "36px 40px" }}>
            <p className="ap-lead" style={{ margin: "0 0 20px" }}>
              Nous croyons que l'apprentissage et l'engagement doivent être dynamiques,
              collaboratifs et amusants. C'est pourquoi nous avons créé QuizMaster,
              une plateforme tout-en-un qui permet aux éducateurs, formateurs et animateurs
              de concevoir des expériences interactives captivantes.
            </p>
            <p className="ap-lead" style={{ margin: 0 }}>
              Que vous organisiez un quiz en classe, un sondage en entreprise ou des
              flashcards pour réviser, QuizMaster vous offre tous les outils nécessaires
              pour captiver votre audience et mesurer l'impact en temps réel.
            </p>
          </div>

          {/* Values */}
          <div style={{ marginBottom: "56px" }}>
            <h2 className="ap-h2" style={{ fontSize: "32px", textAlign: "center", marginBottom: "32px" }}>
              Nos valeurs
            </h2>
            <div style={{ display: "grid", gap: "20px", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
              {values.map(({ icon: Icon, title, desc, accent, accentDeep }) => (
                <div key={title} className="ap-card ap-card--hover" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div
                    className="ap-tile__icon"
                    style={{ background: `var(${accent})`, boxShadow: `0 5px 0 var(${accentDeep})` }}
                  >
                    <Icon className="h-6 w-6" color="#fff" />
                  </div>
                  <h3 className="ap-h3">{title}</h3>
                  <p className="ap-muted" style={{ fontSize: "14px", lineHeight: 1.55 }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA banner */}
          <div
            style={{
              background: "var(--ap-brand)",
              borderRadius: "var(--ap-r-xl)",
              padding: "40px 40px",
              textAlign: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <span style={{ position: "absolute", width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.07)", right: -60, top: -60, pointerEvents: "none" }} />
            <h2 className="ap-h2" style={{ fontSize: "28px", color: "#fff", marginBottom: "12px" }}>
              Rejoignez la communauté QuizMaster
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
