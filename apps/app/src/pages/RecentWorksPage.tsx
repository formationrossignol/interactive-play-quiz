import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { RecentWorkCard } from "@/components/dashboard/RecentWorks";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/skeletons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination } from "@/components/Pagination";
import { MaterialSymbol } from "@/components/MaterialSymbol";
import { getCurrentUser } from "@/lib/auth";
import { listRecentContent } from "@/lib/content/contentRepo";
import type { ContentRow } from "@/lib/content/types";
import { useSEO } from "@/hooks/useSEO";

const PAGE_SIZE = 12;
const LABELS: Record<string, string> = { all: "Tous les types", quiz: "Quiz", poll: "Sondages", flashcard: "Flashcards", slide: "Présentations", course: "Cours", exam: "Examens" };

export default function RecentWorksPage() {
  const user = getCurrentUser();
  const [rows, setRows] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);

  useSEO({
    title: "Travaux récents",
    description: "Retrouvez tous vos contenus récemment modifiés.",
    path: "/recent",
  });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listRecentContent(user.id, 300)
      .then((data) => { if (!cancelled) setRows(data); })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr");
    return rows
      .filter((row) => type === "all" || row.type === type)
      .filter((row) => !needle || String(row.data.title ?? "Sans titre").toLocaleLowerCase("fr").includes(needle) || String(row.data.description ?? "").toLocaleLowerCase("fr").includes(needle))
      .sort((left, right) => {
        if (sort === "title") return String(left.data.title ?? "").localeCompare(String(right.data.title ?? ""), "fr");
        return (sort === "oldest" ? 1 : -1) * (new Date(left.updated_at).getTime() - new Date(right.updated_at).getTime());
      });
  }, [rows, query, type, sort]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const displayed = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const resetFilters = () => { setQuery(""); setType("all"); setSort("recent"); setPage(1); };

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppLayout subtitle="Travaux récents">
      <div className="product-page product-recent-page">
        <PageHeader title="Travaux récents" description="Tous vos contenus, classés par dernière modification." />
        <section className="product-recent-filters" aria-label="Rechercher et filtrer les travaux récents">
          <div className="product-recent-search">
            <MaterialSymbol name="search" size={18} />
            <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Rechercher par titre ou description…" aria-label="Rechercher dans les travaux récents" />
          </div>
          <Select value={type} onValueChange={(value) => { setType(value); setPage(1); }}><SelectTrigger aria-label="Filtrer par type"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(LABELS).map(([value, label]) => <SelectItem value={value} key={value}>{label}</SelectItem>)}</SelectContent></Select>
          <Select value={sort} onValueChange={(value) => { setSort(value); setPage(1); }}><SelectTrigger aria-label="Trier les travaux"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="recent">Plus récents</SelectItem><SelectItem value="oldest">Plus anciens</SelectItem><SelectItem value="title">Titre A–Z</SelectItem></SelectContent></Select>
        </section>
        {loading ? (
          <div className="product-recent-grid product-recent-grid--all" aria-label="Chargement des travaux récents">
            {Array.from({ length: 8 }, (_, index) => <CardSkeleton key={index} withAction={false} mediaClassName="h-[150px] w-full rounded-xl" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="product-empty-inline"><strong>Aucun travail récent</strong><span>Vos prochains contenus apparaîtront ici.</span></div>
        ) : filtered.length === 0 ? (
          <div className="product-empty-inline"><MaterialSymbol name="search_off" size={26} /><strong>Aucun résultat</strong><span>Essayez une autre recherche ou réinitialisez vos filtres.</span><button className="ap-btn ap-btn--ghost ap-btn--sm" onClick={resetFilters}>Réinitialiser</button></div>
        ) : (
          <>
            <div className="product-recent-results"><span>{filtered.length} contenu{filtered.length > 1 ? "s" : ""}</span><span>Page {page} sur {totalPages}</span></div>
            <div className="product-recent-grid product-recent-grid--all">
              {displayed.map((row) => <RecentWorkCard key={row.id} row={row} />)}
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-10" />
          </>
        )}
      </div>
    </AppLayout>
  );
}
