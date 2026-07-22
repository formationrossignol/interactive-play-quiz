import type { SlideElement } from "../types/presentation";
import { TextElementView } from "./TextElementView";
import { ImageElementView } from "./ImageElementView";
import { ShapeElementView } from "./ShapeElementView";
import { VideoElementView } from "./VideoElementView";
import { GroupElementView } from "./GroupElementView";

interface CanvasElementProps {
  element: SlideElement;
  elementRef: (node: HTMLDivElement | null) => void;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
}

/** Lines/arrows are excluded here — they render in the shared LineArrowLayer,
 *  not as individual positioned divs (see design doc).
 *
 *  `elementRef`/`onPointerDown` attach directly to THIS root div — the one
 *  that actually carries `position: absolute; left; top; width; height`.
 *  Later tasks (drag, resize/rotate) read/write `.style.left/.top/.width/
 *  .height/.transform` on the node they get from `elementRef` — if that ref
 *  ever pointed at a plain wrapper around this div instead of this div
 *  itself, those writes would silently no-op (`left`/`top` only affect
 *  positioned elements). Never wrap this component in another div to attach
 *  handlers — extend these two props instead. */
export function CanvasElement({ element, elementRef, onPointerDown }: CanvasElementProps) {
  if (element.type === "line" || element.type === "arrow") return null;
  if (!element.visible) return null;

  return (
    <div
      ref={elementRef}
      data-element-id={element.id}
      onPointerDown={onPointerDown}
      style={{
        position: "absolute",
        left: element.x, top: element.y,
        width: element.width, height: element.height,
        transform: `rotate(${element.rotation}deg)`,
        opacity: element.opacity,
        zIndex: element.zIndex,
        pointerEvents: element.locked ? "none" : "auto",
      }}
    >
      {element.type === "text" && <TextElementView element={element} />}
      {element.type === "image" && <ImageElementView element={element} />}
      {(element.type === "rect" || element.type === "circle") && <ShapeElementView element={element} />}
      {element.type === "video" && <VideoElementView element={element} />}
      {element.type === "group" && <GroupElementView />}
    </div>
  );
}
