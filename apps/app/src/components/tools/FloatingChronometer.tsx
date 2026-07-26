import { useEffect, useState } from "react";
import { Clock3, Flag, Pause, Play, RotateCcw, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { currentElapsed, formatElapsed, useChronometerStore } from "./useChronometerStore";
import { getCurrentUser } from "@/lib/auth";

export function FloatingChronometer() {
  const location = useLocation();
  const state = useChronometerStore();
  const { running, laps, widgetOpen, start, pause, reset, addLap, setWidgetOpen } = state;
  const [now, setNow] = useState(Date.now());
  const elapsed = currentElapsed(state, now);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => setNow(Date.now()), 30);
    return () => window.clearInterval(interval);
  }, [running]);

  const hasSession = running || state.elapsed > 0 || laps.length > 0;
  if (location.pathname === "/tools/chronometre" || (!getCurrentUser() && !hasSession)) return null;

  if (!widgetOpen) {
    return (
      <button
        type="button"
        onClick={() => setWidgetOpen(true)}
        aria-label="Ouvrir le chronomètre"
        title="Chronomètre"
        style={{
          position: "fixed",
          right: 22,
          bottom: 22,
          zIndex: 800,
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: "2px solid var(--ap-line)",
          background: running ? "var(--ap-brand)" : "var(--ap-card)",
          color: running ? "#fff" : "var(--ap-brand)",
          boxShadow: "0 8px 24px rgba(36,32,45,.2)",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
        }}
      >
        <Clock3 size={23} />
      </button>
    );
  }

  return (
    <aside style={{ position: "fixed", right: 22, bottom: 22, zIndex: 800, width: 300, padding: 16, borderRadius: 20, border: "2px solid var(--ap-line)", background: "var(--ap-card)", boxShadow: "0 12px 38px rgba(36,32,45,.25)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <strong style={{ display: "flex", alignItems: "center", gap: 8 }}><Clock3 size={17} color="var(--ap-brand)" /> Chronomètre</strong>
        <button type="button" className="ap-btn ap-btn--ghost ap-icon-btn" onClick={() => setWidgetOpen(false)} aria-label="Réduire le chronomètre"><X size={16} /></button>
      </div>
      <div style={{ padding: "15px 10px", borderRadius: 14, background: "var(--ap-paper-2)", textAlign: "center", fontFamily: "var(--ap-font-display)", fontWeight: 800, fontSize: 30, fontVariantNumeric: "tabular-nums" }}>
        {formatElapsed(elapsed)}
      </div>
      <div style={{ display: "flex", gap: 7, marginTop: 12 }}>
        <button type="button" className="ap-btn ap-btn--sm" style={{ flex: 1 }} onClick={running ? pause : start}>
          {running ? <Pause size={14} /> : <Play size={14} />}
          {running ? "Pause" : elapsed ? "Reprendre" : "Démarrer"}
        </button>
        <button type="button" className="ap-btn ap-btn--ghost ap-icon-btn" onClick={addLap} disabled={!running} title="Tour"><Flag size={15} /></button>
        <button type="button" className="ap-btn ap-btn--ghost ap-icon-btn" onClick={reset} disabled={!elapsed && !laps.length} title="Réinitialiser"><RotateCcw size={15} /></button>
      </div>
      {laps.length > 0 && <p style={{ margin: "10px 0 0", color: "var(--ap-muted)", fontSize: 12, fontWeight: 700 }}>{laps.length} tour{laps.length > 1 ? "s" : ""} enregistré{laps.length > 1 ? "s" : ""}</p>}
    </aside>
  );
}
