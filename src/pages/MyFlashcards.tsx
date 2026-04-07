import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth";
import {
  deleteQuiz,
  getFavoriteFlashcardSets,
  getPublicFlashcardSets,
  getUserFlashcardSets,
  toggleFavorite,
  type SavedQuiz,
} from "@/lib/quizStorage";
import { toast } from "sonner";
import { Edit, Star, Trash2 } from "lucide-react";
import { DeleteQuizDialog } from "@/components/DeleteQuizDialog";
import { t } from "@/lib/i18n";

const MyFlashcards = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [myFlashcards, setMyFlashcards] = useState<SavedQuiz[]>([]);
  const [favoriteFlashcards, setFavoriteFlashcards] = useState<SavedQuiz[]>([]);
  const [publicFlashcards, setPublicFlashcards] = useState<SavedQuiz[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [setToDelete, setSetToDelete] = useState<SavedQuiz | null>(null);

  const loadFlashcards = useCallback(() => {
    if (!user) return;
    setMyFlashcards(getUserFlashcardSets(user.id));
    setFavoriteFlashcards(getFavoriteFlashcardSets(user.id));
    setPublicFlashcards(getPublicFlashcardSets());
  }, [user]);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    loadFlashcards();
  }, [user, navigate, loadFlashcards]);

  const handleDeleteClick = (set: SavedQuiz) => {
    setSetToDelete(set);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (setToDelete && deleteQuiz(setToDelete.id)) {
      toast.success(t("flashcardDeleted"));
      loadFlashcards();
    }
    setDeleteDialogOpen(false);
    setSetToDelete(null);
  };

  const handleToggleFavorite = (event: MouseEvent, cardSet: SavedQuiz) => {
    event.stopPropagation();
    const updated = toggleFavorite(cardSet.id);
    if (updated) {
      toast.success(updated.isFavorite ? t("addedToFavorites") : t("removedFromFavorites"));
      loadFlashcards();
    }
  };

  const renderCard = (cardSet: SavedQuiz, showActions = true) => (
    <div
      key={cardSet.id}
      className="card-flashcard flex h-full cursor-pointer flex-col rounded-2xl border border-slate-100 bg-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover overflow-hidden"
      onClick={() => navigate(`/builder?type=flashcard&quizId=${cardSet.id}`)}
    >
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="text-base font-bold text-slate-900">{cardSet.title}</h3>
            <p className="mt-0.5 text-sm text-slate-500 line-clamp-2">{cardSet.description}</p>
          </div>
          <button
            onClick={(e) => handleToggleFavorite(e, cardSet)}
            className="text-amber-400 hover:text-amber-500 transition-colors cursor-pointer p-1"
            aria-label="Toggle favorite"
          >
            <Star className={`h-4 w-4 ${cardSet.isFavorite ? "fill-amber-400" : ""}`} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <Badge variant="outline" className="rounded-full text-xs border-slate-200 text-slate-500">
            {cardSet.questions.length} {cardSet.questions.length > 1 ? t("cards") : t("card")}
          </Badge>
          {cardSet.isPublic && (
            <Badge variant="outline" className="rounded-full text-xs border-indigo-200 bg-indigo-50 text-indigo-700">
              {t("publicBadge")}
            </Badge>
          )}
          {cardSet.tags?.map((tag) => (
            <Badge key={tag} variant="outline" className="rounded-full text-xs border-slate-200 text-slate-500">
              #{tag}
            </Badge>
          ))}
        </div>
        {showActions && (
          <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <div className="flex gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/builder?type=flashcard&quizId=${cardSet.id}`);
                }}
                title={t("edit")}
                className="cursor-pointer p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label={t("edit")}
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                className="cursor-pointer p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClick(cardSet);
                }}
                title={t("delete")}
                aria-label={t("delete")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/builder?type=flashcard&quizId=${cardSet.id}`);
              }}
              className="rounded-full bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors px-4"
            >
              {t("editSet")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Header subtitle={t("myFlashcards")} />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("myFlashcards")}</h1>
            <p className="text-muted-foreground">{t("myFlashcardsSubtitle")}</p>
          </div>
          <Button onClick={() => navigate('/builder-start?type=flashcard')}>
            {t("createFlashcardSet")}
          </Button>
        </div>

        <Tabs defaultValue="my" className="mt-8 space-y-4">
          <TabsList>
            <TabsTrigger value="my">{`${t("myFlashcardsTab")} (${myFlashcards.length})`}</TabsTrigger>
            <TabsTrigger value="favorites">{`${t("favoritesTab")} (${favoriteFlashcards.length})`}</TabsTrigger>
            <TabsTrigger value="public">{`${t("publicFlashcardsTab")} (${publicFlashcards.length})`}</TabsTrigger>
          </TabsList>

          <TabsContent value="my">
            {myFlashcards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
                <p className="text-sm text-muted-foreground">{t("noFlashcardsSaved")}</p>
                <Button className="mt-4" onClick={() => navigate('/builder-start?type=flashcard')}>
                  {t("createFlashcardSet")}
                </Button>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {myFlashcards.map((cardSet) => renderCard(cardSet))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="favorites">
            {favoriteFlashcards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
                <p className="text-sm text-muted-foreground">{t("noFavoriteFlashcards")}</p>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {favoriteFlashcards.map((cardSet) => renderCard(cardSet, false))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="public">
            {publicFlashcards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
                <p className="text-sm text-muted-foreground">{t("noPublicFlashcards")}</p>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {publicFlashcards.map((cardSet) => renderCard(cardSet, false))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <DeleteQuizDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title={setToDelete?.title || ""}
        type="flashcard"
      />
    </div>
  );
};

export default MyFlashcards;
