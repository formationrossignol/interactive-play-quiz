// src/components/presentation-editor/EditorToolbar.tsx
import { useDocStore } from "./store/useDocStore";
import { useEditorUIStore, type EditorTool } from "./store/useEditorUIStore";
import { useHistoryStore } from "./store/useHistoryStore";
import { alignLeft, alignCenterH, alignRight, alignTop, alignMiddleV, alignBottom, distributeHorizontal, distributeVertical } from "./utils/geometry";
import type { SlideElement } from "./types/presentation";

const TOOLS: { id: EditorTool; label: string }[] = [
  { id: "select", label: "Sélection" },
  { id: "text", label: "Texte" },
  { id: "image", label: "Image" },
  { id: "rect", label: "Rectangle" },
  { id: "circle", label: "Cercle" },
  { id: "line", label: "Ligne" },
  { id: "arrow", label: "Flèche" },
  { id: "video", label: "Vidéo" },
];

export function EditorToolbar({ slideId }: { slideId: string }) {
  const activeTool = useEditorUIStore((s) => s.activeTool);
  const setActiveTool = useEditorUIStore((s) => s.setActiveTool);
  const selectedIds = useEditorUIStore((s) => s.selectedIds);
  const presentation = useDocStore((s) => s.presentation);

  const slide = presentation?.slides.find((s) => s.id === slideId);
  const selected = slide ? slide.elements.filter((el) => selectedIds.has(el.id)) : [];

  function applyAlign(fn: (els: SlideElement[]) => SlideElement[]) {
    if (selected.length < 2) return;
    useHistoryStore.getState().commit();
    const updated = fn(selected);
    useDocStore.getState().updateElements(slideId, updated.map((el) => ({ id: el.id, patch: el })));
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "var(--ap-border-w) solid var(--ap-line)", flexWrap: "wrap" }}>
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          onClick={() => setActiveTool(tool.id)}
          className="ap-btn ap-btn--sm ap-btn--pill"
          aria-pressed={activeTool === tool.id}
          style={{ background: activeTool === tool.id ? "var(--ap-brand)" : "var(--ap-card)", color: activeTool === tool.id ? "#fff" : "var(--ap-ink)" }}
        >
          {tool.label}
        </button>
      ))}

      {selected.length >= 2 && (
        <>
          <span style={{ width: 1, height: 20, background: "var(--ap-line)", margin: "0 4px" }} />
          <button className="ap-btn ap-btn--sm ap-btn--ghost" aria-label="Aligner à gauche" onClick={() => applyAlign(alignLeft)}>⟸</button>
          <button className="ap-btn ap-btn--sm ap-btn--ghost" aria-label="Centrer horizontalement" onClick={() => applyAlign(alignCenterH)}>⇹</button>
          <button className="ap-btn ap-btn--sm ap-btn--ghost" aria-label="Aligner à droite" onClick={() => applyAlign(alignRight)}>⟹</button>
          <button className="ap-btn ap-btn--sm ap-btn--ghost" aria-label="Aligner en haut" onClick={() => applyAlign(alignTop)}>⟰</button>
          <button className="ap-btn ap-btn--sm ap-btn--ghost" aria-label="Centrer verticalement" onClick={() => applyAlign(alignMiddleV)}>⇳</button>
          <button className="ap-btn ap-btn--sm ap-btn--ghost" aria-label="Aligner en bas" onClick={() => applyAlign(alignBottom)}>⟱</button>
          {selected.length >= 3 && (
            <>
              <button className="ap-btn ap-btn--sm ap-btn--ghost" aria-label="Distribuer horizontalement" onClick={() => applyAlign(distributeHorizontal)}>⇔</button>
              <button className="ap-btn ap-btn--sm ap-btn--ghost" aria-label="Distribuer verticalement" onClick={() => applyAlign(distributeVertical)}>⇕</button>
            </>
          )}
          <button
            className="ap-btn ap-btn--sm ap-btn--ghost"
            onClick={() => {
              useHistoryStore.getState().commit();
              useDocStore.getState().groupElements(slideId, [...selectedIds]);
            }}
          >
            Grouper
          </button>
        </>
      )}
      {selected.length === 1 && selected[0].type === "group" && (
        <button
          className="ap-btn ap-btn--sm ap-btn--ghost"
          onClick={() => {
            useHistoryStore.getState().commit();
            useDocStore.getState().ungroupElements(slideId, selected[0].id);
          }}
        >
          Dégrouper
        </button>
      )}
    </div>
  );
}
