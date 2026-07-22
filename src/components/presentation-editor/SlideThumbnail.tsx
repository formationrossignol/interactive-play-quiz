import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Slide } from "./types/presentation";

interface SlideThumbnailProps {
  slide: Slide;
  index: number;
  presentationWidth: number;
  presentationHeight: number;
  isActive: boolean;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
}

/** Scaled-down, non-interactive read of the slide — reuses the same
 *  element data but renders it inert (no drag/edit handlers) at ~1/8
 *  scale via CSS transform, so there is no separate thumbnail renderer to
 *  keep in sync with the real canvas. */
export function SlideThumbnail({ slide, index, presentationWidth, presentationHeight, isActive, isSelected, onSelect }: SlideThumbnailProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id });
  const THUMB_WIDTH = 160;
  const scale = THUMB_WIDTH / presentationWidth;
  const thumbHeight = presentationHeight * scale;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      style={{
        transform: CSS.Transform.toString(transform), transition,
        opacity: isDragging ? 0.4 : slide.hidden ? 0.5 : 1,
        cursor: "pointer",
        border: `2px solid ${isActive || isSelected ? "var(--ap-brand)" : "var(--ap-line)"}`,
        borderRadius: "var(--ap-r-sm)",
        overflow: "hidden",
        width: THUMB_WIDTH, height: thumbHeight,
        position: "relative", flexShrink: 0,
        background: slide.background?.value ?? "#fff",
      }}
    >
      <span style={{ position: "absolute", left: 4, top: 2, fontSize: 10, fontWeight: 800, color: "var(--ap-muted)" }}>{index + 1}</span>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${scale})`, transformOrigin: "top left", width: presentationWidth, height: presentationHeight, pointerEvents: "none" }}>
        {slide.elements.filter((e) => e.visible).map((e) => (
          <div key={e.id} style={{ position: "absolute", left: e.x, top: e.y, width: e.width, height: e.height, background: e.type === "rect" || e.type === "circle" ? (e as { fill?: string }).fill : undefined }} />
        ))}
      </div>
      {slide.hidden && <span style={{ position: "absolute", right: 4, top: 2, fontSize: 10 }}>🚫</span>}
    </div>
  );
}
