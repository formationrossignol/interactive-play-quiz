import type { ImageElement } from "../types/presentation";
import { Skeleton } from "@/components/ui/skeleton";

export function ImageElementView({ element }: { element: ImageElement }) {
  const cropStyle: React.CSSProperties = element.crop
    ? { objectPosition: `-${element.crop.x}px -${element.crop.y}px` }
    : {};

  if (!element.src) {
    return (
      <div style={{ width: "100%", height: "100%", border: "1px dashed var(--ap-line)", borderRadius: element.borderRadius, overflow: "hidden" }}>
        <Skeleton className="h-full w-full rounded-none" />
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
