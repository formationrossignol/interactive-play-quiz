import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Compass, QrCode } from "lucide-react";
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
        {/* Hero */}
        <section
          className="mb-16 text-center px-8 py-14 relative overflow-hidden"
          style={{
            background: "var(--ap-brand-soft)",
            border: "2px solid var(--ap-line)",
            borderRadius: "var(--ap-r-xl)",
            boxShadow: "var(--ap-shadow-soft)",
          }}
        >
          {/* decorative blobs */}
          <span
            className="ap-confetti"
            style={{ width: 180, height: 180, background: "var(--ap-brand)", opacity: 0.06, right: -40, top: -40 }}
          />
          <span
            className="ap-confetti"
            style={{ width: 120, height: 120, background: "var(--ap-quiz)", opacity: 0.08, left: -30, bottom: -30 }}
          />

          <span
            className="ap-badge ap-badge--brand"
            style={{ marginBottom: "24px", display: "inline-flex" }}
          >
            {t("heroInteractive")}
          </span>

          <h1 className="ap-h1 mb-4" style={{ fontSize: "clamp(32px,5vw,56px)" }}>
            {t("heroTitle")}{" "}
            <span style={{ color: "var(--ap-brand)" }}>{t("heroInteractive")}</span>{" "}
            {t("heroQuizzes")}
          </h1>

          <p
            className="ap-lead mx-auto mb-10"
            style={{ maxWidth: "540px" }}
          >
            {t("heroDescription")}
          </p>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              className="ap-btn ap-btn--lg"
              onClick={() => navigate("/builder-start?type=quiz")}
            >
              {t("newQuiz")}
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
                <path d="M3 9h11M9 4l5 5-5 5"/>
              </svg>
            </button>
            <button
              className="ap-btn ap-btn--ghost ap-btn--lg"
              onClick={() => navigate("/discover")}
            >
              <Compass className="h-5 w-5" style={{ color: "var(--ap-brand)" }} />
              {t("discoverPublic")}
            </button>
          </div>
        </section>

        {/* Content type tiles */}
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
                style={{ cursor: "pointer" }}
              >
                <span
                  className="ap-tile__blob"
                  style={{ background: `var(${accentVar})` }}
                />
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
                <p
                  className="ap-muted"
                  style={{ fontSize: "13.5px", lineHeight: 1.45, margin: "8px 0 16px" }}
                >
                  {resolvedDesc}
                </p>
                <button
                  className={btnClass}
                  onClick={(e) => { e.stopPropagation(); navigate(route); }}
                >
                  {resolvedCta}
                </button>
              </div>
            );
          })}
        </section>

        {/* Join section */}
        <section className="mx-auto max-w-lg">
          <div className="ap-card ap-card--floaty">
            <div className="ap-row ap-gap-12" style={{ marginBottom: "20px" }}>
              <div
                className="ap-tile__icon"
                style={{
                  background: "var(--ap-brand)",
                  boxShadow: "0 5px 0 var(--ap-brand-deep)",
                  width: 46,
                  height: 46,
                  borderRadius: "var(--ap-r-md)",
                  flexShrink: 0,
                }}
              >
                <QrCode className="h-5 w-5" color="#fff" />
              </div>
              <div>
                <h3 className="ap-h3">{t("joinTitle")}</h3>
                <p className="ap-muted" style={{ fontSize: "14px", marginTop: "2px" }}>{t("joinDesc")}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <input
                className="ap-code flex-1"
                placeholder={t("enterCode")}
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && joinQuiz()}
                maxLength={6}
                style={{ minWidth: 0 }}
              />
              <button
                className="ap-btn"
                onClick={joinQuiz}
                disabled={!gameCode.trim()}
                style={{ opacity: gameCode.trim() ? 1 : 0.4, cursor: gameCode.trim() ? "pointer" : "not-allowed" }}
              >
                {t("join")}
              </button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
