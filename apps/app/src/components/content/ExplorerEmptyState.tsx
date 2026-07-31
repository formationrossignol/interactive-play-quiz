import type { ReactNode } from "react";

interface ExplorerEmptyStateProps {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}

/** Shared empty state for every library shortcut and collection. */
export function ExplorerEmptyState({ icon, title, body, action }: ExplorerEmptyStateProps) {
  return (
    <div
      className="product-empty-state"
      style={{
        borderRadius: "var(--ap-r-lg)",
        border: "var(--ap-border-w) dashed var(--ap-line-2)",
        background: "var(--ap-paper-2)",
        padding: "48px 24px",
        textAlign: "center",
        maxWidth: 680,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          margin: "0 auto 16px",
          borderRadius: "var(--ap-r-md)",
          background: "var(--ap-card)",
          border: "var(--ap-border-w) solid var(--ap-line)",
          display: "grid",
          placeItems: "center",
          color: "var(--ap-brand)",
        }}
      >
        {icon}
      </div>
      <h3 className="ap-h3" style={{ fontSize: 19, marginBottom: 6 }}>{title}</h3>
      <p className="ap-muted" style={{ maxWidth: 620, margin: action ? "0 auto 20px" : "0 auto", fontSize: 14 }}>
        {body}
      </p>
      {action}
    </div>
  );
}
