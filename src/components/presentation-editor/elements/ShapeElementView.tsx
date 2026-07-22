import type { ShapeElement } from "../types/presentation";

export function ShapeElementView({ element }: { element: ShapeElement }) {
  if (element.type === "circle") {
    return (
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <ellipse cx={50} cy={50} rx={50} ry={50} fill={element.fill} stroke={element.stroke} strokeWidth={element.strokeWidth} />
      </svg>
    );
  }
  return (
    <div style={{ width: "100%", height: "100%", background: element.fill, border: element.stroke ? `${element.strokeWidth ?? 1}px solid ${element.stroke}` : undefined }} />
  );
}
