import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/Header";
import { getCurrentUser } from "@/lib/auth";
import { getUserQuizzes, getPublicQuizzes, getFavoriteQuizzes, deleteQuiz, toggleFavorite, SavedQuiz } from "@/lib/quizStorage";
import { Star, Trash2, Play } from "lucide-react";
import { toast } from "sonner";
import { DeleteQuizDialog } from "@/components/DeleteQuizDialog";

const MyPolls = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [myPolls, setMyPolls] = useState<SavedQuiz[]>([]);
  const [publicPolls, setPublicPolls] = useState<SavedQuiz[]>([]);
  const [favoritePolls, setFavoritePolls] = useState<SavedQuiz[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pollToDelete, setPollToDelete] = useState<SavedQuiz | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    loadPolls();
  }, [user, navigate]);

  const loadPolls = () => {
    if (!user) return;
    const allUserQuizzes = getUserQuizzes(user.id);
    const allPublicQuizzes = getPublicQuizzes();
    const allFavoriteQuizzes = getFavoriteQuizzes(user.id);
    
    setMyPolls(allUserQuizzes.filter(q => q.type === 'poll'));
    setPublicPolls(allPublicQuizzes.filter(q => q.type === 'poll'));
    setFavoritePolls(allFavoriteQuizzes.filter(q => q.type === 'poll'));
  };

  const handleDeleteClick = (poll: SavedQuiz) => {
    setPollToDelete(poll);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (pollToDelete && deleteQuiz(pollToDelete.id)) {
      toast.success("Sondage supprimé");
      loadPolls();
    }
    setDeleteDialogOpen(false);
    setPollToDelete(null);
  };

  const handleToggleFavorite = (e: React.MouseEvent, id: string, currentState: boolean) => {
    e.stopPropagation();
    const updated = toggleFavorite(id);
    if (updated) {
      toast.success(
        currentState ? "Retiré des favoris" : "Ajouté aux favoris"
      );
      loadPolls();
    }
  };

  const handlePlayPoll = (poll: SavedQuiz) => {
    // Save poll to active session
    localStorage.setItem(`poll-${poll.id}`, JSON.stringify(poll));
    navigate(`/quiz/${poll.id}`);
  };

  const PollCard = ({ poll, showDelete = false }: { poll: SavedQuiz; showDelete?: boolean }) => (
    <Card className="group relative overflow-hidden bg-gradient-to-br from-card via-card to-card/95 border-border/50 hover:border-primary/30 hover:shadow-card transition-all duration-300">
      {poll.headerImage && (
        <div className="w-full h-48 overflow-hidden">
          <img 
            src={poll.headerImage} 
            alt={poll.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <CardTitle className="text-foreground mb-2 text-xl">{poll.title}</CardTitle>
            <p className="text-muted-foreground text-sm line-clamp-2">{poll.description}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => handleToggleFavorite(e, poll.id, poll.isFavorite || false)}
            className="text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400 shrink-0"
          >
            <Star className={`w-5 h-5 ${poll.isFavorite ? "fill-yellow-500" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              {poll.questions.length} questions
            </Badge>
            {poll.tags?.map((tag) => (
              <Badge key={tag} variant="outline" className="bg-primary/5">
                {tag}
              </Badge>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div className="flex gap-2">
              {showDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick(poll);
                  }}
                  className="text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={() => handlePlayPoll(poll)}
              className="gap-2"
            >
              <Play className="w-4 h-4" />
              Lancer
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header subtitle="Mes Sondages" />
      
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Mes Sondages</h1>
          <p className="text-muted-foreground">Gérez vos sondages</p>
        </div>

        <Tabs defaultValue="my-polls" className="space-y-6">
          <TabsList className="bg-white/10">
            <TabsTrigger value="my-polls">Mes Sondages ({myPolls.length})</TabsTrigger>
            <TabsTrigger value="public">Sondages Publics ({publicPolls.length})</TabsTrigger>
            <TabsTrigger value="favorites">Favoris ({favoritePolls.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="my-polls" className="space-y-4">
            {myPolls.length === 0 ? (
              <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                <CardContent className="p-12 text-center">
                  <p className="text-white/60">Vous n'avez pas encore créé de sondage</p>
                  <Button variant="hero" className="mt-4" onClick={() => navigate("/builder-start?type=poll")}>
                    Créer mon premier sondage
                  </Button>
                </CardContent>
              </Card>
            ) : (
              myPolls.map(poll => <PollCard key={poll.id} poll={poll} showDelete />)
            )}
          </TabsContent>

          <TabsContent value="public" className="space-y-4">
            {publicPolls.length === 0 ? (
              <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                <CardContent className="p-12 text-center">
                  <p className="text-white/60">Aucun sondage public disponible</p>
                </CardContent>
              </Card>
            ) : (
              publicPolls.map(poll => <PollCard key={poll.id} poll={poll} />)
            )}
          </TabsContent>

          <TabsContent value="favorites" className="space-y-4">
            {favoritePolls.length === 0 ? (
              <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                <CardContent className="p-12 text-center">
                  <p className="text-white/60">Vous n'avez pas encore de sondage favori</p>
                </CardContent>
              </Card>
            ) : (
              favoritePolls.map(poll => <PollCard key={poll.id} poll={poll} showDelete={poll.userId === user.id} />)
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
