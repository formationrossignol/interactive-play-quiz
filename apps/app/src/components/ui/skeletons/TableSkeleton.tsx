import { Skeleton } from "@/components/ui/skeleton";

/** Header row + rows×cols grid of bars — admin tables, data grids. */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Chargement du tableau">
      <div className="flex gap-4">
        {Array.from({ length: cols }, (_, index) => (
          <Skeleton key={index} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4">
          {Array.from({ length: cols }, (_, colIndex) => (
            <Skeleton key={colIndex} className="h-8 flex-1 rounded-md" />
          ))}
        </div>
      ))}
    </div>
  );
}
