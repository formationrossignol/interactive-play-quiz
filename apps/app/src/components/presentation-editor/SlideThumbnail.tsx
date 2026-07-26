import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EyeOff } from "lucide-react";
import type { PresentationFooter, PresentationTheme, Slide } from "./types/presentation";
import { SlideFooter } from "./SlideFooter";

interface SlideThumbnailProps {
  slide: Slide;
  index: number;
  presentationWidth: number;
  presentationHeight: number;
  footer?: PresentationFooter;
  theme?: PresentationTheme;
  isActive: boolean;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
}

/** Scaled-down, non-interactive read of the slide — reuses the same
 *  element data but renders it inert (no drag/edit handlers) at ~1/8
 *  scale via CSS transform, so there is no separate thumbnail renderer to
 *  keep in sync with the real canvas. */
export function SlideThumbnail({ slide, index, presentationWidth, presentationHeight, footer, theme, isActive, isSelected, onSelect }: SlideThumbnailProps) {
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
        background: slide.background?.value ?? theme?.backgroundColor ?? "#fff",
        color: theme?.textColor ?? "#24202d",
        fontFamily: theme?.fontFamily ?? "Arial, sans-serif",
      }}
    >
      <span style={{ position: "absolute", left: 4, top: 2, fontSize: 10, fontWeight: 800, color: "var(--ap-muted)" }}>{index + 1}</span>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${scale})`, transformOrigin: "top left", width: presentationWidth, height: presentationHeight, pointerEvents: "none" }}>
        {slide.elements.filter((e) => e.visible).map((e) => {
          if (e.type === "line" || e.type === "arrow" || e.type === "group") return null;
          const style: React.CSSProperties = { position: "absolute", left: e.x, top: e.y, width: e.width, height: e.height };
          if (e.type === "rect" || e.type === "circle") {
            style.background = (e as { fill?: string }).fill;
          } else if (e.type === "text") {
            style.background = "var(--ap-line)";
          } else if (e.type === "video") {
            style.background = "var(--ap-ink)";
          } else if (e.type === "table") {
            style.backgroundColor = e.cellFill;
            style.backgroundImage = `linear-gradient(${e.borderColor} ${e.borderWidth}px, transparent ${e.borderWidth}px), linear-gradient(90deg, ${e.borderColor} ${e.borderWidth}px, transparent ${e.borderWidth}px)`;
            style.backgroundSize = `${100 / e.columns}% ${100 / e.rows}%`;
          }
          if (e.type === "image") {
            return <img key={e.id} src={(e as { src: string }).src} alt="" style={{ ...style, objectFit: "cover" }} />;
          }
          return <div key={e.id} style={style} />;
        })}
        <SlideFooter footer={footer} slideNumber={index + 1} isTitleSlide={index === 0} />
      </div>
      {slide.hidden && (
        <EyeOff
          aria-label="Diapositive masquée"
          style={{ position: "absolute", right: 4, top: 3, width: 12, height: 12, color: "var(--ap-muted)" }}
        />
      )}
    </div>
  );
}
