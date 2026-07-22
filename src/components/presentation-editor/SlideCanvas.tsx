import { useDocStore } from "./store/useDocStore";
import { useEditorUIStore } from "./store/useEditorUIStore";
import { CanvasElement } from "./elements/CanvasElement";
import { LineArrowLayer } from "./elements/LineArrowLayer";
import type { LineElement } from "./types/presentation";

export function SlideCanvas() {
  const presentation = useDocStore((s) => s.presentation);
  const activeSlideId = useEditorUIStore((s) => s.activeSlideId);
  const zoom = useEditorUIStore((s) => s.zoom);

  if (!presentation) return null;
  const slide = presentation.slides.find((s) => s.id === activeSlideId) ?? presentation.slides[0];
  if (!slide) return null;

  const lines = slide.elements.filter((e): e is LineElement => e.type === "line" || e.type === "arrow");

  return (
    <div style={{ overflow: "auto", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ap-paper-2)" }}>
      <div
        data-slide-stage
        style={{
          position: "relative",
          width: presentation.width,
          height: presentation.height,
          transform: `scale(${zoom})`,
          transformOrigin: "center center",
          background: slide.background?.value ?? "#fff",
          boxShadow: "0 8px 24px rgba(0,0,0,.15)",
          flexShrink: 0,
        }}
      >
        {slide.elements
          .filter((e) => e.type !== "line" && e.type !== "arrow")
          .map((element) => (
            <CanvasElement key={element.id} element={element} elementRef={() => {}} />
          ))}
        <LineArrowLayer lines={lines} width={presentation.width} height={presentation.height} />
      </div>
    </div>
  );
}
