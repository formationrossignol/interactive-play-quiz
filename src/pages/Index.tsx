import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { useLanguage } from "@/hooks/useLanguage";
import { useLiveVisitors } from "@/hooks/useLiveVisitors";
import { useCountUp } from "@/hooks/useCountUp";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PartnersStrip } from "@/components/PartnersStrip";
import { UseCaseTabs } from "@/components/landing/UseCaseTabs";
import { StatsBand } from "@/components/landing/StatsBand";
import { LandingTestimonials } from "@/components/landing/LandingTestimonials";
import { TrustSection } from "@/components/landing/TrustSection";
import { LandingFaq } from "@/components/landing/LandingFaq";
import { t } from "@/lib/i18n";
import { useReviews } from "@/lib/pages/hooks";

const contentTypes = [
  {
    key: "quiz",
    label: "Quiz",
    titleKey: "createQuiz" as const,
    descKey: "createQuizDesc" as const,
    ctaKey: "newQuiz" as const,
    accentVar: "--ap-quiz",
    route: "/builder-start?type=quiz",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--ap-ink)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/>
      </svg>
    ),
  },
  {
    key: "slide",
    label: t("presLabel"),
    titleKey: "createPres" as const,
    descKey: "createPresDesc" as const,
    ctaKey: "newPres" as const,
    accentVar: "--ap-pres",
    route: "/builder-start?type=slide",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--ap-ink)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <path d="M3 4h18v12H3z"/><path d="M12 16v4M8 20h8"/>
      </svg>
    ),
  },
  {
    key: "poll",
    label: "Sondage",
    titleKey: "createPoll" as const,
    descKey: "createPollDesc" as const,
    ctaKey: "newPoll" as const,
    accentVar: "--ap-poll",
    route: "/builder-start?type=poll",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--ap-ink)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <path d="M5 20V10M12 20V4M19 20v-7"/>
      </svg>
    ),
  },
  {
    key: "flashcard",
    label: "Flashcard",
    titleKey: "createFlashcard" as const,
    descKey: "createFlashcardDesc" as const,
    ctaKey: "newFlashcard" as const,
    accentVar: "--ap-flash",
    route: "/builder-start?type=flashcard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--ap-ink)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <path d="M4 6h13v12H4z"/><path d="M8 3h13v12"/>
      </svg>
    ),
  },
] as const;

function LeaderboardTile() {
  const rows = [
    { rank: 1, name: "Camille", initials: "CA", target: 2450 },
    { rank: 2, name: "Mehdi", initials: "ME", target: 2310 },
    { rank: 3, name: "Inès", initials: "IN", target: 2180 },
  ];
  const c1 = useCountUp(rows[0].target);
  const c2 = useCountUp(rows[1].target);
  const c3 = useCountUp(rows[2].target);
  const counts = [c1, c2, c3];

  return (
    <div className="ap-card ap-card--hover ap-reveal d6">
      <h3 className="ap-h3" style={{ marginBottom: 4 }}>Classement en direct</h3>
      <p style={{ fontSize: 14, color: "var(--ap-muted)", marginBottom: 18 }}>Les scores tombent en temps réel.</p>
      <div>
        {rows.map((row, i) => (
          <div className={`ap-lb-row${row.rank === 1 ? " ap-lb-row--first" : ""}`} key={row.name} style={{ marginBottom: i === rows.length - 1 ? 0 : undefined }}>
            <span className="ap-lb-row__rank">{row.rank}</span>
            <span className="ap-lb-row__who"><span className="ap-lb-row__av">{row.initials}</span>{row.name}</span>
            <span ref={counts[i].ref} className="ap-lb-row__pts ap-mono">{counts[i].value.toLocaleString("fr-FR")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const Index = () => {
  const [gameCode, setGameCode] = useState("");
  const navigate = useNavigate();
  const liveVisitors = useLiveVisitors();
  const { data: reviews } = useReviews();
  const avgRating = reviews && reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length).toFixed(1)
    : null;
  useLanguage();
  useSEO({ path: "/" });

  const joinQuiz = () => {
    if (gameCode.trim()) {
      navigate(`/join/${gameCode.toUpperCase()}`);
    }
  };

  return (
    <div className="landing-premium" style={{ minHeight: "100vh", background: "var(--ap-paper)" }}>
      <Header />

      <main style={{ maxWidth: 1160, margin: "0 auto", padding: "0 24px" }}>

        {/* ═══ HERO ═══ */}
        <section style={{
          display: "grid",
          gridTemplateColumns: "1.05fr .95fr",
          gap: 56,
          alignItems: "center",
          padding: "72px 0 80px",
        }} className="hero-grid">

          {/* Left */}
          <div>
            <h1
              className="ap-reveal d3"
              style={{
                fontFamily: "var(--ap-font-display)", fontWeight: 600,
                fontSize: "clamp(38px, 4.8vw, 64px)", lineHeight: 1.05,
                letterSpacing: "-.02em", color: "var(--ap-ink)",
                marginBottom: 20, textWrap: "balance",
              }}
            >
              Tous les formats. Une seule session, en direct.
            </h1>

            <p
              className="ap-reveal d4"
              style={{
                fontFamily: "var(--ap-font-body)", fontSize: 17, color: "var(--ap-muted)",
                maxWidth: "46ch", marginBottom: 32, lineHeight: 1.6,
              }}
            >
              Quiz, sondages, flashcards, présentations et examens dans un seul outil. Vos participants rejoignent en scannant un code — aucun compte, aucune installation.
            </p>

            {/* CTAs */}
            <div className="ap-reveal d5" style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center", marginBottom: 36 }}>
              <button
                className="ap-btn ap-btn--lg"
                onClick={() => navigate("/builder-start?type=quiz")}
                style={{ borderRadius: "var(--ap-r-md)" }}
              >
                Créer gratuitement
              </button>
              <button
                onClick={() => document.getElementById("join-banner")?.scrollIntoView({ behavior: "smooth" })}
                style={{
                  background: "none", border: "none", cursor: "pointer", padding: 0,
                  fontFamily: "var(--ap-font-body)", fontWeight: 600, fontSize: 15, color: "var(--ap-ink)",
                  display: "inline-flex", alignItems: "center", gap: 8,
                }}
              >
                Rejoindre une session
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6"/>
                </svg>
              </button>
            </div>

            {/* Social proof */}
            {avgRating != null && (
              <p className="ap-reveal d6" style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ap-muted)", fontFamily: "var(--ap-font-body)" }}>
                <b style={{ color: "var(--ap-ink)", fontWeight: 700 }}>{avgRating}/5</b> sur {reviews!.length} avis vérifiés
              </p>
            )}
          </div>

          {/* Right — session preview panel */}
          <div className="ap-reveal d4">
            <div className="premium-panel">
              <div className="premium-panel__row">
                <span className="premium-panel__label">Session en cours</span>
                <span className="premium-panel__live">
                  <span className="premium-panel__dot" aria-hidden="true" />
                  {liveVisitors != null ? `${liveVisitors} en ligne` : "en direct"}
                </span>
              </div>
              <div className="premium-panel__code" aria-label="Code de session 48 29 17">48 29 17</div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <div className="premium-panel__players" aria-hidden="true">
                  {["CA", "ME", "IN", "LU"].map((initials) => (
                    <span className="premium-panel__avatar" key={initials}>{initials}</span>
                  ))}
                </div>
                <span className="premium-panel__count">+18 participants</span>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ STRIP — preuve produit ═══ */}
        <section style={{ paddingBottom: 80 }}>
          <p className="ap-strip-label ap-reveal d5">Fait pour aller vite</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }} className="strip-grid">

            {/* Tile 1 — Code PIN */}
            <div className="ap-card ap-card--hover ap-reveal d5">
              <h3 className="ap-h3" style={{ marginBottom: 4 }}>Rejoindre en 5 secondes</h3>
              <p style={{ fontSize: 14, color: "var(--ap-muted)", marginBottom: 18 }}>Un code, un QR, jamais de compte pour les participants.</p>
              <div className="ap-pin" aria-label="Code de partie 48 29 17">
                48<span className="ap-pin__accent">29</span>17
              </div>
            </div>

            {/* Tile 2 — Leaderboard */}
            <LeaderboardTile />

            {/* Tile 3 — Type badges */}
            <div className="ap-card ap-card--hover ap-reveal d6">
              <h3 className="ap-h3" style={{ marginBottom: 4 }}>Quatre formats, un langage</h3>
              <p style={{ fontSize: 14, color: "var(--ap-muted)", marginBottom: 18 }}>Chaque type de contenu a sa couleur, repérable en un clin d'œil.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
                <button className="ap-type-badge ap-type-badge--quiz" onClick={() => navigate("/builder-start?type=quiz")}>
                  <span className="ap-type-badge__dot" aria-hidden="true" />Quiz
                </button>
                <button className="ap-type-badge ap-type-badge--poll" onClick={() => navigate("/builder-start?type=poll")}>
                  <span className="ap-type-badge__dot" aria-hidden="true" />Sondage
                </button>
                <button className="ap-type-badge ap-type-badge--flash" onClick={() => navigate("/builder-start?type=flashcard")}>
                  <span className="ap-type-badge__dot" aria-hidden="true" />Flashcards
                </button>
                <button className="ap-type-badge ap-type-badge--pres" onClick={() => navigate("/builder-start?type=slide")}>
                  <span className="ap-type-badge__dot" aria-hidden="true" />Présentation
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Content type row — minimal, monochrome icon + accent dot ═══ */}
        <section className="mb-16">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 1, background: "var(--ap-line)", border: "1px solid var(--ap-line)", borderRadius: "var(--ap-r-lg)", overflow: "hidden" }}>
            {contentTypes.map(({ key, label, titleKey, descKey, ctaKey, accentVar, icon, route }) => {
              const resolvedTitle = t(titleKey);
              const resolvedDesc = t(descKey);
              const resolvedCta = t(ctaKey);
              return (
                <div
                  key={key}
                  onClick={() => navigate(route)}
                  style={{ cursor: "pointer", display: "flex", flexDirection: "column", padding: "24px 22px", background: "var(--ap-card)" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    {icon}
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: `var(${accentVar})`, flex: "0 0 auto" }} aria-hidden="true" />
                    <span style={{ fontFamily: "var(--ap-font-body)", fontWeight: 600, fontSize: 12, letterSpacing: ".03em", textTransform: "uppercase", color: "var(--ap-muted)" }}>{label}</span>
                  </div>
                  <h3 className="ap-h3" style={{ fontSize: 17, marginBottom: 6 }}>{resolvedTitle}</h3>
                  <p style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--ap-muted)", margin: "0 0 16px", flex: "1 1 auto" }}>
                    {resolvedDesc}
                  </p>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(route); }}
                    style={{
                      background: "none", border: "none", cursor: "pointer", padding: 0, alignSelf: "flex-start",
                      fontFamily: "var(--ap-font-body)", fontWeight: 600, fontSize: 13.5, color: "var(--ap-brand)",
                      display: "inline-flex", alignItems: "center", gap: 6,
                    }}
                  >
                    {resolvedCta}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6"/>
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* ═══ COMMENT ÇA MARCHE ═══ */}
        <section style={{ padding: "24px 0 80px" }}>
          <div style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 40px" }}>
            <h2 className="ap-h2" style={{ marginBottom: 8 }}>Trois étapes, zéro friction.</h2>
            <p className="ap-muted">De la création à la partie en direct, sans détour.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                n: "1", title: "Créer", desc: "Composez un quiz, sondage, flashcard ou présentation en quelques minutes.",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--ap-brand)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                    <path d="M5 19l3.5-1L18 8.5l-2.5-2.5L6 15.5z"/><path d="M14 7l3 3"/>
                  </svg>
                ),
              },
              {
                n: "2", title: "Partager le code", desc: "Un code à 6 chiffres ou un QR code, affiché à l'écran.",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--ap-brand)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                    <rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/>
                    <rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 15h3M14 19h6M19 15v4"/>
                  </svg>
                ),
              },
              {
                n: "3", title: "Jouer", desc: "Les participants rejoignent sans compte, les scores tombent en direct.",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--ap-brand)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                    <path d="M6 4l14 8-14 8z"/>
                  </svg>
                ),
              },
            ].map((step) => (
              <div key={step.n} className="ap-card" style={{ padding: "26px 24px" }}>
                <div
                  style={{
                    width: 40, height: 40, borderRadius: "var(--ap-r-md)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "var(--ap-brand-soft)", marginBottom: 16,
                  }}
                >
                  {step.icon}
                </div>
                <h3 className="ap-h3" style={{ marginBottom: 6 }}>{step.title}</h3>
                <p className="ap-muted" style={{ fontSize: 14, lineHeight: 1.5 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ CAS D'USAGE ═══ */}
        <section style={{ padding: "0 0 80px", maxWidth: 720, margin: "0 auto" }}>
          <div style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 32px" }}>
            <h2 className="ap-h2" style={{ marginBottom: 8 }}>Fait pour votre contexte.</h2>
            <p className="ap-muted">Même outil, deux façons de l'utiliser.</p>
          </div>
          <UseCaseTabs />
        </section>

        {/* ═══ STATS ═══ */}
        <section style={{ padding: "0 0 80px" }}>
          <p className="ap-strip-label">En ce moment</p>
          <StatsBand liveVisitors={liveVisitors} />
        </section>

        {/* ═══ TÉMOIGNAGES ═══ */}
        <section style={{ padding: "0 0 80px" }}>
          <div style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 32px" }}>
            <h2 className="ap-h2" style={{ marginBottom: 8 }}>Ce qu'ils en disent.</h2>
          </div>
          <LandingTestimonials />
        </section>

        {/* ═══ CONFIANCE ═══ */}
        <section style={{ padding: "0 0 80px" }}>
          <div style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 32px" }}>
            <h2 className="ap-h2" style={{ marginBottom: 8 }}>Vos données, respectées.</h2>
          </div>
          <TrustSection />
        </section>

        {/* ═══ FAQ ═══ */}
        <section style={{ padding: "0 0 80px", maxWidth: 720, margin: "0 auto" }}>
          <div style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 32px" }}>
            <h2 className="ap-h2" style={{ marginBottom: 8 }}>Tout ce qu'il faut savoir.</h2>
          </div>
          <LandingFaq />
        </section>

        {/* ═══ JOIN BANNER ═══ */}
        <section
          id="join-banner"
          className="ap-card"
          style={{
            padding: "36px 40px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "24px",
          }}
        >
          {/* Left text */}
          <div style={{ flex: "1 1 280px" }}>
            <h2
              style={{
                fontFamily: "var(--ap-font-display)", fontWeight: 600,
                fontSize: "28px", color: "var(--ap-ink)", margin: "0 0 6px",
                letterSpacing: "-0.02em",
              }}
            >
              Une session en cours ?
            </h2>
            <p style={{ color: "var(--ap-muted)", fontFamily: "var(--ap-font-body)", fontSize: "14.5px", margin: 0 }}>
              Entrez le code à 6 chiffres affiché à l'écran et rejoignez la session.
            </p>
          </div>

          {/* Right input + button */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0",
              background: "var(--ap-paper-2)",
              border: "1px solid var(--ap-line)",
              borderRadius: "var(--ap-r-lg)",
              padding: "6px 6px 6px 18px",
              flex: "0 0 auto",
            }}
          >
            <input
              className="ap-code"
              placeholder="000000"
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && joinQuiz()}
              maxLength={6}
              style={{
                border: "none",
                boxShadow: "none",
                background: "transparent",
                padding: "8px 12px 8px 0",
                width: "140px",
                fontSize: "22px",
                fontFamily: "var(--ap-font-mono)",
                letterSpacing: "6px",
                outline: "none",
                color: "var(--ap-ink)",
              }}
            />
            <button
              className="ap-btn"
              onClick={joinQuiz}
              disabled={!gameCode.trim()}
              style={{ opacity: gameCode.trim() ? 1 : 0.5, borderRadius: "var(--ap-r-md)", alignSelf: "center" }}
            >
              Rejoindre
            </button>
          </div>

          <p style={{ marginTop: 12, fontSize: 13, color: 'var(--ap-muted)', textAlign: 'center', flex: '0 0 100%' }}>
            Vous avez un code d'examen ?{' '}
            <button
              onClick={() => navigate('/join-exam')}
              style={{ background: 'none', border: 'none', color: 'var(--ap-brand)', fontWeight: 600, cursor: 'pointer', fontSize: 13, padding: 0, textDecoration: 'underline' }}
            >
              Rejoindre un examen
            </button>
          </p>
        </section>

        {/* ═══ CTA FINALE ═══ */}
        <section className="ap-reveal" style={{ padding: "80px 0 80px", textAlign: "center" }}>
          <h2 className="ap-h2" style={{ marginBottom: 12 }}>Prêt à lancer votre première session ?</h2>
          <p className="ap-muted" style={{ marginBottom: 28 }}>Gratuit pour commencer, aucune carte bancaire requise.</p>
          <button className="ap-btn ap-btn--lg" onClick={() => navigate("/builder-start?type=quiz")} style={{ borderRadius: "var(--ap-r-md)" }}>
            Créer gratuitement
          </button>
        </section>

        <div style={{ height: 80 }} />
      </main>

      <PartnersStrip />

      <Footer />
    </div>
  );
};

export default Index;
