import { useId } from "react";
import type { LineElement } from "../types/presentation";

interface LineArrowLayerProps {
  lines: LineElement[];
  width: number;
  height: number;
  selectedIds?: Set<string>;
  activeTool?: string;
  onSelect?: (id: string, additive: boolean) => void;
}

/** One shared <svg> for every line/arrow on the slide — see design doc's
 *  rendering rationale (single layer for correct z-order + hit-testing).
 *
 *  Lines/arrows aren't part of `selectable` in SlideCanvas (no bounding-box
 *  drag/resize support yet — see useKeyboardShortcuts' line-aware nudge for
 *  why that's deliberately not wired up here too), but they must still be
 *  selectable and deletable: a wide invisible hit-stroke per line captures
 *  the click and calls `onSelect`, which adds the id to selectedIds the same
 *  way clicking a CanvasElement does — Delete/Backspace, copy/cut/paste and
 *  arrow-key nudge in useKeyboardShortcuts already operate on any element in
 *  selectedIds regardless of this layer. */
export function LineArrowLayer({ lines, width, height, selectedIds, activeTool, onSelect }: LineArrowLayerProps) {
  const markerId = `arrowhead-${useId()}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <defs>
        <marker id={markerId} markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <polygon points="0 0, 10 5, 0 10" />
        </marker>
      </defs>
      {lines.map((line) => {
        const isSelected = selectedIds?.has(line.id) ?? false;
        const pointsAttr = line.points.map(([x, y]) => `${x},${y}`).join(" ");
        return (
          <g key={line.id}>
            <polyline
              points={pointsAttr}
              fill="none"
              stroke={line.stroke}
              strokeWidth={line.strokeWidth}
              markerEnd={line.type === "arrow" ? `url(#${markerId})` : undefined}
            />
            {isSelected && (
              <polyline
                points={pointsAttr}
                fill="none"
                stroke="var(--ap-brand, #6c63ff)"
                strokeWidth={Math.max(line.strokeWidth + 4, 8)}
                strokeOpacity={0.35}
                strokeLinecap="round"
              />
            )}
            {/* Invisible wide hit target — the visible stroke above is often
               too thin to click reliably, and only this element (not the
               svg root) accepts pointer events. */}
            <polyline
              points={pointsAttr}
              fill="none"
              stroke="transparent"
              strokeWidth={Math.max(line.strokeWidth, 16)}
              style={{ pointerEvents: activeTool === "select" ? "stroke" : "none", cursor: "pointer" }}
              onPointerDown={(e) => {
                if (activeTool !== "select" || !onSelect) return;
                e.stopPropagation();
                onSelect(line.id, e.shiftKey);
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}
