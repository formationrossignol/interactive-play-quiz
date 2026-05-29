import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Header } from "@/components/Header";
import { Pagination } from "@/components/Pagination";
import { RatingStars } from "@/components/RatingStars";
import { getPublicQuizzes, rateQuiz } from "@/lib/quizStorage";
import { Search, Play, Clock, Users, Filter } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

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

const PAGE_SIZE = 12;

const DiscoverQuizzes = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tous");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "quiz" | "poll">("all");
  const [page, setPage] = useState(1);
  const publicQuizzes = getPublicQuizzes().filter((quiz) => quiz.type === 'quiz');

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    publicQuizzes.forEach(quiz => {
      quiz.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags);
  }, [publicQuizzes]);

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

  const totalPages = Math.max(1, Math.ceil(filteredQuizzes.length / PAGE_SIZE));
  const paginatedQuizzes = filteredQuizzes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [searchQuery, selectedCategory, selectedTag, typeFilter]);

  const playQuiz = (quizId: string) => {
    const quiz = publicQuizzes.find(q => q.id === quizId);
    if (quiz) {
      localStorage.setItem('current-quiz', JSON.stringify(quiz));
      navigate(`/quiz/${quizId}`);
    }
  };

  const handleRateQuiz = (quizId: string, rating: number) => {
    const result = rateQuiz(quizId, rating);
    if (result) {
      toast.success("Merci pour votre note !");
      window.location.reload(); // Reload to show updated rating
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header subtitle={t('discoverPublic')} />

      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">{t('discoverPublic')}</h1>
          <p className="text-muted-foreground">Explorez les quiz et sondages publics</p>
        </div>

        <Card className="mb-6">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un quiz..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[200px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {QUIZ_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="quiz">Quiz</SelectItem>
                  <SelectItem value="poll">Sondage</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-muted-foreground text-sm">Tags:</span>
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

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedQuizzes.map((quiz) => (
            <Card key={quiz.id} className="hover:border-primary transition-all group overflow-hidden">
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
                      <h3 className="text-foreground font-bold text-xl line-clamp-1">
                        {quiz.title}
                      </h3>
                      <Badge variant={quiz.type === 'poll' ? 'secondary' : 'default'} className="text-xs">
                        {quiz.type === 'poll' ? 'Sondage' : 'Quiz'}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm line-clamp-2">
                      {quiz.description}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-4 text-muted-foreground text-sm">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {quiz.questions.length} Q
                    </div>
                    {quiz.type === 'quiz' && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {Math.round(quiz.questions.reduce((sum: number, q: any) => sum + (q.timeLimit || 0), 0) / 60)}m
                      </div>
                    )}
                  </div>

                  {quiz.category && (
                    <Badge variant="outline">{quiz.category}</Badge>
                  )}

                  {quiz.tags && quiz.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {quiz.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {quiz.type === 'quiz' && (
                  <div className="mb-3">
                    <RatingStars
                      rating={quiz.rating || 0}
                      ratingCount={quiz.ratingCount}
                      onRate={(rating) => handleRateQuiz(quiz.id, rating)}
                      readonly={quiz.userId === user?.id}
                    />
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={() => playQuiz(quiz.id)}
                >
                  <Play className="w-4 h-4 mr-2" />
                  {quiz.type === 'poll' ? 'Répondre' : 'Jouer'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredQuizzes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">Aucun résultat trouvé</p>
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-10" />
      </div>
    </div>
  );
};

export default DiscoverQuizzes;
