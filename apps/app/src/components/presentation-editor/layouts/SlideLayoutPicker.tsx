import { LayoutTemplate } from "lucide-react";
import { SLIDE_LAYOUTS, type SlideLayoutId } from "./slideLayouts";

export function SlideLayoutPicker({
  value,
  onSelect,
}: {
  value?: SlideLayoutId;
  onSelect: (layoutId: SlideLayoutId) => void;
}) {
  return (
    <div
      role="menu"
      aria-label="Mises en page"
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        left: 0,
        width: 420,
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 8,
        padding: 10,
        background: "var(--ap-card)",
        border: "var(--ap-border-w) solid var(--ap-line)",
        borderRadius: "var(--ap-r-md)",
        boxShadow: "var(--ap-shadow-card)",
        zIndex: 30,
      }}
    >
      {SLIDE_LAYOUTS.map((layout) => {
        const selected = value === layout.id;
        return (
          <button
            key={layout.id}
            type="button"
            role="menuitem"
            onClick={() => onSelect(layout.id)}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              padding: 9,
              textAlign: "left",
              border: `2px solid ${selected ? "var(--ap-brand)" : "var(--ap-line)"}`,
              borderRadius: "var(--ap-r-sm)",
              background: selected ? "var(--ap-brand-soft)" : "var(--ap-card)",
              color: "var(--ap-ink)",
              cursor: "pointer",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 58,
                height: 34,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                borderRadius: 5,
                border: "1px solid var(--ap-line-2)",
                background: "white",
                color: selected ? "var(--ap-brand)" : "var(--ap-muted)",
              }}
            >
              <LayoutTemplate size={18} />
            </span>
            <span style={{ minWidth: 0 }}>
              <strong style={{ display: "block", fontSize: 12 }}>{layout.label}</strong>
              <span style={{ display: "block", marginTop: 2, fontSize: 10.5, color: "var(--ap-muted)", lineHeight: 1.25 }}>
                {layout.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
