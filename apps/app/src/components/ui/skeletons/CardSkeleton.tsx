import { Skeleton } from "@/components/ui/skeleton";

/** Single card placeholder: media + title/subtitle + optional action pill. */
export function CardSkeleton({
  withMedia = true,
  withAction = true,
  mediaClassName = "h-32 w-full rounded-xl",
  className,
}: {
  withMedia?: boolean;
  withAction?: boolean;
  mediaClassName?: string;
  className?: string;
}) {
  return (
    <div className={className} role="status" aria-label="Chargement">
      {withMedia && <Skeleton className={`mb-3 ${mediaClassName}`} />}
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="mt-2 h-3 w-1/2" />
      {withAction && <Skeleton className="mt-4 h-9 w-28 rounded-full" />}
    </div>
  );
}
