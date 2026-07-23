import { Loader2 } from "lucide-react";
import type { ImageElement } from "../types/presentation";

export function ImageElementView({ element }: { element: ImageElement }) {
  const cropStyle: React.CSSProperties = element.crop
    ? { objectPosition: `-${element.crop.x}px -${element.crop.y}px` }
    : {};

  if (!element.src) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ap-paper-2)", border: "1px dashed var(--ap-line)", borderRadius: element.borderRadius, color: "var(--ap-muted)" }}>
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <img
      src={element.src}
      alt=""
      style={{
        width: "100%", height: "100%", objectFit: "cover",
        borderRadius: element.borderRadius,
        border: element.borderWidth > 0 ? `${element.borderWidth}px solid ${element.borderColor}` : undefined,
        ...cropStyle,
      }}
      draggable={false}
    />
  );
}
