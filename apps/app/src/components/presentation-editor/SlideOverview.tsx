import { useEffect } from "react";
import { X } from "lucide-react";
import { useDocStore } from "./store/useDocStore";
import { useEditorUIStore } from "./store/useEditorUIStore";
import { TextElementView } from "./elements/TextElementView";
import { ImageElementView } from "./elements/ImageElementView";
import { ShapeElementView } from "./elements/ShapeElementView";
import { TableElementView } from "./elements/TableElementView";
import { LineArrowLayer } from "./elements/LineArrowLayer";
import { SlideFooter } from "./SlideFooter";
import type { LineElement, Slide, SlideElement } from "./types/presentation";

function StaticElement({ slideId, element }: { slideId: string; element: SlideElement }) {
  if (!element.visible || element.type === "line" || element.type === "arrow" || element.type === "group") return null;
  return (
    <div
      style={{
        position: "absolute",
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        transform: `rotate(${element.rotation}deg)`,
        opacity: element.opacity,
        zIndex: element.zIndex,
      }}
    >
      {element.type === "text" && <TextElementView element={element} />}
      {element.type === "image" && <ImageElementView element={element} />}
      {(element.type === "rect" || element.type === "circle") && <ShapeElementView element={element} />}
      {element.type === "video" && <div style={{ width: "100%", height: "100%", background: "#17141f" }} />}
      {element.type === "table" && <TableElementView slideId={slideId} element={element} />}
    </div>
  );
}

function OverviewSlide({ slide, index, width, height, active, onClick }: { slide: Slide; index: number; width: number; height: number; active: boolean; onClick: () => void }) {
  const previewWidth = 360;
  const scale = previewWidth / width;
  const lines = slide.elements.filter((element): element is LineElement => element.type === "line" || element.type === "arrow");
  const presentation = useDocStore.getState().presentation;
  return (
    <button type="button" onClick={onClick} style={{ border: 0, padding: 0, background: "transparent", textAlign: "left", cursor: "pointer" }}>
      <div style={{ width: previewWidth, height: height * scale, border: `3px solid ${active ? "var(--ap-brand)" : "var(--ap-line)"}`, borderRadius: 14, overflow: "hidden", background: slide.background?.value ?? "#fff", boxShadow: active ? "0 0 0 4px var(--ap-brand-soft)" : "0 4px 14px rgba(30,32,45,.08)" }}>
        <div style={{ position: "relative", width, height, transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none" }}>
          {slide.elements.map((element) => <StaticElement key={element.id} slideId={slide.id} element={element} />)}
          <LineArrowLayer lines={lines} width={width} height={height} />
          <SlideFooter footer={presentation?.footer} slideNumber={index + 1} isTitleSlide={index === 0} />
        </div>
      </div>
      <span style={{ display: "block", marginTop: 8, fontSize: 14, fontWeight: 800, color: "var(--ap-ink)" }}>{index + 1}</span>
    </button>
  );
}

export function SlideOverview({ open, onClose }: { open: boolean; onClose: () => void }) {
  const presentation = useDocStore((state) => state.presentation);
  const setActiveSlideId = useEditorUIStore((state) => state.setActiveSlideId);
  const activeSlideId = useEditorUIStore((state) => state.activeSlideId);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  if (!open || !presentation) return null;
  const slides = presentation.slides.slice().sort((a, b) => a.order - b.order);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(244,247,251,.98)", overflow: "auto", padding: "72px 34px 50px" }}>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px", background: "var(--ap-card)", borderBottom: "var(--ap-border-w) solid var(--ap-line)", zIndex: 2 }}>
        <div>
          <strong style={{ fontSize: 17 }}>Vue d’ensemble</strong>
          <span style={{ marginLeft: 10, color: "var(--ap-muted)", fontSize: 13 }}>{slides.length} diapositives</span>
        </div>
        <button type="button" className="ap-btn ap-btn--ghost ap-icon-btn" onClick={onClose} aria-label="Fermer la vue d’ensemble"><X size={20} /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "34px 38px", justifyItems: "center" }}>
        {slides.map((slide, index) => (
          <OverviewSlide
            key={slide.id}
            slide={slide}
            index={index}
            width={presentation.width}
            height={presentation.height}
            active={slide.id === activeSlideId}
            onClick={() => { setActiveSlideId(slide.id); onClose(); }}
          />
        ))}
      </div>
    </div>
  );
}
