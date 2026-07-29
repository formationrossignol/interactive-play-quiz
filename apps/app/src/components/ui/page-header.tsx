import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** Rendered top-right, next to the title (typically the primary CTA `<Button>`). */
  action?: ReactNode;
  className?: string;
}

/** Shared title/description block used at the top of every list-style page, matching the app-wide header convention (no breadcrumb, no eyebrow). */
export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <div
      className={className}
      style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start", justifyContent: "space-between", marginBottom: 36 }}
    >
      <div>
        <h1 className="ap-h2" style={{ fontSize: 28, marginBottom: 6 }}>{title}</h1>
        {description ? <p className="ap-muted" style={{ fontSize: 14 }}>{description}</p> : null}
      </div>
      {action ? <div style={{ display: "flex", gap: 10 }}>{action}</div> : null}
    </div>
  );
}
