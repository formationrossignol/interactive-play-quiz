import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { QuizSession } from "@/components/QuizSession";
import { ExitQuizDialog } from "@/components/ExitQuizDialog";
import { PlayerView } from "@/components/PlayerView";
import { PollSession } from "@/components/PollSession";
import { FlashcardSession } from "@/components/FlashcardSession";
import { PresentationMode } from "@/components/presentation-editor/PresentationMode";
import { useDocStore } from "@/components/presentation-editor/store/useDocStore";
import { isLegacySlideShape, migrateLegacySlideToPresentation } from "@/components/presentation-editor/utils/migrateLegacySlide";
import type { Presentation } from "@/components/presentation-editor/types/presentation";
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
  ambianceId: quiz.ambianceId,
  rating: quiz.rating,
  ratingCount: quiz.ratingCount,
});

const LiveQuizPage = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const storedPlayerRaw = gameCode ? sessionStorage.getItem(`quiz-player-${gameCode}`) : null;
  const storedPlayer = (() => {
    try { return storedPlayerRaw ? (JSON.parse(storedPlayerRaw) as { name: string; avatar: string; id: string }) : null; }
    catch { return null; }
  })();

  const [loadedQuiz, setLoadedQuiz] = useState<SavedQuiz | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const exitHandlerRef = useRef<(() => void) | null>(null);

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
      questions: (loadedQuiz.questions || []).map((question, index) => ({
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
      ambianceId: loadedQuiz.ambianceId,
      transitionTime: loadedQuiz.transitionTime,
    };
  }, [loadedQuiz]);

  const presentation = useMemo(() => {
    if (!loadedQuiz || loadedQuiz.type !== "slide") return null;
    const raw = loadedQuiz as unknown as Record<string, unknown>;
    return isLegacySlideShape(raw)
      ? migrateLegacySlideToPresentation(raw as Parameters<typeof migrateLegacySlideToPresentation>[0])
      : (raw as unknown as Presentation);
  }, [loadedQuiz]);

  useEffect(() => {
    if (presentation) useDocStore.getState().load(presentation);
  }, [presentation]);

  if (!gameCode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="rounded-2xl bg-white/10 border border-white/20 p-8 text-center text-white max-w-md w-full">
          <AlertTriangle className="w-12 h-12 text-indigo-200 mx-auto" />
          <h2 className="text-2xl font-bold text-white mt-4">Code invalide</h2>
          <p className="text-indigo-200 mt-2">Le quiz que vous recherchez n'existe pas.</p>
          <button className="mt-6 bg-white text-indigo-600 font-bold rounded-full px-6 h-11 hover:bg-indigo-50" onClick={() => (window.location.href = "/")}>Retour à l'accueil</button>
        </div>
      </div>
    );
  }

  if (storedPlayer && gameCode) {
    return <PlayerView gameCode={gameCode} playerName={storedPlayer.name} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="rounded-2xl bg-white/10 border border-white/20 p-8 text-center text-white max-w-md w-full">
          <p className="text-lg text-white">Chargement de votre contenu interactif…</p>
        </div>
      </div>
    );
  }

  if (!loadedQuiz) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="rounded-2xl bg-white/10 border border-white/20 p-8 text-center text-white max-w-md w-full">
          <AlertTriangle className="w-12 h-12 text-indigo-200 mx-auto" />
          <h2 className="text-2xl font-bold text-white mt-4">Contenu introuvable</h2>
          <p className="text-indigo-200 mt-2">Impossible de charger le quiz ou le sondage demandé.</p>
          <button className="mt-6 bg-white text-indigo-600 font-bold rounded-full px-6 h-11 hover:bg-indigo-50" onClick={() => (window.location.href = "/")}>Retour à l'accueil</button>
        </div>
      </div>
    );
  }

  switch (loadedQuiz.type) {
    case "poll":
      return <PollSession poll={loadedQuiz} />;
    case "flashcard":
      return <FlashcardSession deck={loadedQuiz} />;
    case "slide":
      return <PresentationMode onExit={() => {}} />;
    default:
      if (!quizSession) {
        return (
          <div className="min-h-screen flex items-center justify-center p-6">
            <div className="rounded-2xl bg-white/10 border border-white/20 p-8 text-center text-white max-w-md w-full">
              <p className="text-lg text-white">Ce quiz ne contient aucune question exploitable pour le moment.</p>
            </div>
          </div>
        );
      }
      return (
        <>
          <ExitQuizDialog
            open={showExitDialog}
            onOpenChange={setShowExitDialog}
            onConfirm={() => { exitHandlerRef.current?.(); setShowExitDialog(false); }}
          />
          <QuizSession
            quiz={quizSession}
            isHost
            onExitRequest={() => setShowExitDialog(true)}
            onExitHandlerReady={(fn) => { exitHandlerRef.current = fn; }}
          />
        </>
      );
  }
};

export default LiveQuizPage;
