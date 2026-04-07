import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Users, Trophy, CheckCircle, XCircle, LogOut } from "lucide-react";
import { MultiStepProgress } from "./MultiStepProgress";
import { BackgroundMusic } from "./BackgroundMusic";
import { ExitQuizDialog } from "./ExitQuizDialog";
import { CircularTimer } from "./CircularTimer";
import { cn } from "@/lib/utils";
import {
  ensureSessionState,
  getSessionStorageKey,
  readSessionState,
  upsertPlayerInSession,
  type SharedPlayer,
} from "@/lib/sessionState";

interface PlayerViewProps {
  gameCode: string;
  playerName: string;
}

const buttonColors = [
  "bg-rose-500 active:bg-rose-600 hover:bg-rose-600",
  "bg-blue-500 active:bg-blue-600 hover:bg-blue-600",
  "bg-amber-500 active:bg-amber-600 hover:bg-amber-600",
  "bg-emerald-500 active:bg-emerald-600 hover:bg-emerald-600",
];

export const PlayerView = ({ gameCode, playerName }: PlayerViewProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const playerAvatar = searchParams.get('avatar') || '🎮';
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<'waiting' | 'question' | 'answer-feedback' | 'leaderboard' | 'final'>('waiting');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [playerScore, setPlayerScore] = useState(0);
  const [playerRank, setPlayerRank] = useState(1);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showExitDialog, setShowExitDialog] = useState(false);

  const totalQuestions = 10;

  // Mock current question data
  const mockQuestion = {
    type: 'multiple-choice' as const,
    question: "Quelle est la capitale de la France ?",
    answers: ["Londres", "Berlin", "Paris", "Madrid"],
    correctAnswer: 2,
    timeLimit: 30,
    points: 100
  };

  // Ensure a session state exists for this quiz
  useEffect(() => {
    ensureSessionState(gameCode);
  }, [gameCode]);

  const syncFromSession = useCallback(() => {
    const session = readSessionState(gameCode);
    setTotalPlayers(session.players.length);
    setGameState((prev) => (prev !== session.gameState ? session.gameState : prev));
    if (session.gameState === 'question') {
      setCurrentQuestion(session.currentQuestionIndex ?? 0);
      if (session.timeLeft > 0) {
        setTimeLeft(session.timeLeft);
      }
    }

    if (playerId) {
      const player = session.players.find((p) => p.id === playerId);
      if (player) {
        setPlayerScore(player.score ?? 0);
        const sorted = [...session.players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        const index = sorted.findIndex((p) => p.id === playerId);
        setPlayerRank(index >= 0 ? index + 1 : 1);
      }
    }
  }, [gameCode, playerId]);

  // Register the player if needed and synchronise initial state
  useEffect(() => {
    const storedPlayerRaw = sessionStorage.getItem(`quiz-player-${gameCode}`);
    if (storedPlayerRaw) {
      try {
        const storedPlayer = JSON.parse(storedPlayerRaw) as SharedPlayer;
        setPlayerId(storedPlayer.id);
        upsertPlayerInSession(gameCode, storedPlayer);
      } catch (error) {
        console.warn('Failed to parse stored player information', error);
      }
    } else {
      const fallbackId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const trimmedName = playerName?.trim() || 'Participant';
      const fallbackPlayer: SharedPlayer = {
        id: fallbackId,
        name: trimmedName,
        avatar: playerAvatar,
        score: 0,
        correctAnswers: 0,
        joinedAt: new Date().toISOString(),
      };
      try {
        sessionStorage.setItem(`quiz-player-${gameCode}`, JSON.stringify(fallbackPlayer));
      } catch (error) {
        console.warn('Unable to persist fallback player info in sessionStorage', error);
      }
      upsertPlayerInSession(gameCode, fallbackPlayer);
      setPlayerId(fallbackId);
    }

    syncFromSession();
  }, [gameCode, playerAvatar, playerName, syncFromSession]);

  useEffect(() => {
    if (playerId) {
      syncFromSession();
    }
  }, [playerId, syncFromSession]);

  // Listen for updates from other tabs (host/admin)
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === getSessionStorageKey(gameCode)) {
        syncFromSession();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [gameCode, syncFromSession]);

  // Timer countdown
  useEffect(() => {
    if (gameState === 'question' && timeLeft > 0 && !hasAnswered) {
      const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [gameState, timeLeft, hasAnswered]);

  const handleExitQuiz = () => {
    navigate("/");
  };

  const submitAnswer = (answer: number | string) => {
    if (hasAnswered) return;

    setSelectedAnswer(answer);
    setHasAnswered(true);

    // Mock scoring logic with speed bonus
    const correct = answer === mockQuestion.correctAnswer;
    setIsCorrect(correct);

    if (correct) {
      // Calculate speed bonus: proportional to time remaining
      const speedBonusPercentage = timeLeft / mockQuestion.timeLimit;
      const speedBonus = Math.floor(mockQuestion.points * speedBonusPercentage * 0.5);
      const totalPoints = mockQuestion.points + speedBonus;
      setPlayerScore(prev => prev + totalPoints);
    }

    // Auto-advance after showing feedback
    setTimeout(() => {
      setGameState('leaderboard');
    }, 2500);
  };

  if (gameState === 'waiting') {
    return (
      <div className="min-h-screen bg-indigo-600 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="text-7xl mb-6 drop-shadow-lg">
            {playerAvatar}
          </div>

          <h1 className="text-2xl font-extrabold text-white mb-2">Connecté !</h1>
          <div className="text-indigo-200 mb-8">
            Bonjour <span className="font-bold text-white">{playerName}</span>
          </div>

          <div className="rounded-2xl bg-white/10 border border-white/20 p-5 text-indigo-200 space-y-4">
            <div className="text-3xl font-mono tracking-wider font-bold text-white mb-2 drop-shadow">
              {gameCode}
            </div>
            <p className="text-indigo-200">En attente du début du quiz...</p>

            <div className="flex items-center justify-center gap-4 text-indigo-200">
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>{totalPlayers} joueurs</span>
              </div>
            </div>
          </div>

          <div className="mt-6 animate-pulse">
            <div className="w-8 h-8 rounded-full mx-auto bg-white/30 shadow-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'question') {
    return (
      <div className="min-h-screen bg-indigo-600 p-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 text-white">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-white/10 border border-white/20 px-3 py-1 text-sm font-semibold text-white">
                Question {currentQuestion + 1}
              </div>
              <div className="flex items-center gap-1">
                <Trophy className="w-4 h-4" />
                <span>{playerScore}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BackgroundMusic isPlaying={gameState === 'question'} />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExitDialog(true)}
                className="rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Progress */}
          <div className="mb-6">
            <MultiStepProgress
              totalSteps={totalQuestions}
              currentStep={currentQuestion}
              className="h-3"
            />
          </div>

          <ExitQuizDialog
            open={showExitDialog}
            onOpenChange={setShowExitDialog}
            onConfirm={handleExitQuiz}
          />

          {/* Question card */}
          <div className="rounded-2xl bg-white p-5 md:p-6 mb-4 shadow-xl">
            <div className="flex justify-center mb-4">
              <CircularTimer timeLeft={timeLeft} totalTime={mockQuestion.timeLimit} />
            </div>

            <h2 className="text-lg font-bold text-slate-900 text-center mb-6 md:text-xl">
              {mockQuestion.question}
            </h2>

            {/* Multiple Choice Answers */}
            {mockQuestion.type === 'multiple-choice' && mockQuestion.answers && (
              <div className="grid gap-3">
                {mockQuestion.answers.map((answer, index) => (
                  <button
                    key={index}
                    className={cn(
                      "cursor-pointer min-h-[56px] w-full rounded-xl p-4 text-left text-white font-semibold text-sm transition-all duration-150",
                      buttonColors[index % buttonColors.length],
                      selectedAnswer === index && "ring-4 ring-white ring-offset-2 ring-offset-indigo-600",
                      hasAnswered && selectedAnswer !== index && "opacity-50"
                    )}
                    onClick={() => submitAnswer(index)}
                    disabled={hasAnswered}
                  >
                    <span className="mr-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/30 text-xs font-bold">
                      {String.fromCharCode(65 + index)}
                    </span>
                    {answer}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Answer Feedback */}
          {hasAnswered && (
            <div className={cn(
              "animate-scale-in rounded-2xl p-6 text-center",
              isCorrect
                ? "bg-white/10 border border-white/20"
                : "bg-white/10 border border-white/20"
            )}>
              <div className="mb-4">
                {isCorrect ? (
                  <CheckCircle className="mx-auto h-12 w-12 animate-bounce text-emerald-300 drop-shadow-lg" />
                ) : (
                  <XCircle className="mx-auto h-12 w-12 animate-pulse text-rose-300 drop-shadow-lg" />
                )}
              </div>
              <h3 className="text-3xl font-extrabold text-white mb-2">
                {isCorrect ? "🎉 Bonne réponse !" : "😔 Mauvaise réponse"}
              </h3>
              {mockQuestion.correctAnswer !== undefined && (
                <p className="mb-3 text-sm font-medium text-indigo-200">
                  La bonne réponse était: <span className="font-bold text-white">{mockQuestion.answers[mockQuestion.correctAnswer]}</span>
                </p>
              )}
              <div className="rounded-2xl bg-white/10 border border-white/20 p-5 inline-block mt-2">
                <div className="text-4xl font-extrabold text-white">
                  {isCorrect ? `+${mockQuestion.points}` : "0"}
                </div>
                <div className="text-indigo-200 text-sm mt-1">points</div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (gameState === 'leaderboard') {
    return (
      <div className="min-h-screen bg-indigo-600 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="mb-4 text-6xl drop-shadow-xl animate-bounce">🏆</div>
          <h2 className="mb-6 text-3xl font-extrabold text-white drop-shadow-lg">Classement</h2>

          <div className="space-y-4 mb-6">
            <div className="flex items-center gap-4 rounded-2xl bg-white/10 border border-white/20 p-4 text-white">
              <span className="text-2xl font-bold text-amber-300">#{playerRank}</span>
              <span className="flex-1 text-left font-semibold">{playerName}</span>
              <span className="font-bold text-indigo-200">{playerScore} pts</span>
            </div>

            <div className="rounded-2xl bg-white/10 border border-white/20 p-4 text-indigo-200 text-sm font-medium">
              ⏳ Attendez la prochaine question...
            </div>
          </div>

          <button
            className="bg-white text-indigo-600 font-bold rounded-full w-full h-12 transition-all duration-150 hover:bg-indigo-50 active:bg-indigo-100 shadow-xl"
            onClick={() => {
              setGameState('question');
              setHasAnswered(false);
              setSelectedAnswer(null);
              setIsCorrect(null);
              setTimeLeft(30);
              setCurrentQuestion(prev => prev + 1);
            }}
          >
            🚀 Prêt pour la suite
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-indigo-600 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-4 text-6xl drop-shadow-lg">🎉</div>
        <h2 className="mb-6 text-3xl font-extrabold text-white">Quiz terminé !</h2>

        <div className="rounded-2xl bg-white/10 border border-white/20 p-6 mb-6">
          <div className="text-6xl font-extrabold text-white mb-2">{playerScore}</div>
          <div className="text-indigo-200 text-sm">points</div>
          <div className="mt-4 text-indigo-200">
            Rang final: <span className="font-bold text-white">#{playerRank}</span> sur {totalPlayers}
          </div>
        </div>

        <button
          className="bg-white text-indigo-600 font-bold rounded-full px-8 h-12 transition-all duration-150 hover:bg-indigo-50 active:bg-indigo-100 shadow-xl"
          onClick={() => navigate("/")}
        >
          Retour à l&apos;accueil
        </button>
      </div>
    </div>
  );
};
