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
    <div className={`product-page-heading${className ? ` ${className}` : ""}`}>
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div style={{ display: "flex", gap: 10 }}>{action}</div> : null}
    </div>
  );
}
