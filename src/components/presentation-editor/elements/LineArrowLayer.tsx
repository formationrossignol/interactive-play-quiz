import { useId } from "react";
import type { LineElement } from "../types/presentation";

/** One shared <svg> for every line/arrow on the slide — see design doc's
 *  rendering rationale (single layer for correct z-order + hit-testing). */
export function LineArrowLayer({ lines, width, height }: { lines: LineElement[]; width: number; height: number }) {
  const markerId = `arrowhead-${useId()}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <defs>
        <marker id={markerId} markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <polygon points="0 0, 10 5, 0 10" />
        </marker>
      </defs>
      {lines.map((line) => (
        <polyline
          key={line.id}
          points={line.points.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          stroke={line.stroke}
          strokeWidth={line.strokeWidth}
          markerEnd={line.type === "arrow" ? `url(#${markerId})` : undefined}
        />
      ))}
    </svg>
  );
}
