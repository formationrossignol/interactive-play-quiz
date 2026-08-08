import { Skeleton } from "@/components/ui/skeleton";

/** A complete MaterialPro page placeholder. It mirrors the real information
 * architecture (toolbar, filters, title, cards and footers) so route loading
 * never falls back to a spinner or an implausible blank rectangle. */
export function PageSkeleton({ tiles = 6 }: { tiles?: number }) {
  return (
    <div className="product-route-skeleton" role="status" aria-label="Chargement de la page">
      <div className="product-route-skeleton__toolbar">
        <div>
          <Skeleton className="h-3 w-36" />
          <Skeleton className="mt-2 h-4 w-64 max-w-full" />
        </div>
        <div className="product-route-skeleton__toolbar-actions">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
      </div>
      <div className="product-route-skeleton__filters">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-32 rounded-lg" />
        ))}
      </div>
      <div className="product-route-skeleton__body">
        <div className="product-route-skeleton__title">
          <Skeleton className="h-5 w-60 max-w-full" />
          <Skeleton className="mt-3 h-3.5 w-96 max-w-full" />
        </div>
        <div className="product-route-skeleton__grid">
          {Array.from({ length: tiles }, (_, index) => (
            <div key={index} className="product-route-skeleton__card">
              <Skeleton className="h-40 w-full rounded-none" />
              <div className="product-route-skeleton__card-copy">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-3 h-3 w-5/6" />
                <Skeleton className="mt-2 h-3 w-1/2" />
              </div>
              <div className="product-route-skeleton__card-footer">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-7 rounded-full" />
              </div>
            </div>
          ))}
        </div>
        <span className="sr-only">Les contenus sont en cours de chargement.</span>
      </div>
    </div>
  );
}
