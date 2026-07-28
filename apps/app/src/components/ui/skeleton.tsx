import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ap-skeleton-shimmer rounded-md", className)} aria-hidden="true" {...props} />;
}

/** Wrap a button's label with this to show shimmer instead of a spinner while an
 *  action is in flight. Content stays in the layout (just hidden) so the button
 *  keeps its width/height — no shimmer, no layout jump either way. */
function ButtonShimmerLabel({ loading, children }: { loading?: boolean; children: ReactNode }) {
  if (!loading) return <>{children}</>;
  return (
    <span className="relative inline-flex items-center gap-2">
      <span className="invisible inline-flex items-center gap-2">{children}</span>
      <span className="ap-skeleton-shimmer absolute inset-0 rounded-md" aria-hidden="true" />
    </span>
  );
}

export { Skeleton, ButtonShimmerLabel };
