import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { RecentWorkCard } from "@/components/dashboard/RecentWorks";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/skeletons";
import { getCurrentUser } from "@/lib/auth";
import { listRecentContent } from "@/lib/content/contentRepo";
import type { ContentRow } from "@/lib/content/types";
import { useSEO } from "@/hooks/useSEO";

export default function RecentWorksPage() {
  const user = getCurrentUser();
  const [rows, setRows] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useSEO({
    title: "Travaux récents",
    description: "Retrouvez tous vos contenus récemment modifiés.",
    path: "/recent",
  });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listRecentContent(user.id, 100)
      .then((data) => { if (!cancelled) setRows(data); })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppLayout subtitle="Travaux récents">
      <div className="product-page product-recent-page">
        <PageHeader title="Travaux récents" description="Tous vos contenus, classés par dernière modification." />
        {loading ? (
          <div className="product-recent-grid product-recent-grid--all" aria-label="Chargement des travaux récents">
            {Array.from({ length: 8 }, (_, index) => <CardSkeleton key={index} withAction={false} mediaClassName="h-[150px] w-full rounded-xl" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="product-empty-inline"><strong>Aucun travail récent</strong><span>Vos prochains contenus apparaîtront ici.</span></div>
        ) : (
          <div className="product-recent-grid product-recent-grid--all">
            {rows.map((row) => <RecentWorkCard key={row.id} row={row} />)}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
