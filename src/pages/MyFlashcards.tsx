import { useEffect, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth";
import {
  deleteQuiz,
  getFavoriteFlashcardSets,
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [setToDelete, setSetToDelete] = useState<SavedQuiz | null>(null);

  const loadFlashcards = () => {
    if (!user) return;
    setMyFlashcards(getUserFlashcardSets(user.id));
    setFavoriteFlashcards(getFavoriteFlashcardSets(user.id));
  };

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    loadFlashcards();
  }, [user, navigate]);

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
    <Card
      key={cardSet.id}
      className="group flex h-full flex-col justify-between border-border/60 bg-card/80 shadow-sm transition-all duration-200 hover:border-primary/30"
      onClick={() => navigate(`/builder?type=flashcard&quizId=${cardSet.id}`)}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-foreground text-xl">{cardSet.title}</CardTitle>
            <p className="text-sm text-muted-foreground line-clamp-2">{cardSet.description}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => handleToggleFavorite(e, cardSet)}
            className="text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400"
          >
            <Star className={`h-5 w-5 ${cardSet.isFavorite ? "fill-yellow-500" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-full">
            {cardSet.questions.length} {cardSet.questions.length > 1 ? t("cards") : t("card")}
          </Badge>
          {cardSet.tags?.map((tag) => (
            <Badge key={tag} variant="outline" className="rounded-full">
              #{tag}
            </Badge>
          ))}
        </div>
      </CardContent>
      {showActions && (
        <CardFooter className="flex items-center justify-between gap-2 border-t border-border/40 pt-4">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/builder?type=flashcard&quizId=${cardSet.id}`);
              }}
              title={t("edit")}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteClick(cardSet);
              }}
              title={t("delete")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="default"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/builder?type=flashcard&quizId=${cardSet.id}`);
            }}
          >
            {t("editSet")}
          </Button>
        </CardFooter>
      )}
    </Card>
  );

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
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
        </TabsList>

          <TabsContent value="my">
            {myFlashcards.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-10 text-center">
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
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-10 text-center">
                <p className="text-sm text-muted-foreground">{t("noFavoriteFlashcards")}</p>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {favoriteFlashcards.map((cardSet) => renderCard(cardSet, false))}
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
