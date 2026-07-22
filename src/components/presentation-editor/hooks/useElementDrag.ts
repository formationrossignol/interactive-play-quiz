import { useRef, useCallback } from "react";
import { useDocStore } from "../store/useDocStore";
import { useEditorUIStore } from "../store/useEditorUIStore";
import { useHistoryStore } from "../store/useHistoryStore";
import { snapDelta } from "../utils/geometry";
import type { BaseElement } from "../types/presentation";

interface DragTarget {
  id: string;
  startX: number;
  startY: number;
  node: HTMLElement;
}

/**
 * Returns a pointerdown handler to attach to a selected element's wrapper.
 * `nodesRef` must map element id -> its live DOM node (CanvasElement's
 * elementRef callback feeds this).
 */
export function useElementDrag(slideId: string, nodesRef: React.MutableRefObject<Map<string, HTMLElement>>) {
  const draggingRef = useRef<DragTarget[] | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent, draggedId: string) => {
    e.stopPropagation();
    const doc = useDocStore.getState();
    const ui = useEditorUIStore.getState();
    const slide = doc.presentation!.slides.find((s) => s.id === slideId)!;

    const activeIds = ui.selectedIds.has(draggedId) ? [...ui.selectedIds] : [draggedId];

    const targets: DragTarget[] = activeIds
      .map((id) => {
        const el = slide.elements.find((x) => x.id === id);
        const node = nodesRef.current.get(id);
        if (!el || !node) return null;
        return { id, startX: el.x, startY: el.y, node };
      })
      .filter((t): t is DragTarget => t !== null);
    draggingRef.current = targets;
    ui.setDragging(true);

    const others = slide.elements.filter((el): el is BaseElement => !activeIds.includes(el.id));
    const zoom = ui.zoom;
    const startClientX = e.clientX;
    const startClientY = e.clientY;

    function onMove(moveEvent: PointerEvent) {
      if (!draggingRef.current) return;
      let dx = (moveEvent.clientX - startClientX) / zoom;
      let dy = (moveEvent.clientY - startClientY) / zoom;

      if (!moveEvent.altKey) {
        const primary = draggingRef.current[0];
        const proxy: BaseElement = { ...slide.elements.find((x) => x.id === primary.id)!, x: primary.startX, y: primary.startY };
        const snapped = snapDelta(proxy, dx, dy, others, 8);
        dx = snapped.dx;
        dy = snapped.dy;
      }

      for (const t of draggingRef.current) {
        // CanvasElement's own React-controlled style already sets
        // `transform: rotate(${element.rotation}deg)` — overwriting it with
        // just `translate()` would un-rotate the element for the duration
        // of the drag. Read the element's rotation once (it doesn't change
        // mid-drag) and compose both in one transform string.
        const rotation = slide.elements.find((x) => x.id === t.id)?.rotation ?? 0;
        t.node.style.transform = `translate(${dx}px, ${dy}px) rotate(${rotation}deg)`;
      }
    }

    function onUp(upEvent: PointerEvent) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const targets = draggingRef.current;
      draggingRef.current = null;
      useEditorUIStore.getState().setDragging(false);
      if (!targets || targets.length === 0) return;

      let dx = (upEvent.clientX - startClientX) / zoom;
      let dy = (upEvent.clientY - startClientY) / zoom;
      if (!upEvent.altKey) {
        const primary = targets[0];
        const proxy: BaseElement = { ...slide.elements.find((x) => x.id === primary.id)!, x: primary.startX, y: primary.startY };
        const snapped = snapDelta(proxy, dx, dy, others, 8);
        dx = snapped.dx;
        dy = snapped.dy;
      }

      useHistoryStore.getState().commit();
      useDocStore.getState().updateElements(
        slideId,
        targets.map((t) => ({ id: t.id, patch: { x: t.startX + dx, y: t.startY + dy } })),
      );
      // clear the imperative transform now that the store holds the real position
      for (const t of targets) t.node.style.transform = "";
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [slideId, nodesRef]);

  return { onPointerDown };
}
