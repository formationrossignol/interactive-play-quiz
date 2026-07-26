import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DisabledReasonProps {
  reason?: string;
  className?: string;
  children: (descriptionId?: string) => ReactNode;
}

/**
 * Keeps an unavailable action in its usual position and explains the
 * prerequisite directly beside it. The render prop links the control to the
 * explanation with aria-describedby.
 */
export function DisabledReason({ reason, className, children }: DisabledReasonProps) {
  const generatedId = useId();
  const descriptionId = reason ? generatedId : undefined;

  return (
    <div className={cn("inline-flex flex-col items-start gap-1.5", className)}>
      {children(descriptionId)}
      {reason && (
        <p id={descriptionId} className="m-0 max-w-64 text-xs font-semibold leading-snug text-muted-foreground">
          {reason}
        </p>
      )}
    </div>
  );
}
