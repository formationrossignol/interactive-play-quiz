import { Image, LayoutPanelLeft, LayoutPanelTop, PanelRight, Rows3 } from "lucide-react";
import { QUESTION_LAYOUTS, type QuestionLayoutId } from "@/lib/contentLayouts";

const ICONS = {
  standard: Rows3,
  "media-top": LayoutPanelTop,
  "media-left": LayoutPanelLeft,
  "media-right": PanelRight,
  "media-background": Image,
} as const;

export function QuestionLayoutPicker({
  value,
  onChange,
  compact = false,
}: {
  value?: QuestionLayoutId;
  onChange: (layout: QuestionLayoutId) => void;
  compact?: boolean;
}) {
  return (
    <div>
      {!compact && (
        <div style={{ marginBottom: 9 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ap-muted)" }}>
            Mise en page
          </div>
          <div style={{ marginTop: 3, color: "var(--ap-muted)", fontSize: 12, fontWeight: 650 }}>
            Choisissez comment la question et son média occupent l’écran.
          </div>
        </div>
      )}
      <div
        role="radiogroup"
        aria-label="Mise en page de la question"
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "repeat(5, minmax(0, 1fr))" : "repeat(auto-fit, minmax(110px, 1fr))",
          gap: 8,
        }}
      >
        {QUESTION_LAYOUTS.map((layout) => {
          const Icon = ICONS[layout.id];
          const selected = (value ?? "standard") === layout.id;
          return (
            <button
              key={layout.id}
              type="button"
              role="radio"
              aria-checked={selected}
              title={layout.description}
              onClick={() => onChange(layout.id)}
              style={{
                minWidth: 0,
                display: "flex",
                flexDirection: compact ? "column" : "row",
                alignItems: "center",
                justifyContent: compact ? "center" : "flex-start",
                gap: compact ? 4 : 8,
                padding: compact ? "8px 4px" : "10px",
                borderRadius: 12,
                border: `2px solid ${selected ? "var(--ap-brand)" : "var(--ap-line)"}`,
                background: selected ? "var(--ap-brand-soft)" : "var(--ap-card)",
                color: selected ? "var(--ap-brand-deep)" : "var(--ap-muted)",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: compact ? 9.5 : 12,
                fontWeight: 800,
              }}
            >
              <Icon size={compact ? 17 : 19} aria-hidden="true" />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{layout.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
