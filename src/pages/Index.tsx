import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Compass } from "lucide-react";
import { t } from "@/lib/i18n";

const contentTypes = [
  {
    key: "quiz",
    label: "Quiz",
    titleKey: "createQuiz" as const,
    descKey: "createQuizDesc" as const,
    ctaKey: "newQuiz" as const,
    accentVar: "--ap-quiz",
    accentDeepVar: "--ap-quiz-deep",
    badgeClass: "ap-badge ap-badge--quiz",
    btnClass: "ap-btn ap-btn--sm ap-btn--pill ap-btn--quiz",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="26" height="26">
        <path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/>
      </svg>
    ),
    route: "/builder-start?type=quiz",
  },
  {
    key: "slide",
    label: "Présentation",
    titleKey: null,
    title: "Créer une présentation",
    descKey: null,
    desc: "Créez des présentations interactives et engageantes",
    ctaKey: null,
    cta: "Nouvelle présentation",
    accentVar: "--ap-pres",
    accentDeepVar: "--ap-pres-deep",
    badgeClass: "ap-badge ap-badge--pres",
    btnClass: "ap-btn ap-btn--sm ap-btn--pill ap-btn--pres",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="26" height="26">
        <path d="M3 4h18v12H3z"/><path d="M12 16v4M8 20h8"/>
      </svg>
    ),
    route: "/builder-start?type=slide",
  },
  {
    key: "poll",
    label: "Sondage",
    titleKey: "createPoll" as const,
    descKey: "createPollDesc" as const,
    ctaKey: "newPoll" as const,
    accentVar: "--ap-poll",
    accentDeepVar: "--ap-poll-deep",
    badgeClass: "ap-badge ap-badge--poll",
    btnClass: "ap-btn ap-btn--sm ap-btn--pill ap-btn--poll",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="26" height="26">
        <path d="M5 20V10M12 20V4M19 20v-7"/>
      </svg>
    ),
    route: "/builder-start?type=poll",
  },
  {
    key: "flashcard",
    label: "Flashcard",
    titleKey: "createFlashcard" as const,
    descKey: "createFlashcardDesc" as const,
    ctaKey: "newFlashcard" as const,
    accentVar: "--ap-flash",
    accentDeepVar: "--ap-flash-deep",
    badgeClass: "ap-badge ap-badge--flash",
    btnClass: "ap-btn ap-btn--sm ap-btn--pill ap-btn--flash",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="26" height="26">
        <path d="M4 6h13v12H4z"/><path d="M8 3h13v12"/>
      </svg>
    ),
    route: "/builder-start?type=flashcard",
  },
] as const;

/* ---- Mini quiz card shown in the hero ---- */
const HeroQuizCard = () => (
  <div style={{ position: "relative" }}>
    {/* floating badge top-left */}
    <div
      className="ap-pill"
      style={{
        position: "absolute",
        top: -18,
        left: -10,
        background: "var(--ap-pres-soft)",
        border: "2px solid var(--ap-pres)",
        color: "var(--ap-pres-deep)",
        zIndex: 2,
        fontSize: "13px",
        fontWeight: 800,
      }}
    >
      <span className="ap-dot" style={{ background: "var(--ap-pres)" }} />
      +850 pts !
    </div>

    {/* card */}
    <div
      className="ap-card ap-card--floaty"
      style={{ maxWidth: 380, padding: "24px", position: "relative" }}
    >
      {/* top row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        {/* circular timer */}
        <div style={{ position: "relative", width: 52, height: 52 }}>
          <svg width="52" height="52" viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="22" fill="none" stroke="var(--ap-line)" strokeWidth="4" />
            <circle
              cx="26" cy="26" r="22"
              fill="none" stroke="var(--ap-quiz)" strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 22 * 0.4} ${2 * Math.PI * 22}`}
              strokeLinecap="round"
              transform="rotate(-90 26 26)"
            />
          </svg>
          <span style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--ap-font-display)", fontWeight: 600, fontSize: "17px", color: "var(--ap-ink)",
          }}>12</span>
        </div>
        {/* question badge */}
        <span
          className="ap-badge ap-badge--flash"
          style={{ fontSize: "12px", fontWeight: 800 }}
        >
          Question 1/8 · 100 pts
        </span>
      </div>

      {/* question */}
      <p style={{
        fontFamily: "var(--ap-font-body)", fontWeight: 800, fontSize: "17px",
        color: "var(--ap-ink)", marginBottom: "18px", lineHeight: 1.35,
      }}>
        Quel est le symbole chimique de l'or ?
      </p>

      {/* answers grid */}
      <div className="ap-answers" style={{ gap: "10px" }}>
        <button className="ap-answer ap-answer--1"><span className="ap-answer__shape">▲</span>Au</button>
        <button className="ap-answer ap-answer--2"><span className="ap-answer__shape">◆</span>Ag</button>
        <button className="ap-answer ap-answer--3"><span className="ap-answer__shape">●</span>Fe</button>
        <button className="ap-answer ap-answer--4"><span className="ap-answer__shape">■</span>Cu</button>
      </div>
    </div>

    {/* floating badge bottom-right */}
    <div
      className="ap-pill"
      style={{
        position: "absolute",
        bottom: -14,
        right: -10,
        zIndex: 2,
        fontSize: "13px",
        fontWeight: 800,
        background: "#fff",
        boxShadow: "var(--ap-shadow-card)",
      }}
    >
      <span className="ap-dot" style={{ background: "var(--ap-flash)" }} />
      Léa mène la partie
    </div>
  </div>
);

const Index = () => {
  const [gameCode, setGameCode] = useState("");
  const navigate = useNavigate();

  const joinQuiz = () => {
    if (gameCode.trim()) {
      navigate(`/join/${gameCode.toUpperCase()}`);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--ap-paper)" }}>
      <Header />

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-12">

        {/* ═══ HERO — split layout ═══ */}
        <section
          className="mb-16 flex flex-col gap-12 lg:flex-row lg:items-center lg:justify-between"
          style={{ paddingBottom: "8px" }}
        >
          {/* Left */}
          <div style={{ flex: "1 1 0", maxWidth: 560 }}>
            {/* pill badge */}
            <div
              className="ap-pill"
              style={{ marginBottom: "28px", display: "inline-flex", gap: "8px" }}
            >
              <span className="ap-dot" style={{ background: "var(--ap-quiz)" }} />
              <span className="ap-dot" style={{ background: "var(--ap-poll)" }} />
              <span className="ap-dot" style={{ background: "var(--ap-flash)" }} />
              <span className="ap-dot" style={{ background: "var(--ap-pres)" }} />
              <span style={{
                fontFamily: "var(--ap-font-display)", fontWeight: 600,
                fontSize: "12.5px", letterSpacing: "1px", textTransform: "uppercase",
                color: "var(--ap-ink)",
              }}>
                Quiz · Sondage · Présentation
              </span>
            </div>

            {/* headline */}
            <h1
              style={{
                fontFamily: "var(--ap-font-display)", fontWeight: 600,
                fontSize: "clamp(42px, 6vw, 68px)", lineHeight: 1.02,
                letterSpacing: "-1.5px", color: "var(--ap-ink)",
                marginBottom: "10px",
              }}
            >
              Mettez toute<br />
              la salle{" "}
              <span style={{ color: "var(--ap-brand)", position: "relative", display: "inline-block" }}>
                dans le jeu
                {/* yellow underline decoration */}
                <svg
                  viewBox="0 0 220 14"
                  style={{
                    position: "absolute", bottom: -6, left: 0, width: "100%",
                    height: "auto", pointerEvents: "none",
                  }}
                  preserveAspectRatio="none"
                >
                  <path
                    d="M4 9 Q55 2 110 8 Q165 14 216 5"
                    stroke="var(--ap-flash)" strokeWidth="4.5"
                    fill="none" strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>

            {/* subtitle */}
            <p
              className="ap-lead"
              style={{ marginBottom: "36px", maxWidth: 480, fontSize: "17px" }}
            >
              Quiz multijoueurs en temps réel, sondages live et présentations interactives. QR code, classement instantané et une ambiance d'arcade — sans rien perdre en puissance.
            </p>

            {/* CTAs */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", marginBottom: "36px" }}>
              <button
                className="ap-btn ap-btn--lg ap-btn--pill ap-btn--quiz"
                onClick={() => navigate("/builder-start?type=quiz")}
              >
                Créer gratuitement
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M3 9h11M9 4l5 5-5 5"/>
                </svg>
              </button>
              <button
                className="ap-btn ap-btn--lg ap-btn--ghost ap-btn--pill"
                onClick={() => navigate("/discover")}
              >
                <Compass className="h-5 w-5" style={{ color: "var(--ap-brand)" }} />
                Rejoindre une partie
              </button>
            </div>

            {/* social proof */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ display: "flex" }}>
                {["var(--ap-quiz)", "var(--ap-poll)", "var(--ap-flash)", "var(--ap-pres)"].map((c, i) => (
                  <span
                    key={i}
                    style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: `var(${c.slice(4, -1)})`,
                      border: "2px solid var(--ap-paper)",
                      marginLeft: i > 0 ? -8 : 0,
                      display: "inline-block",
                    }}
                  />
                ))}
              </div>
              <span style={{ fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: "13.5px", color: "var(--ap-muted)" }}>
                +12 000 animateurs créent des moments inoubliables
              </span>
            </div>
          </div>

          {/* Right — floating quiz card */}
          <div
            style={{ flex: "0 0 auto", display: "flex", justifyContent: "center", paddingTop: "24px", paddingBottom: "24px" }}
          >
            <HeroQuizCard />
          </div>
        </section>

        {/* ═══ Content type tiles ═══ */}
        <section className="mb-16 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {contentTypes.map(({ key, label, titleKey, title, descKey, desc, ctaKey, cta, accentVar, accentDeepVar, badgeClass, btnClass, icon, route }) => {
            const resolvedTitle = titleKey ? t(titleKey) : (title as string);
            const resolvedDesc = descKey ? t(descKey) : (desc as string);
            const resolvedCta = ctaKey ? t(ctaKey) : (cta as string);
            return (
              <div
                key={key}
                onClick={() => navigate(route)}
                className="ap-card ap-tile ap-card--hover"
                style={{ cursor: "pointer", display: "flex", flexDirection: "column" }}
              >
                <span className="ap-tile__blob" style={{ background: `var(${accentVar})` }} />
                <div
                  className="ap-tile__icon"
                  style={{
                    background: `var(${accentVar})`,
                    boxShadow: `0 5px 0 var(${accentDeepVar})`,
                  }}
                >
                  {icon}
                </div>
                <div className={badgeClass} style={{ marginBottom: "8px" }}>{label}</div>
                <h3 className="ap-h3">{resolvedTitle}</h3>
                <p className="ap-muted" style={{ fontSize: "13.5px", lineHeight: 1.45, margin: "8px 0 16px" }}>
                  {resolvedDesc}
                </p>
                <button
                  className={btnClass}
                  onClick={(e) => { e.stopPropagation(); navigate(route); }}
                  style={{ marginTop: "auto", alignSelf: "flex-start" }}
                >
                  {resolvedCta}
                </button>
              </div>
            );
          })}
        </section>

        {/* ═══ JOIN BANNER ═══ */}
        <section
          style={{
            background: "var(--ap-brand)",
            borderRadius: "var(--ap-r-xl)",
            padding: "36px 40px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "24px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* decorative blobs */}
          <span style={{
            position: "absolute", width: 200, height: 200, borderRadius: "50%",
            background: "rgba(255,255,255,0.08)", left: -60, top: -60, pointerEvents: "none",
          }} />
          <span style={{
            position: "absolute", width: 120, height: 120, borderRadius: "50%",
            background: "rgba(255,255,255,0.06)", right: 200, bottom: -40, pointerEvents: "none",
          }} />

          {/* Left text */}
          <div style={{ flex: "1 1 280px", position: "relative" }}>
            <h2
              style={{
                fontFamily: "var(--ap-font-display)", fontWeight: 600,
                fontSize: "28px", color: "#fff", margin: "0 0 6px",
                letterSpacing: "-0.5px",
              }}
            >
              Une partie en cours ?
            </h2>
            <p style={{ color: "rgba(255,255,255,0.78)", fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: "14.5px", margin: 0 }}>
              Entrez le code à 6 chiffres affiché à l'écran et rejoignez le jeu.
            </p>
          </div>

          {/* Right input + button */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0",
              background: "#fff",
              borderRadius: "var(--ap-r-xl)",
              padding: "6px 6px 6px 18px",
              boxShadow: "0 8px 0 var(--ap-brand-deep)",
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
                letterSpacing: "8px",
                outline: "none",
                color: "var(--ap-ink)",
              }}
            />
            <button
              className="ap-btn ap-btn--quiz"
              onClick={joinQuiz}
              disabled={!gameCode.trim()}
              style={{ opacity: gameCode.trim() ? 1 : 0.5, borderRadius: "var(--ap-r-lg)", boxShadow: "none", alignSelf: "center" }}
            >
              Rejoindre
            </button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
