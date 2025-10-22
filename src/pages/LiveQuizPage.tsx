import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { QuizSession } from "@/components/QuizSession";
import { PlayerView } from "@/components/PlayerView";
import { PollSession } from "@/components/PollSession";
import { FlashcardSession } from "@/components/FlashcardSession";
import { SlidePresentationSession } from "@/components/SlidePresentationSession";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getQuizById, type SavedQuiz } from "@/lib/quizStorage";

const fallbackKeysForType = (id: string) => [
  `quiz-${id}`,
  `poll-${id}`,
  `flashcard-${id}`,
  `slide-${id}`,
  "current-quiz"
];

const normalizeStoredQuiz = (quiz: Partial<SavedQuiz>, fallbackId: string): SavedQuiz => ({
  id: quiz.id ?? fallbackId,
  title: quiz.title ?? "Sans titre",
  description: quiz.description ?? "",
  questions: Array.isArray(quiz.questions) ? quiz.questions : [],
  createdAt: quiz.createdAt ?? new Date().toISOString(),
  userId: quiz.userId ?? "local-user",
  isPublic: quiz.isPublic ?? false,
  isFavorite: quiz.isFavorite ?? false,
  tags: quiz.tags ?? [],
  speedBonus: quiz.speedBonus ?? true,
  transitionTime: quiz.transitionTime ?? 5,
  category: quiz.category ?? "",
  type: (quiz.type as SavedQuiz["type"]) ?? "quiz",
  headerImage: quiz.headerImage,
  theme: quiz.theme,
  font: quiz.font,
  rating: quiz.rating,
  ratingCount: quiz.ratingCount,
});

const LiveQuizPage = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const [searchParams] = useSearchParams();
  const playerName = searchParams.get("player");

  const [loadedQuiz, setLoadedQuiz] = useState<SavedQuiz | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!gameCode) return;

    setIsLoading(true);
    const storedQuiz = getQuizById(gameCode);
    if (storedQuiz) {
      setLoadedQuiz(storedQuiz);
      setIsLoading(false);
      return;
    }

    for (const key of fallbackKeysForType(gameCode)) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw);
        if (!parsed) continue;
        const normalized = normalizeStoredQuiz(parsed, gameCode);
        if (normalized.id === gameCode) {
          setLoadedQuiz(normalized);
          setIsLoading(false);
          return;
        }
      } catch (error) {
        console.error("Failed to parse stored quiz", error);
      }
    }

    setLoadedQuiz(null);
    setIsLoading(false);
  }, [gameCode]);

  const quizSession = useMemo(() => {
    if (!loadedQuiz || loadedQuiz.type !== "quiz") return null;

    return {
      id: loadedQuiz.id,
      title: loadedQuiz.title,
      description: loadedQuiz.description,
      gameCode: loadedQuiz.id,
      hostId: loadedQuiz.userId,
      isActive: true,
      createdAt: new Date(loadedQuiz.createdAt ?? new Date().toISOString()),
      questions: (loadedQuiz.questions || []).map((question: any, index: number) => ({
        ...question,
        id: question?.id ?? `${loadedQuiz.id}-${index}`,
        type: question?.type ?? "multiple-choice",
        question: question?.question ?? `Question ${index + 1}`,
        answers: question?.answers ?? [],
        correctAnswer: question?.correctAnswer,
        timeLimit: question?.timeLimit ?? 30,
        points: question?.points ?? 100,
      })),
      headerImage: loadedQuiz.headerImage,
      theme: loadedQuiz.theme,
      font: loadedQuiz.font,
      transitionTime: loadedQuiz.transitionTime,
    };
  }, [loadedQuiz]);

  if (!gameCode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 text-slate-100">
        <Card className="border border-slate-700/60 bg-slate-900/80 shadow-2xl">
          <CardContent className="p-8 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-warning mx-auto" />
            <h2 className="text-2xl font-bold text-white">Code invalide</h2>
            <p className="text-slate-300">Le quiz que vous recherchez n'existe pas.</p>
            <Button variant="hero" onClick={() => (window.location.href = "/")}>Retour à l'accueil</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (playerName && gameCode) {
    return <PlayerView gameCode={gameCode} playerName={playerName} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 text-slate-100">
        <Card className="border border-slate-700/60 bg-slate-900/80 shadow-2xl">
          <CardContent className="p-8 text-center text-lg">Chargement de votre contenu interactif…</CardContent>
        </Card>
      </div>
    );
  }

  if (!loadedQuiz) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 text-slate-100">
        <Card className="border border-slate-700/60 bg-slate-900/80 shadow-2xl">
          <CardContent className="p-8 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-warning mx-auto" />
            <h2 className="text-2xl font-bold text-white">Contenu introuvable</h2>
            <p className="text-slate-300">Impossible de charger le quiz ou le sondage demandé.</p>
            <Button variant="hero" onClick={() => (window.location.href = "/")}>Retour à l'accueil</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  switch (loadedQuiz.type) {
    case "poll":
      return <PollSession poll={loadedQuiz} />;
    case "flashcard":
      return <FlashcardSession deck={loadedQuiz} />;
    case "slide":
      return <SlidePresentationSession presentation={loadedQuiz} />;
    default:
      if (!quizSession) {
        return (
          <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 text-slate-100">
            <Card className="border border-slate-700/60 bg-slate-900/80 shadow-2xl">
              <CardContent className="p-8 text-center text-lg">
                Ce quiz ne contient aucune question exploitable pour le moment.
              </CardContent>
            </Card>
          </div>
        );
      }
      return <QuizSession quiz={quizSession} isHost />;
  }
};

export default LiveQuizPage;
