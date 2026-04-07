import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Edit, Play, Star, Trash2 } from "lucide-react";
import { t } from "@/lib/i18n";

const MyPolls = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [myPolls, setMyPolls] = useState<SavedQuiz[]>([]);
  const [favoritePolls, setFavoritePolls] = useState<SavedQuiz[]>([]);
  const [publicPolls, setPublicPolls] = useState<SavedQuiz[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pollToDelete, setPollToDelete] = useState<SavedQuiz | null>(null);

  const loadPolls = useCallback(() => {
    if (!user) return;
    const allUserQuizzes = getUserQuizzes(user.id);
    const allPublicQuizzes = getPublicQuizzes();
    const allFavoriteQuizzes = getFavoriteQuizzes(user.id);

    setMyPolls(allUserQuizzes.filter((quiz) => quiz.type === "poll"));
    setPublicPolls(allPublicQuizzes.filter((quiz) => quiz.type === "poll"));
    setFavoritePolls(allFavoriteQuizzes.filter((quiz) => quiz.type === "poll"));
  }, [user]);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    loadPolls();
  }, [user, navigate, loadPolls]);

  const handleDeleteClick = (poll: SavedQuiz) => {
    setPollToDelete(poll);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (pollToDelete && deleteQuiz(pollToDelete.id)) {
      toast.success(t("pollDeleted"));
      loadPolls();
    }
    setDeleteDialogOpen(false);
    setPollToDelete(null);
  };

  const handleToggleFavorite = (event: MouseEvent, poll: SavedQuiz) => {
    event.stopPropagation();
    const updated = toggleFavorite(poll.id);
    if (updated) {
      toast.success(updated.isFavorite ? t("addedToFavorites") : t("removedFromFavorites"));
      loadPolls();
    }
  };

  const handleLaunchPoll = (poll: SavedQuiz) => {
    localStorage.setItem(`poll-${poll.id}`, JSON.stringify(poll));
    navigate(`/quiz/${poll.id}`);
  };

  const handleEditPoll = (event: MouseEvent, pollId: string) => {
    event.stopPropagation();
    navigate(`/builder?type=poll&quizId=${pollId}`);
  };

  const renderPollCard = (poll: SavedQuiz, showActions = true) => (
    <div
      key={poll.id}
      className="card-poll flex h-full cursor-pointer flex-col rounded-2xl border border-slate-100 bg-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover overflow-hidden"
      onClick={() => navigate(`/builder?type=poll&quizId=${poll.id}`)}
    >
      {poll.headerImage && (
        <div className="relative h-40 w-full overflow-hidden">
          <img
            src={poll.headerImage}
            alt={poll.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="text-base font-bold text-slate-900">{poll.title}</h3>
            <p className="mt-0.5 text-sm text-slate-500 line-clamp-2">{poll.description}</p>
          </div>
          <button
            onClick={(event) => handleToggleFavorite(event, poll)}
            className="text-amber-400 hover:text-amber-500 transition-colors cursor-pointer p-1"
            aria-label="Toggle favorite"
          >
            <Star className={`h-4 w-4 ${poll.isFavorite ? "fill-amber-400" : ""}`} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <Badge variant="outline" className="rounded-full text-xs border-slate-200 text-slate-500">
            {poll.questions.length} {poll.questions.length > 1 ? t("questions") : t("question")}
          </Badge>
          {poll.tags?.map((tag) => (
            <Badge key={tag} variant="outline" className="rounded-full text-xs border-slate-200 text-slate-500">
              #{tag}
            </Badge>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <div className="flex gap-1">
            {showActions && (
              <>
                <button
                  onClick={(event) => handleEditPoll(event, poll.id)}
                  title={t("edit")}
                  className="cursor-pointer p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  aria-label={t("edit")}
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  className="cursor-pointer p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  onClick={(event) => { event.stopPropagation(); handleDeleteClick(poll); }}
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
            onClick={(event) => { event.stopPropagation(); handleLaunchPoll(poll); }}
            className="rounded-full bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors gap-1.5 px-4"
          >
            <Play className="h-3.5 w-3.5" />
            {t("launchPoll")}
          </Button>
        </div>
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Header subtitle={t("myPolls")} />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("myPolls")}</h1>
            <p className="text-muted-foreground">{t("myPollsSubtitle")}</p>
          </div>
          <Button onClick={() => navigate('/builder-start?type=poll')}>
            {t("createPollCta")}
          </Button>
        </div>

        <Tabs defaultValue="my" className="mt-8 space-y-4">
          <TabsList>
            <TabsTrigger value="my">{`${t("myPollsTab")} (${myPolls.length})`}</TabsTrigger>
            <TabsTrigger value="favorites">{`${t("favoritesTab")} (${favoritePolls.length})`}</TabsTrigger>
            <TabsTrigger value="public">{`${t("publicPollsTab")} (${publicPolls.length})`}</TabsTrigger>
          </TabsList>

          <TabsContent value="my">
            {myPolls.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
                <p className="text-sm text-muted-foreground">{t("noPollsSaved")}</p>
                <Button className="mt-4" onClick={() => navigate('/builder-start?type=poll')}>
                  {t("createPollCta")}
                </Button>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {myPolls.map((poll) => renderPollCard(poll, true))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="favorites">
            {favoritePolls.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
                <p className="text-sm text-muted-foreground">{t("noFavoritePolls")}</p>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {favoritePolls.map((poll) => renderPollCard(poll, poll.userId === user.id))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="public">
            {publicPolls.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
                <p className="text-sm text-muted-foreground">{t("noPublicPolls")}</p>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {publicPolls.map((poll) => renderPollCard(poll, false))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <DeleteQuizDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title={pollToDelete?.title || ""}
        type="poll"
      />
    </div>
  );
};

export default MyPolls;
