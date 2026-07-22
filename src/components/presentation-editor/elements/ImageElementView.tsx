import type { ImageElement } from "../types/presentation";

export function ImageElementView({ element }: { element: ImageElement }) {
  const cropStyle: React.CSSProperties = element.crop
    ? { objectPosition: `-${element.crop.x}px -${element.crop.y}px` }
    : {};
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
