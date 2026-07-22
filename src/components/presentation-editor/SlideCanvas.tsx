import { useRef } from "react";
import { useDocStore } from "./store/useDocStore";
import { useEditorUIStore } from "./store/useEditorUIStore";
import { CanvasElement } from "./elements/CanvasElement";
import { LineArrowLayer } from "./elements/LineArrowLayer";
import { SelectionOverlay } from "./SelectionOverlay";
import { rectsIntersect } from "./utils/geometry";
import type { LineElement } from "./types/presentation";

export function SlideCanvas() {
  const presentation = useDocStore((s) => s.presentation);
  const activeSlideId = useEditorUIStore((s) => s.activeSlideId);
  const zoom = useEditorUIStore((s) => s.zoom);
  const selectedIds = useEditorUIStore((s) => s.selectedIds);
  const select = useEditorUIStore((s) => s.select);
  const toggleSelect = useEditorUIStore((s) => s.toggleSelect);
  const clearSelection = useEditorUIStore((s) => s.clearSelection);

  const marqueeRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{ startX: number; startY: number } | null>(null);

  if (!presentation) return null;
  const slide = presentation.slides.find((s) => s.id === activeSlideId) ?? presentation.slides[0];
  if (!slide) return null;

  const lines = slide.elements.filter((e): e is LineElement => e.type === "line" || e.type === "arrow");
  const selectable = slide.elements.filter((e) => e.type !== "line" && e.type !== "arrow");

  function stagePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    clearSelection();
    const stage = e.currentTarget;
    const bounds = stage.getBoundingClientRect();
    const startX = (e.clientX - bounds.left) / zoom;
    const startY = (e.clientY - bounds.top) / zoom;
    dragState.current = { startX, startY };

    const marquee = marqueeRef.current;
    if (marquee) {
      marquee.style.display = "block";
      marquee.style.left = `${startX}px`;
      marquee.style.top = `${startY}px`;
      marquee.style.width = "0px";
      marquee.style.height = "0px";
    }

    function onMove(moveEvent: PointerEvent) {
      if (!dragState.current || !marquee) return;
      const x = (moveEvent.clientX - bounds.left) / zoom;
      const y = (moveEvent.clientY - bounds.top) / zoom;
      const left = Math.min(dragState.current.startX, x);
      const top = Math.min(dragState.current.startY, y);
      marquee.style.left = `${left}px`;
      marquee.style.top = `${top}px`;
      marquee.style.width = `${Math.abs(x - dragState.current.startX)}px`;
      marquee.style.height = `${Math.abs(y - dragState.current.startY)}px`;
    }

    function onUp(upEvent: PointerEvent) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (!dragState.current) return;
      const x = (upEvent.clientX - bounds.left) / zoom;
      const y = (upEvent.clientY - bounds.top) / zoom;
      const marqueeRect = {
        x: Math.min(dragState.current.startX, x),
        y: Math.min(dragState.current.startY, y),
        width: Math.abs(x - dragState.current.startX),
        height: Math.abs(y - dragState.current.startY),
      };
      const hitIds = selectable
        .filter((el) => rectsIntersect(marqueeRect, el))
        .map((el) => el.id);
      if (hitIds.length > 0) select(hitIds);
      dragState.current = null;
      if (marquee) marquee.style.display = "none";
    }

    // SlideCanvas stays mounted for the whole editing session; unmounting mid-drag
    // (before pointerup fires) is not a normal use case for this editor.
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div style={{ overflow: "auto", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ap-paper-2)" }}>
      <div
        data-slide-stage
        onPointerDown={stagePointerDown}
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
        {selectable.map((element) => (
          <CanvasElement
            key={element.id}
            element={element}
            elementRef={() => {}}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (e.shiftKey) toggleSelect(element.id); else select([element.id]);
            }}
          />
        ))}
        <LineArrowLayer lines={lines} width={presentation.width} height={presentation.height} />
        <SelectionOverlay slideId={slide.id} elements={selectable} selectedIds={selectedIds} zoom={zoom} />
        <div ref={marqueeRef} style={{ position: "absolute", display: "none", border: "1px dashed var(--ap-brand)", background: "rgba(108,99,255,.08)", pointerEvents: "none" }} />
      </div>
    </div>
  );
}
