import { boundingBoxOf } from "./utils/geometry";
import type { SlideElement } from "./types/presentation";

interface SelectionOverlayProps {
  slideId: string;
  elements: SlideElement[];
  selectedIds: Set<string>;
  zoom: number;
}

/** Draws a dashed outline around each selected element, plus one solid
 *  bounding box when 2+ are selected (multi-select group handles hook into
 *  this box in Task 11). Purely visual — no pointer handling here, that
 *  lives in TransformControls (Task 11). */
export function SelectionOverlay({ elements, selectedIds, zoom }: SelectionOverlayProps) {
  const selected = elements.filter((e) => selectedIds.has(e.id));
  if (selected.length === 0) return null;

  const box = selected.length > 1 ? boundingBoxOf(selected) : null;

  return (
    <>
      {selected.map((e) => (
        <div
          key={e.id}
          style={{
            position: "absolute",
            left: e.x, top: e.y, width: e.width, height: e.height,
            border: `${1.5 / zoom}px dashed var(--ap-brand)`,
            pointerEvents: "none",
          }}
        />
      ))}
      {box && (
        <div
          style={{
            position: "absolute",
            left: box.x, top: box.y, width: box.width, height: box.height,
            border: `${2 / zoom}px solid var(--ap-brand)`,
            pointerEvents: "none",
          }}
        />
      )}
    </>
  );
}
