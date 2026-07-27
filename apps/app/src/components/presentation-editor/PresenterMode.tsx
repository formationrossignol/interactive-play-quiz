import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Pause, Play, RotateCcw, X } from "lucide-react";
import { useDocStore } from "./store/useDocStore";
import { StaticSlideStage } from "./StaticSlideStage";

const MESSAGE_TYPE = "brivia-presenter-state";
const READY_TYPE = "brivia-audience-ready";

const formatElapsed = (seconds: number) => {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
};

export function PresenterMode({ onExit }: { onExit: () => void }) {
  const presentation = useDocStore((state) => state.presentation);
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(true);
  const audienceWindow = useRef<Window | null>(null);
  const visibleSlides = useMemo(
    () => (presentation?.slides ?? []).filter((slide) => !slide.hidden).sort((a, b) => a.order - b.order),
    [presentation],
  );
  const current = visibleSlides[index];
  const next = visibleSlides[index + 1];

  const sendAudienceState = useCallback(() => {
    if (!presentation || !audienceWindow.current || audienceWindow.current.closed) return;
    audienceWindow.current.postMessage({ type: MESSAGE_TYPE, presentation, index }, window.location.origin);
  }, [index, presentation]);

  useEffect(() => {
    if (!timerRunning) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [timerRunning]);

  useEffect(() => {
    sendAudienceState();
  }, [sendAudienceState]);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.data?.type === READY_TYPE) sendAudienceState();
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [sendAudienceState]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, [contenteditable='true']")) return;
      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        setIndex((value) => Math.min(visibleSlides.length - 1, value + 1));
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        setIndex((value) => Math.max(0, value - 1));
      }
      if (event.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit, visibleSlides.length]);

  if (!presentation || !current) return null;
  const currentNumber = presentation.slides.findIndex((slide) => slide.id === current.id) + 1;
  const currentScale = Math.min(720 / presentation.width, 405 / presentation.height);
  const nextScale = Math.min(330 / presentation.width, 186 / presentation.height);

  const openAudience = () => {
    audienceWindow.current = window.open("/presentation-audience", "brivia-presentation-audience", "popup=yes,width=1280,height=720");
    window.setTimeout(sendAudienceState, 450);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "#111318", color: "#fff", fontFamily: "var(--ap-font-body)", display: "grid", gridTemplateRows: "64px minmax(0,1fr)" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 14, padding: "0 20px", borderBottom: "1px solid rgba(255,255,255,.14)", background: "#181b22" }}>
        <strong style={{ fontFamily: "var(--ap-font-display)", fontSize: 17, marginRight: "auto" }}>Mode présentateur · {presentation.title}</strong>
        <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 900 }}>{formatElapsed(elapsed)}</span>
        <button className="ap-btn ap-btn--ghost ap-icon-btn" style={{ color: "#fff", borderColor: "rgba(255,255,255,.25)", background: "transparent" }} onClick={() => setTimerRunning((running) => !running)} aria-label={timerRunning ? "Mettre le chrono en pause" : "Relancer le chrono"}>
          {timerRunning ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button className="ap-btn ap-btn--ghost ap-icon-btn" style={{ color: "#fff", borderColor: "rgba(255,255,255,.25)", background: "transparent" }} onClick={() => setElapsed(0)} aria-label="Réinitialiser le chrono">
          <RotateCcw size={16} />
        </button>
        <button className="ap-btn ap-btn--sm" onClick={openAudience}>
          <ExternalLink size={16} /> Ouvrir l’écran public
        </button>
        <button className="ap-btn ap-btn--ghost ap-icon-btn" style={{ color: "#fff", borderColor: "rgba(255,255,255,.25)", background: "transparent" }} onClick={onExit} aria-label="Quitter le mode présentateur">
          <X size={18} />
        </button>
      </header>

      <main style={{ minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", gap: 18, padding: 18 }}>
        <section style={{ minWidth: 0, display: "grid", gridTemplateRows: "minmax(0,1fr) auto", gap: 14 }}>
          <div style={{ minHeight: 0, display: "grid", placeItems: "center", border: "1px solid rgba(255,255,255,.14)", background: "#090a0d", borderRadius: "var(--ap-r-md)", overflow: "hidden" }}>
            <div style={{ width: presentation.width * currentScale, height: presentation.height * currentScale }}>
              <StaticSlideStage presentation={presentation} slide={current} slideNumber={currentNumber} scale={currentScale} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12 }}>
            <button className="ap-btn ap-btn--ghost ap-icon-btn" style={{ color: "#fff", borderColor: "rgba(255,255,255,.25)", background: "#181b22" }} disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))} aria-label="Diapositive précédente"><ChevronLeft /></button>
            <strong style={{ minWidth: 92, textAlign: "center" }}>{index + 1} / {visibleSlides.length}</strong>
            <button className="ap-btn ap-btn--ghost ap-icon-btn" style={{ color: "#fff", borderColor: "rgba(255,255,255,.25)", background: "#181b22" }} disabled={index === visibleSlides.length - 1} onClick={() => setIndex((value) => Math.min(visibleSlides.length - 1, value + 1))} aria-label="Diapositive suivante"><ChevronRight /></button>
          </div>
        </section>

        <aside style={{ minHeight: 0, display: "grid", gridTemplateRows: "auto minmax(0,1fr)", gap: 14 }}>
          <div style={{ padding: 14, border: "1px solid rgba(255,255,255,.14)", borderRadius: "var(--ap-r-md)", background: "#181b22" }}>
            <span style={{ display: "block", marginBottom: 10, color: "rgba(255,255,255,.62)", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".08em" }}>À suivre</span>
            {next ? (
              <div style={{ width: presentation.width * nextScale, height: presentation.height * nextScale, overflow: "hidden", background: "#090a0d" }}>
                <StaticSlideStage presentation={presentation} slide={next} slideNumber={presentation.slides.findIndex((slide) => slide.id === next.id) + 1} scale={nextScale} />
              </div>
            ) : (
              <div style={{ height: 186, display: "grid", placeItems: "center", color: "rgba(255,255,255,.55)", background: "#090a0d" }}>Fin de la présentation</div>
            )}
          </div>
          <label style={{ minHeight: 0, display: "grid", gridTemplateRows: "auto minmax(0,1fr)", gap: 10, padding: 14, border: "1px solid rgba(255,255,255,.14)", borderRadius: "var(--ap-r-md)", background: "#181b22", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".08em" }}>
            Notes
            <textarea
              value={current.notes ?? ""}
              onChange={(event) => useDocStore.getState().updateSlideNotes(current.id, event.target.value)}
              placeholder="Aucune note pour cette diapositive."
              style={{ minHeight: 0, resize: "none", padding: 12, border: "1px solid rgba(255,255,255,.16)", borderRadius: "var(--ap-r-sm)", background: "#101218", color: "#fff", fontFamily: "var(--ap-font-body)", fontSize: 14, lineHeight: 1.55, textTransform: "none", letterSpacing: 0 }}
            />
          </label>
        </aside>
      </main>
    </div>
  );
}
