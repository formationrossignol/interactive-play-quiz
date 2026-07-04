import { useState, useEffect, useRef, useCallback } from "react";

const QUESTIONS = [
  {
    q: "Quelle planète est la plus grande du système solaire ?",
    answers: ["Saturne", "Jupiter", "Neptune", "Uranus"],
    correct: 1,
    emoji: "🪐",
  },
  {
    q: "Dans quel pays a été inventé le WiFi ?",
    answers: ["USA", "Japon", "Finlande", "Australie"],
    correct: 3,
    emoji: "📶",
  },
  {
    q: "Quel animal terrestre court le plus vite ?",
    answers: ["Lion", "Guépard", "Faucon", "Éléphant"],
    correct: 1,
    emoji: "🐆",
  },
];

const SHAPES = [
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" key="tri"><path d="M8 2 L15 14 H1 Z"/></svg>,
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" key="circle"><circle cx="8" cy="8" r="7"/></svg>,
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" key="sq"><rect x="1" y="1" width="14" height="14" rx="2"/></svg>,
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" key="dia"><path d="M8 1 L15 8 L8 15 L1 8 Z"/></svg>,
];

const SHAPE_COLORS = ["var(--ap-quiz)", "var(--ap-poll)", "var(--ap-pres)", "var(--ap-flash)"];
const SHAPE_SOFT   = ["var(--ap-quiz-soft)", "var(--ap-poll-soft)", "var(--ap-pres-soft)", "var(--ap-flash-soft)"];
const SHAPE_DEEP   = ["var(--ap-quiz-deep)", "var(--ap-poll-deep)", "var(--ap-pres-deep)", "var(--ap-flash-deep)"];

const TIMER_SECONDS = 10;

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
    el.style.cssText = `
      left: 50%; top: 50%;
      width: ${p.size}px; height: ${p.size}px;
      background: ${p.color};
      --cx: ${p.x}px; --cy: ${p.y}px; --cr: ${p.r}deg;
    `;
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
    const startTime = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
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
  const [phase, setPhase] = useState<"question" | "feedback" | "done">("question");
  const [shakingIndex, setShakingIndex] = useState<number | null>(null);
  const [pillBonus, setPillBonus] = useState<number | null>(null);
  const [pillKey, setPillKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animatedScore = useAnimatedNumber(score);

  const q = QUESTIONS[qIndex];

  const advance = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (qIndex + 1 < QUESTIONS.length) {
      setTimeout(() => {
        setQIndex((i) => i + 1);
        setSelected(null);
        setRevealed(false);
        setTimeLeft(TIMER_SECONDS);
        setPhase("question");
      }, 1400);
    } else {
      setTimeout(() => setPhase("done"), 1400);
    }
  }, [qIndex]);

  const pick = useCallback((i: number) => {
    if (revealed) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setSelected(i);
    setRevealed(true);
    setPhase("feedback");
    if (i === q.correct) {
      const bonus = Math.round((timeLeft / TIMER_SECONDS) * 1000);
      setScore((s) => s + bonus);
      setPillBonus(bonus);
      setPillKey((k) => k + 1);
      setTimeout(() => setPillBonus(null), 2000);
      if (containerRef.current) spawnConfetti(containerRef.current);
    } else {
      setShakingIndex(i);
      setTimeout(() => setShakingIndex(null), 500);
    }
    advance();
  }, [revealed, q.correct, timeLeft, advance]);

  useEffect(() => {
    if (phase !== "question") return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          setRevealed(true);
          setPhase("feedback");
          advance();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, qIndex, advance]);

  const restart = () => {
    setQIndex(0); setSelected(null); setRevealed(false);
    setScore(0); setTimeLeft(TIMER_SECONDS); setPhase("question");
  };

  const timerPct = (timeLeft / TIMER_SECONDS) * 100;

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 380,
        background: "var(--ap-card)",
        borderRadius: "var(--ap-r-xl)",
        boxShadow: "var(--ap-shadow-card)",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* Score pill — pops on correct answer */}
      {pillBonus !== null && (
        <div
          key={pillKey}
          className="ap-score-pill"
          style={{ top: "56px", left: "50%" }}
        >
          +{pillBonus} pts
        </div>
      )}

      {/* Header */}
      <div style={{ background: "var(--ap-brand)", padding: "14px 20px 0", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontFamily: "var(--ap-font-display)", fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,.8)" }}>
              Q{qIndex + 1}/{QUESTIONS.length}
            </span>
          </div>
          <div style={{
            fontFamily: "var(--ap-font-display)",
            fontSize: "15px", fontWeight: 700,
            color: "#fff",
            display: "flex", alignItems: "center", gap: "6px",
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="white"><polygon points="8,1 10,6 16,6 11,10 13,15 8,12 3,15 5,10 0,6 6,6"/></svg>
            <span className="ap-mono">{animatedScore}</span>
          </div>
        </div>

        {/* Timer bar */}
        <div style={{ height: "4px", background: "rgba(255,255,255,.2)", borderRadius: "4px", overflow: "hidden", marginBottom: "2px" }}>
          <div
            style={{
              height: "100%",
              width: `${timerPct}%`,
              background: timeLeft <= 3 ? "var(--ap-quiz)" : "rgba(255,255,255,.9)",
              borderRadius: "4px",
              transition: "width 1s linear, background .3s",
            }}
          />
        </div>
        <div style={{ height: "8px" }} />
      </div>

      {/* Question */}
      <div style={{ padding: "20px 20px 16px" }}>
        {phase === "done" ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div style={{ fontSize: "36px", marginBottom: "8px" }}>🎉</div>
            <p style={{ fontFamily: "var(--ap-font-display)", fontSize: "20px", fontWeight: 600, color: "var(--ap-ink)", marginBottom: "4px" }}>
              Score final
            </p>
            <p style={{ fontFamily: "var(--ap-font-display)", fontSize: "36px", fontWeight: 700, color: "var(--ap-brand)", marginBottom: "16px" }} className="ap-mono">
              {score}
            </p>
            <button
              className="ap-btn ap-btn--pill"
              style={{ fontSize: "14px", padding: "10px 22px" }}
              onClick={restart}
            >
              Recommencer
            </button>
          </div>
        ) : (
          <>
            <p style={{
              fontFamily: "var(--ap-font-display)",
              fontSize: "16px", fontWeight: 600,
              color: "var(--ap-ink)",
              lineHeight: 1.35,
              marginBottom: "16px",
              minHeight: "48px",
            }}>
              {q.emoji} {q.q}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {q.answers.map((a, i) => {
                const isSelected = selected === i;
                const isCorrect = i === q.correct;
                const showResult = revealed;
                let bg = "var(--ap-card)";
                let border = "2px solid var(--ap-line)";
                let shadow = "0 3px 0 var(--ap-line)";
                let textColor = "var(--ap-ink)";
                if (showResult) {
                  if (isCorrect) { bg = "var(--ap-pres-soft)"; border = `2px solid var(--ap-pres)`; shadow = `0 3px 0 var(--ap-pres-deep)`; }
                  else if (isSelected) { bg = "var(--ap-quiz-soft)"; border = `2px solid var(--ap-quiz)`; shadow = `0 3px 0 var(--ap-quiz-deep)`; }
                  else { bg = "var(--ap-paper)"; textColor = "var(--ap-muted)"; border = "2px solid var(--ap-line)"; shadow = "0 2px 0 var(--ap-line)"; }
                }
                return (
                  <button
                    key={i}
                    onClick={() => pick(i)}
                    disabled={revealed}
                    className={shakingIndex === i ? "ap-answer--wrong" : ""}
                    style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      padding: "10px 12px", borderRadius: "var(--ap-r-sm)",
                      background: bg, border, boxShadow: shadow,
                      color: textColor,
                      fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: "13px",
                      cursor: revealed ? "default" : "pointer",
                      textAlign: "left",
                      transition: "background .15s, border-color .15s, box-shadow .15s, transform .1s var(--ap-spring)",
                      transform: (showResult && isCorrect) ? "translateY(-1px) scale(1.02)" : "none",
                    }}
                  >
                    <span style={{
                      width: "28px", height: "28px", borderRadius: "8px", flexShrink: 0,
                      background: showResult ? (isCorrect ? "var(--ap-pres)" : isSelected ? "var(--ap-quiz)" : SHAPE_COLORS[i]) : SHAPE_COLORS[i],
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff",
                      transition: "background .2s",
                    }}>
                      {SHAPES[i]}
                    </span>
                    <span style={{ flex: 1, lineHeight: 1.3 }}>{a}</span>
                    {showResult && isCorrect && <span style={{ fontSize: "14px" }}>✓</span>}
                    {showResult && isSelected && !isCorrect && <span style={{ fontSize: "14px" }}>✗</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      {phase !== "done" && (
        <div style={{
          padding: "10px 20px 14px",
          borderTop: "1px solid var(--ap-line)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontFamily: "var(--ap-font-body)", fontSize: "12px", color: "var(--ap-muted)", fontWeight: 600 }}>
            Essaie ! C'est vrai QuizMaster.
          </span>
          <span
            className="ap-mono"
            style={{
              fontFamily: "var(--ap-font-display)", fontSize: "13px", fontWeight: 700,
              color: timeLeft <= 3 ? "var(--ap-quiz)" : "var(--ap-muted)",
              transition: "color .3s",
            }}
          >
            {timeLeft}s
          </span>
        </div>
      )}
    </div>
  );
}
