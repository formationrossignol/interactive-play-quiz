import { useEffect, useState } from "react";
import { useDocStore } from "./store/useDocStore";
import { CanvasElement } from "./elements/CanvasElement";
import { LineArrowLayer } from "./elements/LineArrowLayer";
import type { LineElement } from "./types/presentation";
import { Palette, X } from "lucide-react";
import { SlideFooter } from "./SlideFooter";
import { PRESENTATION_FONT_OPTIONS, PRESENTATION_TEXT_COLORS } from "./templates/presentationTemplates";

export function PresentationMode({ onExit }: { onExit: () => void }) {
  const presentation = useDocStore((s) => s.presentation);
  const [index, setIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [styleOpen, setStyleOpen] = useState(false);
  const visibleSlides = (presentation?.slides ?? []).filter((s) => !s.hidden).sort((a, b) => a.order - b.order);
  const slide = visibleSlides[index];

  // Fit the slide to the viewport like Google Slides' present mode: scale
  // down (or up) to the largest size that still fits, recomputed on resize
  // (e.g. rotating a tablet, or the window changing on desktop).
  useEffect(() => {
    if (!presentation) return;
    function fit() {
      const scaleX = window.innerWidth / presentation!.width;
      const scaleY = window.innerHeight / presentation!.height;
      setScale(Math.min(scaleX, scaleY));
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [presentation]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") setIndex((i) => Math.min(visibleSlides.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "Escape") onExit();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visibleSlides.length, onExit]);

  let touchStartX = 0;
  function onTouchStart(e: React.TouchEvent) { touchStartX = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (dx < -50) setIndex((i) => Math.min(visibleSlides.length - 1, i + 1));
    if (dx > 50) setIndex((i) => Math.max(0, i - 1));
  }

  if (!presentation || !slide) return null;
  const lines = slide.elements.filter((e): e is LineElement => e.type === "line" || e.type === "arrow");
  const slideNumber = presentation.slides.findIndex((item) => item.id === slide.id) + 1;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        style={{
          position: "relative",
          width: presentation.width,
          height: presentation.height,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          background: slide.background?.value ?? presentation.theme?.backgroundColor ?? "#fff",
          color: presentation.theme?.textColor ?? "#24202d",
          fontFamily: presentation.theme?.fontFamily ?? "Arial, sans-serif",
          flexShrink: 0,
        }}
      >
        {slide.elements.filter((e) => e.type !== "line" && e.type !== "arrow").map((element) => (
          <CanvasElement key={element.id} slideId={slide.id} element={element} elementRef={() => {}} />
        ))}
        <LineArrowLayer lines={lines} width={presentation.width} height={presentation.height} />
        <SlideFooter footer={presentation.footer} slideNumber={slideNumber} isTitleSlide={slideNumber === 1} />
      </div>
      <div style={{ position: "absolute", bottom: 16, right: 16, color: "#fff", fontSize: 14, fontFamily: "var(--ap-font-body)" }}>
        {index + 1} / {visibleSlides.length}
      </div>
      <div style={{ position: "absolute", top: 16, left: 16, color: "#fff", fontFamily: "var(--ap-font-body)" }}>
        <button
          type="button"
          onClick={() => setStyleOpen((open) => !open)}
          aria-expanded={styleOpen}
          className="ap-btn ap-btn--sm"
          style={{ borderColor: "rgba(255,255,255,.35)", background: "rgba(22,22,28,.72)", color: "#fff", backdropFilter: "blur(8px)" }}
        >
          <Palette size={16} />
          Style
        </button>
        {styleOpen && (
          <div style={{ width: 300, marginTop: 8, padding: 14, borderRadius: 15, background: "rgba(22,22,28,.92)", border: "1px solid rgba(255,255,255,.24)", boxShadow: "0 12px 30px rgba(0,0,0,.28)", backdropFilter: "blur(12px)" }}>
            <label style={{ display: "grid", gap: 6, marginBottom: 12, fontSize: 12, fontWeight: 800 }}>
              Police
              <select
                value={presentation.theme?.fontFamily ?? PRESENTATION_FONT_OPTIONS[0].value}
                onChange={(event) => useDocStore.getState().updateTheme({ fontFamily: event.target.value, templateId: "personnalise" })}
                style={{ height: 36, border: "1px solid rgba(255,255,255,.32)", borderRadius: 9, background: "#fff", color: "#24202d", padding: "0 9px", fontFamily: "inherit" }}
              >
                {PRESENTATION_FONT_OPTIONS.map((font) => <option key={font.label} value={font.value}>{font.label}</option>)}
              </select>
            </label>
            <span style={{ display: "block", marginBottom: 7, fontSize: 12, fontWeight: 800 }}>Couleur du texte</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {PRESENTATION_TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Couleur ${color}`}
                  onClick={() => useDocStore.getState().updateTheme({ textColor: color, templateId: "personnalise" })}
                  style={{ width: 27, height: 27, borderRadius: "50%", background: color, border: presentation.theme?.textColor === color ? "3px solid #9b91ff" : "2px solid rgba(255,255,255,.5)", cursor: "pointer" }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <button
        onClick={onExit}
        aria-label="Quitter le mode présentation"
        title="Quitter"
        style={{ position: "absolute", top: 16, right: 16, color: "#fff", background: "none", border: "none", cursor: "pointer", padding: 6, display: "grid", placeItems: "center" }}
      >
        <X size={22} aria-hidden="true" />
      </button>
    </div>
  );
}

export function exportPresentationAsFile() {
  const json = useDocStore.getState().exportJSON();
  const presentation = useDocStore.getState().presentation;
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${presentation?.title ?? "presentation"}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importPresentationFromFile(file: File): Promise<void> {
  return file.text().then((json) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error("Fichier JSON invalide.");
    }
    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { slides?: unknown }).slides)) {
      throw new Error("Ce fichier ne contient pas une présentation valide.");
    }
    useDocStore.getState().importJSON(json);
  });
}
