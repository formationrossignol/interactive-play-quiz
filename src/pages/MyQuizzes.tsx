import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Edit, Play, Star, Trash2 } from "lucide-react";
import { t } from "@/lib/i18n";

const MyQuizzes = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [myQuizzes, setMyQuizzes] = useState<SavedQuiz[]>([]);
  const [favoriteQuizzes, setFavoriteQuizzes] = useState<SavedQuiz[]>([]);
  const [publicQuizzes, setPublicQuizzes] = useState<SavedQuiz[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState<SavedQuiz | null>(null);

  const loadQuizzes = useCallback(() => {
    if (!user) return;
    const userQuizzes = getUserQuizzes(user.id);
    const publicQuizzesData = getPublicQuizzes();
    const favorite = getFavoriteQuizzes(user.id);

    setMyQuizzes(userQuizzes.filter((quiz) => quiz.type === "quiz"));
    setPublicQuizzes(publicQuizzesData.filter((quiz) => quiz.type === "quiz"));
    setFavoriteQuizzes(favorite.filter((quiz) => quiz.type === "quiz"));
  }, [user]);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    loadQuizzes();
  }, [user, navigate, loadQuizzes]);

  const handleDeleteClick = (quiz: SavedQuiz) => {
    setQuizToDelete(quiz);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (quizToDelete && deleteQuiz(quizToDelete.id)) {
      toast.success(t("quizDeleted"));
      loadQuizzes();
    }
    setDeleteDialogOpen(false);
    setQuizToDelete(null);
  };

  const handleToggleFavorite = (event: MouseEvent, quiz: SavedQuiz) => {
    event.stopPropagation();
    const updated = toggleFavorite(quiz.id);
    if (updated) {
      toast.success(updated.isFavorite ? t("addedToFavorites") : t("removedFromFavorites"));
      loadQuizzes();
    }
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
    const result = rateQuiz(quizId, rating);
    if (result) {
      toast.success("Merci pour votre note !");
      loadQuizzes();
    }
  };

  const renderQuizCard = (quiz: SavedQuiz, showActions = true) => (
    <div
      key={quiz.id}
      className="card-quiz flex h-full cursor-pointer flex-col rounded-2xl border border-slate-100 bg-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover overflow-hidden"
      onClick={() => navigate(`/builder?type=quiz&quizId=${quiz.id}`)}
    >
      {quiz.headerImage && (
        <div className="relative h-40 w-full overflow-hidden">
          <img
            src={quiz.headerImage}
            alt={quiz.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="text-base font-bold text-slate-900">{quiz.title}</h3>
            <p className="mt-0.5 text-sm text-slate-500 line-clamp-2">{quiz.description}</p>
          </div>
          <button
            onClick={(event) => handleToggleFavorite(event, quiz)}
            className="text-amber-400 hover:text-amber-500 transition-colors cursor-pointer p-1"
            aria-label="Toggle favorite"
          >
            <Star className={`h-4 w-4 ${quiz.isFavorite ? "fill-amber-400" : ""}`} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <Badge
            variant="outline"
            className={`rounded-full text-xs ${quiz.isPublic ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500"}`}
          >
            {quiz.isPublic ? t("publicBadge") : t("privateBadge")}
          </Badge>
          <Badge variant="outline" className="rounded-full text-xs border-slate-200 text-slate-500">
            {quiz.questions.length} {quiz.questions.length > 1 ? t("questions") : t("question")}
          </Badge>
          {quiz.tags?.map((tag) => (
            <Badge key={tag} variant="outline" className="rounded-full text-xs border-slate-200 text-slate-500">
              #{tag}
            </Badge>
          ))}
        </div>
        {quiz.isPublic && (
          <div className="border-t border-slate-100 pt-3 mb-3">
            <RatingStars
              rating={quiz.rating || 0}
              ratingCount={quiz.ratingCount}
              onRate={(rating) => handleRateQuiz(quiz.id, rating)}
              readonly={quiz.userId === user?.id}
            />
          </div>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <div className="flex gap-1">
            {showActions && (
              <>
                <button
                  onClick={(event) => handleEditQuiz(event, quiz.id)}
                  title={t("edit")}
                  className="cursor-pointer p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  aria-label={t("edit")}
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  className="cursor-pointer p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  onClick={(event) => { event.stopPropagation(); handleDeleteClick(quiz); }}
                  title={t("delete")}
                  aria-label={t("delete")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
          <Button
            size="sm"
            onClick={(event) => { event.stopPropagation(); handlePlayQuiz(quiz); }}
            className="rounded-full bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors gap-1.5 px-4"
          >
            <Play className="h-3.5 w-3.5" />
            {t("playQuiz")}
          </Button>
        </div>
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Header subtitle={t("myQuizzes")} />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("myQuizzes")}</h1>
            <p className="text-muted-foreground">{t("myQuizzesSubtitle")}</p>
          </div>
          <Button onClick={() => navigate('/builder-start?type=quiz')}>
            {t("createQuizCta")}
          </Button>
        </div>

        <Tabs defaultValue="my" className="mt-8 space-y-4">
          <TabsList>
            <TabsTrigger value="my">{`${t("myQuizzesTab")} (${myQuizzes.length})`}</TabsTrigger>
            <TabsTrigger value="favorites">{`${t("favoritesTab")} (${favoriteQuizzes.length})`}</TabsTrigger>
            <TabsTrigger value="public">{`${t("publicQuizzesTab")} (${publicQuizzes.length})`}</TabsTrigger>
          </TabsList>

          <TabsContent value="my">
            {myQuizzes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
                <p className="text-sm text-muted-foreground">{t("noQuizzesSaved")}</p>
                <Button className="mt-4" onClick={() => navigate('/builder-start?type=quiz')}>
                  {t("createQuizCta")}
                </Button>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {myQuizzes.map((quiz) => renderQuizCard(quiz, true))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="favorites">
            {favoriteQuizzes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
                <p className="text-sm text-muted-foreground">{t("noFavoriteQuizzes")}</p>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {favoriteQuizzes.map((quiz) => renderQuizCard(quiz, quiz.userId === user.id))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="public">
            {publicQuizzes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
                <p className="text-sm text-muted-foreground">{t("noPublicQuizzes")}</p>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {publicQuizzes.map((quiz) => renderQuizCard(quiz, false))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <DeleteQuizDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title={quizToDelete?.title || ""}
        type="quiz"
      />
    </div>
  );
};

export default MyQuizzes;
