import { Skeleton } from "@/components/ui/skeleton";

/** Shown while a lazy route chunk loads — replaces the blank flash. */
export const RouteFallback = () => (
  <div
    style={{ minHeight: "100vh", padding: 24 }}
    role="status"
    aria-label="Chargement de la page"
  >
    <div style={{ maxWidth: 1120, margin: "0 auto" }}>
      <div className="mb-8 flex items-center gap-4">
        <Skeleton className="h-11 w-11 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-36 w-full rounded-2xl" />)}
      </div>
      <Skeleton className="mt-7 h-64 w-full rounded-2xl" />
    </div>
  </div>
);
