import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pagination } from "@/components/Pagination";
import { getCurrentUser } from "@/lib/auth";
import {
  deleteQuiz,
  getFavoriteQuizzes,
  getPublicQuizzes,
  getUserQuizzes,
  toggleFavorite,
  type SavedQuiz,
} from "@/lib/quizStorage";
import { DeleteQuizDialog } from "@/components/DeleteQuizDialog";
import { toast } from "sonner";
import { Edit, Play, Search, Star, Trash2 } from "lucide-react";
import { t } from "@/lib/i18n";
import { useCollectionFilters } from "@/hooks/useCollectionFilters";

const MyPolls = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [myPolls, setMyPolls] = useState<SavedQuiz[]>([]);
  const [favoritePolls, setFavoritePolls] = useState<SavedQuiz[]>([]);
  const [publicPolls, setPublicPolls] = useState<SavedQuiz[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pollToDelete, setPollToDelete] = useState<SavedQuiz | null>(null);
  const [activeTab, setActiveTab] = useState("my");

  const loadPolls = useCallback(() => {
    if (!user) return;
    const all = getUserQuizzes(user.id);
    const pub = getPublicQuizzes();
    const fav = getFavoriteQuizzes(user.id);
    setMyPolls(all.filter((q) => q.type === "poll"));
    setPublicPolls(pub.filter((q) => q.type === "poll"));
    setFavoritePolls(fav.filter((q) => q.type === "poll"));
  }, [user]);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    loadPolls();
  }, [user, navigate, loadPolls]);

  const myFilters = useCollectionFilters(myPolls);
  const favFilters = useCollectionFilters(favoritePolls);
  const pubFilters = useCollectionFilters(publicPolls);

  const filtersFor = (tab: string) =>
    tab === "favorites" ? favFilters : tab === "public" ? pubFilters : myFilters;

  const handleDeleteClick = (poll: SavedQuiz) => { setPollToDelete(poll); setDeleteDialogOpen(true); };
  const handleDeleteConfirm = () => {
    if (pollToDelete && deleteQuiz(pollToDelete.id)) { toast.success(t("pollDeleted")); loadPolls(); }
    setDeleteDialogOpen(false); setPollToDelete(null);
  };
  const handleToggleFavorite = (event: MouseEvent, poll: SavedQuiz) => {
    event.stopPropagation();
    const updated = toggleFavorite(poll.id);
    if (updated) { toast.success(updated.isFavorite ? t("addedToFavorites") : t("removedFromFavorites")); loadPolls(); }
  };
  const handleLaunchPoll = (poll: SavedQuiz) => {
    localStorage.setItem(`poll-${poll.id}`, JSON.stringify(poll));
    navigate(`/quiz/${poll.id}`);
  };
  const handleEditPoll = (event: MouseEvent, pollId: string) => {
    event.stopPropagation();
    navigate(`/builder?type=poll&quizId=${pollId}`);
  };

  const renderFilters = (tab: string) => {
    const f = filtersFor(tab);
    return (
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Rechercher..." value={f.search} onChange={(e) => f.setSearch(e.target.value)} className="pl-9 rounded-xl border-slate-200" />
        </div>
        <Select value={f.category} onValueChange={f.setCategory}>
          <SelectTrigger className="w-[160px] rounded-xl border-slate-200"><SelectValue placeholder="Catégorie" /></SelectTrigger>
          <SelectContent className="bg-popover z-50">{f.categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={f.sort} onValueChange={(v) => f.setSort(v as any)}>
          <SelectTrigger className="w-[150px] rounded-xl border-slate-200"><SelectValue placeholder="Trier" /></SelectTrigger>
          <SelectContent className="bg-popover z-50">
            <SelectItem value="newest">Plus récent</SelectItem>
            <SelectItem value="oldest">Plus ancien</SelectItem>
            <SelectItem value="az">A → Z</SelectItem>
            <SelectItem value="questions">Nb questions</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  };

  const renderPollCard = (poll: SavedQuiz, showActions = true) => (
    <div
      key={poll.id}
      className="flex h-full cursor-pointer flex-col rounded-2xl border border-slate-100 bg-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover overflow-hidden"
      onClick={() => navigate(`/builder?type=poll&quizId=${poll.id}`)}
    >
      {poll.headerImage && (
        <div className="relative h-40 w-full overflow-hidden">
          <img src={poll.headerImage} alt={poll.title} className="h-full w-full object-cover" />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="text-base font-bold text-slate-900">{poll.title}</h3>
            <p className="mt-0.5 text-sm text-slate-500 line-clamp-2">{poll.description}</p>
          </div>
          <button onClick={(e) => handleToggleFavorite(e, poll)} className="text-amber-400 hover:text-amber-500 transition-colors cursor-pointer p-1">
            <Star className={`h-4 w-4 ${poll.isFavorite ? "fill-amber-400" : ""}`} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <Badge variant="outline" className="rounded-full text-xs border-slate-200 text-slate-500">
            {poll.questions.length} {poll.questions.length > 1 ? t("questions") : t("question")}
          </Badge>
          {poll.tags?.map((tag) => (
            <Badge key={tag} variant="outline" className="rounded-full text-xs border-slate-200 text-slate-500">#{tag}</Badge>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <div className="flex gap-1">
            {showActions && (
              <>
                <button onClick={(e) => handleEditPoll(e, poll.id)} title={t("edit")} className="cursor-pointer p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"><Edit className="h-4 w-4" /></button>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(poll); }} title={t("delete")} className="cursor-pointer p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="h-4 w-4" /></button>
              </>
            )}
          </div>
          <Button size="sm" onClick={(e) => { e.stopPropagation(); handleLaunchPoll(poll); }} className="rounded-full bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 gap-1.5 px-4">
            <Play className="h-3.5 w-3.5" />{t("launchPoll")}
          </Button>
        </div>
      </div>
    </div>
  );

  const renderTabContent = (tab: string, allItems: SavedQuiz[], emptyKey: string, ctaKey?: string, showActions = true) => {
    const f = filtersFor(tab);
    if (allItems.length === 0) return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
        <p className="text-sm text-muted-foreground">{t(emptyKey as any)}</p>
        {ctaKey && <Button className="mt-4" onClick={() => navigate('/builder-start?type=poll')}>{t(ctaKey as any)}</Button>}
      </div>
    );
    return (
      <>
        {renderFilters(tab)}
        {f.paginated.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Aucun résultat pour cette recherche.</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {f.paginated.map((p) => renderPollCard(p, showActions))}
          </div>
        )}
        <Pagination page={f.page} totalPages={f.totalPages} onPageChange={f.setPage} className="mt-8" />
      </>
    );
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Header subtitle={t("myPolls")} />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("myPolls")}</h1>
            <p className="text-muted-foreground">{t("myPollsSubtitle")}</p>
          </div>
          <Button onClick={() => navigate('/builder-start?type=poll')}>{t("createPollCta")}</Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="my">{`${t("myPollsTab")} (${myPolls.length})`}</TabsTrigger>
            <TabsTrigger value="favorites">{`${t("favoritesTab")} (${favoritePolls.length})`}</TabsTrigger>
            <TabsTrigger value="public">{`${t("publicPollsTab")} (${publicPolls.length})`}</TabsTrigger>
          </TabsList>
          <TabsContent value="my">{renderTabContent("my", myPolls, "noPollsSaved", "createPollCta")}</TabsContent>
          <TabsContent value="favorites">{renderTabContent("favorites", favoritePolls, "noFavoritePolls")}</TabsContent>
          <TabsContent value="public">{renderTabContent("public", publicPolls, "noPublicPolls", undefined, false)}</TabsContent>
        </Tabs>
      </div>

      <DeleteQuizDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} onConfirm={handleDeleteConfirm} title={pollToDelete?.title || ""} type="poll" />
    </div>
  );
};

export default MyPolls;
