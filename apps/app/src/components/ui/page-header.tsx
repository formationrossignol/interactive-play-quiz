import type { ReactNode } from "react";
import { MaterialSymbol } from "@/components/MaterialSymbol";

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** Small MaterialPro-style section label rendered above the page title. */
  eyebrow?: string;
  /** Rendered top-right, next to the title (typically the primary CTA `<Button>`). */
  action?: ReactNode;
  className?: string;
}

/** Shared MaterialPro title, breadcrumb and action row used by list-style pages. */
export function PageHeader({ title, description, eyebrow = "Workspace", action, className }: PageHeaderProps) {
  return (
    <div className={`product-page-heading${className ? ` ${className}` : ""}`}>
      <div>
        <div className="product-page-heading__breadcrumb" aria-label={`Brivia, ${title}`}>
          <MaterialSymbol name="home" size={15} />
          <span>Brivia</span>
          <MaterialSymbol name="chevron_right" size={15} />
          <strong>{eyebrow}</strong>
        </div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="product-page-heading__actions">{action}</div> : null}
    </div>
  );
}
