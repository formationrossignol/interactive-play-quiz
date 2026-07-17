import { useState, useEffect, useRef, useCallback } from "react";

const ALL_QUESTIONS = [
  {
    q: "Quel océan est le plus profond ?",
    answers: ["Atlantique", "Pacifique", "Indien", "Arctique"],
    correct: 1,
    hint: "C'était le Pacifique : fosse des Mariannes, -10 984 m. ✓",
  },
  {
    q: "Dans quel pays a été inventé le WiFi ?",
    answers: ["USA", "Japon", "Finlande", "Australie"],
    correct: 3,
    hint: "C'était l'Australie (CSIRO, 1992). ✓",
  },
  {
    q: "Quel animal terrestre court le plus vite ?",
    answers: ["Lion", "Guépard", "Faucon", "Éléphant"],
    correct: 1,
    hint: "C'était le guépard, jusqu'à 112 km/h. ✓",
  },
  {
    q: "Combien de planètes dans le système solaire ?",
    answers: ["7", "8", "9", "10"],
    correct: 1,
    hint: "C'était 8, Pluton est naine depuis 2006. ✓",
  },
  {
    q: "Quelle langue est la plus parlée au monde ?",
    answers: ["Anglais", "Espagnol", "Hindi", "Mandarin"],
    correct: 3,
    hint: "C'était le mandarin, 1,1 milliard de locuteurs natifs. ✓",
  },
  {
    q: "Quelle est la capitale de l'Australie ?",
    answers: ["Sydney", "Melbourne", "Canberra", "Brisbane"],
    correct: 2,
    hint: "C'était Canberra, pas Sydney ! ✓",
  },
  {
    q: "En quelle année a eu lieu la Révolution française ?",
    answers: ["1776", "1789", "1799", "1815"],
    correct: 1,
    hint: "C'était 1789, prise de la Bastille. ✓",
  },
  {
    q: "Quel élément chimique a pour symbole Au ?",
    answers: ["Argent", "Aluminium", "Or", "Cuivre"],
    correct: 2,
    hint: "C'était l'Or, du latin Aurum. ✓",
  },
  {
    q: "Combien d'os y a-t-il dans le corps humain adulte ?",
    answers: ["186", "206", "226", "256"],
    correct: 1,
    hint: "C'était 206, on en naît avec plus de 300 ! ✓",
  },
  {
    q: "Quel pays a la plus grande superficie du monde ?",
    answers: ["Canada", "USA", "Chine", "Russie"],
    correct: 3,
    hint: "C'était la Russie, 17,1 millions de km². ✓",
  },
];

function pickQuestions(n = 3): typeof ALL_QUESTIONS {
  const shuffled = [...ALL_QUESTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

const QUESTIONS = pickQuestions(3);

const SHAPES = [
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" key="tri"><path d="M12 3 22 21H2z"/></svg>,
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" key="sq"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>,
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" key="circ"><circle cx="12" cy="12" r="9"/></svg>,
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" key="dia"><path d="M12 2 22 12 12 22 2 12z"/></svg>,
];

const SHAPE_COLORS = ["var(--ap-quiz)", "var(--ap-poll)", "var(--ap-flash)", "var(--ap-pres)"];

const TIMER_SECONDS = 15;
const CIRC = 2 * Math.PI * 24; // r=24 → ≈ 150.8

type Piece = { id: number; x: number; y: number; r: number; color: string; size: number };

function spawnConfetti(container: HTMLElement) {
  const colors = ["#7048ff", "#ff5a4d", "#2f7bff", "#ffb020", "#15c08a"];
  const pieces: Piece[] = Array.from({ length: 22 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 220,
    y: -(40 + Math.random() * 100),
    r: Math.random() * 360,
    color: colors[i % colors.length],
    size: 6 + Math.random() * 7,
  }));
  pieces.forEach((p) => {
    const el = document.createElement("div");
    el.className = "ap-confetti-piece";
    el.style.cssText = `left:50%;top:50%;width:${p.size}px;height:${p.size}px;background:${p.color};--cx:${p.x}px;--cy:${p.y}px;--cr:${p.r}deg;`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 750);
  });
}

function useAnimatedNumber(target: number, duration = 500) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const start = prev.current;
    prev.current = target;
    if (start === target) return;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - t0) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(start + (target - start) * ease));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return display;
}

export function HeroMiniQuiz() {
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [done, setDone] = useState(false);
  const [shakingIndex, setShakingIndex] = useState<number | null>(null);
  const [pillBonus, setPillBonus] = useState<number | null>(null);
  const [pillKey, setPillKey] = useState(0);
  const [hintText, setHintText] = useState("Cliquez sur une réponse, c'est une vraie démo.");
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animatedScore = useAnimatedNumber(score);

  const q = QUESTIONS[qIndex];
  const timerOffset = CIRC * (1 - timeLeft / TIMER_SECONDS);
  const isHot = timeLeft <= 5;

  const advance = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (qIndex + 1 < QUESTIONS.length) {
      setTimeout(() => {
        setQIndex((i) => i + 1);
        setSelected(null);
        setRevealed(false);
        setTimeLeft(TIMER_SECONDS);
        setHintText("Cliquez sur une réponse, c'est une vraie démo.");
      }, 1600);
    } else {
      setTimeout(() => setDone(true), 1600);
    }
  }, [qIndex]);

  const pick = useCallback((i: number) => {
    if (revealed) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setSelected(i);
    setRevealed(true);
    if (i === q.correct) {
      const bonus = Math.max(100, Math.round((timeLeft / TIMER_SECONDS) * 1000));
      setScore((s) => s + bonus);
      setPillBonus(bonus);
      setPillKey((k) => k + 1);
      setTimeout(() => setPillBonus(null), 2200);
      setHintText(q.hint);
      if (containerRef.current) spawnConfetti(containerRef.current);
    } else {
      setShakingIndex(i);
      setTimeout(() => setShakingIndex(null), 500);
      setHintText(`Presque ! ${q.hint}`);
    }
    advance();
  }, [revealed, q, timeLeft, advance]);

  useEffect(() => {
    if (revealed || done) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          setRevealed(true);
          setHintText(`Temps écoulé. ${q.hint}`);
          advance();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [revealed, done, qIndex, q.hint, advance]);

  const restart = () => {
    setQIndex(0); setSelected(null); setRevealed(false);
    setScore(0); setTimeLeft(TIMER_SECONDS); setDone(false);
    setHintText("Cliquez sur une réponse, c'est une vraie démo.");
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 400,
        background: "var(--ap-card)",
        border: "var(--ap-border-w) solid var(--ap-line)",
        borderRadius: "var(--ap-r-lg)",
        padding: 26,
        boxShadow: "0 6px 0 var(--ap-line), 0 34px 60px rgba(60,40,120,.13)",
        userSelect: "none",
      }}
      role="group"
      aria-label="Démo interactive : essayez une question"
    >
      {/* Score pill */}
      {pillBonus !== null && (
        <div key={pillKey} className="ap-score-pill" style={{ top: 60, left: "50%" }}>
          +{pillBonus} pts
        </div>
      )}

      {done ? (
        /* ── Done screen ── */
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div>
          <p style={{ fontFamily: "var(--ap-font-display)", fontSize: 18, fontWeight: 600, color: "var(--ap-muted)", marginBottom: 4 }}>
            Score final
          </p>
          <p className="ap-mono" style={{ fontFamily: "var(--ap-font-display)", fontSize: 44, fontWeight: 700, color: "var(--ap-brand)", marginBottom: 20 }}>
            {animatedScore}
          </p>
          <button
            className="ap-btn ap-btn--pill"
            style={{ fontSize: 14, padding: "10px 24px" }}
            onClick={restart}
          >
            Rejouer ↺
          </button>
        </div>
      ) : (
        <>
          {/* ── Top row: circular timer + badge ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            {/* Circular timer */}
            <div style={{ position: "relative", width: 56, height: 56 }} aria-hidden="true">
              <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: "rotate(-90deg)" }}>
                <circle
                  cx="28" cy="28" r="24"
                  fill="none" stroke="var(--ap-line)" strokeWidth="5"
                />
                <circle
                  cx="28" cy="28" r="24"
                  fill="none"
                  stroke={isHot ? "var(--ap-quiz)" : "var(--ap-brand)"}
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  strokeDashoffset={timerOffset}
                  style={{ transition: "stroke-dashoffset 1s linear, stroke .3s" }}
                />
              </svg>
              <span style={{
                position: "absolute", inset: 0, display: "grid", placeItems: "center",
                fontFamily: "var(--ap-font-display)", fontWeight: 600, fontSize: 19,
                fontVariantNumeric: "tabular-nums",
                color: isHot ? "var(--ap-quiz)" : "var(--ap-ink)",
                transition: "color .3s",
              }}>
                {timeLeft}
              </span>
            </div>

            {/* Question badge */}
            <span className="ap-badge ap-badge--flash" style={{ fontSize: 12.5, fontWeight: 800 }}>
              Q{qIndex + 1}/{QUESTIONS.length} · {animatedScore} pts
            </span>
          </div>

          {/* ── Question ── */}
          <h2 style={{
            fontFamily: "var(--ap-font-body)", fontWeight: 800, fontSize: 19,
            lineHeight: 1.35, color: "var(--ap-ink)", marginBottom: 18,
          }}>
            {q.q}
          </h2>

          {/* ── Answers ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {q.answers.map((a, i) => {
              const isSelected = selected === i;
              const isCorrect = i === q.correct;
              let bg = "var(--ap-card)";
              let border = "var(--ap-border-w) solid var(--ap-line)";
              let shadow = "var(--ap-shadow-soft)";
              let color = "var(--ap-ink)";
              let shapeBg = SHAPE_COLORS[i];
              if (revealed) {
                if (isCorrect) {
                  bg = "var(--ap-pres-deep)"; border = "2px solid var(--ap-pres-deep)";
                  shadow = "0 4px 0 #076346"; color = "#fff"; shapeBg = "rgba(255,255,255,.22)";
                } else if (isSelected) {
                  bg = "var(--ap-paper-2)"; border = "var(--ap-border-w) solid var(--ap-line)";
                  shadow = "var(--ap-shadow-soft)"; color = "var(--ap-muted)"; shapeBg = "var(--ap-line-2)";
                } else {
                  bg = "var(--ap-paper-2)"; border = "var(--ap-border-w) solid var(--ap-line)";
                  shadow = "var(--ap-shadow-soft)"; color = "var(--ap-muted)"; shapeBg = "var(--ap-line-2)";
                }
              }
              return (
                <button
                  key={i}
                  onClick={() => pick(i)}
                  disabled={revealed}
                  className={[
                    revealed && isCorrect ? "ap-answer--correct" : "",
                    shakingIndex === i ? "ap-answer--wrong" : "",
                    revealed && !isCorrect && !isSelected ? "ap-answer--dim" : "",
                  ].filter(Boolean).join(" ")}
                  style={{
                    display: "flex", alignItems: "center", gap: 11, textAlign: "left",
                    fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: 15,
                    color,
                    background: bg, border, borderRadius: "var(--ap-r-md)",
                    padding: "12px 14px",
                    boxShadow: shadow,
                    cursor: revealed ? "default" : "pointer",
                    transition: "transform .15s var(--ap-spring), box-shadow .15s var(--ap-spring), border-color .15s, background .25s, color .25s",
                  }}
                >
                  <span style={{
                    flexShrink: 0, width: 34, height: 34, borderRadius: 10,
                    display: "grid", placeItems: "center",
                    background: shapeBg, color: "#fff",
                    transition: "background .25s",
                  }}>
                    {SHAPES[i]}
                  </span>
                  <span style={{ flex: 1, lineHeight: 1.3 }}>{a}</span>
                </button>
              );
            })}
          </div>

          {/* ── Hint row ── */}
          <div style={{
            marginTop: 16, fontSize: 13.5, fontWeight: 700, color: "var(--ap-muted)",
            display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 24,
            fontFamily: "var(--ap-font-body)",
          }}>
            <span>{hintText}</span>
            <button
              onClick={restart}
              style={{
                fontWeight: 800, color: "var(--ap-brand-deep)", background: "none", border: "none",
                cursor: "pointer", fontSize: 13.5, fontFamily: "inherit",
                borderBottom: "2px solid var(--ap-brand)", paddingBottom: 1,
                opacity: revealed ? 1 : 0,
                pointerEvents: revealed ? "auto" : "none",
                transition: "opacity .3s",
                whiteSpace: "nowrap", marginLeft: 12, flexShrink: 0,
              }}
            >
              Rejouer ↺
            </button>
          </div>
        </>
      )}
    </div>
  );
}
