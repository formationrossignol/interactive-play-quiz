import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Clock, Trophy, Settings, Download, LogOut } from "lucide-react";
import { QRCodeGenerator } from "./QRCodeGenerator";
import { WordCloudQuestion } from "./WordCloudQuestion";
import { RankingQuestion } from "./RankingQuestion";
import { MultiStepProgress } from "./MultiStepProgress";
import { BackgroundMusic } from "./BackgroundMusic";
import { ExitQuizDialog } from "./ExitQuizDialog";
import { CircularTimer } from "./CircularTimer";
import { QuizSessionAnswerDistribution } from "./QuizSession_AnswerDistribution";
import { RaceLeaderboard } from "./RaceLeaderboard";
import { TransitionTimer } from "./TransitionTimer";
import { AvatarDisplay } from "./BetterAvatars";
import { cn } from "@/lib/utils";
import { DEFAULT_THEME_ID, THEMES } from "@/lib/themes";
import { hexToRgba } from "@/lib/color";
import {
  ensureSessionState,
  ensureSessionInSupabase,
  getSessionStorageKey,
  patchSessionState,
  readSessionState,
  resetSessionForNewRun,
  appendSessionHistory,
  readSessionHistory,
  type SharedPlayer,
  type SessionRun,
} from "@/lib/sessionState";
import { supabase } from "@/lib/supabase";

interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  previousScore?: number;
  correctAnswers: number;
  joinedAt: Date;
  lastAnswer?: number;
  lastAnswerQuestionIndex?: number;
}

const FONT_STACKS: Record<string, string> = {
  inter: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  poppins: '"Poppins", "Inter", sans-serif',
  "space-grotesk": '"Space Grotesk", "Inter", sans-serif',
  playfair: '"Playfair Display", "Times New Roman", serif',
  merriweather: '"Merriweather", "Georgia", serif',
};

interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'single-choice' | 'true-false' | 'short-answer' | 'ranking' | 'word-cloud';
  question: string;
  answers?: string[];
  correctAnswer?: number | string;
  timeLimit: number;
  points: number;
  items?: Array<{ id: string; text: string; correctPosition: number }>;
  image?: string;
  [key: string]: unknown;
}

interface QuizSession {
  id: string;
  title: string;
  description: string;
  gameCode: string;
  questions: QuizQuestion[];
  hostId: string;
  isActive: boolean;
  createdAt: Date;
  headerImage?: string;
  theme?: string;
  font?: string;
  transitionTime?: number;
}

interface QuizSessionProps {
  quiz: QuizSession;
  isHost?: boolean;
}

// Pre-computed once so Math.random() doesn't re-run on every re-render of the final screen
const CONFETTI_ITEMS = Array.from({ length: 80 }, () => ({
  left: Math.random() * 100,
  color: ['#ffb020', '#ff5a4d', '#15c08a', '#7048ff', '#2f7bff'][Math.floor(Math.random() * 5)],
  delay: Math.random() * 3,
  duration: 2 + Math.random() * 2,
}));

interface PlayerSidebarItemProps {
  player: Player;
  answered: boolean;
  offline: boolean;
}

const PlayerSidebarItem = memo(({ player, answered, offline }: PlayerSidebarItemProps) => (
  <div
    className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-all duration-300"
    style={{
      background: offline
        ? 'rgba(239,68,68,0.1)'
        : answered
        ? 'rgba(21,192,138,0.18)'
        : 'rgba(255,255,255,0.04)',
      opacity: offline ? 0.6 : answered ? 1 : 0.45,
      border: offline ? '1px solid rgba(239,68,68,0.25)' : '1px solid transparent',
    }}
  >
    <AvatarDisplay emoji={player.avatar} size="sm" />
    <span className="flex-1 truncate text-xs font-bold text-white">{player.name}</span>
    {offline && <span className="text-red-400 text-xs flex-shrink-0">✗</span>}
    {!offline && answered && <span className="text-xs flex-shrink-0" style={{ color: '#6ee7b7' }}>✓</span>}
  </div>
));

export const QuizSession = ({ quiz, isHost = false }: QuizSessionProps) => {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [sessionReady, setSessionReady] = useState(false);

  const [gameState, setGameState] = useState<'waiting' | 'transition' | 'question' | 'answer-distribution' | 'leaderboard' | 'final'>('waiting');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<SessionRun[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [answerDistribution, setAnswerDistribution] = useState<number[]>([]);
  const [sessionStats, setSessionStats] = useState({
    totalPlayers: 0,
    averageScore: 0,
    questionsAnswered: 0,
    duration: 0
  });
  const [disconnectedIds, setDisconnectedIds] = useState<Set<string>>(new Set());
  const disconnectedIdsRef = useRef<Set<string>>(new Set());

  const joinUrl = `${window.location.origin}/join/${quiz.gameCode}`;
  const currentQuestion = quiz.questions[currentQuestionIndex];

  const selectedTheme = useMemo(() => {
    const themeId = quiz.theme ?? DEFAULT_THEME_ID;
    return THEMES.find((themeOption) => themeOption.id === themeId) ?? THEMES[0];
  }, [quiz.theme]);

  const backgroundStyle = useMemo(() => {
    if (!selectedTheme) {
      return {
        background: "linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(15, 23, 42, 0.88))",
      };
    }

    return {
      backgroundImage: selectedTheme.background,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    };
  }, [selectedTheme]);

  const overlayColor = useMemo(() => {
    if (!selectedTheme?.palette?.length) {
      return "rgba(15, 23, 42, 0.72)";
    }

    const midPalette = selectedTheme.palette[Math.min(2, selectedTheme.palette.length - 1)];
    return hexToRgba(midPalette, 0.7);
  }, [selectedTheme]);

  const accentOverlay = useMemo(() => {
    const firstPalette = selectedTheme?.palette?.[0];
    return firstPalette ? hexToRgba(firstPalette, 0.28) : "rgba(15, 23, 42, 0.45)";
  }, [selectedTheme]);

  const fontFamily = quiz.font ? FONT_STACKS[quiz.font] : undefined;

  const questionImage = typeof currentQuestion?.image === "string" ? currentQuestion.image : undefined;
  const headerImage = typeof quiz.headerImage === "string" ? quiz.headerImage : undefined;

  const ThemedBackground = ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className="relative min-h-screen" style={backgroundStyle}>
      <div className="absolute inset-0" style={{ background: accentOverlay }} aria-hidden />
      <div className="absolute inset-0" style={{ background: overlayColor, mixBlendMode: "multiply" }} aria-hidden />
      <div className={cn("relative z-10", className)} style={fontFamily ? { fontFamily } : undefined}>
        {children}
      </div>
    </div>
  );

  const [hasSyncedPlayers, setHasSyncedPlayers] = useState(false);

  const normalizeSharedPlayer = useCallback((shared: SharedPlayer): Player => ({
    id: shared.id,
    name: shared.name,
    avatar: shared.avatar,
    score: shared.score ?? 0,
    correctAnswers: shared.correctAnswers ?? 0,
    previousScore: shared.previousScore,
    joinedAt: shared.joinedAt ? new Date(shared.joinedAt) : new Date(),
    lastAnswer: shared.lastAnswer,
    lastAnswerQuestionIndex: shared.lastAnswerQuestionIndex,
  }), []);

  // Refs so syncFromStorage doesn't need to close over mutable state
  const gameStateRef = useRef(gameState);
  const currentQuestionIndexRef = useRef(currentQuestionIndex);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { currentQuestionIndexRef.current = currentQuestionIndex; }, [currentQuestionIndex]);

  // Auto-advance guard — reset each time a new question starts
  const hasAutoAdvancedRef = useRef(false);
  useEffect(() => { hasAutoAdvancedRef.current = false; }, [currentQuestionIndex]);

  // Tracks the wall-clock end time of the current question (set when question starts)
  const questionEndTimeRef = useRef<number | null>(null);

  // Always-fresh ref to showAnswerDistribution — avoids stale-closure in interval/effects
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const showAnswerDistRef = useRef<() => any>(() => {});

  const syncFromStorage = useCallback(() => {
    const session = readSessionState(quiz.gameCode);
    const mappedPlayers = session.players.map(normalizeSharedPlayer);
    setPlayers(mappedPlayers);

    if (session.gameState && session.gameState !== gameStateRef.current) {
      setGameState(session.gameState);
    }

    if (
      typeof session.currentQuestionIndex === 'number' &&
      session.currentQuestionIndex !== currentQuestionIndexRef.current &&
      session.currentQuestionIndex >= 0 &&
      session.currentQuestionIndex < quiz.questions.length
    ) {
      setCurrentQuestionIndex(session.currentQuestionIndex);
      const nextQuestion = quiz.questions[session.currentQuestionIndex];
      if (nextQuestion?.timeLimit) {
        setTimeLeft(nextQuestion.timeLimit);
      }
    }

    if (gameStateRef.current === 'question') {
      setTimeLeft(session.timeLeft);
    }

    setHasSyncedPlayers(true);
  }, [normalizeSharedPlayer, quiz.gameCode, quiz.questions]);

  // Run once on mount: init session and register storage listener
  useEffect(() => {
    const init = async () => {
      ensureSessionState(quiz.gameCode);
      const existing = readSessionState(quiz.gameCode);

      if (isHost) {
        // Save results of any previous run before resetting
        if (existing.players.length > 0) {
          appendSessionHistory(quiz.gameCode, existing.players, quiz.questions.length);
        }
        // Always reset — clears stale players from previous sessions
        const ok = await resetSessionForNewRun(quiz.gameCode, { questions: quiz.questions, title: quiz.title });
        if (!ok) {
          toast.error('Erreur Supabase lors de la réinitialisation. Vérifiez la console.');
        }
      } else {
        const ok = await ensureSessionInSupabase(quiz.gameCode, { questions: quiz.questions, title: quiz.title });
        if (!ok) {
          toast.error('Erreur Supabase — les joueurs ne pourront pas rejoindre depuis un autre appareil. Vérifiez la console pour les détails.');
        }
        syncFromStorage();
      }

      setSessionHistory(readSessionHistory(quiz.gameCode));
      setSessionReady(true);
    };

    init().catch((err) => {
      console.error('[QuizSession] init error:', err);
      toast.error(`Supabase: ${err?.message ?? 'erreur inconnue'}`);
      setSessionReady(true);
    });

    const handleStorage = (event: StorageEvent) => {
      if (event.key === getSessionStorageKey(quiz.gameCode)) {
        syncFromStorage();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz.gameCode]);

  // Poll Supabase for player updates (joins in waiting, answers+scores during question).
  // Polling avoids the write→event→sync→write feedback loop that realtime would cause.
  useEffect(() => {
    if (!isHost) return;
    if (gameState !== 'waiting' && gameState !== 'question') return;

    const poll = async () => {
      const { data, error } = await supabase
        .from('session_state')
        .select('players')
        .eq('game_code', quiz.gameCode)
        .single();
      if (error) console.error('[QuizSession poll error]', error.code, error.message);
      if (data?.players && Array.isArray(data.players)) {
        const remote = (data.players as SharedPlayer[]).map(normalizeSharedPlayer);
        setPlayers((prev) => {
          if (gameState === 'waiting') {
            const prevIds = new Set(prev.map((p) => p.id));
            const hasNew = remote.some((p) => !prevIds.has(p.id));
            return hasNew ? remote : prev;
          }
          // During question: merge scores and answers from Supabase without full replace
          // to avoid overwriting host-managed fields (previousScore etc.)
          return prev.map((p) => {
            const fresh = remote.find((r) => r.id === p.id);
            if (!fresh) return p;
            return {
              ...p,
              score: fresh.score ?? p.score,
              correctAnswers: fresh.correctAnswers ?? p.correctAnswers,
              lastAnswer: fresh.lastAnswer,
              lastAnswerQuestionIndex: fresh.lastAnswerQuestionIndex,
            };
          });
        });

        // Disconnect detection: player is considered offline if heartbeat >15s stale
        if (gameState === 'question') {
          const THRESHOLD_MS = 15000;
          const now = Date.now();
          (data.players as SharedPlayer[]).forEach((p) => {
            if (!p.lastHeartbeat) return;
            const age = now - new Date(p.lastHeartbeat).getTime();
            const wasDisconnected = disconnectedIdsRef.current.has(p.id);
            if (age > THRESHOLD_MS && !wasDisconnected) {
              disconnectedIdsRef.current.add(p.id);
              setDisconnectedIds(new Set(disconnectedIdsRef.current));
              toast.error(`${p.name} s'est déconnecté`, { duration: 5000 });
            } else if (age <= THRESHOLD_MS && wasDisconnected) {
              disconnectedIdsRef.current.delete(p.id);
              setDisconnectedIds(new Set(disconnectedIdsRef.current));
            }
          });
        }
      }
    };

    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [isHost, gameState, quiz.gameCode, normalizeSharedPlayer]);

  useEffect(() => {
    if (!isHost || !hasSyncedPlayers) return;
    // During waiting: players add themselves to Supabase directly via upsertPlayerInSession.
    // Writing here would overwrite their entries with the host's (initially empty) local list.
    if (gameState === 'waiting') return;

    const playersForStorage: SharedPlayer[] = players.map((player) => ({
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      score: player.score,
      correctAnswers: player.correctAnswers,
      previousScore: player.previousScore,
      joinedAt: player.joinedAt.toISOString(),
      lastAnswer: player.lastAnswer,
      lastAnswerQuestionIndex: player.lastAnswerQuestionIndex,
    }));

    patchSessionState(quiz.gameCode, { players: playersForStorage });
  }, [hasSyncedPlayers, isHost, gameState, players, quiz.gameCode]);

  // Timer: interval-based with Date.now() — no drift, updates 4× per second.
  // Integrates auto-advance via showAnswerDistRef to avoid stale-closure issues.
  useEffect(() => {
    if (gameState !== 'question') return;
    const interval = setInterval(() => {
      if (questionEndTimeRef.current === null) return;
      const remaining = Math.max(0, Math.ceil((questionEndTimeRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0 && !hasAutoAdvancedRef.current) {
        hasAutoAdvancedRef.current = true;
        clearInterval(interval);
        showAnswerDistRef.current();
      }
    }, 250);
    return () => clearInterval(interval);
  }, [gameState, currentQuestionIndex]);

  // Auto-advance when every player has answered the current question
  useEffect(() => {
    if (!isHost || gameState !== 'question' || players.length === 0) return;
    if (hasAutoAdvancedRef.current) return;

    const allAnswered = players.every(
      (p) => p.lastAnswerQuestionIndex === currentQuestionIndex
    );
    if (allAnswered) {
      hasAutoAdvancedRef.current = true;
      showAnswerDistRef.current();
    }
  }, [players, gameState, currentQuestionIndex, isHost]);

  // Write timeLeft to Supabase only every 5s (not every second) to reduce write load.
  // Players sync their local countdown independently; this is just a fallback resync.
  useEffect(() => {
    if (!isHost || gameState !== 'question') return;
    if (timeLeft % 5 !== 0 && timeLeft !== 0) return;

    patchSessionState(quiz.gameCode, { timeLeft });
  }, [gameState, isHost, quiz.gameCode, timeLeft]);


  // Update session stats
  useEffect(() => {
    setSessionStats({
      totalPlayers: players.length,
      averageScore: players.reduce((sum, p) => sum + p.score, 0) / players.length || 0,
      questionsAnswered: currentQuestionIndex,
      duration: Date.now() - quiz.createdAt.getTime()
    });
  }, [players, currentQuestionIndex, quiz.createdAt]);

  const startQuiz = () => {
    questionEndTimeRef.current = Date.now() + currentQuestion.timeLimit * 1000;
    setGameState('question');
    setTimeLeft(currentQuestion.timeLimit);
    if (isHost) {
      patchSessionState(quiz.gameCode, {
        gameState: 'question',
        currentQuestionIndex,
        timeLeft: currentQuestion.timeLimit,
      });
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < quiz.questions.length - 1) {
      // Save previous scores before updating
      setPlayers(prev => prev.map(p => ({ ...p, previousScore: p.score })));
      setGameState('transition');
      if (isHost) {
        patchSessionState(quiz.gameCode, {
          gameState: 'transition',
          currentQuestionIndex,
          timeLeft: quiz.transitionTime ?? 5,
        });
      }
    } else {
      setGameState('final');
      if (isHost) {
        patchSessionState(quiz.gameCode, {
          gameState: 'final',
          currentQuestionIndex,
        });
      }
    }
  };

  const handleTransitionComplete = () => {
    const nextTimeLimit = quiz.questions[currentQuestionIndex + 1].timeLimit;
    questionEndTimeRef.current = Date.now() + nextTimeLimit * 1000;
    setCurrentQuestionIndex(prev => prev + 1);
    setGameState('question');
    setTimeLeft(nextTimeLimit);
    if (isHost) {
      patchSessionState(quiz.gameCode, {
        gameState: 'question',
        currentQuestionIndex: currentQuestionIndex + 1,
        timeLeft: nextTimeLimit,
      });
    }
  };

  const showAnswerDistribution = async () => {
    // Fetch latest player answers directly from Supabase (cross-device safe)
    let freshPlayers: SharedPlayer[] = readSessionState(quiz.gameCode).players;
    try {
      const { data } = await supabase
        .from('session_state')
        .select('players')
        .eq('game_code', quiz.gameCode)
        .single();
      if (data?.players && Array.isArray(data.players)) {
        freshPlayers = data.players as SharedPlayer[];
      }
    } catch {}

    const answeredPlayers = freshPlayers.filter(
      (p) => p.lastAnswerQuestionIndex === currentQuestionIndex
    );
    const counts = currentQuestion.answers
      ? currentQuestion.answers.map((_: unknown, i: number) =>
          answeredPlayers.filter((p) => p.lastAnswer === i).length
        )
      : [];
    const total = counts.reduce((s: number, c: number) => s + c, 0);
    const distribution = counts.map((c: number) =>
      total > 0 ? Math.round((c / total) * 100) : 0
    );

    // Also sync scores into host players state from fresh Supabase data
    setPlayers((prev) =>
      prev.map((p) => {
        const fresh = freshPlayers.find((r) => r.id === p.id);
        if (!fresh) return p;
        return {
          ...p,
          score: fresh.score ?? p.score,
          correctAnswers: fresh.correctAnswers ?? p.correctAnswers,
          lastAnswer: fresh.lastAnswer,
          lastAnswerQuestionIndex: fresh.lastAnswerQuestionIndex,
        };
      })
    );

    setAnswerDistribution(distribution);
    setGameState('answer-distribution');
    if (isHost) {
      patchSessionState(quiz.gameCode, {
        gameState: 'answer-distribution',
        currentQuestionIndex,
      });
    }
  };

  // Keep ref fresh every render so interval/effects always call the latest version
  showAnswerDistRef.current = showAnswerDistribution;

  const showLeaderboard = () => {
    setGameState('leaderboard');
    if (isHost) {
      patchSessionState(quiz.gameCode, {
        gameState: 'leaderboard',
        currentQuestionIndex,
      });
    }
  };

  const handleExitQuiz = () => {
    navigate("/");
  };

  const exportResults = () => {
    const results = {
      quiz: quiz.title,
      gameCode: quiz.gameCode,
      date: new Date().toISOString(),
      players: players.map(p => ({
        name: p.name,
        score: p.score,
        correctAnswers: p.correctAnswers,
        joinedAt: p.joinedAt.toISOString()
      })),
      stats: sessionStats
    };

    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `quiz-results-${quiz.gameCode}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (gameState === 'waiting') {
    return (
      <ThemedBackground className="p-4 text-slate-100">
        <div className="mx-auto max-w-6xl space-y-6">
          {headerImage && (
            <Card className="overflow-hidden border border-white/10 bg-black/30 shadow-2xl backdrop-blur">
              <div className="relative h-56 w-full md:h-64">
                <img
                  src={headerImage}
                  alt={`Illustration pour ${quiz.title}`}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" aria-hidden />
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <h1 className="text-3xl font-bold text-white drop-shadow-lg md:text-4xl">{quiz.title}</h1>
                  {quiz.description && (
                    <p className="mt-2 max-w-3xl text-sm text-slate-200 md:text-base">
                      {quiz.description}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Host Controls */}
          {isHost && (
            <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/30 p-6 shadow-xl backdrop-blur">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-white drop-shadow">{quiz.title}</h2>
                  {quiz.description && (
                    <p className="text-sm text-slate-200 md:text-base">{quiz.description}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowExitDialog(true)}
                    className="border-white/30 bg-black/40 text-slate-100 backdrop-blur hover:bg-black/60"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Quitter
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowSettings(!showSettings)}
                    className="border-white/30 bg-black/40 text-slate-100 backdrop-blur hover:bg-black/60"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Paramètres
                  </Button>
                  <Button variant="hero" size="lg" onClick={startQuiz} disabled={players.length === 0}>
                    Lancer le quiz ({players.length} joueurs)
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          <ExitQuizDialog
            open={showExitDialog}
            onOpenChange={setShowExitDialog}
            onConfirm={handleExitQuiz}
          />

          <Dialog open={showSettings} onOpenChange={setShowSettings}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Paramètres du quiz</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Titre</span>
                  <span className="font-medium">{quiz.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Questions</span>
                  <span className="font-medium">{quiz.questions.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Code</span>
                  <span className="font-mono font-medium">{quiz.gameCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Temps de transition</span>
                  <span className="font-medium">{quiz.transitionTime ?? 5} s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Thème</span>
                  <span className="font-medium">{selectedTheme?.name ?? "Défaut"}</span>
                </div>
                {quiz.font && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Police</span>
                    <span className="font-medium">{quiz.font}</span>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* QR Code & Join Info */}
            <div className="space-y-4 lg:col-span-1">
              {sessionReady ? (
                <QRCodeGenerator gameCode={quiz.gameCode} joinUrl={joinUrl} />
              ) : (
                <Card className="border border-white/10 bg-black/30 text-slate-100 backdrop-blur">
                  <CardContent className="flex flex-col items-center justify-center p-10 gap-3 text-slate-200">
                    <Settings className="w-8 h-8 animate-spin opacity-60" />
                    <span className="text-sm font-semibold">Synchronisation…</span>
                  </CardContent>
                </Card>
              )}
              <Card className="border border-white/10 bg-black/30 text-slate-100 backdrop-blur">
                <CardContent className="space-y-2 p-4 text-sm">
                  <div className="flex items-center gap-2 text-slate-200">
                    <Users className="h-4 w-4" />
                    <span>{players.length} joueur(s) en attente</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-200">
                    <Clock className="h-4 w-4" />
                    <span>Transition : {quiz.transitionTime ?? 5} s</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Players List */}
            <div className="lg:col-span-2">
              <Card className="border border-white/10 bg-black/35 shadow-xl backdrop-blur">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="flex items-center gap-2 text-xl font-bold text-white">
                      <Users className="w-5 h-5" />
                      Participants ({players.length})
                    </h3>
                    {isHost && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportResults}
                        className="border-white/30 bg-black/40 text-slate-100 backdrop-blur hover:bg-black/60"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Exporter
                      </Button>
                    )}
                  </div>

                  <div className="grid max-h-96 gap-3 overflow-y-auto md:grid-cols-2 lg:grid-cols-3">
                    {players.map((player) => (
                      <div
                        key={player.id}
                        className="flex items-center gap-3 rounded-lg border border-white/10 bg-slate-900/40 p-3 text-sm text-slate-100 shadow-sm backdrop-blur-md animate-fade-in"
                      >
                        <AvatarDisplay emoji={player.avatar} size="sm" />
                        <span className="flex-1 truncate">{player.name}</span>
                      </div>
                    ))}
                    {players.length === 0 && (
                      <div className="col-span-full py-8 text-center text-slate-200">
                        <p>En attente des participants…</p>
                        <p className="mt-2 text-sm text-slate-300">Partagez le QR code ou le code de jeu</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Session History */}
          {isHost && sessionHistory.length > 0 && (
            <Card className="border border-white/10 bg-black/35 shadow-xl backdrop-blur">
              <CardContent className="p-6">
                <h3 className="mb-4 flex items-center gap-2 text-xl font-bold text-white">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  Sessions précédentes
                </h3>
                <div className="space-y-4">
                  {sessionHistory.map((run) => {
                    const sorted = [...run.players].sort((a, b) => b.score - a.score);
                    return (
                      <details key={run.id} className="group rounded-lg border border-white/10 bg-black/20 p-4">
                        <summary className="flex cursor-pointer items-center justify-between text-slate-200 list-none">
                          <span className="font-semibold">
                            {new Date(run.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-sm text-slate-400">{run.players.length} joueur(s) · {run.questionCount} questions</span>
                        </summary>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {sorted.map((p, idx) => (
                            <div key={p.id} className="flex items-center gap-2 rounded border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100">
                              <span className="w-5 text-center">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}</span>
                              <AvatarDisplay emoji={p.avatar} size="sm" />
                              <span className="flex-1 truncate">{p.name}</span>
                              <span className="font-semibold text-yellow-300">{p.score} pts</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quiz Preview */}
          {isHost && (
            <Card className="border border-white/10 bg-black/35 shadow-xl backdrop-blur">
              <CardContent className="p-6">
                <h3 className="mb-4 text-xl font-bold text-white">Aperçu du quiz</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white drop-shadow">{quiz.questions.length}</div>
                    <div className="text-sm text-slate-300">Questions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white drop-shadow">
                      {Math.round(quiz.questions.reduce((sum, q) => sum + q.timeLimit, 0) / 60)}m
                    </div>
                    <div className="text-sm text-slate-300">Durée estimée</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white drop-shadow">
                      {quiz.questions.reduce((sum, q) => sum + q.points, 0)}
                    </div>
                    <div className="text-sm text-slate-300">Points totaux</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white drop-shadow">{players.length}</div>
                    <div className="text-sm text-slate-300">Participants</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </ThemedBackground>
    );
  }

  if (gameState === 'transition') {
    return (
      <ThemedBackground className="flex items-center justify-center p-4 text-slate-100">
        <TransitionTimer
          duration={quiz.transitionTime ?? 5}
          onComplete={handleTransitionComplete}
        />
      </ThemedBackground>
    );
  }

  if (gameState === 'question') {
    const answeredCount = players.filter(
      (p) => p.lastAnswerQuestionIndex === currentQuestionIndex
    ).length;
    const allAnswered = players.length > 0 && answeredCount === players.length;

    const ANSWER_STYLES = [
      { bg: '#E74C3C', shadow: 'rgba(231,76,60,0.45)', shape: '▲' },
      { bg: '#2980B9', shadow: 'rgba(41,128,185,0.45)', shape: '◆' },
      { bg: '#F39C12', shadow: 'rgba(243,156,18,0.45)', shape: '●' },
      { bg: '#27AE60', shadow: 'rgba(39,174,96,0.45)', shape: '■' },
    ];

    return (
      <ThemedBackground className="min-h-screen flex flex-col text-white">
        <ExitQuizDialog
          open={showExitDialog}
          onOpenChange={setShowExitDialog}
          onConfirm={handleExitQuiz}
        />

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between px-5 py-3 bg-black/50 backdrop-blur-sm border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-4">
            <span
              className="text-sm font-bold text-white/70"
              style={{ fontFamily: 'var(--ap-font-display)' }}
            >
              Q {currentQuestionIndex + 1}/{quiz.questions.length}
            </span>
            <MultiStepProgress
              totalSteps={quiz.questions.length}
              currentStep={currentQuestionIndex}
              className="w-28 h-2"
            />
          </div>
          <div className="flex items-center gap-2">
            {/* Live answered count */}
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold transition-all duration-500"
              style={{
                background: allAnswered ? 'rgba(39,174,96,0.3)' : 'rgba(255,255,255,0.12)',
                border: allAnswered ? '1px solid rgba(39,174,96,0.5)' : '1px solid rgba(255,255,255,0.15)',
              }}
            >
              <Users className="w-4 h-4" />
              <span>
                {answeredCount}
                <span className="text-white/50">/{players.length}</span>
              </span>
              {allAnswered && <span className="text-green-400 ml-0.5">✓</span>}
            </div>
            {isHost && (
              <>
                <BackgroundMusic isPlaying />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowExitDialog(true)}
                  className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
                <Button variant="quiz" size="sm" onClick={showAnswerDistribution}>
                  Résultats
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ── Body row: main content + dedicated sidebar ── */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* ── Question zone (center) ── */}
            <div className="flex-1 flex flex-col items-center justify-center px-8 py-6 gap-5 overflow-auto">
              {/* Timer + points row */}
              <div className="flex items-center gap-5">
                <CircularTimer timeLeft={timeLeft} totalTime={currentQuestion.timeLimit} />
                <div
                  className="flex items-center gap-2 rounded-2xl border border-white/20 bg-black/30 px-5 py-2.5 backdrop-blur"
                >
                  <Trophy className="w-5 h-5 text-yellow-300" />
                  <span
                    className="text-2xl font-bold text-yellow-200"
                    style={{ fontFamily: 'var(--ap-font-display)' }}
                  >
                    {currentQuestion.points} pts
                  </span>
                </div>
              </div>

              {/* Question image */}
              {questionImage && (
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-xl max-h-48 w-full max-w-3xl">
                  <img
                    src={questionImage}
                    alt={currentQuestion.question}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              {/* Question text */}
              <h1
                className="text-center text-white drop-shadow-2xl max-w-4xl leading-snug"
                style={{
                  fontFamily: 'var(--ap-font-display)',
                  fontSize: 'clamp(1.4rem, 3.5vw, 2.6rem)',
                  fontWeight: 700,
                  textShadow: '0 2px 16px rgba(0,0,0,0.4)',
                }}
              >
                {currentQuestion.question}
              </h1>

              {/* Word-cloud / ranking types (non-standard) */}
              {currentQuestion.type === 'word-cloud' && (
                <WordCloudQuestion
                  question={currentQuestion.question}
                  timeLimit={currentQuestion.timeLimit}
                  onSubmit={(answer) => console.log('Word cloud answer:', answer)}
                  responses={[
                    { word: 'innovation', count: 5, player: 'Alice' },
                    { word: 'technology', count: 3, player: 'Bob' },
                    { word: 'future', count: 4, player: 'Charlie' }
                  ]}
                  showResults={false}
                />
              )}
              {currentQuestion.type === 'ranking' && currentQuestion.items && (
                <RankingQuestion
                  question={currentQuestion.question}
                  items={currentQuestion.items}
                  timeLimit={currentQuestion.timeLimit}
                  onSubmit={(ranking) => console.log('Ranking answer:', ranking)}
                  showResults={false}
                />
              )}
            </div>

            {/* ── Answer grid (Kahoot-style bottom) ── */}
            {['multiple-choice', 'single-choice'].includes(currentQuestion.type) && currentQuestion.answers && (
              <div className="grid grid-cols-2 gap-3 p-4 pt-0 flex-shrink-0">
                {(currentQuestion.answers as string[]).map((answer, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 rounded-2xl px-6 py-4 text-white font-bold text-lg select-none"
                    style={{
                      background: ANSWER_STYLES[index % 4].bg,
                      boxShadow: `0 6px 24px ${ANSWER_STYLES[index % 4].shadow}`,
                      minHeight: '72px',
                      fontFamily: 'var(--ap-font-body)',
                    }}
                  >
                    <span className="text-2xl opacity-90 flex-shrink-0">
                      {ANSWER_STYLES[index % 4].shape}
                    </span>
                    <span className="leading-tight">{answer}</span>
                  </div>
                ))}
              </div>
            )}

            {currentQuestion.type === 'true-false' && (
              <div className="grid grid-cols-2 gap-3 p-4 pt-0 flex-shrink-0">
                <div
                  className="flex items-center justify-center gap-3 rounded-2xl px-6 py-5 text-white font-bold text-xl select-none"
                  style={{ background: '#27AE60', boxShadow: '0 6px 24px rgba(39,174,96,0.5)', fontFamily: 'var(--ap-font-display)' }}
                >
                  <span className="text-3xl">✓</span> Vrai
                </div>
                <div
                  className="flex items-center justify-center gap-3 rounded-2xl px-6 py-5 text-white font-bold text-xl select-none"
                  style={{ background: '#E74C3C', boxShadow: '0 6px 24px rgba(231,76,60,0.5)', fontFamily: 'var(--ap-font-display)' }}
                >
                  <span className="text-3xl">✗</span> Faux
                </div>
              </div>
            )}

            {currentQuestion.type === 'short-answer' && (
              <div
                className="mx-4 mb-4 rounded-2xl border-2 border-dashed border-white/30 bg-white/10 p-5 text-center text-white text-lg font-bold backdrop-blur flex-shrink-0"
                style={{ fontFamily: 'var(--ap-font-display)' }}
              >
                ✏️ Les joueurs tapent leur réponse
              </div>
            )}
          </div>

          {/* ── Player sidebar (dedicated column, host only) ── */}
          {isHost && (
            <div className="w-52 border-l border-white/10 bg-black/40 backdrop-blur-md p-3 flex flex-col flex-shrink-0">
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <span className="text-xs font-bold text-white/60" style={{ fontFamily: 'var(--ap-font-display)' }}>
                  Joueurs
                </span>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: allAnswered ? 'rgba(21,192,138,0.3)' : 'rgba(255,255,255,0.1)',
                    color: allAnswered ? '#6ee7b7' : 'white',
                    border: allAnswered ? '1px solid rgba(21,192,138,0.4)' : '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {answeredCount}/{players.length}
                </span>
              </div>
              <div className="overflow-y-auto space-y-1 flex-1">
                {players.map((p) => (
                  <PlayerSidebarItem
                    key={p.id}
                    player={p}
                    answered={p.lastAnswerQuestionIndex === currentQuestionIndex}
                    offline={disconnectedIds.has(p.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </ThemedBackground>
    );
  }

  if (gameState === 'answer-distribution') {
    return (
      <ThemedBackground className="p-4 text-slate-100">
        <QuizSessionAnswerDistribution
          currentQuestion={currentQuestion}
          answerDistribution={answerDistribution}
          onNext={showLeaderboard}
          onSkipToNext={isHost ? nextQuestion : undefined}
          isHost={isHost || false}
        />
      </ThemedBackground>
    );
  }

  if (gameState === 'leaderboard') {
    return (
      <ThemedBackground className="p-4 text-slate-100">
        <RaceLeaderboard
          players={players}
          onComplete={nextQuestion}
          isHost={isHost}
          isLastQuestion={currentQuestionIndex >= quiz.questions.length - 1}
        />
      </ThemedBackground>
    );
  }

  if (gameState === 'final') {
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    const [p1, p2, p3] = sortedPlayers;

    const podiumStep = (
      label: string,
      score: number,
      avatar: string,
      medal: string,
      height: number,
      width: number,
      bg: string,
      textColor: string,
      avatarSize: 'sm' | 'md' | 'lg' | 'xl',
      glow?: string,
    ) => (
      <div className="flex flex-col items-center" style={{ width }}>
        <AvatarDisplay emoji={avatar} size={avatarSize} />
        <div
          style={{
            width: '100%',
            height,
            background: bg,
            borderRadius: '14px 14px 0 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 8px 10px',
            boxShadow: glow ?? 'none',
          }}
        >
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 800,
              color: textColor,
              fontFamily: 'var(--ap-font-display)',
              textAlign: 'center',
              lineHeight: 1.2,
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </span>
          <span style={{ fontSize: height >= 140 ? '2rem' : '1.5rem' }}>{medal}</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: textColor, opacity: 0.85 }}>
            {score.toLocaleString()} pts
          </span>
        </div>
      </div>
    );

    return (
      <ThemedBackground className="min-h-screen text-slate-100">
        {/* Confetti — config pre-computed at module level to avoid Math.random() per render */}
        <div className="fixed inset-0 pointer-events-none z-0">
          {CONFETTI_ITEMS.map((c, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 rounded-full animate-confetti"
              style={{
                left: `${c.left}%`,
                backgroundColor: c.color,
                animationDelay: `${c.delay}s`,
                animationDuration: `${c.duration}s`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 flex min-h-screen">
          {/* ── Main content ── */}
          <div className="flex-1 overflow-auto px-4 pt-8 pb-10 text-center">
            {/* Title */}
            <h1
              className="mb-8"
              style={{
                fontFamily: 'var(--ap-font-display)',
                fontSize: 'clamp(2.2rem, 5vw, 3.5rem)',
                fontWeight: 700,
                color: '#fff',
                textShadow: '0 4px 20px rgba(0,0,0,0.4)',
              }}
            >
              🎉 Quiz Terminé !
            </h1>

            {/* Podium — order: 2nd | 1st | 3rd */}
            <div className="flex items-end justify-center gap-0 mb-0">
              {p2
                ? podiumStep(p2.name, p2.score, p2.avatar, '🥈', 110, 140,
                    'linear-gradient(170deg,#E8E8E8 0%,#B8B8B8 100%)',
                    '#444', 'lg',
                    'inset 0 1px 0 rgba(255,255,255,0.5)')
                : <div style={{ width: 140 }} />}

              {p1
                ? podiumStep(p1.name, p1.score, p1.avatar, '🥇', 160, 160,
                    'linear-gradient(170deg,#FFE566 0%,#FFB800 100%)',
                    '#7a4000', 'xl',
                    'inset 0 1px 0 rgba(255,255,255,0.5), 0 -10px 36px rgba(255,184,0,0.55)')
                : <div style={{ width: 160 }} />}

              {p3
                ? podiumStep(p3.name, p3.score, p3.avatar, '🥉', 80, 130,
                    'linear-gradient(170deg,#E8A87C 0%,#CD7F32 100%)',
                    '#4a2000', 'lg',
                    'inset 0 1px 0 rgba(255,255,255,0.4)')
                : <div style={{ width: 130 }} />}
            </div>

            {/* Podium floor */}
            <div
              style={{
                height: 7,
                background: 'rgba(255,255,255,0.18)',
                borderRadius: '0 0 10px 10px',
                marginBottom: 28,
              }}
            />

            {/* Players 4+ */}
            {sortedPlayers.length > 3 && (
              <div className="space-y-2 mb-8 max-w-lg mx-auto">
                {sortedPlayers.slice(3).map((player, idx) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 rounded-xl px-4 py-2.5"
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.15)',
                    }}
                  >
                    <span
                      className="font-bold text-white/70 text-sm w-5 text-center"
                      style={{ fontFamily: 'var(--ap-font-display)' }}
                    >
                      {idx + 4}
                    </span>
                    <AvatarDisplay emoji={player.avatar} size="sm" />
                    <span
                      className="flex-1 text-left font-bold text-white truncate text-sm"
                      style={{ fontFamily: 'var(--ap-font-body)' }}
                    >
                      {player.name}
                    </span>
                    <span
                      className="font-bold text-white/80 text-sm"
                      style={{ fontFamily: 'var(--ap-font-display)' }}
                    >
                      {player.score.toLocaleString()} pts
                    </span>
                  </div>
                ))}
              </div>
            )}

            {isHost && (
              <div className="flex justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={exportResults}
                  className="border-white/30 bg-black/40 font-bold text-slate-100 shadow-xl backdrop-blur hover:bg-black/60"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Exporter
                </Button>
                <Button variant="hero" onClick={() => window.location.href = '/'} className="font-bold shadow-xl">
                  🎮 Nouveau Quiz
                </Button>
              </div>
            )}
          </div>

          {/* ── Classement complet (host sidebar) ── */}
          {isHost && (
            <div className="w-60 border-l border-white/10 bg-black/45 backdrop-blur-md flex flex-col p-4 flex-shrink-0">
              <div
                className="mb-3 flex-shrink-0 uppercase tracking-wider text-xs font-bold"
                style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--ap-font-display)' }}
              >
                Classement · {sortedPlayers.length} joueurs
              </div>
              <div className="overflow-y-auto space-y-1.5 flex-1">
                {sortedPlayers.map((player, idx) => {
                  const isOffline = disconnectedIds.has(player.id);
                  return (
                    <div
                      key={player.id}
                      className="flex items-center gap-2 rounded-xl px-2.5 py-2 transition-all"
                      style={{
                        background: isOffline ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.08)',
                        border: isOffline ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(255,255,255,0.08)',
                        opacity: isOffline ? 0.65 : 1,
                      }}
                    >
                      <span
                        className="font-bold w-5 text-center flex-shrink-0 text-xs"
                        style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--ap-font-display)' }}
                      >
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                      </span>
                      <AvatarDisplay emoji={player.avatar} size="sm" />
                      <span
                        className="flex-1 truncate text-white font-bold text-xs"
                        style={{ fontFamily: 'var(--ap-font-body)' }}
                      >
                        {player.name}
                      </span>
                      <span
                        className="font-bold text-xs flex-shrink-0"
                        style={{ color: 'rgba(255,255,255,0.75)', fontFamily: 'var(--ap-font-display)' }}
                      >
                        {player.score.toLocaleString()}
                      </span>
                      {isOffline && (
                        <span className="text-red-400 text-xs flex-shrink-0" title="Déconnecté">✗</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ThemedBackground>
    );
  }

  return null;
};
