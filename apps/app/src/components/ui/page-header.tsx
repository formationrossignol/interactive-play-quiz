import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** Semantic section label retained for callers; breadcrumbs are no longer
   * rendered because the persistent sidebar already carries location. */
  eyebrow?: string;
  /** Rendered top-right, next to the title (typically the primary CTA `<Button>`). */
  action?: ReactNode;
  className?: string;
}

/** Shared MaterialPro title and action row used by list-style pages. */
export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <div className={`product-page-heading${className ? ` ${className}` : ""}`}>
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="product-page-heading__actions">{action}</div> : null}
    </div>
  );
}
