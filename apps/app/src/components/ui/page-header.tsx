import type { ReactNode } from "react";

import { Breadcrumb, type BreadcrumbItem } from "@/components/Breadcrumb";

export interface PageHeaderProps {
  onHome: () => void;
  breadcrumbItems: BreadcrumbItem[];
  eyebrow: string;
  title: string;
  description?: ReactNode;
  /** Rendered top-right, next to the breadcrumb (typically the primary CTA `<Button>`). */
  action?: ReactNode;
  className?: string;
}

/** Shared eyebrow/title/description block used at the top of every list-style page (breadcrumb row + heading). */
export function PageHeader({ onHome, breadcrumbItems, eyebrow, title, description, action, className }: PageHeaderProps) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Breadcrumb onHome={onHome} items={breadcrumbItems} />
        {action}
      </div>

      <header className="mb-7 mt-7">
        <p className="ap-muted text-xs font-extrabold uppercase tracking-[.08em]">{eyebrow}</p>
        <h1 className="ap-h1 mt-1 text-3xl md:text-4xl">{title}</h1>
        {description ? <p className="ap-muted mt-2 max-w-3xl text-sm">{description}</p> : null}
      </header>
    </div>
  );
}
