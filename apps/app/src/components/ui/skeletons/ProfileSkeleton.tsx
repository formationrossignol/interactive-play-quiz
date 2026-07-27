import { Skeleton } from "@/components/ui/skeleton";

/** Avatar + name/subtitle + a few bio lines — profile headers, account panels. */
export function ProfileSkeleton({ bioLines = 3 }: { bioLines?: number }) {
  return (
    <div role="status" aria-label="Chargement du profil">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-3.5 w-24" />
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-2">
        {Array.from({ length: bioLines }, (_, index) => (
          <Skeleton key={index} className={`h-3.5 ${index === bioLines - 1 ? "w-1/2" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}
