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
import { Fireworks } from "./Fireworks";
import { TransitionTimer } from "./TransitionTimer";
import { AvatarDisplay } from "./BetterAvatars";
import { cn } from "@/lib/utils";
import { DEFAULT_THEME_ID, THEMES } from "@/lib/themes";
import { hexToRgba } from "@/lib/color";
import {
  ensureSessionState,
  ensureSessionInSupabase,
  fetchSessionStateFromSupabase,
  getSessionStorageKey,
  patchSessionState,
  readSessionState,
  resetSessionForNewRun,
  appendSessionHistory,
  readSessionHistory,
  type SharedPlayer,
  type SessionRun,
} from "@/lib/sessionState";
import { supabase, supabaseUrl, supabaseKey } from "@/lib/supabase";

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
  onExitRequest?: () => void;
  onExitHandlerReady?: (handler: () => void) => void;
}


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

export const QuizSession = ({ quiz, isHost = false, onExitRequest, onExitHandlerReady }: QuizSessionProps) => {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [sessionReady, setSessionReady] = useState(false);

  const [gameState, setGameState] = useState<'waiting' | 'transition' | 'question-intro' | 'question' | 'answer-distribution' | 'leaderboard' | 'final'>('waiting');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<SessionRun[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [answerDistribution, setAnswerDistribution] = useState<number[]>([]);
  const [sessionStats, setSessionStats] = useState({
    totalPlayers: 0,
    averageScore: 0,
    questionsAnswered: 0,
    duration: 0
  });
  const [disconnectedIds, setDisconnectedIds] = useState<Set<string>>(new Set());
  const disconnectedIdsRef = useRef<Set<string>>(new Set());
  const [autoAdvance, setAutoAdvance] = useState(false);

  // Live reactions (waiting + final screens)
  const [floatingReactions, setFloatingReactions] = useState<Array<{ id: string; emoji: string; x: number; playerName: string; avatar: string; text: string; isEmoji: boolean }>>([]);
  const [reactionComments, setReactionComments] = useState<Array<{ playerName: string; avatar: string; text: string; ts: number }>>([]);
  const seenReactionKeysRef = useRef<Set<string>>(new Set());
  const sessionStartedAtRef = useRef<number>(Date.now());

  const joinUrl = `${window.location.origin}/join/${quiz.gameCode}`;
  const currentQuestion = quiz.questions[currentQuestionIndex];

  const selectedTheme = useMemo(() => {
    const themeId = quiz.theme ?? DEFAULT_THEME_ID;
    return THEMES.find((themeOption) => themeOption.id === themeId) ?? THEMES[0];
  }, [quiz.theme]);

  const isMillionnaire = selectedTheme?.id === 'qui-veut-gagner';

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
      {!isMillionnaire && <div className="absolute inset-0" style={{ background: accentOverlay }} aria-hidden />}
      {!isMillionnaire && <div className="absolute inset-0" style={{ background: overlayColor, mixBlendMode: "multiply" }} aria-hidden />}
      {isMillionnaire && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 35%,rgba(200,160,0,0.18) 0%,transparent 70%)',
        }} />
      )}
      <div className={cn("relative z-10", className)} style={fontFamily ? { fontFamily } : undefined}>
        {children}
      </div>
    </div>
  );

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
  // Prevents showAnswerDistribution from running twice (timer + manual button race)
  const isShowingDistRef = useRef(false);
  // Prevents startQuiz from firing twice on double-click
  const hasStartedRef = useRef(false);
  // Prevents question-intro → question transition from firing more than once per question
  const hasIntroAdvancedRef = useRef(false);
  useEffect(() => {
    hasAutoAdvancedRef.current = false;
    isShowingDistRef.current = false;
    hasIntroAdvancedRef.current = false;
    // Clear offline flags — a previously-disconnected player may have reconnected
    // by the time the next question starts; don't carry stale state forward.
    disconnectedIdsRef.current = new Set();
    setDisconnectedIds(new Set());
  }, [currentQuestionIndex]);

  // Tracks the wall-clock end time of the current question (set when question starts)
  const questionEndTimeRef = useRef<number | null>(null);

  // Always-fresh ref to showAnswerDistribution — avoids stale-closure in interval/effects
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const showAnswerDistRef = useRef<() => any>(() => {});

  const syncFromStorage = useCallback(() => {
    const session = readSessionState(quiz.gameCode);

    // During 'question', the host owns player data via Supabase polling.
    // Player tabs on the same device write to the same localStorage key and can race,
    // producing a stale or incomplete players array. Skip setPlayers here to avoid
    // overwriting Supabase-fetched state with corrupted local data.
    if (gameStateRef.current !== 'question') {
      const mappedPlayers = session.players.map(normalizeSharedPlayer);
      setPlayers(mappedPlayers);
    }

    // Never allow a stale player-tab write to downgrade game state (e.g. question → waiting).
    // Only advance forward: waiting < transition < question < answer-distribution < leaderboard < final
    const STATE_ORDER = ['waiting', 'transition', 'question-intro', 'question', 'answer-distribution', 'leaderboard', 'final'];
    const currentOrder = STATE_ORDER.indexOf(gameStateRef.current);
    const newOrder = STATE_ORDER.indexOf(session.gameState);
    if (session.gameState && newOrder > currentOrder) {
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

  }, [normalizeSharedPlayer, quiz.gameCode, quiz.questions]);

  // Run once on mount: init session and register storage listener
  useEffect(() => {
    const init = async () => {
      ensureSessionState(quiz.gameCode);
      const existing = readSessionState(quiz.gameCode);

      if (isHost) {
        // Save results of any previous run before resetting.
        // Prefer Supabase over localStorage — cross-device scores live in Supabase.
        const remoteState = await fetchSessionStateFromSupabase(quiz.gameCode);
        const playersToSave = remoteState?.players.length
          ? remoteState.players
          : existing.players;
        if (playersToSave.length > 0) {
          appendSessionHistory(quiz.gameCode, playersToSave, quiz.questions.length);
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
          const THRESHOLD_MS = 25000;
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

    // Poll faster during 'question' to detect allAnswered quickly; 2s is enough for waiting
    const interval = setInterval(poll, gameState === 'question' ? 800 : 2000);
    return () => clearInterval(interval);
  }, [isHost, gameState, quiz.gameCode, normalizeSharedPlayer]);


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

  // question-intro → question: host auto-advances after QUESTION_READING_SECS then starts timer.
  // Non-host QuizSession views rely on the Supabase state change triggered by the host.
  useEffect(() => {
    if (!isHost || gameState !== 'question-intro') return;
    if (hasIntroAdvancedRef.current) return;
    const timer = setTimeout(() => {
      if (hasIntroAdvancedRef.current) return;
      hasIntroAdvancedRef.current = true;
      const timeLimit = quiz.questions[currentQuestionIndex].timeLimit;
      questionEndTimeRef.current = Date.now() + timeLimit * 1000;
      setGameState('question');
      setTimeLeft(timeLimit);
      patchSessionState(quiz.gameCode, {
        gameState: 'question',
        currentQuestionIndex,
        timeLeft: timeLimit,
      });
    }, QUESTION_READING_SECS * 1000);
    return () => clearTimeout(timer);
  }, [gameState, currentQuestionIndex, isHost, quiz.gameCode, quiz.questions]);

  // Auto-advance when every active (non-disconnected) player has answered
  useEffect(() => {
    if (!isHost || gameState !== 'question' || players.length === 0) return;
    if (hasAutoAdvancedRef.current) return;

    // Exclude players flagged as offline — they can't block the quiz
    const activePlayers = players.filter(p => !disconnectedIds.has(p.id));
    if (activePlayers.length === 0) return;

    const allAnswered = activePlayers.every(
      (p) => p.lastAnswerQuestionIndex === currentQuestionIndex
    );
    if (allAnswered) {
      hasAutoAdvancedRef.current = true;
      showAnswerDistRef.current();
    }
  }, [players, disconnectedIds, gameState, currentQuestionIndex, isHost]);

  // Write timeLeft to Supabase only every 5s (not every second) to reduce write load.
  // Players sync their local countdown independently; this is just a fallback resync.
  useEffect(() => {
    if (!isHost || gameState !== 'question') return;
    if (timeLeft % 5 !== 0 && timeLeft !== 0) return;

    patchSessionState(quiz.gameCode, { timeLeft });
  }, [gameState, isHost, quiz.gameCode, timeLeft]);


  // Clear floating reactions when screen changes
  useEffect(() => {
    setFloatingReactions([]);
    setReactionComments([]);
    seenReactionKeysRef.current = new Set();
  }, [gameState]);

  // Poll for player reactions (waiting + final screens, host-only)
  useEffect(() => {
    if (!isHost || (gameState !== 'final' && gameState !== 'waiting')) return;
    seenReactionKeysRef.current = new Set();

    const poll = async () => {
      const { data } = await supabase
        .from('session_state')
        .select('players')
        .eq('game_code', quiz.gameCode)
        .single();
      if (!data?.players || !Array.isArray(data.players)) return;

      (data.players as SharedPlayer[]).forEach((p) => {
        if (!p.lastReaction) return;
        // Ignore reactions from previous sessions
        if (new Date(p.lastReaction.sentAt).getTime() < sessionStartedAtRef.current) return;
        const key = `${p.id}:${p.lastReaction.sentAt}`;
        if (seenReactionKeysRef.current.has(key)) return;
        seenReactionKeysRef.current.add(key);

        const reactionText = p.lastReaction!.comment || p.lastReaction!.emoji;
        const isEmoji = !p.lastReaction!.comment;

        // Spawn floating bubble with avatar + name + content
        const floatId = `${Date.now()}-${Math.random()}`;
        const x = Math.random() * 70 + 5;
        setFloatingReactions((prev) => [...prev, {
          id: floatId,
          emoji: p.lastReaction!.emoji,
          x,
          playerName: p.name,
          avatar: p.avatar,
          text: reactionText,
          isEmoji,
        }]);
        setTimeout(() => setFloatingReactions((prev) => prev.filter((r) => r.id !== floatId)), 2800);

        // Only text comments go to the sidebar feed
        if (!isEmoji) {
          setReactionComments((prev) =>
            [{ playerName: p.name, avatar: p.avatar, text: reactionText, ts: Date.now() }, ...prev].slice(0, 30)
          );
        }
      });
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [isHost, gameState, quiz.gameCode]);

  // Update session stats
  useEffect(() => {
    setSessionStats({
      totalPlayers: players.length,
      averageScore: players.reduce((sum, p) => sum + p.score, 0) / players.length || 0,
      questionsAnswered: currentQuestionIndex,
      duration: Date.now() - quiz.createdAt.getTime()
    });
  }, [players, currentQuestionIndex, quiz.createdAt]);

  const QUESTION_READING_SECS = 3;

  const startQuiz = () => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    setGameState('question-intro');
    setTimeLeft(currentQuestion.timeLimit);
    if (isHost) {
      patchSessionState(quiz.gameCode, {
        gameState: 'question-intro',
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
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex >= quiz.questions.length) return;
    const nextTimeLimit = quiz.questions[nextIndex].timeLimit;
    setCurrentQuestionIndex(prev => prev + 1);
    setGameState('question-intro');
    setTimeLeft(nextTimeLimit);
    if (isHost) {
      patchSessionState(quiz.gameCode, {
        gameState: 'question-intro',
        currentQuestionIndex: nextIndex,
        timeLeft: nextTimeLimit,
      });
    }
  };

  const showAnswerDistribution = async () => {
    if (isShowingDistRef.current) return;
    isShowingDistRef.current = true;
    // Fetch latest player answers directly from Supabase (cross-device safe).
    // Race against a 3s timeout so a hanging fetch can't block the advance.
    let freshPlayers: SharedPlayer[] = readSessionState(quiz.gameCode).players;
    try {
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
      const fetch = supabase
        .from('session_state')
        .select('players')
        .eq('game_code', quiz.gameCode)
        .single();
      const result = await Promise.race([fetch, timeout]);
      if (result && 'data' in result && result.data?.players && Array.isArray(result.data.players)) {
        freshPlayers = result.data.players as SharedPlayer[];
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

  const handleExitQuiz = useCallback(() => {
    if (isHost && gameStateRef.current !== 'final') {
      patchSessionState(quiz.gameCode, { gameState: 'abandoned' });
    }
    navigate("/");
  }, [isHost, quiz.gameCode, navigate]);

  // Register exit handler with parent (dialog lives in parent to avoid flicker)
  useEffect(() => {
    onExitHandlerReady?.(handleExitQuiz);
  }, [handleExitQuiz, onExitHandlerReady]);

  // Abandon session when host closes/refreshes the tab mid-quiz
  useEffect(() => {
    if (!isHost) return;
    const handler = () => {
      if (gameStateRef.current === 'final') return;
      // patchSessionState: updates localStorage immediately (same-device tabs) + fires Supabase update
      patchSessionState(quiz.gameCode, { gameState: 'abandoned' });
      // keepalive fetch: survives page unload, ensures cross-device participants are notified
      fetch(`${supabaseUrl}/rest/v1/session_state?game_code=eq.${quiz.gameCode}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ game_state: 'abandoned', updated_at: new Date().toISOString() }),
        keepalive: true,
      });
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isHost, quiz.gameCode]);

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
      <div style={{ background: 'var(--ap-paper)', minHeight: '100vh', fontFamily: 'var(--ap-font-body)' }} className="p-4">
        <style>{`
          @keyframes floatUpLobby {
            0%   { opacity: 1; transform: translateY(0) scale(1); }
            80%  { opacity: 0.8; }
            100% { opacity: 0; transform: translateY(-200px) scale(1.02); }
          }
          .reaction-float-lobby { animation: floatUpLobby 2.8s ease-out forwards; pointer-events: none; position: fixed; z-index: 9999; }
        `}</style>
        {floatingReactions.map((r) => (
          <div key={r.id} className="reaction-float-lobby" style={{ left: `${r.x}%`, bottom: '15%' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(10px)',
              border: '1.5px solid rgba(255,255,255,0.2)',
              borderRadius: 999, padding: '6px 14px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }}>
              <div style={{ flexShrink: 0 }}><AvatarDisplay emoji={r.avatar} size="xs" /></div>
              <span style={{ color: '#fff', fontSize: '11px', fontWeight: 700, flexShrink: 0, fontFamily: 'var(--ap-font-body)' }}>{r.playerName}</span>
              <span style={{ fontSize: r.isEmoji ? '1.4rem' : '12px', color: 'rgba(255,255,255,0.9)', fontFamily: 'var(--ap-font-body)', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: r.isEmoji ? 'nowrap' : 'normal' }}>{r.text}</span>
            </div>
          </div>
        ))}
        <div className="mx-auto max-w-6xl space-y-6">

          {/* Header image */}
          {headerImage && (
            <div style={{ borderRadius: 'var(--ap-r-xl)', overflow: 'hidden', border: '2px solid var(--ap-line)', boxShadow: 'var(--ap-shadow-card)' }}>
              <div className="relative h-48 w-full md:h-56">
                <img src={headerImage} alt={`Illustration pour ${quiz.title}`} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" aria-hidden />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <h1 style={{ fontFamily: 'var(--ap-font-display)', color: '#fff', fontSize: 'clamp(1.5rem,3vw,2.2rem)', fontWeight: 700, margin: 0 }}>{quiz.title}</h1>
                  {quiz.description && <p className="mt-1 text-sm text-white/80 font-semibold">{quiz.description}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Host Controls */}
          {isHost && (
            <div className="ap-card" style={{ boxShadow: 'var(--ap-shadow-card)' }}>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  {!headerImage && (
                    <h2 style={{ fontFamily: 'var(--ap-font-display)', color: 'var(--ap-ink)', fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>{quiz.title}</h2>
                  )}
                  {quiz.description && !headerImage && (
                    <p style={{ color: 'var(--ap-muted)', fontWeight: 700, marginTop: 4 }}>{quiz.description}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => onExitRequest?.()} className="ap-btn ap-btn--ghost ap-btn--sm">
                    <LogOut className="w-4 h-4" />
                    Quitter
                  </button>
                  <button onClick={() => setShowSettings(!showSettings)} className="ap-btn ap-btn--ghost ap-btn--sm">
                    <Settings className="w-4 h-4" />
                    Paramètres
                  </button>
                  <button
                    onClick={startQuiz}
                    disabled={players.length === 0}
                    className="ap-btn ap-btn--lg ap-btn--pill"
                    style={{
                      background: players.length === 0 ? 'var(--ap-muted)' : 'var(--ap-brand)',
                      boxShadow: players.length === 0 ? 'none' : '0 5px 0 var(--ap-brand-deep)',
                      cursor: players.length === 0 ? 'not-allowed' : 'pointer',
                      opacity: players.length === 0 ? 0.6 : 1,
                    }}
                  >
                    🚀 Lancer le quiz ({players.length} joueur{players.length !== 1 ? 's' : ''})
                  </button>
                </div>
              </div>
            </div>
          )}

          <Dialog open={showSettings} onOpenChange={setShowSettings}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Paramètres du quiz</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                {[
                  { label: 'Titre', value: quiz.title },
                  { label: 'Questions', value: quiz.questions.length },
                  { label: 'Code', value: quiz.gameCode, mono: true },
                  { label: 'Transition', value: `${quiz.transitionTime ?? 5} s` },
                  { label: 'Thème', value: selectedTheme?.name ?? 'Défaut' },
                  ...(quiz.font ? [{ label: 'Police', value: quiz.font }] : []),
                ].map(({ label, value, mono }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={mono ? 'font-mono font-medium' : 'font-medium'}>{value}</span>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* QR + infos */}
            <div className="space-y-4 lg:col-span-1">
              {sessionReady ? (
                <QRCodeGenerator gameCode={quiz.gameCode} joinUrl={joinUrl} />
              ) : (
                <div className="ap-card flex flex-col items-center justify-center gap-3 py-10">
                  <Settings className="w-8 h-8 animate-spin" style={{ color: 'var(--ap-muted)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--ap-muted)' }}>Synchronisation…</span>
                </div>
              )}
              <div className="ap-card" style={{ padding: '14px 18px' }}>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--ap-ink)', fontWeight: 700 }}>
                  <Users className="h-4 w-4" style={{ color: 'var(--ap-brand)' }} />
                  <span>{players.length} joueur{players.length !== 1 ? 's' : ''} en attente</span>
                </div>
                <div className="flex items-center gap-2 text-sm mt-2" style={{ color: 'var(--ap-muted)', fontWeight: 700 }}>
                  <Clock className="h-4 w-4" />
                  <span>Transition : {quiz.transitionTime ?? 5} s</span>
                </div>
              </div>
            </div>

            {/* Players list */}
            <div className="lg:col-span-2">
              <div className="ap-card" style={{ boxShadow: 'var(--ap-shadow-card)' }}>
                <div className="flex items-center justify-between mb-5">
                  <h3 style={{ fontFamily: 'var(--ap-font-display)', color: 'var(--ap-ink)', fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                    <Users className="w-5 h-5" style={{ color: 'var(--ap-brand)' }} />
                    Participants ({players.length})
                  </h3>
                  {isHost && (
                    <button onClick={exportResults} className="ap-btn ap-btn--ghost ap-btn--sm">
                      <Download className="w-4 h-4" />
                      Exporter
                    </button>
                  )}
                </div>
                <div className="grid max-h-96 gap-2 overflow-y-auto md:grid-cols-2 lg:grid-cols-3">
                  {players.map((player) => (
                    <div
                      key={player.id}
                      className="animate-fade-in flex items-center gap-3 p-3 text-sm"
                      style={{
                        background: 'var(--ap-paper)',
                        border: '2px solid var(--ap-line)',
                        borderRadius: 'var(--ap-r-md)',
                        color: 'var(--ap-ink)',
                        fontWeight: 700,
                      }}
                    >
                      <AvatarDisplay emoji={player.avatar} size="sm" />
                      <span className="flex-1 truncate">{player.name}</span>
                    </div>
                  ))}
                  {players.length === 0 && (
                    <div className="col-span-full py-8 text-center" style={{ color: 'var(--ap-muted)', fontWeight: 700 }}>
                      <p>En attente des participants…</p>
                      <p className="mt-2 text-sm">Partagez le QR code ou le code de jeu</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Session History */}
          {isHost && sessionHistory.length > 0 && (
            <div className="ap-card">
              <h3 style={{ fontFamily: 'var(--ap-font-display)', color: 'var(--ap-ink)', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Trophy className="w-5 h-5" style={{ color: 'var(--ap-flash)' }} />
                Sessions précédentes
              </h3>
              <div className="space-y-3">
                {sessionHistory.map((run) => {
                  const sorted = [...run.players].sort((a, b) => b.score - a.score);
                  return (
                    <details key={run.id} style={{ border: '2px solid var(--ap-line)', borderRadius: 'var(--ap-r-md)', padding: '12px 16px' }}>
                      <summary className="flex cursor-pointer items-center justify-between list-none" style={{ color: 'var(--ap-ink)', fontWeight: 700 }}>
                        <span>{new Date(run.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="text-sm" style={{ color: 'var(--ap-muted)' }}>{run.players.length} joueur{run.players.length !== 1 ? 's' : ''} · {run.questionCount} questions</span>
                      </summary>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {sorted.map((p, idx) => (
                          <div key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm" style={{ background: 'var(--ap-paper)', border: '2px solid var(--ap-line)', borderRadius: 'var(--ap-r-sm)', color: 'var(--ap-ink)', fontWeight: 700 }}>
                            <span className="w-5 text-center">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}</span>
                            <AvatarDisplay emoji={p.avatar} size="sm" />
                            <span className="flex-1 truncate">{p.name}</span>
                            <span style={{ color: 'var(--ap-flash-deep)', fontWeight: 800 }}>{p.score} pts</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quiz preview stats */}
          {isHost && (
            <div className="ap-card">
              <h3 style={{ fontFamily: 'var(--ap-font-display)', color: 'var(--ap-ink)', fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>Aperçu du quiz</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[
                  { value: quiz.questions.length, label: 'Questions', color: 'var(--ap-brand)' },
                  { value: `${Math.round(quiz.questions.reduce((s, q) => s + q.timeLimit, 0) / 60)}m`, label: 'Durée estimée', color: 'var(--ap-poll)' },
                  { value: quiz.questions.reduce((s, q) => s + q.points, 0), label: 'Points totaux', color: 'var(--ap-flash-deep)' },
                  { value: players.length, label: 'Participants', color: 'var(--ap-pres)' },
                ].map(({ value, label, color }) => (
                  <div key={label} className="text-center p-3" style={{ background: 'var(--ap-paper)', border: '2px solid var(--ap-line)', borderRadius: 'var(--ap-r-md)' }}>
                    <div style={{ fontFamily: 'var(--ap-font-display)', fontSize: '1.8rem', fontWeight: 700, color }}>{value}</div>
                    <div className="text-sm" style={{ color: 'var(--ap-muted)', fontWeight: 700 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
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

  if (gameState === 'question-intro') {
    const qNum = currentQuestionIndex + 1;
    const totalQ = quiz.questions.length;
    return (
      <ThemedBackground className="min-h-screen flex flex-col items-center justify-center text-white px-6 py-10 gap-8">
        {/* Question number badge */}
        <div style={{
          fontFamily: 'var(--ap-font-display)',
          fontSize: '0.85rem',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.55)',
        }}>
          Question {qNum} / {totalQ}
        </div>

        {/* Question image */}
        {questionImage && (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-xl max-h-52 w-full max-w-3xl">
            <img src={questionImage} alt={currentQuestion.question} className="h-full w-full object-cover" />
          </div>
        )}

        {/* Question text */}
        {isMillionnaire ? (
          <div style={{ background: 'rgba(6,10,35,0.9)', border: '1.5px solid rgba(200,160,0,0.6)', borderRadius: 40, padding: '18px 36px', maxWidth: 720, width: '100%', boxShadow: '0 0 28px rgba(200,160,0,0.18)' }}>
            <h1 className="text-center text-white leading-snug m-0" style={{ fontFamily: 'var(--ap-font-display)', fontSize: 'clamp(1.3rem,3.2vw,2.4rem)', fontWeight: 700 }}>
              {currentQuestion.question}
            </h1>
          </div>
        ) : (
          <h1
            className="text-center text-white drop-shadow-2xl max-w-4xl leading-snug"
            style={{ fontFamily: 'var(--ap-font-display)', fontSize: 'clamp(1.4rem, 3.5vw, 2.6rem)', fontWeight: 700, textShadow: '0 2px 16px rgba(0,0,0,0.4)' }}
          >
            {currentQuestion.question}
          </h1>
        )}

        {/* Pulsing "answers coming" indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 999,
          padding: '8px 20px',
          fontFamily: 'var(--ap-font-body)',
          fontSize: '0.85rem',
          fontWeight: 700,
          color: 'rgba(255,255,255,0.7)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}>
          <span>⏳</span>
          <span>Lisez la question…</span>
        </div>
        <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }`}</style>
      </ThemedBackground>
    );
  }

  if (gameState === 'question') {
    const activePlayers = players.filter(p => !disconnectedIds.has(p.id));
    const answeredCount = activePlayers.filter(
      (p) => p.lastAnswerQuestionIndex === currentQuestionIndex
    ).length;
    const allAnswered = activePlayers.length > 0 && answeredCount === activePlayers.length;

    const ANSWER_STYLES = isMillionnaire ? [
      { bg: 'rgba(8,12,40,0.88)', shadow: 'rgba(200,160,0,0.2)', shape: 'A' },
      { bg: 'rgba(8,12,40,0.88)', shadow: 'rgba(200,160,0,0.2)', shape: 'B' },
      { bg: 'rgba(8,12,40,0.88)', shadow: 'rgba(200,160,0,0.2)', shape: 'C' },
      { bg: 'rgba(8,12,40,0.88)', shadow: 'rgba(200,160,0,0.2)', shape: 'D' },
    ] : [
      { bg: '#E74C3C', shadow: 'rgba(231,76,60,0.45)', shape: '▲' },
      { bg: '#2980B9', shadow: 'rgba(41,128,185,0.45)', shape: '◆' },
      { bg: '#F39C12', shadow: 'rgba(243,156,18,0.45)', shape: '●' },
      { bg: '#27AE60', shadow: 'rgba(39,174,96,0.45)', shape: '■' },
    ];

    return (
      <ThemedBackground className="min-h-screen flex flex-col text-white">
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
                <span className="text-white/50">/{activePlayers.length}</span>
              </span>
              {allAnswered && <span className="text-green-400 ml-0.5">✓</span>}
            </div>
            {isHost && (
              <>
                <BackgroundMusic isPlaying />
                <button
                  onClick={() => setAutoAdvance(v => !v)}
                  title={autoAdvance ? 'Auto-avance activé' : 'Auto-avance désactivé'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', borderRadius: 999,
                    border: `1.5px solid ${autoAdvance ? 'rgba(39,174,96,0.6)' : 'rgba(255,255,255,0.2)'}`,
                    background: autoAdvance ? 'rgba(39,174,96,0.2)' : 'rgba(255,255,255,0.08)',
                    color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'var(--ap-font-body)',
                  }}
                >
                  {autoAdvance ? '▶▶' : '▶'} Auto
                </button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onExitRequest?.()}
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
              {isMillionnaire ? (
                <div style={{ background: 'rgba(6,10,35,0.9)', border: '1.5px solid rgba(200,160,0,0.6)', borderRadius: 40, padding: '18px 36px', maxWidth: 720, width: '100%', boxShadow: '0 0 28px rgba(200,160,0,0.18), inset 0 1px 0 rgba(200,160,0,0.12)' }}>
                  <h1 className="text-center text-white leading-snug m-0" style={{ fontFamily: 'var(--ap-font-display)', fontSize: 'clamp(1.3rem,3.2vw,2.4rem)', fontWeight: 700 }}>
                    {currentQuestion.question}
                  </h1>
                </div>
              ) : (
                <h1
                  className="text-center text-white drop-shadow-2xl max-w-4xl leading-snug"
                  style={{ fontFamily: 'var(--ap-font-display)', fontSize: 'clamp(1.4rem, 3.5vw, 2.6rem)', fontWeight: 700, textShadow: '0 2px 16px rgba(0,0,0,0.4)' }}
                >
                  {currentQuestion.question}
                </h1>
              )}

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

            {/* ── Answer grid ── */}
            {['multiple-choice', 'single-choice'].includes(currentQuestion.type) && currentQuestion.answers && (
              <div className="grid grid-cols-2 gap-3 p-4 pt-0 flex-shrink-0">
                {(currentQuestion.answers as string[]).map((answer, index) => (
                  isMillionnaire ? (
                    <div
                      key={index}
                      className="flex items-center gap-3 px-3 py-3 text-white font-bold text-base select-none"
                      style={{ background: ANSWER_STYLES[index % 4].bg, border: '1.5px solid rgba(200,160,0,0.6)', borderRadius: 40, boxShadow: `0 0 20px ${ANSWER_STYLES[index % 4].shadow}, inset 0 1px 0 rgba(200,160,0,0.1)`, minHeight: '64px', fontFamily: 'var(--ap-font-body)' }}
                    >
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(200,160,0,0.15)', border: '1.5px solid rgba(200,160,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#FFD700', fontWeight: 900, fontSize: '1rem', fontFamily: 'var(--ap-font-display)' }}>
                        {ANSWER_STYLES[index % 4].shape}
                      </div>
                      <span className="leading-tight flex-1 text-center">{answer}</span>
                    </div>
                  ) : (
                    <div
                      key={index}
                      className="flex items-center gap-4 rounded-2xl px-6 py-4 text-white font-bold text-lg select-none"
                      style={{ background: ANSWER_STYLES[index % 4].bg, boxShadow: `0 6px 24px ${ANSWER_STYLES[index % 4].shadow}`, minHeight: '72px', fontFamily: 'var(--ap-font-body)' }}
                    >
                      <span className="text-2xl opacity-90 flex-shrink-0">{ANSWER_STYLES[index % 4].shape}</span>
                      <span className="leading-tight">{answer}</span>
                    </div>
                  )
                ))}
              </div>
            )}

            {currentQuestion.type === 'true-false' && (
              <div className="grid grid-cols-2 gap-3 p-4 pt-0 flex-shrink-0">
                {isMillionnaire ? (
                  <>
                    <div className="flex items-center gap-3 px-3 py-3 text-white font-bold text-xl select-none" style={{ background: 'rgba(8,12,40,0.88)', border: '1.5px solid rgba(200,160,0,0.6)', borderRadius: 40, boxShadow: '0 0 20px rgba(200,160,0,0.2)', minHeight: '64px', fontFamily: 'var(--ap-font-display)', justifyContent: 'center' }}>
                      <span style={{ color: '#FFD700', fontSize: '1.5rem' }}>○</span> Vrai
                    </div>
                    <div className="flex items-center gap-3 px-3 py-3 text-white font-bold text-xl select-none" style={{ background: 'rgba(8,12,40,0.88)', border: '1.5px solid rgba(200,160,0,0.6)', borderRadius: 40, boxShadow: '0 0 20px rgba(200,160,0,0.2)', minHeight: '64px', fontFamily: 'var(--ap-font-display)', justifyContent: 'center' }}>
                      <span style={{ color: '#FFD700', fontSize: '1.5rem' }}>✕</span> Faux
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-3 rounded-2xl px-6 py-5 text-white font-bold text-xl select-none" style={{ background: '#27AE60', boxShadow: '0 6px 24px rgba(39,174,96,0.5)', fontFamily: 'var(--ap-font-display)' }}>
                      <span className="text-3xl">✓</span> Vrai
                    </div>
                    <div className="flex items-center justify-center gap-3 rounded-2xl px-6 py-5 text-white font-bold text-xl select-none" style={{ background: '#E74C3C', boxShadow: '0 6px 24px rgba(231,76,60,0.5)', fontFamily: 'var(--ap-font-display)' }}>
                      <span className="text-3xl">✗</span> Faux
                    </div>
                  </>
                )}
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
          onNext={currentQuestionIndex >= quiz.questions.length - 1 ? nextQuestion : showLeaderboard}
          onSkipToNext={isHost && currentQuestionIndex + 1 < quiz.questions.length ? nextQuestion : undefined}
          isHost={isHost || false}
          isLastQuestion={currentQuestionIndex >= quiz.questions.length - 1}
          autoAdvance={autoAdvance}
        />
      </ThemedBackground>
    );
  }

  if (gameState === 'leaderboard') {
    return (
      <RaceLeaderboard
        players={players}
        onComplete={nextQuestion}
        isHost={isHost}
        isLastQuestion={currentQuestionIndex >= quiz.questions.length - 1}
        autoAdvance={autoAdvance}
      />
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
          <span style={{ fontSize: height >= 140 ? '3rem' : '2.2rem' }}>{medal}</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: textColor, opacity: 0.85 }}>
            {score.toLocaleString()} pts
          </span>
        </div>
      </div>
    );

    return (
      <div style={{ background: 'var(--ap-paper)', minHeight: '100vh', fontFamily: 'var(--ap-font-body)' }} className="relative">
        <style>{`
          @keyframes floatUp {
            0%   { opacity: 1; transform: translateY(0) scale(1); }
            80%  { opacity: 0.8; }
            100% { opacity: 0; transform: translateY(-200px) scale(1.02); }
          }
          .reaction-float { animation: floatUp 2.8s ease-out forwards; pointer-events: none; position: fixed; z-index: 9999; }
        `}</style>
        <Fireworks />

        {/* Floating reaction bubbles (with podium colors for top 3) */}
        {(() => {
          const fpMap: Record<string, { bg: string; border: string; nameColor: string; textColor: string }> = {};
          if (p1) fpMap[p1.name] = { bg: 'linear-gradient(135deg,#FFE566,#FFCC00)', border: '#e5aa00', nameColor: '#7a4000', textColor: '#5a2e00' };
          if (p2) fpMap[p2.name] = { bg: 'linear-gradient(135deg,#E8E8E8,#C0C0C0)', border: '#aaa', nameColor: '#333', textColor: '#222' };
          if (p3) fpMap[p3.name] = { bg: 'linear-gradient(135deg,#E8A87C,#CD7F32)', border: '#a06030', nameColor: '#4a2000', textColor: '#3a1800' };
          return floatingReactions.map((r) => {
            const ps = fpMap[r.playerName];
            return (
              <div key={r.id} className="reaction-float" style={{ left: `${r.x}%`, bottom: '20%' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: ps ? ps.bg : 'rgba(0,0,0,0.78)',
                  backdropFilter: ps ? undefined : 'blur(10px)',
                  border: `1.5px solid ${ps ? ps.border : 'rgba(255,255,255,0.2)'}`,
                  borderRadius: 999, padding: '6px 14px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                }}>
                  <div style={{ flexShrink: 0 }}><AvatarDisplay emoji={r.avatar} size="xs" /></div>
                  <span style={{ color: ps ? ps.nameColor : '#fff', fontSize: '11px', fontWeight: 700, flexShrink: 0, fontFamily: 'var(--ap-font-body)' }}>{r.playerName}</span>
                  <span style={{ fontSize: r.isEmoji ? '1.4rem' : '12px', color: ps ? ps.textColor : 'rgba(255,255,255,0.9)', fontFamily: 'var(--ap-font-body)', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: r.isEmoji ? 'nowrap' : 'normal' }}>{r.text}</span>
                </div>
              </div>
            );
          });
        })()}

        <div className="relative z-10 flex min-h-screen">
          {/* ── Main content ── */}
          <div className="flex-1 flex flex-col overflow-auto px-4 pt-8 text-center" style={{ position: 'relative' }}>
            {/* Stage spotlights inside main content — coordinates are % of this area so sidebar is automatically excluded */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: -1, overflow: 'hidden' }}>
              <svg width="100%" height="100%" viewBox="0 0 1000 820" preserveAspectRatio="xMidYMin slice" style={{ display: 'block' }}>
                <defs>
                  <linearGradient id="beam-l" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(190,210,255,0.6)"/>
                    <stop offset="55%" stopColor="rgba(190,210,255,0.14)"/>
                    <stop offset="100%" stopColor="rgba(190,210,255,0)"/>
                  </linearGradient>
                  <linearGradient id="beam-c" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(255,215,0,0.72)"/>
                    <stop offset="50%" stopColor="rgba(255,215,0,0.2)"/>
                    <stop offset="100%" stopColor="rgba(255,215,0,0)"/>
                  </linearGradient>
                  <linearGradient id="beam-r" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(190,210,255,0.6)"/>
                    <stop offset="55%" stopColor="rgba(190,210,255,0.14)"/>
                    <stop offset="100%" stopColor="rgba(190,210,255,0)"/>
                  </linearGradient>
                  <filter id="bblur" x="-30%" y="0%" width="160%" height="110%">
                    <feGaussianBlur stdDeviation="14"/>
                  </filter>
                </defs>
                {/* Left beam — fixture at x=200, aimed at p2 (x≈350 in content space) */}
                <polygon points="186,0 214,0 490,820 90,820" fill="url(#beam-l)" filter="url(#bblur)"/>
                <polygon points="191,0 209,0 445,820 135,820" fill="url(#beam-l)" opacity="0.55"/>
                <ellipse cx="200" cy="5" rx="32" ry="9" fill="#c8d4f0" stroke="#8898c8" strokeWidth="1.5"/>
                <ellipse cx="200" cy="2" rx="16" ry="5" fill="rgba(210,225,255,0.95)"/>
                <circle cx="200" cy="0" r="8" fill="rgba(230,240,255,1)" opacity="0.85"/>
                {/* Center beam — fixture at x=500, aimed at p1 center */}
                <polygon points="476,0 524,0 720,820 280,820" fill="url(#beam-c)" filter="url(#bblur)"/>
                <polygon points="483,0 517,0 680,820 320,820" fill="url(#beam-c)" opacity="0.55"/>
                <ellipse cx="500" cy="5" rx="36" ry="11" fill="#e8c000" stroke="#a08800" strokeWidth="2"/>
                <ellipse cx="500" cy="2" rx="18" ry="6" fill="rgba(255,240,80,0.98)"/>
                <circle cx="500" cy="0" r="10" fill="rgba(255,250,170,1)" opacity="0.9"/>
                {/* Right beam — fixture at x=800, aimed at p3 (x≈645 in content space) */}
                <polygon points="786,0 814,0 910,820 510,820" fill="url(#beam-r)" filter="url(#bblur)"/>
                <polygon points="791,0 809,0 865,820 555,820" fill="url(#beam-r)" opacity="0.55"/>
                <ellipse cx="800" cy="5" rx="32" ry="9" fill="#c8d4f0" stroke="#8898c8" strokeWidth="1.5"/>
                <ellipse cx="800" cy="2" rx="16" ry="5" fill="rgba(210,225,255,0.95)"/>
                <circle cx="800" cy="0" r="8" fill="rgba(230,240,255,1)" opacity="0.85"/>
              </svg>
            </div>

            {/* Banner title — simple arrow ribbon */}
            <div className="mb-4 flex-shrink-0 flex justify-center px-2">
              <svg viewBox="0 0 800 76" style={{ width: '100%', maxWidth: 800, display: 'block', overflow: 'visible', filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.55))' }}>
                <defs>
                  <linearGradient id="rib2-red" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d41010"/>
                    <stop offset="42%" stopColor="#9e0808"/>
                    <stop offset="58%" stopColor="#9e0808"/>
                    <stop offset="100%" stopColor="#d41010"/>
                  </linearGradient>
                  <linearGradient id="rib2-shine" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.18)"/>
                    <stop offset="55%" stopColor="rgba(255,255,255,0)"/>
                  </linearGradient>
                  <filter id="rib2-ts">
                    <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="#5a1800" floodOpacity="0.85"/>
                  </filter>
                </defs>
                {/* Main body — arrow-point both ends */}
                <polygon points="0,38 56,0 744,0 800,38 744,76 56,76" fill="url(#rib2-red)"/>
                {/* Top-half shine */}
                <polygon points="0,38 56,0 744,0 800,38 744,36 56,36" fill="url(#rib2-shine)" opacity="0.55"/>
                {/* Outer gold border */}
                <polygon points="0,38 56,0 744,0 800,38 744,76 56,76" fill="none" stroke="#C8A000" strokeWidth="2.5"/>
                {/* Inner gold border */}
                <polygon points="22,38 66,10 734,10 778,38 734,66 66,66" fill="none" stroke="#E0B800" strokeWidth="1.5" opacity="0.85"/>
                {/* Title */}
                <text x="401" y="49" textAnchor="middle" fontSize="36" fontWeight="700" fill="#6a1800" fontFamily="Fredoka, system-ui, sans-serif">Quiz terminé !</text>
                <text x="400" y="48" textAnchor="middle" fontSize="36" fontWeight="700" fill="#FFD700" fontFamily="Fredoka, system-ui, sans-serif" filter="url(#rib2-ts)">Quiz terminé !</text>
              </svg>
            </div>

            {/* Bottom zone: 4+ list beside podium */}
            <div className="flex-1 flex items-end gap-3 mb-0 min-h-0">

              {/* Players 4+ — scrollable column beside podium */}
              {sortedPlayers.length > 3 && (
                <div
                  className="flex flex-col gap-1.5 overflow-y-auto flex-shrink-0"
                  style={{ width: 180, maxHeight: 280, paddingBottom: 7 }}
                >
                  {sortedPlayers.slice(3).map((player, idx) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0"
                      style={{
                        background: 'var(--ap-card)',
                        border: '1.5px solid var(--ap-line)',
                        borderRadius: 'var(--ap-r-sm)',
                        boxShadow: 'var(--ap-shadow-soft)',
                      }}
                    >
                      <span
                        className="text-xs w-4 text-center flex-shrink-0"
                        style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 700, color: 'var(--ap-muted)' }}
                      >
                        {idx + 4}
                      </span>
                      <AvatarDisplay emoji={player.avatar} size="xs" />
                      <span
                        className="flex-1 text-left truncate text-xs"
                        style={{ fontFamily: 'var(--ap-font-body)', fontWeight: 700, color: 'var(--ap-ink)' }}
                      >
                        {player.name}
                      </span>
                      <span
                        className="text-xs flex-shrink-0"
                        style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 700, color: 'var(--ap-muted)' }}
                      >
                        {player.score.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Podium — order: 2nd | 1st | 3rd */}
              <div className="flex-1 flex flex-col items-center min-w-0">
                <div className="flex items-end justify-center gap-0 w-full">
              {p2
                ? podiumStep(p2.name, p2.score, p2.avatar, '🥈', 110, 140,
                    'linear-gradient(170deg,#E8E8E8 0%,#B8B8B8 100%)',
                    '#444', 'lg',
                    'inset 0 1px 0 rgba(255,255,255,0.5)')
                : (
                  <div className="flex flex-col items-center" style={{ width: 140 }}>
                    <div style={{ width: 50, height: 50 }} />
                    <div style={{
                      width: '100%', height: 110,
                      background: 'linear-gradient(170deg,#E8E8E8 0%,#B8B8B8 100%)',
                      borderRadius: '14px 14px 0 0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: 0.4,
                    }}>
                      <span style={{ fontSize: '2.2rem' }}>🥈</span>
                    </div>
                  </div>
                )}

              {p1
                ? podiumStep(p1.name, p1.score, p1.avatar, '🏆', 160, 160,
                    'linear-gradient(170deg,#FFE566 0%,#FFB800 100%)',
                    '#7a4000', 'xl',
                    'inset 0 1px 0 rgba(255,255,255,0.5), 0 -10px 36px rgba(255,184,0,0.55)')
                : (
                  <div className="flex flex-col items-center" style={{ width: 160 }}>
                    <div style={{ width: 60, height: 60 }} />
                    <div style={{
                      width: '100%', height: 160,
                      background: 'linear-gradient(170deg,#FFE566 0%,#FFB800 100%)',
                      borderRadius: '14px 14px 0 0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: 0.4,
                    }}>
                      <span style={{ fontSize: '3rem' }}>🏆</span>
                    </div>
                  </div>
                )}

              {p3
                ? podiumStep(p3.name, p3.score, p3.avatar, '🥉', 80, 130,
                    'linear-gradient(170deg,#E8A87C 0%,#CD7F32 100%)',
                    '#4a2000', 'lg',
                    'inset 0 1px 0 rgba(255,255,255,0.4)')
                : (
                  <div className="flex flex-col items-center" style={{ width: 130 }}>
                    <div style={{ width: 45, height: 45 }} />
                    <div style={{
                      width: '100%', height: 80,
                      background: 'linear-gradient(170deg,#E8A87C 0%,#CD7F32 100%)',
                      borderRadius: '14px 14px 0 0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: 0.4,
                    }}>
                      <span style={{ fontSize: '2.2rem' }}>🥉</span>
                    </div>
                  </div>
                )}
                </div>{/* end podium row */}

                {/* Podium floor */}
                <div
                  style={{ height: 7, background: 'var(--ap-line)', borderRadius: '0 0 10px 10px', width: '100%' }}
                />
              </div>{/* end podium column */}

            </div>{/* end bottom zone */}

            {/* Buttons */}
            {isHost && (
              <div className="flex justify-center gap-4 flex-wrap py-6 flex-shrink-0">
                <button onClick={exportResults} className="ap-btn ap-btn--ghost">
                  <Download className="w-5 h-5" />
                  Exporter
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="ap-btn ap-btn--lg ap-btn--pill"
                  style={{ background: 'var(--ap-brand)', boxShadow: '0 5px 0 var(--ap-brand-deep)' }}
                >
                  🎮 Nouveau Quiz
                </button>
              </div>
            )}
          </div>

          {/* ── Classement complet (host sidebar) ── */}
          {isHost && (
            <div
              className="w-60 flex flex-col p-4 flex-shrink-0"
              style={{
                borderLeft: '2px solid var(--ap-line)',
                background: 'var(--ap-card)',
              }}
            >
              <div
                className="mb-3 flex-shrink-0 uppercase tracking-wider text-xs font-bold"
                style={{ color: 'var(--ap-muted)', fontFamily: 'var(--ap-font-display)' }}
              >
                Classement · {sortedPlayers.length} joueur{sortedPlayers.length !== 1 ? 's' : ''}
              </div>
              <div className="overflow-y-auto space-y-1.5" style={{ maxHeight: '45%' }}>
                {sortedPlayers.map((player, idx) => {
                  const isOffline = disconnectedIds.has(player.id);
                  return (
                    <div
                      key={player.id}
                      className="flex items-center gap-2 px-2.5 py-2 transition-all"
                      style={{
                        background: isOffline ? 'rgba(239,68,68,0.08)' : 'var(--ap-paper)',
                        border: isOffline ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--ap-line)',
                        borderRadius: 'var(--ap-r-sm)',
                        opacity: isOffline ? 0.65 : 1,
                      }}
                    >
                      <span
                        className="font-bold w-5 text-center flex-shrink-0 text-xs"
                        style={{ color: 'var(--ap-muted)', fontFamily: 'var(--ap-font-display)' }}
                      >
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                      </span>
                      <AvatarDisplay emoji={player.avatar} size="sm" />
                      <span
                        className="flex-1 truncate font-bold text-xs"
                        style={{ fontFamily: 'var(--ap-font-body)', color: 'var(--ap-ink)' }}
                      >
                        {player.name}
                      </span>
                      <span
                        className="font-bold text-xs flex-shrink-0"
                        style={{ color: 'var(--ap-brand)', fontFamily: 'var(--ap-font-display)' }}
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

              {/* Live reactions feed (text comments only) */}
              {reactionComments.length > 0 && (() => {
                const podiumMap: Record<string, { bg: string; border: string; nameColor: string; textColor: string }> = {};
                if (p1) podiumMap[p1.name] = { bg: 'linear-gradient(135deg,#FFE566,#FFCC00)', border: '#e5aa00', nameColor: '#7a4000', textColor: '#5a2e00' };
                if (p2) podiumMap[p2.name] = { bg: 'linear-gradient(135deg,#E8E8E8,#C0C0C0)', border: '#aaa', nameColor: '#333', textColor: '#222' };
                if (p3) podiumMap[p3.name] = { bg: 'linear-gradient(135deg,#E8A87C,#CD7F32)', border: '#a06030', nameColor: '#4a2000', textColor: '#3a1800' };
                return (
                  <div className="mt-3 flex flex-col min-h-0 flex-1">
                    <div
                      className="uppercase tracking-wider text-xs font-bold mb-2 flex-shrink-0"
                      style={{ color: '#241b3a', fontFamily: 'var(--ap-font-display)' }}
                    >
                      Réactions live
                    </div>
                    <div className="space-y-1.5 overflow-y-auto flex-1">
                      {reactionComments.map((c, i) => {
                        const ps = podiumMap[c.playerName];
                        return (
                          <div
                            key={`${c.playerName}-${c.ts}-${i}`}
                            className="flex items-center gap-2 px-2 py-1.5"
                            style={{
                              background: ps ? ps.bg : '#ffffff',
                              border: `1.5px solid ${ps ? ps.border : '#efe6d3'}`,
                              borderRadius: 'var(--ap-r-sm)',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                            }}
                          >
                            <div style={{ flexShrink: 0 }}>
                              <AvatarDisplay emoji={c.avatar} size="xs" />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <span
                                className="font-bold text-xs block truncate"
                                style={{ color: ps ? ps.nameColor : '#7048ff', fontFamily: 'var(--ap-font-display)' }}
                              >
                                {c.playerName}
                              </span>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: ps ? ps.textColor : '#241b3a', fontFamily: 'var(--ap-font-body)', wordBreak: 'break-word', lineHeight: 1.3 }}>
                                {c.text}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};
