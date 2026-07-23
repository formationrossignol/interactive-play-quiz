// src/components/presentation-editor/utils/createElement.ts
import type { ImageElement, LineElement, ShapeElement, SlideElement, TextElement, VideoElement } from "../types/presentation";
import type { EditorTool } from "../store/useEditorUIStore";

export type DrawableTool = Exclude<EditorTool, "select">;

/** Below this drag distance (px, slide space) a gesture counts as a plain
 *  click — the element gets a default size centered on the click point
 *  instead of the (near-zero) dragged rectangle. */
export const DRAG_MIN_PX = 6;

const DEFAULT_SIZE: Record<DrawableTool, { width: number; height: number }> = {
  text: { width: 320, height: 80 },
  rect: { width: 200, height: 140 },
  circle: { width: 160, height: 160 },
  image: { width: 320, height: 240 },
  video: { width: 480, height: 270 },
  line: { width: 200, height: 0 },
  arrow: { width: 200, height: 0 },
};

export function blankRichText(): TextElement["richText"] {
  return { type: "doc", content: [{ type: "paragraph", content: [] }] };
}

/**
 * Builds the new element for a drawing gesture on the canvas: `start`/`end`
 * are pointerdown/pointerup coordinates in slide space (already divided by
 * zoom). Image/video are created with an empty `src` — the caller fills it
 * in once the upload finishes.
 */
export function createElementForTool(
  tool: DrawableTool,
  id: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
  zIndex: number,
): SlideElement {
  const base = { id, rotation: 0, zIndex, opacity: 1, locked: false, visible: true };

  if (tool === "line" || tool === "arrow") {
    const dragged = Math.hypot(end.x - start.x, end.y - start.y) >= DRAG_MIN_PX;
    const p2 = dragged ? end : { x: start.x + DEFAULT_SIZE[tool].width, y: start.y };
    return {
      ...base,
      type: tool,
      x: Math.min(start.x, p2.x),
      y: Math.min(start.y, p2.y),
      width: Math.abs(p2.x - start.x),
      height: Math.abs(p2.y - start.y),
      points: [[start.x, start.y], [p2.x, p2.y]],
      stroke: "#1f2937",
      strokeWidth: 3,
    } satisfies LineElement;
  }

  const dragged = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) >= DRAG_MIN_PX;
  const size = DEFAULT_SIZE[tool];
  const rect = dragged
    ? {
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y),
      }
    : { x: start.x - size.width / 2, y: start.y - size.height / 2, width: size.width, height: size.height };

  if (tool === "text") {
    return { ...base, type: "text", ...rect, richText: blankRichText() } satisfies TextElement;
  }
  if (tool === "rect" || tool === "circle") {
    return { ...base, type: tool, ...rect, fill: "#6c63ff" } satisfies ShapeElement;
  }
  if (tool === "image") {
    return { ...base, type: "image", ...rect, src: "", borderRadius: 0, borderWidth: 0, borderColor: "transparent" } satisfies ImageElement;
  }
  return { ...base, type: "video", ...rect, src: "", provider: "upload" } satisfies VideoElement;
}
