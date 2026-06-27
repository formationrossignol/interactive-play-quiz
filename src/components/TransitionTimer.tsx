import { useEffect, useRef, useState } from "react";

interface TransitionTimerProps {
  duration: number;
  onComplete: () => void;
}

export const TransitionTimer = ({ duration, onComplete }: TransitionTimerProps) => {
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

  const percentage = duration > 0 ? (timeLeft / duration) * 100 : 0;
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--ap-brand)" }}
    >
      <div className="text-center">
        <div className="text-5xl mb-8 animate-bounce">🚀</div>

        <h1
          className="ap-h2 text-white mb-10"
          style={{ textShadow: "0 2px 8px rgba(0,0,0,0.2)" }}
        >
          Prochaine question…
        </h1>

        <div className="relative inline-flex items-center justify-center mb-8">
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
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="14"
              fill="rgba(255,255,255,0.08)"
            />
            <circle
              cx="110"
              cy="110"
              r={radius}
              stroke="white"
              strokeWidth="14"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="text-7xl font-bold text-white"
              style={{ fontFamily: "var(--ap-font-display)", textShadow: "0 2px 12px rgba(0,0,0,0.3)" }}
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
          Préparez-vous !
        </p>
      </div>
    </div>
  );
};
