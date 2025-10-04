import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import { getUserQuizzes, getPublicQuizzes, getFavoriteQuizzes, deleteQuiz, toggleFavorite, SavedQuiz } from "@/lib/quizStorage";
import { Star, Trash2, Play, Globe, Lock, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const MyPolls = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [myPolls, setMyPolls] = useState<SavedQuiz[]>([]);
  const [publicPolls, setPublicPolls] = useState<SavedQuiz[]>([]);
  const [favoritePolls, setFavoritePolls] = useState<SavedQuiz[]>([]);

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

  const handleDelete = (id: string) => {
    if (deleteQuiz(id)) {
      toast.success("Sondage supprimé");
      loadPolls();
    }
  };

  const handleToggleFavorite = (id: string) => {
    toggleFavorite(id);
    loadPolls();
  };

  const handlePlayPoll = (poll: SavedQuiz) => {
    localStorage.setItem(`quiz-${poll.id}`, JSON.stringify(poll));
    navigate(`/quiz/${poll.id}`);
  };

  const PollCard = ({ poll, showDelete = false }: { poll: SavedQuiz; showDelete?: boolean }) => (
    <Card className="bg-white/10 backdrop-blur-lg border-white/20 hover:bg-white/15 transition-all">
      {poll.headerImage && (
        <div className="w-full h-48 overflow-hidden rounded-t-lg">
          <img 
            src={poll.headerImage} 
            alt={poll.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-white mb-2">{poll.title}</CardTitle>
            <p className="text-white/60 text-sm">{poll.description}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleFavorite(poll.id)}
            className="text-white hover:bg-white/10"
          >
            <Star className={poll.isFavorite ? "fill-yellow-500 text-yellow-500" : ""} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant={poll.isPublic ? "default" : "secondary"} className="bg-white/20">
              {poll.isPublic ? <Globe className="w-3 h-3 mr-1" /> : <Lock className="w-3 h-3 mr-1" />}
              {poll.isPublic ? "Public" : "Privé"}
            </Badge>
            <Badge variant="secondary" className="bg-white/20">
              {poll.questions.length} questions
            </Badge>
            {poll.tags?.map((tag) => (
              <Badge key={tag} variant="outline" className="bg-primary/20 text-white border-white/20">
                {tag}
              </Badge>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {showDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(poll.id)}
                  className="text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="hero"
                size="sm"
                onClick={() => handlePlayPoll(poll)}
              >
                <Play className="w-4 h-4 mr-1" />
                Lancer
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-hero p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Mes Sondages</h1>
            <p className="text-white/80">Gérez vos sondages et explorez les sondages publics</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
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
                  <Button variant="hero" className="mt-4" onClick={() => navigate("/builder?type=poll")}>
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
    </div>
  );
};

export default MyPolls;
