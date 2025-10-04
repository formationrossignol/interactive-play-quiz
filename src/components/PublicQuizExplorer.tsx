import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getPublicQuizzes, SavedQuiz } from "@/lib/quizStorage";
import { Search, Play, Clock, Users, Star, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";

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

export const PublicQuizExplorer = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tous");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const publicQuizzes = getPublicQuizzes();

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
      
      return matchesSearch && matchesCategory && matchesTag;
    });
  }, [publicQuizzes, searchQuery, selectedCategory, selectedTag]);

  const playQuiz = (quizId: string) => {
    // In a real app, this would start a new session
    console.log("Play quiz:", quizId);
  };

  return (
    <Card className="bg-white/10 backdrop-blur-lg border-white/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Play className="w-6 h-6" />
          Découvrir les Quiz Publics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
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
        </div>

        {/* Quiz Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto">
          {filteredQuizzes.map((quiz) => (
            <Card key={quiz.id} className="bg-white/10 border-white/20 hover:bg-white/15 transition-all group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-white font-bold text-lg mb-1 line-clamp-1">
                      {quiz.title}
                    </h3>
                    <p className="text-white/60 text-sm line-clamp-2">
                      {quiz.description}
                    </p>
                  </div>
                  {quiz.isFavorite && (
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500 flex-shrink-0 ml-2" />
                  )}
                </div>

                <div className="space-y-2 mb-4">
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
              <p>Aucun quiz trouvé</p>
              <p className="text-sm mt-2">Essayez de modifier vos filtres</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
