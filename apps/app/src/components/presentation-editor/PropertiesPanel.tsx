import { useDocStore } from "./store/useDocStore";
import { useEditorUIStore } from "./store/useEditorUIStore";
import { useHistoryStore } from "./store/useHistoryStore";
import type { ImageElement, ShapeElement, SlideBackground, SlideElement } from "./types/presentation";

function NumberField({ label, value, onCommit }: { label: string; value: number; onCommit: (n: number) => void }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--ap-muted)" }}>
      {label}
      <input
        type="number"
        defaultValue={value}
        onBlur={(e) => onCommit(Number(e.target.value))}
        style={{ border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-sm)", padding: "6px 8px", fontSize: 13 }}
      />
    </label>
  );
}

function SlideBackgroundPanel({ slideId }: { slideId: string }) {
  const presentation = useDocStore((s) => s.presentation);
  const slide = presentation?.slides.find((s) => s.id === slideId);
  const background = slide?.background;

  function commit(background: SlideBackground | undefined) {
    useHistoryStore.getState().commit();
    useDocStore.getState().setSlideBackground(slideId, background);
  }

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, width: 240 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ap-muted)" }}>Aucune sélection</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4, borderTop: "var(--ap-border-w) solid var(--ap-line)" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ap-muted)" }}>Fond de la diapositive</span>

        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
          Couleur
          <input
            type="color"
            value={background?.type === "color" ? background.value : "#ffffff"}
            onChange={(e) => commit({ type: "color", value: e.target.value })}
            style={{ width: 32, height: 28, border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-sm)", cursor: "pointer", background: "transparent" }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--ap-muted)" }}>
          Image (URL)
          <input
            type="text"
            placeholder="https://…"
            defaultValue={background?.type === "image" ? background.value : ""}
            onBlur={(e) => {
              const url = e.target.value.trim();
              if (url) commit({ type: "image", value: url });
            }}
            style={{ border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-sm)", padding: "6px 8px", fontSize: 13 }}
          />
        </label>

        {background && (
          <button className="ap-btn ap-btn--ghost ap-btn--sm" onClick={() => commit(undefined)}>
            Réinitialiser le fond
          </button>
        )}
      </div>
    </div>
  );
}

export function PropertiesPanel({ slideId }: { slideId: string }) {
  const presentation = useDocStore((s) => s.presentation);
  const selectedIds = useEditorUIStore((s) => s.selectedIds);
  const slide = presentation?.slides.find((s) => s.id === slideId);
  const selected: SlideElement[] = slide ? slide.elements.filter((el) => selectedIds.has(el.id)) : [];

  if (selected.length === 0) {
    return <SlideBackgroundPanel slideId={slideId} />;
  }
  if (selected.length !== 1) {
    return <div style={{ padding: 16, fontSize: 13, color: "var(--ap-muted)" }}>{`${selected.length} éléments sélectionnés`}</div>;
  }
  const el = selected[0];

  function commit(patch: Partial<SlideElement>) {
    useHistoryStore.getState().commit();
    useDocStore.getState().updateElement(slideId, el.id, patch);
  }

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, width: 240 }}>
      <div key={el.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <NumberField label="X" value={el.x} onCommit={(x) => commit({ x })} />
        <NumberField label="Y" value={el.y} onCommit={(y) => commit({ y })} />
        <NumberField label="Largeur" value={el.width} onCommit={(width) => commit({ width })} />
        <NumberField label="Hauteur" value={el.height} onCommit={(height) => commit({ height })} />
        <NumberField label="Rotation" value={el.rotation} onCommit={(rotation) => commit({ rotation })} />
        <NumberField label="Opacité (%)" value={Math.round(el.opacity * 100)} onCommit={(pct) => commit({ opacity: Math.min(1, Math.max(0, pct / 100)) })} />
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <input type="checkbox" checked={el.locked} onChange={(e) => commit({ locked: e.target.checked })} />
        Verrouillé
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <input type="checkbox" checked={el.visible} onChange={(e) => commit({ visible: e.target.checked })} />
        Visible
      </label>

      {(el.type === "rect" || el.type === "circle") && (
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--ap-muted)" }}>
          Couleur de remplissage
          <input type="color" value={(el as ShapeElement).fill} onChange={(e) => commit({ fill: e.target.value } as Partial<ShapeElement>)} />
        </label>
      )}

      {el.type === "image" && (
        <>
          <NumberField label="Coins arrondis" value={(el as ImageElement).borderRadius} onCommit={(borderRadius) => commit({ borderRadius } as Partial<ImageElement>)} />
          <NumberField label="Épaisseur bordure" value={(el as ImageElement).borderWidth} onCommit={(borderWidth) => commit({ borderWidth } as Partial<ImageElement>)} />
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--ap-muted)" }}>
            Couleur bordure
            <input type="color" value={(el as ImageElement).borderColor} onChange={(e) => commit({ borderColor: e.target.value } as Partial<ImageElement>)} />
          </label>
        </>
      )}
    </div>
  );
}
