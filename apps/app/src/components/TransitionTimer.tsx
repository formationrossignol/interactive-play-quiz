import { useEffect, useRef, useState } from "react";

/* Shared visual language for every "time between questions" screen.
   Host (TransitionTimer) and players (PlayerView) render the same ring,
   with the same color thresholds as CircularTimer (green → amber → red). */

interface TransitionCountdownProps {
  timeLeft: number;
  total: number;
  badge?: string;
  title?: string;
  subtitle?: string;
}

export const TransitionCountdown = ({
  timeLeft,
  total,
  badge,
  title = "Prochaine question…",
  subtitle = "Préparez-vous !",
}: TransitionCountdownProps) => {
  const percentage = total > 0 ? (timeLeft / total) * 100 : 0;
  const arcColor = percentage > 60 ? "#15c08a" : percentage > 30 ? "#ffb020" : "#ff5a4d";
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="text-center">
      {badge && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12.5,
            fontWeight: 800,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.85)",
            background: "rgba(255,255,255,0.12)",
            border: "2px solid rgba(255,255,255,0.25)",
            padding: "6px 15px",
            borderRadius: 999,
            marginBottom: 22,
            fontFamily: "var(--ap-font-body)",
          }}
        >
          {badge}
        </span>
      )}

      <h1
        className="ap-h2 text-white"
        style={{ textShadow: "0 2px 8px rgba(0,0,0,0.25)", marginBottom: 34 }}
      >
        {title}
      </h1>

      <div className="relative inline-flex items-center justify-center mb-7">
        <svg
          className="transform -rotate-90"
          width="220"
          height="220"
          style={{ filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.25))" }}
        >
          <circle
            cx="110"
            cy="110"
            r={radius}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="14"
            fill="rgba(0,0,0,0.18)"
          />
          <circle
            cx="110"
            cy="110"
            r={radius}
            stroke={arcColor}
            strokeWidth="14"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-7xl font-bold"
            style={{
              fontFamily: "var(--ap-font-display)",
              color: "#fff",
              textShadow: "0 2px 12px rgba(0,0,0,0.3)",
            }}
          >
            {timeLeft}
          </span>
        </div>
      </div>

      <p
        style={{
          color: "rgba(255,255,255,0.75)",
          fontFamily: "var(--ap-font-body)",
          fontWeight: 700,
          fontSize: "16px",
        }}
      >
        {subtitle}
      </p>
    </div>
  );
};

/* Fullscreen 3-2-1-GO splash, shared by host (overlay) and players (screen).
   Same cadence on both sides: 3 × 900 ms + 800 ms on "GO !". */

export const COUNTDOWN_TOTAL_MS = 3 * 900 + 800;

export const CountdownSplash = ({ fixed = false }: { fixed?: boolean }) => {
  const [num, setNum] = useState("3");

  useEffect(() => {
    const seq = ["2", "1", "GO !"];
    const timers = seq.map((value, i) => setTimeout(() => setNum(value), (i + 1) * 900));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div
      style={{
        position: fixed ? "fixed" : "relative",
        inset: fixed ? 0 : undefined,
        minHeight: fixed ? undefined : "100vh",
        zIndex: 100,
        display: "grid",
        placeItems: "center",
        background: "var(--ap-brand)",
        backgroundImage: "radial-gradient(rgba(255,255,255,.14) 1.5px,transparent 1.5px)",
        backgroundSize: "30px 30px",
      }}
      aria-live="assertive"
    >
      <style>{`@keyframes cd-pop { 0%{transform:scale(.3);opacity:0;}45%{transform:scale(1.1);opacity:1;}100%{transform:scale(1);opacity:1;} }`}</style>
      <span
        key={num}
        style={{
          fontFamily: "var(--ap-font-display)",
          fontWeight: 600,
          fontSize: "clamp(120px,30vw,280px)",
          color: "#fff",
          textShadow: "0 10px 0 var(--ap-brand-deep)",
          animation: "cd-pop .9s cubic-bezier(.2,.7,.3,1.3)",
          display: "block",
          lineHeight: 1,
          textAlign: "center",
        }}
      >
        {num}
      </span>
    </div>
  );
};

interface TransitionTimerProps {
  duration: number;
  onComplete: () => void;
  badge?: string;
}

export const TransitionTimer = ({ duration, onComplete, badge }: TransitionTimerProps) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  const onCompleteRef = useRef(onComplete);
  const firedRef = useRef(false);

  useEffect(() => { onCompleteRef.current = onComplete; });

  useEffect(() => {
    const endTime = Date.now() + duration * 1000;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0 && !firedRef.current) {
        firedRef.current = true;
        clearInterval(interval);
        onCompleteRef.current();
      }
    }, 250);
    return () => clearInterval(interval);
  }, [duration]);

  return <TransitionCountdown timeLeft={timeLeft} total={duration} badge={badge} />;
};
