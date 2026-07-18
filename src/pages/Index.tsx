import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { useLanguage } from "@/hooks/useLanguage";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { HeroMiniQuiz } from "@/components/HeroMiniQuiz";
import { PartnersStrip } from "@/components/PartnersStrip";
import { t } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        if (reduced) { setValue(target); return; }
        const t0 = performance.now();
        const tick = (now: number) => {
          const k = Math.min(1, (now - t0) / duration);
          const ease = 1 - Math.pow(1 - k, 3);
          setValue(Math.round(target * ease));
          if (k < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);
  return { ref, value };
}

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
    label: t("presLabel"),
    titleKey: "createPres" as const,
    descKey: "createPresDesc" as const,
    ctaKey: "newPres" as const,
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


function LeaderboardTile() {
  const c1 = useCountUp(2450);
  const c2 = useCountUp(2310);
  const c3 = useCountUp(2180);
  return (
    <div className="ap-card ap-card--hover ap-reveal d6" style={{ boxShadow: "0 5px 0 var(--ap-line)" }}>
      <h3 className="ap-h3" style={{ marginBottom: 4 }}>Classement en direct</h3>
      <p style={{ fontSize: 14, color: "var(--ap-muted)", marginBottom: 18 }}>Les scores tombent en temps réel, la tension monte.</p>
      <div>
        <div className="ap-lb-row ap-lb-row--first">
          <span className="ap-lb-row__rank">🥇</span>
          <span className="ap-lb-row__who"><span className="ap-lb-row__av">🦊</span>Camille</span>
          <span className="ap-lb-row__up">▲ 2</span>
          <span ref={c1.ref} className="ap-lb-row__pts ap-mono">{c1.value.toLocaleString("fr-FR")}</span>
        </div>
        <div className="ap-lb-row">
          <span className="ap-lb-row__rank">2</span>
          <span className="ap-lb-row__who"><span className="ap-lb-row__av">🐙</span>Mehdi</span>
          <span ref={c2.ref} className="ap-lb-row__pts ap-mono">{c2.value.toLocaleString("fr-FR")}</span>
        </div>
        <div className="ap-lb-row" style={{ marginBottom: 0 }}>
          <span className="ap-lb-row__rank">3</span>
          <span className="ap-lb-row__who"><span className="ap-lb-row__av">🦉</span>Inès</span>
          <span ref={c3.ref} className="ap-lb-row__pts ap-mono">{c3.value.toLocaleString("fr-FR")}</span>
        </div>
      </div>
    </div>
  );
}

function useLiveVisitors() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const channel = supabase.channel("live-visitors", {
      config: { presence: { key: crypto.randomUUID() } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });
    return () => { void supabase.removeChannel(channel); };
  }, []);
  return count;
}

const Index = () => {
  const [gameCode, setGameCode] = useState("");
  const navigate = useNavigate();
  const liveVisitors = useLiveVisitors();
  useLanguage();
  useSEO({ path: "/" });

  const joinQuiz = () => {
    if (gameCode.trim()) {
      navigate(`/join/${gameCode.toUpperCase()}`);
    }
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <Header />

      <main style={{ maxWidth: 1160, margin: "0 auto", padding: "0 24px" }}>

        {/* ═══ HERO ═══ */}
        <section style={{
          display: "grid",
          gridTemplateColumns: "1.05fr .95fr",
          gap: 56,
          alignItems: "center",
          padding: "56px 0 72px",
        }} className="hero-grid">

          {/* Left */}
          <div>
            {/* Eyebrow */}
            <div className="ap-eyebrow ap-reveal d2" style={{ marginBottom: 22 }}>
              <span className="ap-eyebrow__dot" aria-hidden="true" />
              2 314 sessions en direct cette semaine
            </div>

            {/* H1 */}
            <h1
              className="ap-reveal d3"
              style={{
                fontFamily: "var(--ap-font-display)", fontWeight: 600,
                fontSize: "clamp(36px, 4.6vw, 56px)", lineHeight: 1.08,
                letterSpacing: "-.015em", color: "var(--ap-ink)",
                marginBottom: 20,
              }}
            >
              Vos formations méritent mieux que des slides{" "}
              <span style={{ position: "relative", whiteSpace: "nowrap", color: "var(--ap-brand)" }}>
                qui dorment
                <svg
                  viewBox="0 0 100 12"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  style={{ position: "absolute", left: 0, bottom: -6, width: "100%", height: 12, overflow: "visible" }}
                >
                  <path
                    d="M2 9 Q 25 3, 50 8 T 98 6"
                    fill="none" stroke="var(--ap-flash)" strokeWidth="5" strokeLinecap="round"
                    strokeDasharray="240" strokeDashoffset="240"
                    style={{ animation: "ap-draw-line .7s var(--ap-ease) .9s forwards" }}
                  />
                </svg>
              </span>
            </h1>

            {/* Lede */}
            <p
              className="ap-reveal d4"
              style={{
                fontFamily: "var(--ap-font-body)", fontSize: 18, color: "var(--ap-muted)",
                maxWidth: "46ch", marginBottom: 30, lineHeight: 1.55,
              }}
            >
              Quiz, sondages, flashcards et présentations interactives dans un seul outil. Vos participants rejoignent en{" "}
              <strong style={{ color: "var(--ap-ink)", fontWeight: 700 }}>un scan de QR code</strong>, sans compte, sans installation.
            </p>

            {/* CTAs */}
            <div className="ap-reveal d5" style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 34 }}>
              <button
                className="ap-btn ap-btn--pill ap-btn--lg"
                onClick={() => navigate("/builder-start?type=quiz")}
              >
                Créer gratuitement
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6"/>
                </svg>
              </button>
              <button
                className="ap-btn ap-btn--pill ap-btn--lg ap-btn--ghost"
                onClick={() => document.getElementById("join-banner")?.scrollIntoView({ behavior: "smooth" })}
              >
                Rejoindre une partie
              </button>
            </div>

            {/* Social proof */}
            <div className="ap-reveal d6" style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ display: "flex" }} aria-hidden="true">
                {["🦊", "🐸", "🦉", "🐙"].map((emoji, i) => (
                  <span key={i} style={{
                    width: 34, height: 34, borderRadius: "50%",
                    border: "3px solid var(--ap-paper)",
                    display: "grid", placeItems: "center", fontSize: 15,
                    marginLeft: i > 0 ? -10 : 0,
                    background: "var(--ap-card)",
                    boxShadow: "0 2px 0 var(--ap-line)",
                  }}>{emoji}</span>
                ))}
              </div>
              <small style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ap-muted)", fontFamily: "var(--ap-font-body)" }}>
                <b style={{ color: "var(--ap-ink)", fontWeight: 800 }}>4,9/5</b> par 1 200+ formateurs et enseignants
              </small>
            </div>
          </div>

          {/* Right — stage */}
          <div className="ap-reveal d4" style={{ position: "relative", paddingTop: 24, paddingBottom: 24 }}>
            {/* Live visitors pill */}
            <div
              className="ap-float-pill"
              style={{
                bottom: 8, right: -10,
                color: "var(--ap-quiz-deep)", borderColor: "var(--ap-quiz)",
                background: "var(--ap-quiz-soft)", animationDelay: "1.2s",
              }}
              aria-hidden="true"
            >
              🔴 {liveVisitors != null ? `${liveVisitors} visiteur${liveVisitors !== 1 ? "s" : ""}` : "…"} en direct
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <HeroMiniQuiz />
            </div>
          </div>
        </section>

        {/* ═══ STRIP — preuve produit ═══ */}
        <section style={{ paddingBottom: 80 }}>
          <p className="ap-strip-label ap-reveal d5">Les objets du jeu, même système partout</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }} className="strip-grid">

            {/* Tile 1 — Code PIN */}
            <div className="ap-card ap-card--hover ap-reveal d5" style={{ boxShadow: "0 5px 0 var(--ap-line)" }}>
              <h3 className="ap-h3" style={{ marginBottom: 4 }}>Rejoindre en 5 secondes</h3>
              <p style={{ fontSize: 14, color: "var(--ap-muted)", marginBottom: 18 }}>Un code, un QR, jamais de compte pour les participants.</p>
              <div className="ap-pin" aria-label="Code de partie 48 29 17">
                48<span className="ap-pin__accent">29</span>17
              </div>
            </div>

            {/* Tile 2 — Leaderboard */}
            <LeaderboardTile />

            {/* Tile 3 — Type badges */}
            <div className="ap-card ap-card--hover ap-reveal d6" style={{ boxShadow: "0 5px 0 var(--ap-line)" }}>
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

        {/* ═══ Content type tiles ═══ */}
        <section className="mb-16 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {contentTypes.map(({ key, label, titleKey, descKey, ctaKey, accentVar, accentDeepVar, badgeClass, btnClass, icon, route }) => {
            const resolvedTitle = t(titleKey);
            const resolvedDesc = t(descKey);
            const resolvedCta = t(ctaKey);
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
          id="join-banner"
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

        <div style={{ height: 80 }} />
      </main>

      <PartnersStrip />

      <Footer />
    </div>
  );
};

export default Index;
