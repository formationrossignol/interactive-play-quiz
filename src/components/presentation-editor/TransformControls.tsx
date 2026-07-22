import { useRef } from "react";
import { useDocStore } from "./store/useDocStore";
import { useHistoryStore } from "./store/useHistoryStore";
import type { SlideElement } from "./types/presentation";

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type Handle = (typeof HANDLES)[number];

interface TransformControlsProps {
  slideId: string;
  element: SlideElement;
  zoom: number;
  node: HTMLElement | null; // the element's own DOM node, for imperative style writes
}

export function TransformControls({ slideId, element, zoom, node }: TransformControlsProps) {
  const startRef = useRef<{ x: number; y: number; width: number; height: number; clientX: number; clientY: number } | null>(null);

  function onResizeStart(e: React.PointerEvent, handle: Handle) {
    e.stopPropagation();
    startRef.current = { x: element.x, y: element.y, width: element.width, height: element.height, clientX: e.clientX, clientY: e.clientY };

    function onMove(moveEvent: PointerEvent) {
      const start = startRef.current;
      if (!start || !node) return;
      const dx = (moveEvent.clientX - start.clientX) / zoom;
      const dy = (moveEvent.clientY - start.clientY) / zoom;

      let { x, y, width, height } = start;
      if (handle.includes("e")) width = Math.max(10, start.width + dx);
      if (handle.includes("s")) height = Math.max(10, start.height + dy);
      if (handle.includes("w")) {
        const newWidth = Math.max(10, start.width - dx);
        x = start.x + (start.width - newWidth);
        width = newWidth;
      }
      if (handle.includes("n")) {
        const newHeight = Math.max(10, start.height - dy);
        y = start.y + (start.height - newHeight);
        height = newHeight;
      }

      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      node.style.width = `${width}px`;
      node.style.height = `${height}px`;
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const start = startRef.current;
      startRef.current = null;
      if (!start || !node) return;
      useHistoryStore.getState().commit();
      useDocStore.getState().updateElement(slideId, element.id, {
        x: parseFloat(node.style.left), y: parseFloat(node.style.top),
        width: parseFloat(node.style.width), height: parseFloat(node.style.height),
      });
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function onRotateStart(e: React.PointerEvent) {
    e.stopPropagation();
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    function angleAt(clientX: number, clientY: number) {
      return (Math.atan2(clientY - centerY, clientX - centerX) * 180) / Math.PI + 90;
    }
    const startAngle = angleAt(e.clientX, e.clientY) - element.rotation;

    function onMove(moveEvent: PointerEvent) {
      if (!node) return;
      const rotation = angleAt(moveEvent.clientX, moveEvent.clientY) - startAngle;
      node.style.transform = `rotate(${rotation}deg)`;
      node.dataset.pendingRotation = String(rotation);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (!node) return;
      const rotation = parseFloat(node.dataset.pendingRotation ?? String(element.rotation));
      delete node.dataset.pendingRotation;
      useHistoryStore.getState().commit();
      useDocStore.getState().updateElement(slideId, element.id, { rotation });
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const size = 8 / zoom;
  const handleStyle = (handle: Handle): React.CSSProperties => {
    const pos: Record<Handle, React.CSSProperties> = {
      nw: { left: -size / 2, top: -size / 2, cursor: "nwse-resize" },
      n: { left: "50%", top: -size / 2, marginLeft: -size / 2, cursor: "ns-resize" },
      ne: { right: -size / 2, top: -size / 2, cursor: "nesw-resize" },
      e: { right: -size / 2, top: "50%", marginTop: -size / 2, cursor: "ew-resize" },
      se: { right: -size / 2, bottom: -size / 2, cursor: "nwse-resize" },
      s: { left: "50%", bottom: -size / 2, marginLeft: -size / 2, cursor: "ns-resize" },
      sw: { left: -size / 2, bottom: -size / 2, cursor: "nesw-resize" },
      w: { left: -size / 2, top: "50%", marginTop: -size / 2, cursor: "ew-resize" },
    };
    return { position: "absolute", width: size, height: size, background: "#fff", border: "1px solid var(--ap-brand)", ...pos[handle] };
  };

  return (
    <div style={{ position: "absolute", left: element.x, top: element.y, width: element.width, height: element.height, pointerEvents: "none" }}>
      {HANDLES.map((h) => (
        <div key={h} style={{ ...handleStyle(h), pointerEvents: "auto" }} onPointerDown={(e) => onResizeStart(e, h)} />
      ))}
      <div
        style={{ position: "absolute", left: "50%", top: -24 / zoom, width: size, height: size, marginLeft: -size / 2, borderRadius: "50%", background: "#fff", border: "1px solid var(--ap-brand)", cursor: "grab", pointerEvents: "auto" }}
        onPointerDown={onRotateStart}
      />
    </div>
  );
}
