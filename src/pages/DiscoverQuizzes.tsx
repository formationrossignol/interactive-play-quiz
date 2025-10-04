import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getPublicQuizzes } from "@/lib/quizStorage";
import { Search, Play, Clock, Users, Filter, Zap, User, LogOut, BookOpen } from "lucide-react";
import { getCurrentUser, logout } from "@/lib/auth";

const QUIZ_CATEGORIES = [
  "Tous",
  "Culture Générale",
  "Science",
  "Histoire",
  "Géographie",
  "Sport",
  "Divertissement",
  "Technologie",
  "Arts",
  "Autre"
];

const DiscoverQuizzes = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tous");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "quiz" | "poll">("all");
  const publicQuizzes = getPublicQuizzes();

  const handleLogout = () => {
    logout();
    window.location.reload();
  };

  // Get all unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    publicQuizzes.forEach(quiz => {
      quiz.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags);
  }, [publicQuizzes]);

  // Filter quizzes
  const filteredQuizzes = useMemo(() => {
    return publicQuizzes.filter(quiz => {
      const matchesSearch = quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          quiz.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === "Tous" || quiz.category === selectedCategory;
      const matchesTag = !selectedTag || quiz.tags?.includes(selectedTag);
      const matchesType = typeFilter === "all" || quiz.type === typeFilter;
      
      return matchesSearch && matchesCategory && matchesTag && matchesType;
    });
  }, [publicQuizzes, searchQuery, selectedCategory, selectedTag, typeFilter]);

  const playQuiz = (quizId: string) => {
    const quiz = publicQuizzes.find(q => q.id === quizId);
    if (quiz) {
      localStorage.setItem('current-quiz', JSON.stringify(quiz));
      navigate(`/quiz/${quizId}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Navigation */}
      <nav className="p-6 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate('/')}
          >
            <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">QuizMaster</h1>
          </div>
          
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Button variant="outline" onClick={() => navigate('/my-quizzes')}>
                  <BookOpen className="w-4 h-4 mr-2" />
                  Mes Quiz
                </Button>
                <Button variant="outline" onClick={() => navigate('/profile')}>
                  <User className="w-4 h-4 mr-2" />
                  Profil
                </Button>
                <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                  <User className="w-4 h-4 text-white" />
                  <span className="text-white text-sm">{user.username}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => navigate('/auth')}>
                <User className="w-4 h-4 mr-2" />
                Connexion
              </Button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center mb-12">
          <h2 className="text-5xl font-bold text-white mb-4">
            Découvrir les Quiz Publics
          </h2>
          <p className="text-xl text-white/80">
            Explorez et participez aux quiz créés par la communauté
          </p>
        </div>

        {/* Filters */}
        <Card className="bg-white/10 backdrop-blur-lg border-white/20 mb-8">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[250px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
                <Input
                  placeholder="Rechercher un quiz..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60 pl-10"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[200px] bg-white/10 border-white/20 text-white">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {QUIZ_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
                <SelectTrigger className="w-[150px] bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="quiz">Quiz</SelectItem>
                  <SelectItem value="poll">Sondage</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tags Filter */}
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-white/60 text-sm">Tags:</span>
                <Badge
                  variant={selectedTag === null ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setSelectedTag(null)}
                >
                  Tous
                </Badge>
                {allTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={selectedTag === tag ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setSelectedTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quiz Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredQuizzes.map((quiz) => (
            <Card key={quiz.id} className="bg-white/10 border-white/20 hover:bg-white/15 transition-all group overflow-hidden">
              {quiz.headerImage && (
                <div className="w-full h-48 overflow-hidden">
                  <img 
                    src={quiz.headerImage} 
                    alt={quiz.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-white font-bold text-xl line-clamp-1">
                        {quiz.title}
                      </h3>
                      <Badge variant={quiz.type === 'poll' ? 'secondary' : 'default'} className="text-xs">
                        {quiz.type === 'poll' ? 'Sondage' : 'Quiz'}
                      </Badge>
                    </div>
                    <p className="text-white/60 text-sm line-clamp-2">
                      {quiz.description}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-4 text-white/80 text-sm">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {quiz.questions.length} Q
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {Math.round(quiz.questions.reduce((sum: number, q: any) => sum + q.timeLimit, 0) / 60)}m
                    </div>
                  </div>

                  {quiz.category && (
                    <Badge variant="secondary" className="text-xs">
                      {quiz.category}
                    </Badge>
                  )}

                  {quiz.tags && quiz.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {quiz.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {quiz.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{quiz.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                <Button
                  variant="hero"
                  size="sm"
                  className="w-full"
                  onClick={() => playQuiz(quiz.id)}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Jouer
                </Button>
              </CardContent>
            </Card>
          ))}

          {filteredQuizzes.length === 0 && (
            <div className="col-span-full text-center py-12 text-white/60">
              <p className="text-xl mb-2">Aucun quiz trouvé</p>
              <p className="text-sm">Essayez de modifier vos filtres</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiscoverQuizzes;
