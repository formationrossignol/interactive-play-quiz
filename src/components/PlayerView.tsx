import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Users, Trophy, LogOut } from "lucide-react";
import { AvatarDisplay } from "./BetterAvatars";
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

const answerShapes = ["▲", "◆", "●", "■"];

export const PlayerView = ({ gameCode, playerName }: PlayerViewProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const playerAvatar = searchParams.get('avatar') || '🎮';
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<'waiting' | 'question' | 'answer-feedback' | 'leaderboard' | 'transition' | 'final'>('waiting');
  const [allPlayers, setAllPlayers] = useState<{ id: string; name: string; avatar: string; score: number }[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [playerScore, setPlayerScore] = useState(0);
  const [playerRank, setPlayerRank] = useState(1);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [lastEarnedPoints, setLastEarnedPoints] = useState(0);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false);
  const [lastAnsweredQuestion, setLastAnsweredQuestion] = useState<any>(null);

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

  // On mount, always fetch authoritative state from Supabase.
  // Local localStorage may be stale (e.g. 'final' from a previous run of the same quiz).
  useEffect(() => {
    ensureSessionState(gameCode);
    fetchSessionStateFromSupabase(gameCode).then((remote) => {
      if (remote) {
        writeSessionState(gameCode, remote);
        syncFromSession();
      }
    });
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
      let mapped: 'waiting' | 'question' | 'answer-feedback' | 'leaderboard' | 'transition' | 'final' = 'waiting';
      if (remoteState === 'question') mapped = 'question';
      else if (remoteState === 'leaderboard') mapped = 'leaderboard';
      else if (remoteState === 'final') mapped = 'final';
      else if (remoteState === 'answer-distribution') mapped = 'answer-feedback';
      else if (remoteState === 'transition') mapped = 'transition';

      // Reset answer state only when a NEW question starts (index changed)
      const newIndex = data.current_question_index ?? 0;
      if (mapped === 'question' && newIndex !== answeredForIndexRef.current) {
        setHasAnswered(false);
        setSelectedAnswer(null);
      }
      setGameState(mapped);

      if (mapped === 'final' && players.length > 0) {
        setAllPlayers(
          [...players]
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
            .map(p => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.score ?? 0 }))
        );
      }

      setTotalPlayers(players.length);

      if (remoteState === 'question' || remoteState === 'transition') {
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

  // Timer countdown (question + transition)
  useEffect(() => {
    if ((gameState === 'question' && !hasAnswered || gameState === 'transition') && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [gameState, timeLeft, hasAnswered]);

  const handleExitQuiz = () => {
    navigate("/");
  };

  const submitAnswer = (answer: number | string) => {
    if (hasAnswered || !liveQuestion) return;

    setLastAnsweredQuestion(liveQuestion);
    setSelectedAnswer(answer);
    setHasAnswered(true);
    answeredForIndexRef.current = currentQuestion;

    const expected = liveQuestion.correctAnswer;
    const correct = liveQuestion.type === 'short-answer'
      ? typeof expected === 'string' && String(answer).toLowerCase().trim() === expected.toLowerCase().trim()
      : answer === expected;

    const base = liveQuestion.points ?? 100;
    const earnedPoints = correct
      ? Math.max(Math.round(base * (timeLeft / (liveQuestion.timeLimit ?? 30))), Math.round(base * 0.1))
      : 0;

    setLastAnswerCorrect(correct);
    setLastEarnedPoints(earnedPoints);
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
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "var(--ap-brand)" }}
      >
        <div className="max-w-md w-full text-center">
          <div className="flex justify-center mb-6">
            <AvatarDisplay emoji={playerAvatar} size="xl" />
          </div>

          <h1 className="ap-h2 text-white mb-2">Connecté !</h1>
          <div className="mb-8" style={{ color: "rgba(255,255,255,0.75)", fontFamily: "var(--ap-font-body)", fontWeight: 700 }}>
            Bonjour <span className="font-bold text-white">{playerName}</span>
          </div>

          <div
            className="p-5 space-y-4"
            style={{
              background: "rgba(255,255,255,0.12)",
              border: "2px solid rgba(255,255,255,0.2)",
              borderRadius: "var(--ap-r-xl)",
            }}
          >
            <div className="ap-code" style={{ color: "#fff", background: "rgba(255,255,255,0.15)", border: "none", fontSize: "28px" }}>
              {gameCode}
            </div>
            <p style={{ color: "rgba(255,255,255,0.75)", fontFamily: "var(--ap-font-body)", fontWeight: 700 }}>
              En attente du début du quiz...
            </p>
            <div className="flex items-center justify-center gap-4" style={{ color: "rgba(255,255,255,0.75)" }}>
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>{totalPlayers} joueurs</span>
              </div>
            </div>
          </div>

          <div className="mt-6 animate-pulse">
            <div className="w-8 h-8 rounded-full mx-auto" style={{ background: "rgba(255,255,255,0.3)" }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'question' && !liveQuestion) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--ap-brand)" }}
      >
        <p className="text-white text-lg animate-pulse" style={{ fontFamily: "var(--ap-font-display)" }}>
          Chargement de la question…
        </p>
      </div>
    );
  }

  if (gameState === 'question') {
    return (
      <div
        className="min-h-screen p-4"
        style={{ background: "var(--ap-brand)" }}
      >
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 text-white">
            <div className="flex items-center gap-4">
              <span
                className="ap-pill"
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "2px solid rgba(255,255,255,0.2)",
                  color: "#fff",
                }}
              >
                Question {currentQuestion + 1}
              </span>
              <div className="flex items-center gap-1" style={{ fontFamily: "var(--ap-font-display)", fontWeight: 600 }}>
                <Trophy className="w-4 h-4" />
                <span>{playerScore}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BackgroundMusic isPlaying={gameState === 'question'} />
              <button
                className="ap-btn ap-btn--ghost ap-btn--sm"
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "2px solid rgba(255,255,255,0.2)",
                  color: "#fff",
                  boxShadow: "none",
                  padding: "8px 10px",
                }}
                aria-label="Quitter le quiz"
                onClick={() => setShowExitDialog(true)}
              >
                <LogOut className="w-4 h-4" />
              </button>
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
          <div className="ap-card ap-card--floaty mb-4">
            <div className="flex justify-center mb-4">
              <CircularTimer timeLeft={timeLeft} totalTime={liveQuestion.timeLimit} />
            </div>

            <h2 className="ap-h3 text-center mb-6" style={{ fontSize: "18px", lineHeight: 1.4 }}>
              {liveQuestion.question}
            </h2>

            {/* Multiple / Single Choice Answers */}
            {['multiple-choice', 'single-choice'].includes(liveQuestion.type) && liveQuestion.answers && (
              <div className="ap-answers">
                {liveQuestion.answers.map((answer: string, index: number) => (
                  <button
                    key={index}
                    className={cn(
                      `ap-answer ap-answer--${(index % 4) + 1}`,
                      selectedAnswer === index && "outline outline-4 outline-white outline-offset-2",
                      hasAnswered && selectedAnswer !== index && "opacity-50"
                    )}
                    onClick={() => submitAnswer(index)}
                    disabled={hasAnswered}
                  >
                    <span className="ap-answer__shape">{answerShapes[index % 4]}</span>
                    {answer}
                  </button>
                ))}
              </div>
            )}

            {/* True / False */}
            {liveQuestion.type === 'true-false' && (
              <div className="ap-answers">
                {[{ label: liveQuestion.answers?.[0] ?? 'Vrai', value: 'true' }, { label: liveQuestion.answers?.[1] ?? 'Faux', value: 'false' }].map(({ label, value }, index) => (
                  <button
                    key={value}
                    className={cn(
                      `ap-answer ap-answer--${index + 1}`,
                      selectedAnswer === value && "outline outline-4 outline-white outline-offset-2",
                      hasAnswered && selectedAnswer !== value && "opacity-50"
                    )}
                    onClick={() => submitAnswer(value)}
                    disabled={hasAnswered}
                  >
                    <span className="ap-answer__shape">{index === 0 ? '✓' : '✗'}</span>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Short Answer */}
            {liveQuestion.type === 'short-answer' && !hasAnswered && (
              <form
                className="flex flex-col gap-3 px-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = (e.currentTarget.elements.namedItem('answer') as HTMLInputElement);
                  if (input.value.trim()) submitAnswer(input.value.trim());
                }}
              >
                <input
                  name="answer"
                  type="text"
                  placeholder="Votre réponse…"
                  className="w-full rounded-xl border-2 border-white/30 bg-white/15 p-4 text-white placeholder-white/50 text-lg outline-none focus:border-white/60"
                  disabled={hasAnswered}
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="ap-btn ap-btn--lg ap-btn--pill"
                  style={{ background: "var(--ap-ink)" }}
                >
                  Valider
                </button>
              </form>
            )}
          </div>

          {/* Waiting confirmation */}
          {hasAnswered && (
            <div
              className="p-6 text-center"
              style={{
                background: "rgba(255,255,255,0.12)",
                border: "2px solid rgba(255,255,255,0.2)",
                borderRadius: "var(--ap-r-xl)",
              }}
            >
              <div className="text-4xl mb-3">⏳</div>
              <h3 className="ap-h3 text-white">Réponse envoyée !</h3>
              <p className="mt-2" style={{ color: "rgba(255,255,255,0.75)", fontFamily: "var(--ap-font-body)", fontSize: "14px" }}>
                En attente des autres joueurs…
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (gameState === 'answer-feedback') {
    const correctAnswerText = (() => {
      if (!lastAnsweredQuestion) return '';
      const q = lastAnsweredQuestion;
      if (q.type === 'multiple-choice' || q.type === 'single-choice') {
        const idx = typeof q.correctAnswer === 'number' ? q.correctAnswer : Number(q.correctAnswer);
        return q.answers?.[idx] ?? '';
      }
      if (q.type === 'true-false') {
        return q.correctAnswer === 'true' ? (q.answers?.[0] ?? 'Vrai') : (q.answers?.[1] ?? 'Faux');
      }
      return String(q.correctAnswer ?? '');
    })();

    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: lastAnswerCorrect ? "var(--ap-brand)" : "#1a1a2e" }}
      >
        <div className="max-w-md w-full text-center">
          <div className="text-8xl mb-4 drop-shadow-xl">{lastAnswerCorrect ? '✅' : '❌'}</div>
          <h2 className="ap-h2 text-white mb-3">
            {lastAnswerCorrect ? 'Bonne réponse !' : 'Mauvaise réponse !'}
          </h2>

          {!lastAnswerCorrect && correctAnswerText && (
            <p className="mb-4" style={{ color: 'rgba(255,255,255,0.75)', fontFamily: 'var(--ap-font-body)', fontWeight: 600 }}>
              La bonne réponse était :{' '}
              <span className="font-bold text-white">{correctAnswerText}</span>
            </p>
          )}

          <div
            className="p-6"
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: '2px solid rgba(255,255,255,0.25)',
              borderRadius: 'var(--ap-r-xl)',
              marginTop: '8px',
            }}
          >
            <div
              className="text-5xl font-bold text-white mb-1"
              style={{ fontFamily: 'var(--ap-font-display)' }}
            >
              +{lastEarnedPoints}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700, fontFamily: 'var(--ap-font-body)' }}>
              points gagnés
            </div>
            <div
              style={{
                borderTop: '1px solid rgba(255,255,255,0.2)',
                marginTop: '16px',
                paddingTop: '16px',
                color: 'rgba(255,255,255,0.85)',
                fontWeight: 700,
                fontFamily: 'var(--ap-font-body)',
              }}
            >
              Total : <span className="text-white font-bold">{playerScore} pts</span>
            </div>
          </div>

          <p className="mt-4 text-sm" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--ap-font-body)' }}>
            En attente de la suite…
          </p>
        </div>
      </div>
    );
  }

  if (gameState === 'transition') {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "var(--ap-pres)" }}
      >
        <div className="text-center">
          <div className="text-6xl mb-6 drop-shadow-xl animate-bounce">⏳</div>
          <h2 className="ap-h2 text-white mb-3">Prochaine question…</h2>
          <div
            className="text-6xl font-bold text-white mb-4"
            style={{ fontFamily: "var(--ap-font-display)" }}
          >
            {timeLeft > 0 ? timeLeft : ''}
          </div>
          <p style={{ color: "rgba(255,255,255,0.65)", fontFamily: "var(--ap-font-body)", fontWeight: 600 }}>
            Préparez-vous !
          </p>
        </div>
      </div>
    );
  }

  if (gameState === 'leaderboard') {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "var(--ap-flash)" }}
      >
        <div className="max-w-md w-full text-center">
          <div className="mb-4 text-6xl drop-shadow-xl animate-bounce">🏆</div>
          <h2 className="ap-h2 text-white mb-6">Classement</h2>

          <div className="space-y-4 mb-6">
            <div
              className="flex items-center gap-4 p-4 text-white"
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "2px solid rgba(255,255,255,0.25)",
                borderRadius: "var(--ap-r-lg)",
              }}
            >
              <span className="text-2xl" style={{ fontFamily: "var(--ap-font-display)", fontWeight: 600, color: "var(--ap-ink)" }}>
                #{playerRank}
              </span>
              <span className="flex-1 text-left font-bold">{playerName}</span>
              <span className="font-bold" style={{ color: "var(--ap-ink)" }}>{playerScore} pts</span>
            </div>

            <div
              className="p-4 text-sm font-bold"
              style={{
                background: "rgba(255,255,255,0.12)",
                border: "2px solid rgba(255,255,255,0.2)",
                borderRadius: "var(--ap-r-lg)",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              ⏳ Attendez la prochaine question...
            </div>
          </div>

          <div
            className="p-4 text-center text-sm font-bold"
            style={{
              background: "rgba(255,255,255,0.12)",
              border: "2px solid rgba(255,255,255,0.2)",
              borderRadius: "var(--ap-r-lg)",
              color: "rgba(255,255,255,0.85)",
            }}
          >
            ⏳ En attente de la prochaine question…
          </div>
        </div>
      </div>
    );
  }

  // final state
  return (
    <div
      className="min-h-screen p-4"
      style={{ background: "var(--ap-pres)" }}
    >
      <div className="max-w-md mx-auto text-center">
        <div className="mb-4 text-6xl drop-shadow-lg">🎉</div>
        <h2 className="ap-h2 text-white mb-2">Quiz terminé !</h2>

        {/* Player's own result */}
        <div
          className="p-4 mb-6"
          style={{
            background: "rgba(255,255,255,0.18)",
            border: "2px solid rgba(255,255,255,0.3)",
            borderRadius: "var(--ap-r-xl)",
          }}
        >
          <div className="ap-h1 text-white mb-1">{playerScore}</div>
          <div className="font-bold text-sm mb-1" style={{ color: "rgba(255,255,255,0.75)" }}>points</div>
          <div className="font-bold" style={{ color: "rgba(255,255,255,0.85)" }}>
            Rang final : <span className="text-white">#{playerRank}</span> sur {totalPlayers}
          </div>
        </div>

        {/* Full ranking */}
        {allPlayers.length > 0 && (
          <div className="mb-6 space-y-2">
            {allPlayers.map((p, idx) => {
              const isMe = p.id === playerId;
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{
                    background: isMe ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)",
                    border: isMe ? "2px solid rgba(255,255,255,0.5)" : "2px solid rgba(255,255,255,0.15)",
                  }}
                >
                  <span className="w-8 text-center text-lg font-bold text-white">
                    {idx < 3 ? medals[idx] : `${idx + 1}`}
                  </span>
                  <AvatarDisplay emoji={p.avatar} size="sm" />
                  <span className="flex-1 text-left font-bold text-white truncate">{p.name}</span>
                  <span className="font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>{p.score} pts</span>
                </div>
              );
            })}
          </div>
        )}

        <button
          className="ap-btn ap-btn--lg ap-btn--pill"
          style={{ background: "var(--ap-ink)", boxShadow: "0 5px 0 rgba(0,0,0,0.3)" }}
          onClick={() => navigate("/")}
        >
          Retour à l&apos;accueil
        </button>
      </div>
    </div>
  );
};
