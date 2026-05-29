import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Users, Trophy, LogOut } from "lucide-react";
import { MultiStepProgress } from "./MultiStepProgress";
import { BackgroundMusic } from "./BackgroundMusic";
import { ExitQuizDialog } from "./ExitQuizDialog";
import { CircularTimer } from "./CircularTimer";
import { cn } from "@/lib/utils";
import {
  ensureSessionState,
  fetchSessionStateFromSupabase,
  getSessionStorageKey,
  readSessionState,
  subscribeToSessionState,
  upsertPlayerInSession,
  writeSessionState,
  type SharedPlayer,
  type SharedGameState,
} from "@/lib/sessionState";
import { supabase } from "@/lib/supabase";

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
  const [showExitDialog, setShowExitDialog] = useState(false);

  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const totalQuestions = quizQuestions.length || 1;
  const liveQuestion = quizQuestions[currentQuestion] ?? null;

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

  // Ensure session exists; fetch from Supabase if localStorage empty (cross-device join)
  useEffect(() => {
    ensureSessionState(gameCode);
    const localState = readSessionState(gameCode);
    if (localState.gameState === "waiting" && localState.players.length === 0) {
      fetchSessionStateFromSupabase(gameCode).then((remote) => {
        if (remote) {
          writeSessionState(gameCode, remote);
          syncFromSession();
        }
      });
    }
  }, [gameCode, syncFromSession]);

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

  // Tracks which question index the player has already answered — prevents poll from re-enabling buttons
  const answeredForIndexRef = useRef<number | null>(null);

  // Keep a stable ref so the subscription never needs to be recreated when playerId changes.
  // Re-creating the channel causes a gap where the "quiz started" event can be missed.
  const syncRef = useRef(syncFromSession);
  useEffect(() => {
    syncRef.current = syncFromSession;
  }, [syncFromSession]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === getSessionStorageKey(gameCode)) {
        syncRef.current();
      }
    };

    window.addEventListener('storage', handleStorage);
    const channel = subscribeToSessionState(gameCode, () => syncRef.current());

    return () => {
      window.removeEventListener('storage', handleStorage);
      channel.unsubscribe();
    };
  }, [gameCode]); // stable — only recreated if gameCode changes

  // Poll Supabase directly and update React state — bypasses localStorage chain.
  // Runs every 2s as fallback when realtime is unavailable (e.g. mobile background throttle).
  useEffect(() => {
    let prevUpdatedAt = '';

    const poll = async () => {
      const { data } = await supabase
        .from('session_state')
        .select('*')
        .eq('game_code', gameCode)
        .single();

      if (!data) return;

      // Load quiz questions once when available
      if (data.quiz_data?.questions && Array.isArray(data.quiz_data.questions)) {
        setQuizQuestions((prev) => prev.length === 0 ? data.quiz_data.questions : prev);
      }

      // Skip state sync if nothing changed
      if (data.updated_at === prevUpdatedAt) return;
      prevUpdatedAt = data.updated_at;

      const remoteState = (data.game_state ?? 'waiting') as SharedGameState;
      const players = Array.isArray(data.players) ? (data.players as SharedPlayer[]) : [];

      // Map host game states → player game states
      let mapped: 'waiting' | 'question' | 'answer-feedback' | 'leaderboard' | 'final' = 'waiting';
      if (remoteState === 'question') mapped = 'question';
      else if (remoteState === 'leaderboard') mapped = 'leaderboard';
      else if (remoteState === 'final') mapped = 'final';
      else if (remoteState === 'answer-distribution' || remoteState === 'transition') mapped = 'leaderboard';

      // Reset answer state only when a NEW question starts (index changed)
      const newIndex = data.current_question_index ?? 0;
      if (mapped === 'question' && newIndex !== answeredForIndexRef.current) {
        setHasAnswered(false);
        setSelectedAnswer(null);
      }
      setGameState(mapped);

      setTotalPlayers(players.length);

      if (remoteState === 'question') {
        setCurrentQuestion(data.current_question_index ?? 0);
        setTimeLeft(data.time_left ?? 0);
      }

      if (playerId) {
        const me = players.find((p) => p.id === playerId);
        if (me) {
          setPlayerScore(me.score ?? 0);
          const sorted = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
          const idx = sorted.findIndex((p) => p.id === playerId);
          setPlayerRank(idx >= 0 ? idx + 1 : 1);
        }
      }
    };

    poll(); // immediate first fetch
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [gameCode, playerId]);

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
    if (hasAnswered || !liveQuestion) return;

    setSelectedAnswer(answer);
    setHasAnswered(true);
    answeredForIndexRef.current = currentQuestion;

    const correct = answer === liveQuestion.correctAnswer;
    const earnedPoints = correct
      ? Math.round(
          (liveQuestion.points ?? 100) +
          (liveQuestion.points ?? 100) * 0.5 * (timeLeft / (liveQuestion.timeLimit ?? 30))
        )
      : 0;
    const newScore = playerScore + earnedPoints;
    const storedPlayerRaw = sessionStorage.getItem(`quiz-player-${gameCode}`);
    if (storedPlayerRaw) {
      try {
        const storedPlayer = JSON.parse(storedPlayerRaw) as SharedPlayer;
        const updated: SharedPlayer = {
          ...storedPlayer,
          score: newScore,
          correctAnswers: (storedPlayer.correctAnswers ?? 0) + (correct ? 1 : 0),
          lastAnswer: typeof answer === 'number' ? answer : undefined,
          lastAnswerQuestionIndex: currentQuestion,
        };
        sessionStorage.setItem(`quiz-player-${gameCode}`, JSON.stringify(updated));
        upsertPlayerInSession(gameCode, updated);
        setPlayerScore(newScore);
      } catch {}
    }
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

          {/* Temp debug — remove after fix confirmed */}
          <div className="mt-4 text-xs text-indigo-300 opacity-60">
            state: {gameState} | q: {quizQuestions.length}
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'question' && !liveQuestion) {
    return (
      <div className="min-h-screen bg-indigo-600 flex items-center justify-center">
        <p className="text-white text-lg animate-pulse">Chargement de la question…</p>
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
                aria-label="Quitter le quiz"
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
              <CircularTimer timeLeft={timeLeft} totalTime={liveQuestion.timeLimit} />
            </div>

            <h2 className="text-lg font-bold text-slate-900 text-center mb-6 md:text-xl">
              {liveQuestion.question}
            </h2>

            {/* Multiple Choice Answers */}
            {liveQuestion.type === 'multiple-choice' && liveQuestion.answers && (
              <div className="grid gap-3">
                {liveQuestion.answers.map((answer, index) => (
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

          {/* Waiting confirmation — no correct answer revealed on player device */}
          {hasAnswered && (
            <div className="animate-scale-in rounded-2xl p-6 text-center bg-white/10 border border-white/20">
              <div className="text-4xl mb-3">⏳</div>
              <h3 className="text-xl font-bold text-white">Réponse envoyée !</h3>
              <p className="text-indigo-200 text-sm mt-2">En attente des autres joueurs…</p>
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
