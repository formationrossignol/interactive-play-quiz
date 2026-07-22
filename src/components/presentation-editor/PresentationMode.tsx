import { useEffect, useState } from "react";
import { useDocStore } from "./store/useDocStore";
import { CanvasElement } from "./elements/CanvasElement";
import { LineArrowLayer } from "./elements/LineArrowLayer";
import type { LineElement } from "./types/presentation";

export function PresentationMode({ onExit }: { onExit: () => void }) {
  const presentation = useDocStore((s) => s.presentation);
  const [index, setIndex] = useState(0);
  const visibleSlides = (presentation?.slides ?? []).filter((s) => !s.hidden).sort((a, b) => a.order - b.order);
  const slide = visibleSlides[index];

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

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div style={{ position: "relative", width: presentation.width, height: presentation.height, background: slide.background?.value ?? "#fff" }}>
        {slide.elements.filter((e) => e.type !== "line" && e.type !== "arrow").map((element) => (
          <CanvasElement key={element.id} slideId={slide.id} element={element} elementRef={() => {}} />
        ))}
        <LineArrowLayer lines={lines} width={presentation.width} height={presentation.height} />
      </div>
      <div style={{ position: "absolute", bottom: 16, right: 16, color: "#fff", fontSize: 14, fontFamily: "var(--ap-font-body)" }}>
        {index + 1} / {visibleSlides.length}
      </div>
      <button onClick={onExit} style={{ position: "absolute", top: 16, right: 16, color: "#fff", background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>
        ✕
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
