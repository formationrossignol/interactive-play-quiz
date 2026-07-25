import { useEffect, useRef, useState } from "react";
import { Flag, Pause, Play, RotateCcw } from "lucide-react";

const formatElapsed = (ms: number) => {
  const centis = Math.floor((ms % 1000) / 10);
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const pad = (n: number, len = 2) => n.toString().padStart(len, "0");
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(centis)}`
    : `${pad(minutes)}:${pad(seconds)}.${pad(centis)}`;
};

export const Chronometer = () => {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const startedAtRef = useRef(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      setElapsed(Date.now() - startedAtRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running]);

  const start = () => {
    startedAtRef.current = Date.now() - elapsed;
    setRunning(true);
  };

  const pause = () => setRunning(false);

  const reset = () => {
    setRunning(false);
    setElapsed(0);
    setLaps([]);
  };

  const addLap = () => setLaps((prev) => [elapsed, ...prev]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, width: "100%" }}>
      <div
        className="ap-card"
        style={{
          width: "min(360px, 90vw)",
          padding: "40px 24px",
          textAlign: "center",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span
          style={{
            fontSize: "clamp(40px, 9vw, 56px)",
            fontWeight: 800,
            fontFamily: "var(--ap-font-display)",
            color: "var(--ap-ink)",
          }}
        >
          {formatElapsed(elapsed)}
        </span>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        {running ? (
          <button type="button" className="ap-btn ap-btn--lg" onClick={pause}>
            <Pause className="h-4 w-4" />
            Pause
          </button>
        ) : (
          <button type="button" className="ap-btn ap-btn--lg" onClick={start}>
            <Play className="h-4 w-4" />
            {elapsed > 0 ? "Reprendre" : "Démarrer"}
          </button>
        )}
        <button type="button" className="ap-btn ap-btn--ghost ap-btn--lg" onClick={addLap} disabled={!running}>
          <Flag className="h-4 w-4" />
          Tour
        </button>
        <button
          type="button"
          className="ap-btn ap-btn--ghost ap-btn--lg"
          onClick={reset}
          disabled={elapsed === 0 && laps.length === 0}
        >
          <RotateCcw className="h-4 w-4" />
          Réinitialiser
        </button>
      </div>

      {laps.length > 0 && (
        <div className="ap-card" style={{ width: "min(360px, 90vw)", padding: "12px 16px" }}>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {laps.map((lap, i) => (
              <li
                key={laps.length - i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 14,
                  fontVariantNumeric: "tabular-nums",
                  padding: "4px 0",
                  borderBottom: i < laps.length - 1 ? "1px solid var(--ap-line)" : undefined,
                }}
              >
                <span className="ap-muted">Tour {laps.length - i}</span>
                <span style={{ fontWeight: 700, color: "var(--ap-ink)" }}>{formatElapsed(lap)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};
