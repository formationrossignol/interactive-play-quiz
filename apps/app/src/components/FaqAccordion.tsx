import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export interface FaqItemData {
  q: string;
  a: string;
}

const FaqItem = ({ q, a }: FaqItemData) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "var(--ap-border-w) solid var(--ap-line)" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 0", background: "none", border: "none", cursor: "pointer",
          textAlign: "left", gap: "12px",
        }}
      >
        <span style={{ fontFamily: "var(--ap-font-display)", fontWeight: 700, fontSize: "15px", color: "var(--ap-ink)", flex: 1 }}>
          {q}
        </span>
        {open
          ? <ChevronUp style={{ width: 18, height: 18, color: "var(--ap-brand)", flexShrink: 0 }} />
          : <ChevronDown style={{ width: 18, height: 18, color: "var(--ap-muted)", flexShrink: 0 }} />}
      </button>
      {open && (
        <p style={{ fontFamily: "var(--ap-font-body)", fontSize: "14px", lineHeight: 1.6, color: "var(--ap-muted)", paddingBottom: "18px" }}>
          {a}
        </p>
      )}
    </div>
  );
};

export const FaqAccordion = ({ items }: { items: FaqItemData[] }) => (
  <div className="ap-card" style={{ padding: "8px 28px" }}>
    {items.map((item) => (
      <FaqItem key={item.q} q={item.q} a={item.a} />
    ))}
  </div>
);
