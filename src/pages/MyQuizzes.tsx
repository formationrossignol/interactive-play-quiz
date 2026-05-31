import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pagination } from "@/components/Pagination";
import { RatingStars } from "@/components/RatingStars";
import { getCurrentUser } from "@/lib/auth";
import {
  deleteQuiz,
  getFavoriteQuizzes,
  getPublicQuizzes,
  getUserQuizzes,
  rateQuiz,
  toggleFavorite,
  type SavedQuiz,
} from "@/lib/quizStorage";
import { DeleteQuizDialog } from "@/components/DeleteQuizDialog";
import { toast } from "sonner";
import { Edit, Play, Search, Star, Trash2 } from "lucide-react";
import { t } from "@/lib/i18n";
import { useCollectionFilters } from "@/hooks/useCollectionFilters";

const MyQuizzes = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [myQuizzes, setMyQuizzes] = useState<SavedQuiz[]>([]);
  const [favoriteQuizzes, setFavoriteQuizzes] = useState<SavedQuiz[]>([]);
  const [publicQuizzes, setPublicQuizzes] = useState<SavedQuiz[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState<SavedQuiz | null>(null);
  const [activeTab, setActiveTab] = useState("my");

  const loadQuizzes = useCallback(() => {
    if (!user) return;
    const userQuizzes = getUserQuizzes(user.id);
    const publicQuizzesData = getPublicQuizzes();
    const favorite = getFavoriteQuizzes(user.id);
    setMyQuizzes(userQuizzes.filter((q) => q.type === "quiz"));
    setPublicQuizzes(publicQuizzesData.filter((q) => q.type === "quiz"));
    setFavoriteQuizzes(favorite.filter((q) => q.type === "quiz"));
  }, [user]);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    loadQuizzes();
  }, [user, navigate, loadQuizzes]);

  const myFilters = useCollectionFilters(myQuizzes);
  const favFilters = useCollectionFilters(favoriteQuizzes);
  const pubFilters = useCollectionFilters(publicQuizzes);

  const filtersFor = (tab: string) =>
    tab === "favorites" ? favFilters : tab === "public" ? pubFilters : myFilters;

  const handleDeleteClick = (quiz: SavedQuiz) => { setQuizToDelete(quiz); setDeleteDialogOpen(true); };
  const handleDeleteConfirm = () => {
    if (quizToDelete && deleteQuiz(quizToDelete.id)) { toast.success(t("quizDeleted")); loadQuizzes(); }
    setDeleteDialogOpen(false); setQuizToDelete(null);
  };
  const handleToggleFavorite = (event: MouseEvent, quiz: SavedQuiz) => {
    event.stopPropagation();
    const updated = toggleFavorite(quiz.id);
    if (updated) { toast.success(updated.isFavorite ? t("addedToFavorites") : t("removedFromFavorites")); loadQuizzes(); }
  };
  const handlePlayQuiz = (quiz: SavedQuiz) => {
    localStorage.setItem(`quiz-${quiz.id}`, JSON.stringify(quiz));
    navigate(`/quiz/${quiz.id}`);
  };
  const handleEditQuiz = (event: MouseEvent, quizId: string) => {
    event.stopPropagation();
    navigate(`/builder?type=quiz&quizId=${quizId}`);
  };
  const handleRateQuiz = (quizId: string, rating: number) => {
    if (rateQuiz(quizId, rating)) { toast.success("Merci pour votre note !"); loadQuizzes(); }
  };

  const renderFilters = (tab: string) => {
    const f = filtersFor(tab);
    return (
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Rechercher..."
            value={f.search}
            onChange={(e) => f.setSearch(e.target.value)}
            className="pl-9 rounded-xl border-slate-200"
          />
        </div>
        <Select value={f.category} onValueChange={f.setCategory}>
          <SelectTrigger className="w-[160px] rounded-xl border-slate-200">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            {f.categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={f.sort} onValueChange={(v) => f.setSort(v as any)}>
          <SelectTrigger className="w-[150px] rounded-xl border-slate-200">
            <SelectValue placeholder="Trier" />
          </SelectTrigger>
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

  const renderQuizCard = (quiz: SavedQuiz, showActions = true) => (
    <div
      key={quiz.id}
      className="flex h-full cursor-pointer flex-col rounded-2xl border border-slate-100 bg-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover overflow-hidden"
      onClick={() => navigate(`/builder?type=quiz&quizId=${quiz.id}`)}
    >
      {quiz.headerImage && (
        <div className="relative h-40 w-full overflow-hidden">
          <img src={quiz.headerImage} alt={quiz.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="text-base font-bold text-slate-900">{quiz.title}</h3>
            <p className="mt-0.5 text-sm text-slate-500 line-clamp-2">{quiz.description}</p>
          </div>
          <button onClick={(e) => handleToggleFavorite(e, quiz)} className="text-amber-400 hover:text-amber-500 transition-colors cursor-pointer p-1">
            <Star className={`h-4 w-4 ${quiz.isFavorite ? "fill-amber-400" : ""}`} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <Badge variant="outline" className={`rounded-full text-xs ${quiz.isPublic ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500"}`}>
            {quiz.isPublic ? t("publicBadge") : t("privateBadge")}
          </Badge>
          <Badge variant="outline" className="rounded-full text-xs border-slate-200 text-slate-500">
            {quiz.questions.length} {quiz.questions.length > 1 ? t("questions") : t("question")}
          </Badge>
          {quiz.tags?.map((tag) => (
            <Badge key={tag} variant="outline" className="rounded-full text-xs border-slate-200 text-slate-500">#{tag}</Badge>
          ))}
        </div>
        {quiz.isPublic && (
          <div className="border-t border-slate-100 pt-3 mb-3">
            <RatingStars rating={quiz.rating || 0} ratingCount={quiz.ratingCount} onRate={(r) => handleRateQuiz(quiz.id, r)} readonly={quiz.userId === user?.id} />
          </div>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <div className="flex gap-1">
            {showActions && (
              <>
                <button onClick={(e) => handleEditQuiz(e, quiz.id)} title={t("edit")} className="cursor-pointer p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"><Edit className="h-4 w-4" /></button>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(quiz); }} title={t("delete")} className="cursor-pointer p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="h-4 w-4" /></button>
              </>
            )}
          </div>
          <Button size="sm" onClick={(e) => { e.stopPropagation(); handlePlayQuiz(quiz); }} className="ap-btn ap-btn--sm ap-btn--pill ap-btn--quiz gap-1.5 px-4">
            <Play className="h-3.5 w-3.5" />{t("playQuiz")}
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
        {ctaKey && <Button className="mt-4" onClick={() => navigate('/builder-start?type=quiz')}>{t(ctaKey as any)}</Button>}
      </div>
    );
    return (
      <>
        {renderFilters(tab)}
        {f.paginated.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Aucun résultat pour cette recherche.</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {f.paginated.map((q) => renderQuizCard(q, showActions))}
          </div>
        )}
        <Pagination page={f.page} totalPages={f.totalPages} onPageChange={f.setPage} className="mt-8" />
      </>
    );
  };

  if (!user) return null;

  return (
    <div className="min-h-screen ">
      <Header subtitle={t("myQuizzes")} />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("myQuizzes")}</h1>
            <p className="text-muted-foreground">{t("myQuizzesSubtitle")}</p>
          </div>
          <Button onClick={() => navigate('/builder-start?type=quiz')}>{t("createQuizCta")}</Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="my">{`${t("myQuizzesTab")} (${myQuizzes.length})`}</TabsTrigger>
            <TabsTrigger value="favorites">{`${t("favoritesTab")} (${favoriteQuizzes.length})`}</TabsTrigger>
            <TabsTrigger value="public">{`${t("publicQuizzesTab")} (${publicQuizzes.length})`}</TabsTrigger>
          </TabsList>
          <TabsContent value="my">{renderTabContent("my", myQuizzes, "noQuizzesSaved", "createQuizCta")}</TabsContent>
          <TabsContent value="favorites">{renderTabContent("favorites", favoriteQuizzes, "noFavoriteQuizzes", undefined, favoriteQuizzes.some((q) => q.userId === user.id))}</TabsContent>
          <TabsContent value="public">{renderTabContent("public", publicQuizzes, "noPublicQuizzes", undefined, false)}</TabsContent>
        </Tabs>
      </div>

      <DeleteQuizDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} onConfirm={handleDeleteConfirm} title={quizToDelete?.title || ""} type="quiz" />
    </div>
  );
};

export default MyQuizzes;
