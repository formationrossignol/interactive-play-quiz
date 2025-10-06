import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/Header";
import { getCurrentUser } from "@/lib/auth";
import { getUserQuizzes, getPublicQuizzes, getFavoriteQuizzes, deleteQuiz, toggleFavorite, SavedQuiz } from "@/lib/quizStorage";
import { Star, Trash2, Play, Globe, Lock } from "lucide-react";
import { toast } from "sonner";

const MyQuizzes = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [myQuizzes, setMyQuizzes] = useState<SavedQuiz[]>([]);
  const [publicQuizzes, setPublicQuizzes] = useState<SavedQuiz[]>([]);
  const [favoriteQuizzes, setFavoriteQuizzes] = useState<SavedQuiz[]>([]);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    loadQuizzes();
  }, [user, navigate]);

  const loadQuizzes = () => {
    if (!user) return;
    setMyQuizzes(getUserQuizzes(user.id));
    setPublicQuizzes(getPublicQuizzes());
    setFavoriteQuizzes(getFavoriteQuizzes(user.id));
  };

  const handleDelete = (id: string) => {
    if (deleteQuiz(id)) {
      toast.success("Quiz supprimé");
      loadQuizzes();
    }
  };

  const handleToggleFavorite = (id: string, currentState: boolean) => {
    const updated = toggleFavorite(id);
    if (updated) {
      toast.success(
        currentState ? "Retiré des favoris" : "Ajouté aux favoris"
      );
      loadQuizzes();
    }
  };

  const handlePlayQuiz = (quiz: SavedQuiz) => {
    // Save quiz to active session
    localStorage.setItem(`quiz-${quiz.id}`, JSON.stringify(quiz));
    navigate(`/quiz/${quiz.id}`);
  };

  const QuizCard = ({ quiz, showDelete = false }: { quiz: SavedQuiz; showDelete?: boolean }) => (
    <Card className="group relative overflow-hidden bg-gradient-to-br from-card via-card to-card/95 border-border/50 hover:border-primary/30 hover:shadow-card transition-all duration-300">
      {quiz.headerImage && (
        <div className="w-full h-48 overflow-hidden">
          <img 
            src={quiz.headerImage} 
            alt={quiz.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <CardTitle className="text-foreground mb-2 text-xl">{quiz.title}</CardTitle>
            <p className="text-muted-foreground text-sm line-clamp-2">{quiz.description}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleToggleFavorite(quiz.id, quiz.isFavorite || false)}
            className="text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400 shrink-0"
          >
            <Star className={`w-5 h-5 ${quiz.isFavorite ? "fill-yellow-500" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant={quiz.isPublic ? "default" : "secondary"} className="gap-1">
              {quiz.isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              {quiz.isPublic ? "Public" : "Privé"}
            </Badge>
            <Badge variant="outline">
              {quiz.questions.length} questions
            </Badge>
            {quiz.tags?.map((tag) => (
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
                  onClick={() => handleDelete(quiz.id)}
                  className="text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={() => handlePlayQuiz(quiz)}
              className="gap-2"
            >
              <Play className="w-4 h-4" />
              Jouer
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header subtitle="Mes Quiz" />
      
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Mes Quiz</h1>
          <p className="text-muted-foreground">Gérez vos quiz et explorez les quiz publics</p>
        </div>

        <Tabs defaultValue="my-quizzes" className="space-y-6">
          <TabsList className="bg-white/10">
            <TabsTrigger value="my-quizzes">Mes Quiz ({myQuizzes.length})</TabsTrigger>
            <TabsTrigger value="public">Quiz Publics ({publicQuizzes.length})</TabsTrigger>
            <TabsTrigger value="favorites">Favoris ({favoriteQuizzes.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="my-quizzes" className="space-y-4">
            {myQuizzes.length === 0 ? (
              <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                <CardContent className="p-12 text-center">
                  <p className="text-white/60">Vous n'avez pas encore créé de quiz</p>
                  <Button variant="hero" className="mt-4" onClick={() => navigate("/builder")}>
                    Créer mon premier quiz
                  </Button>
                </CardContent>
              </Card>
            ) : (
              myQuizzes.map(quiz => <QuizCard key={quiz.id} quiz={quiz} showDelete />)
            )}
          </TabsContent>

          <TabsContent value="public" className="space-y-4">
            {publicQuizzes.length === 0 ? (
              <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                <CardContent className="p-12 text-center">
                  <p className="text-white/60">Aucun quiz public disponible</p>
                </CardContent>
              </Card>
            ) : (
              publicQuizzes.map(quiz => <QuizCard key={quiz.id} quiz={quiz} />)
            )}
          </TabsContent>

          <TabsContent value="favorites" className="space-y-4">
            {favoriteQuizzes.length === 0 ? (
              <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                <CardContent className="p-12 text-center">
                  <p className="text-white/60">Vous n'avez pas encore de quiz favoris</p>
                </CardContent>
              </Card>
            ) : (
              favoriteQuizzes.map(quiz => <QuizCard key={quiz.id} quiz={quiz} showDelete={quiz.userId === user.id} />)
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default MyQuizzes;
