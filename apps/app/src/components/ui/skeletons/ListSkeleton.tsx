import { Skeleton } from "@/components/ui/skeleton";

/** Rows of icon/avatar + two text lines — feeds, notifications, search results. */
export function ListSkeleton({
  rows = 5,
  withAvatar = true,
  avatarClassName = "rounded-full",
}: {
  rows?: number;
  withAvatar?: boolean;
  avatarClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Chargement de la liste">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          {withAvatar && <Skeleton className={`h-9 w-9 shrink-0 ${avatarClassName}`} />}
          <div className="flex-1">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="mt-2 h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
