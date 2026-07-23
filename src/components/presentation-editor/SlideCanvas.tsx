import { useRef } from "react";
import { toast } from "sonner";
import { useDocStore } from "./store/useDocStore";
import { useEditorUIStore } from "./store/useEditorUIStore";
import { useHistoryStore } from "./store/useHistoryStore";
import { useElementDrag } from "./hooks/useElementDrag";
import { CanvasElement } from "./elements/CanvasElement";
import { LineArrowLayer } from "./elements/LineArrowLayer";
import { SelectionOverlay } from "./SelectionOverlay";
import { TransformControls } from "./TransformControls";
import { rectsIntersect } from "./utils/geometry";
import { createElementForTool, type DrawableTool } from "./utils/createElement";
import { IMAGE_TYPES, MediaValidationError, uploadPresentationMedia, VIDEO_TYPES } from "./utils/mediaRepo";
import type { LineElement, SlideElement } from "./types/presentation";

function newElementId(): string {
  return `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface Point { x: number; y: number }

interface PendingMedia {
  id: string;
  tool: "image" | "video";
  start: Point;
  end: Point;
  zIndex: number;
}

export function SlideCanvas({ userId }: { userId: string }) {
  const presentation = useDocStore((s) => s.presentation);
  const activeSlideId = useEditorUIStore((s) => s.activeSlideId);
  const activeTool = useEditorUIStore((s) => s.activeTool);
  const setActiveTool = useEditorUIStore((s) => s.setActiveTool);
  const zoom = useEditorUIStore((s) => s.zoom);
  const selectedIds = useEditorUIStore((s) => s.selectedIds);
  const select = useEditorUIStore((s) => s.select);
  const toggleSelect = useEditorUIStore((s) => s.toggleSelect);
  const clearSelection = useEditorUIStore((s) => s.clearSelection);

  const marqueeRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{ startX: number; startY: number } | null>(null);
  const nodesRef = useRef(new Map<string, HTMLElement>());
  const pendingMediaRef = useRef<PendingMedia | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const slide = presentation
    ? (presentation.slides.find((s) => s.id === activeSlideId) ?? presentation.slides[0])
    : null;

  // Hooks must run unconditionally on every render (Rules of Hooks) — call
  // this before the early returns below, with a safe "" fallback when there's
  // no slide yet (matches the same pattern used for useKeyboardShortcuts).
  const { onPointerDown: onElementDragStart } = useElementDrag(slide?.id ?? "", nodesRef);

  if (!presentation || !slide) return null;

  const lines = slide.elements.filter((e): e is LineElement => e.type === "line" || e.type === "arrow");
  const selectable = slide.elements.filter((e) => e.type !== "line" && e.type !== "arrow");

  function placeElement(tool: DrawableTool, start: Point, end: Point) {
    if (!slide) return;
    const zIndex = Math.max(0, ...slide.elements.map((el) => el.zIndex)) + 1;
    setActiveTool("select");

    if (tool === "image" || tool === "video") {
      pendingMediaRef.current = { id: newElementId(), tool, start, end, zIndex };
      (tool === "image" ? imageInputRef.current : videoInputRef.current)?.click();
      return;
    }

    const element = createElementForTool(tool, newElementId(), start, end, zIndex);
    useHistoryStore.getState().commit();
    useDocStore.getState().addElement(slide.id, element);
    select([element.id]);
    if (tool === "text") useEditorUIStore.getState().setEditingElementId(element.id);
  }

  async function handleMediaFile(file: File | undefined) {
    const pending = pendingMediaRef.current;
    pendingMediaRef.current = null;
    if (!file || !pending || !slide || !presentation) return;
    try {
      const url = await uploadPresentationMedia(userId, presentation.id, pending.id, file);
      const element = createElementForTool(pending.tool, pending.id, pending.start, pending.end, pending.zIndex);
      useHistoryStore.getState().commit();
      useDocStore.getState().addElement(slide.id, { ...element, src: url } as SlideElement);
      select([pending.id]);
    } catch (err) {
      toast.error(err instanceof MediaValidationError ? err.message : "Échec de l'envoi du fichier.");
    }
  }

  function toolPointerDown(e: React.PointerEvent<HTMLDivElement>, tool: DrawableTool) {
    const stage = e.currentTarget;
    const bounds = stage.getBoundingClientRect();
    const start: Point = { x: (e.clientX - bounds.left) / zoom, y: (e.clientY - bounds.top) / zoom };

    const preview = marqueeRef.current;
    if (preview) {
      preview.style.display = "block";
      preview.style.left = `${start.x}px`;
      preview.style.top = `${start.y}px`;
      preview.style.width = "0px";
      preview.style.height = "0px";
    }

    function onMove(moveEvent: PointerEvent) {
      if (!preview) return;
      const x = (moveEvent.clientX - bounds.left) / zoom;
      const y = (moveEvent.clientY - bounds.top) / zoom;
      preview.style.left = `${Math.min(start.x, x)}px`;
      preview.style.top = `${Math.min(start.y, y)}px`;
      preview.style.width = `${Math.abs(x - start.x)}px`;
      preview.style.height = `${Math.abs(y - start.y)}px`;
    }

    function onUp(upEvent: PointerEvent) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (preview) preview.style.display = "none";
      const end: Point = { x: (upEvent.clientX - bounds.left) / zoom, y: (upEvent.clientY - bounds.top) / zoom };
      placeElement(tool, start, end);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function stagePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (activeTool !== "select") {
      // Unlike the marquee path below, this also fires for pointerdown
      // bubbled up from a CanvasElement (see its onPointerDown) — a draw
      // tool must be able to start a new element on top of an existing one.
      // `e.currentTarget` is always the stage div regardless of bubble
      // source, so coordinates below stay correct either way.
      toolPointerDown(e, activeTool);
      return;
    }
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
      <input
        ref={imageInputRef}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void handleMediaFile(f); }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept={VIDEO_TYPES.join(",")}
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void handleMediaFile(f); }}
      />
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
          cursor: activeTool === "select" ? "default" : "crosshair",
        }}
      >
        {selectable.map((element) => (
          <CanvasElement
            key={element.id}
            slideId={slide.id}
            element={element}
            elementRef={(node) => {
              if (node) nodesRef.current.set(element.id, node); else nodesRef.current.delete(element.id);
            }}
            onPointerDown={(e) => {
              // A draw tool is active: let the event bubble to the stage so
              // it starts a new element there, even on top of this one —
              // don't hijack it into a select/drag of the existing element.
              if (activeTool !== "select") return;
              e.stopPropagation();
              if (e.shiftKey) { toggleSelect(element.id); return; }
              if (!selectedIds.has(element.id)) select([element.id]);
              onElementDragStart(e, element.id);
            }}
          />
        ))}
        <LineArrowLayer lines={lines} width={presentation.width} height={presentation.height} />
        <SelectionOverlay slideId={slide.id} elements={selectable} selectedIds={selectedIds} zoom={zoom} />
        {selectedIds.size === 1 && (() => {
          const onlyId = [...selectedIds][0];
          const el = selectable.find((x) => x.id === onlyId);
          if (!el || el.locked) return null;
          return <TransformControls slideId={slide.id} element={el} zoom={zoom} node={nodesRef.current.get(onlyId) ?? null} />;
        })()}
        <div ref={marqueeRef} style={{ position: "absolute", display: "none", border: "1px dashed var(--ap-brand)", background: "rgba(108,99,255,.08)", pointerEvents: "none" }} />
      </div>
    </div>
  );
}
