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
  const reactionsEndRef = useRef<HTMLDivElement>(null);

  // Final screen sequential reveal
  const [revealPhase, setRevealPhase] = useState<'none' | 'bronze' | 'silver' | 'suspense' | 'gold' | 'stats'>('none');

  useEffect(() => {
    if (gameState !== 'final') { setRevealPhase('none'); return; }
    const t: ReturnType<typeof setTimeout>[] = [];
    t.push(setTimeout(() => setRevealPhase('bronze'),   500));
    t.push(setTimeout(() => setRevealPhase('silver'),  1500));
    t.push(setTimeout(() => setRevealPhase('suspense'), 2500));
    t.push(setTimeout(() => setRevealPhase('gold'),    4100));
    t.push(setTimeout(() => setRevealPhase('stats'),   5100));
    return () => t.forEach(clearTimeout);
  }, [gameState]);

  // Lobby join toast
  const [lastJoined, setLastJoined] = useState<{ name: string; avatar: string } | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownNum, setCountdownNum] = useState('3');
  const [kickedPlayerIds, setKickedPlayerIds] = useState<Set<string>>(new Set());
  const prevPlayersLenRef = useRef(0);

  useEffect(() => {
    if (gameState !== 'waiting') return;
    if (players.length > prevPlayersLenRef.current) {
      const newest = players[players.length - 1];
      if (newest) {
        setLastJoined({ name: newest.name, avatar: newest.avatar });
        setToastVisible(true);
        const t = setTimeout(() => setToastVisible(false), 1600);
        prevPlayersLenRef.current = players.length;
        return () => clearTimeout(t);
      }
    }
    prevPlayersLenRef.current = players.length;
  }, [players, gameState]);

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

  // Auto-scroll reactions feed to bottom on new messages
  useEffect(() => {
    reactionsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [reactionComments]);

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
    const visiblePlayers = players.filter(p => !kickedPlayerIds.has(p.id));
    const ghostCount = Math.max(0, 4 - visiblePlayers.length);

    const handleStart = () => {
      setShowCountdown(true);
      setCountdownNum('3');
      const seq = ['3', '2', '1', 'GO !'];
      let k = 0;
      const tick = () => {
        setCountdownNum(seq[k]);
        k++;
        if (k < seq.length) setTimeout(tick, 900);
        else setTimeout(() => { setShowCountdown(false); startQuiz(); }, 800);
      };
      tick();
    };

    const kickPlayer = (id: string) => {
      setKickedPlayerIds(prev => new Set([...prev, id]));
    };

    return (
      <div style={{
        background: 'var(--ap-paper)',
        backgroundImage: 'radial-gradient(var(--ap-line-2) 1px,transparent 1px)',
        backgroundSize: '28px 28px',
        minHeight: '100vh',
        fontFamily: 'var(--ap-font-body)',
        color: 'var(--ap-ink)',
        display: 'flex', flexDirection: 'column',
        WebkitFontSmoothing: 'antialiased',
      }}>
        <style>{`
          @keyframes floatUpLobby { 0%{opacity:1;transform:translateY(0) scale(1);}80%{opacity:.8;}100%{opacity:0;transform:translateY(-200px) scale(1.02);} }
          .reaction-float-lobby { animation:floatUpLobby 2.8s ease-out forwards; pointer-events:none; position:fixed; z-index:9999; }
          @keyframes player-in { 0%{opacity:0;transform:scale(.4) rotate(-8deg);}70%{transform:scale(1.08) rotate(2deg);}100%{opacity:1;transform:none;} }
          @keyframes idle-wiggle { 50%{transform:translateY(-4px) rotate(3deg);} }
          @keyframes pin-breathe { 50%{transform:scale(1.035);} }
          @keyframes lobby-bump { 40%{transform:scale(1.16);} }
          @keyframes lobby-pulse { 50%{opacity:.3;} }
          @keyframes cd-pop { 0%{transform:scale(.3);opacity:0;}45%{transform:scale(1.1);opacity:1;}100%{transform:scale(1);opacity:1;} }
          @keyframes toast-in { to{transform:translate(-50%,0);} }
          .lobby-player { animation: player-in .5s cubic-bezier(.2,.7,.3,1.3); transition:transform .15s cubic-bezier(.2,.7,.3,1.3),box-shadow .15s cubic-bezier(.2,.7,.3,1.3); }
          .lobby-player:hover { transform:translateY(-3px); box-shadow:0 7px 0 var(--ap-line-2) !important; }
          .lobby-player .kick-btn { opacity:0; transform:scale(.6); transition:opacity .15s,transform .15s cubic-bezier(.2,.7,.3,1.3); }
          .lobby-player:hover .kick-btn { opacity:1; transform:scale(1); }
        `}</style>

        {/* Floating reactions */}
        {floatingReactions.map((r) => (
          <div key={r.id} className="reaction-float-lobby" style={{ left:`${r.x}%`, bottom:'15%' }}>
            <div style={{ display:'flex',alignItems:'center',gap:6,background:'rgba(0,0,0,.78)',backdropFilter:'blur(10px)',border:'1.5px solid rgba(255,255,255,.2)',borderRadius:999,padding:'6px 14px',boxShadow:'0 4px 20px rgba(0,0,0,.3)' }}>
              <div style={{ flexShrink:0 }}><AvatarDisplay emoji={r.avatar} size="xs" /></div>
              <span style={{ color:'#fff',fontSize:11,fontWeight:700,flexShrink:0,fontFamily:'var(--ap-font-body)' }}>{r.playerName}</span>
              <span style={{ fontSize:r.isEmoji?'1.4rem':'12px',color:'rgba(255,255,255,.9)',fontFamily:'var(--ap-font-body)' }}>{r.text}</span>
            </div>
          </div>
        ))}

        {/* Join toast */}
        <div aria-live="polite" style={{
          position:'fixed', top:18, left:'50%',
          transform: toastVisible ? 'translate(-50%,0)' : 'translate(-50%,-70px)',
          background:'var(--ap-ink)', color:'#fff', fontWeight:800, fontSize:14,
          padding:'11px 20px', borderRadius:999,
          boxShadow:'0 4px 0 #16102a,0 16px 34px rgba(36,27,58,.3)',
          display:'flex', alignItems:'center', gap:9, zIndex:40,
          transition:'transform .4s cubic-bezier(.2,.7,.3,1.3)',
          pointerEvents:'none',
        }}>
          {lastJoined && <AvatarDisplay emoji={lastJoined.avatar} size="xs" />}
          <span>{lastJoined?.name} a rejoint la partie</span>
        </div>

        {/* Topbar */}
        <div style={{ display:'flex',alignItems:'center',gap:14,padding:'16px 24px',maxWidth:1240,margin:'0 auto',width:'100%' }}>
          <span style={{ display:'flex',alignItems:'center',gap:9 }}>
            <span style={{ width:36,height:36,borderRadius:12,background:'var(--ap-brand)',display:'grid',placeItems:'center',boxShadow:'0 4px 0 var(--ap-brand-deep)',transform:'rotate(-6deg)',flexShrink:0 }} aria-hidden="true">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="#fff"><path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l0-8z"/></svg>
            </span>
            <span style={{ fontFamily:'var(--ap-font-display)',fontWeight:600,fontSize:19 }}>Ludiq</span>
          </span>
          <span style={{ fontWeight:800,fontSize:15,color:'var(--ap-muted)' }}>
            · En attente — <b style={{ color:'var(--ap-ink)' }}>{quiz.title}</b>
          </span>
          <div style={{ flex:1 }} />
          {isHost && (
            <button
              onClick={() => onExitRequest?.()}
              style={{ display:'inline-flex',alignItems:'center',gap:8,fontWeight:800,fontSize:13,color:'var(--ap-muted)',cursor:'pointer',background:'var(--ap-card)',border:'2px solid var(--ap-line)',borderRadius:999,padding:'8px 15px',boxShadow:'0 3px 0 var(--ap-line)' }}
            >
              🚪 Quitter
            </button>
          )}
        </div>

        {/* Main 2-col layout */}
        <div style={{ flex:1,display:'grid',gridTemplateColumns:'380px 1fr',gap:26,maxWidth:1240,margin:'0 auto',width:'100%',padding:'8px 24px 120px',alignItems:'start' }}>

          {/* ── Join card (sticky left) ── */}
          <aside style={{ background:'var(--ap-card)',border:'2px solid var(--ap-line)',borderRadius:'var(--ap-r-lg)',boxShadow:'0 6px 0 var(--ap-line),0 30px 55px rgba(60,40,120,.1)',padding:26,textAlign:'center',position:'sticky',top:18 }} aria-label="Comment rejoindre la partie">
            <h2 style={{ fontFamily:'var(--ap-font-display)',fontWeight:600,fontSize:21,marginBottom:4 }}>Rejoignez la partie</h2>
            <p style={{ fontWeight:800,fontSize:15,color:'var(--ap-muted)',marginBottom:18 }}>
              Sur <b style={{ color:'var(--ap-brand-deep)' }}>ludiq.app</b>, entrez le code
            </p>

            {/* PIN + QR side by side */}
            <div style={{ display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:12,alignItems:'center' }}>
              <div>
                <p style={{ fontSize:11,fontWeight:800,letterSpacing:'.09em',textTransform:'uppercase',color:'var(--ap-muted)',marginBottom:8 }}>Code de la partie</p>
                <div style={{ background:'var(--ap-paper-2)',border:'2px dashed var(--ap-line-2)',borderRadius:'var(--ap-r-md)',padding:'16px 10px',overflow:'hidden' }}>
                  <div style={{ fontFamily:'var(--ap-font-mono)',fontWeight:700,fontSize: quiz.gameCode.length > 8 ? Math.max(14, 32 - (quiz.gameCode.length - 6) * 1.8) : 32,letterSpacing:'.08em',fontVariantNumeric:'tabular-nums',lineHeight:1.1,animation:'pin-breathe 3.2s ease-in-out infinite',color:'var(--ap-ink)',wordBreak:'break-all' }} aria-label={`Code : ${quiz.gameCode}`}>
                    {quiz.gameCode.slice(0,3)}<span style={{ color:'var(--ap-brand)' }}>{quiz.gameCode.slice(3)}</span>
                  </div>
                </div>
              </div>
              <span style={{ fontFamily:'var(--ap-font-display)',fontWeight:600,fontSize:13,color:'var(--ap-line-2)',textTransform:'uppercase' }} aria-hidden="true">ou</span>
              <div>
                <p style={{ fontSize:11,fontWeight:800,letterSpacing:'.09em',textTransform:'uppercase',color:'var(--ap-muted)',marginBottom:8 }}>Scannez</p>
                <div style={{ background:'var(--ap-card)',border:'2px solid var(--ap-line)',borderRadius:'var(--ap-r-md)',padding:8,boxShadow:'0 3px 0 var(--ap-line)',display:'grid',placeItems:'center' }}>
                  {sessionReady ? (
                    <QRCodeGenerator gameCode={quiz.gameCode} joinUrl={joinUrl} compact compactSize={108} />
                  ) : (
                    <div style={{ width:108,height:108,display:'grid',placeItems:'center',color:'var(--ap-muted)',fontSize:12,fontWeight:700 }}>Chargement…</div>
                  )}
                </div>
              </div>
            </div>

            {/* Copy / share actions */}
            {sessionReady && (
              <div style={{ display:'flex',gap:8,marginTop:12 }}>
                <button
                  className="ap-btn ap-btn--sm ap-btn--ghost"
                  style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6 }}
                  onClick={async () => {
                    try { await navigator.clipboard.writeText(joinUrl); toast.success('Lien copié !'); }
                    catch { toast.error('Échec de la copie'); }
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  Copier le lien
                </button>
                <button
                  className="ap-btn ap-btn--sm ap-btn--ghost"
                  style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6 }}
                  onClick={async () => {
                    if (navigator.share) {
                      try { await navigator.share({ title:'Rejoignez mon quiz !', text:`Code : ${quiz.gameCode}`, url: joinUrl }); }
                      catch (e) { if ((e as Error).name !== 'AbortError') { await navigator.clipboard.writeText(joinUrl); toast.success('Lien copié !'); } }
                    } else {
                      await navigator.clipboard.writeText(joinUrl); toast.success('Lien copié !');
                    }
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  Partager
                </button>
              </div>
            )}

            <div style={{ marginTop:12,fontSize:13,fontWeight:700,background:'var(--ap-flash-soft)',border:'2px solid rgba(255,176,32,.4)',borderRadius:'var(--ap-r-md)',padding:'10px 14px',textAlign:'left',display:'flex',gap:9,alignItems:'flex-start',color:'var(--ap-flash-deep)' }}>
              <span aria-hidden="true">💡</span>
              <span>Le quiz comporte {quiz.questions.length} question{quiz.questions.length > 1 ? 's' : ''}. Rejoignez avant le lancement !</span>
            </div>
          </aside>

          {/* ── Arena ── */}
          <section aria-label="Joueurs connectés">
            <div style={{ display:'flex',alignItems:'baseline',gap:12,margin:'4px 2px 16px' }}>
              <h2 style={{ fontFamily:'var(--ap-font-display)',fontWeight:600,fontSize:22,margin:0 }}>Joueurs</h2>
              <span style={{ fontFamily:'var(--ap-font-mono)',fontWeight:700,fontSize:15,fontVariantNumeric:'tabular-nums',color:'var(--ap-pres-deep)',background:'var(--ap-pres-soft)',border:'2px solid rgba(21,192,138,.4)',borderRadius:999,padding:'4px 13px',animation: visiblePlayers.length > prevPlayersLenRef.current ? 'lobby-bump .35s cubic-bezier(.2,.7,.3,1.3)' : undefined }} role="status" aria-live="polite">
                {visiblePlayers.length}
              </span>
              {isHost && <span style={{ fontSize:13,fontWeight:700,color:'var(--ap-muted)' }}>Survolez un joueur pour le retirer</span>}
            </div>

            <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(128px,1fr))',gap:13 }}>
              {visiblePlayers.map((player) => (
                <div
                  key={player.id}
                  className="lobby-player"
                  style={{ position:'relative',background:'var(--ap-card)',border:'2px solid var(--ap-line)',borderRadius:'var(--ap-r-md)',padding:'15px 10px 13px',textAlign:'center',boxShadow:'0 4px 0 var(--ap-line)' }}
                >
                  {isHost && (
                    <button
                      className="kick-btn"
                      onClick={() => kickPlayer(player.id)}
                      aria-label={`Retirer ${player.name}`}
                      style={{ position:'absolute',top:-8,right:-8,width:24,height:24,borderRadius:'50%',border:'2px solid var(--ap-card)',background:'var(--ap-quiz)',color:'#fff',fontWeight:800,fontSize:12,lineHeight:1,cursor:'pointer',display:'grid',placeItems:'center',boxShadow:'0 2px 0 var(--ap-quiz-deep)' }}
                    >✕</button>
                  )}
                  <div style={{ width:52,height:52,margin:'0 auto 8px',borderRadius:'50%',background:'var(--ap-paper-2)',border:'2px solid var(--ap-line)',display:'grid',placeItems:'center',fontSize:27,animation:'idle-wiggle 4.5s ease-in-out infinite' }} aria-hidden="true">
                    <AvatarDisplay emoji={player.avatar} size="sm" />
                  </div>
                  <span style={{ fontWeight:800,fontSize:13.5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'block' }}>{player.name}</span>
                </div>
              ))}
              {/* Ghost slots */}
              {Array.from({ length: ghostCount }).map((_, i) => (
                <div key={`ghost-${i}`} style={{ border:'2px dashed var(--ap-line-2)',borderRadius:'var(--ap-r-md)',display:'grid',placeItems:'center',minHeight:118,color:'var(--ap-line-2)',fontFamily:'var(--ap-font-display)',fontWeight:600,fontSize:22 }} aria-hidden="true">?</div>
              ))}
            </div>
          </section>
        </div>

        {/* ── Launch bar (host, fixed bottom) ── */}
        {isHost && (
          <div style={{ position:'fixed',bottom:0,left:0,right:0,zIndex:30,background:'var(--ap-card)',borderTop:'2px solid var(--ap-line)',boxShadow:'0 -14px 34px rgba(60,40,120,.08)' }}>
            <div style={{ maxWidth:1240,margin:'0 auto',padding:'14px 24px',display:'flex',alignItems:'center',gap:16 }}>
              <span style={{ fontWeight:800,fontSize:14,color:'var(--ap-muted)',display:'flex',alignItems:'center',gap:9 }}>
                <span style={{ width:9,height:9,borderRadius:'50%',background:'var(--ap-pres)',animation:'lobby-pulse 1.8s infinite',display:'inline-block',flexShrink:0 }} aria-hidden="true" />
                {visiblePlayers.length === 0 ? 'En attente des premiers joueurs…' : visiblePlayers.length < 5 ? 'La salle se remplit…' : 'Prêt quand vous voulez !'}
              </span>
              <div style={{ flex:1 }} />
              <button
                onClick={handleStart}
                disabled={visiblePlayers.length === 0}
                style={{
                  display:'inline-flex',alignItems:'center',gap:9,
                  fontFamily:'var(--ap-font-body)',fontWeight:800,fontSize:16,
                  padding:'14px 30px',borderRadius:999,border:'none',cursor: visiblePlayers.length === 0 ? 'not-allowed' : 'pointer',
                  color:'#fff',
                  background: visiblePlayers.length === 0 ? 'var(--ap-muted)' : 'var(--ap-pres-deep)',
                  boxShadow: visiblePlayers.length === 0 ? 'none' : '0 5px 0 #076346',
                  opacity: visiblePlayers.length === 0 ? 0.6 : 1,
                  transition:'transform .15s,box-shadow .15s',
                }}
              >
                Lancer la partie
                <span style={{ fontFamily:'var(--ap-font-mono)',fontSize:13,fontVariantNumeric:'tabular-nums',background:'rgba(255,255,255,.2)',borderRadius:999,padding:'2px 9px' }}>
                  {visiblePlayers.length} joueur{visiblePlayers.length > 1 ? 's' : ''}
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 4l14 8-14 8z"/></svg>
              </button>
            </div>
          </div>
        )}

        {/* ── Fullscreen countdown ── */}
        {showCountdown && (
          <div style={{ position:'fixed',inset:0,zIndex:100,display:'grid',placeItems:'center',background:'var(--ap-brand)',backgroundImage:'radial-gradient(rgba(255,255,255,.14) 1.5px,transparent 1.5px)',backgroundSize:'30px 30px' }} aria-live="assertive">
            <span key={countdownNum} style={{ fontFamily:'var(--ap-font-display)',fontWeight:600,fontSize:'clamp(120px,30vw,280px)',color:'#fff',textShadow:'0 10px 0 var(--ap-brand-deep)',animation:'cd-pop .9s cubic-bezier(.2,.7,.3,1.3)',display:'block',lineHeight:1,textAlign:'center' }}>
              {countdownNum}
            </span>
          </div>
        )}

        {/* Settings dialog */}
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

    const phaseAfter = (phase: string) =>
      ['bronze','silver','suspense','gold','stats'].slice(
        ['bronze','silver','suspense','gold','stats'].indexOf(phase)
      ).includes(revealPhase);

    const avgCorrect = players.length > 0 && quiz.questions.length > 0
      ? Math.round((players.reduce((s, p) => s + p.correctAnswers, 0) / players.length / quiz.questions.length) * 100)
      : 0;

    const PILLAR = {
      1: { h: 210, bg: 'linear-gradient(180deg,#ffb020,#c98700)', shadow: '0 0 60px rgba(255,176,32,.25),inset 0 4px 0 rgba(255,255,255,.35)' },
      2: { h: 150, bg: 'linear-gradient(180deg,#cfd4e2,#9aa2b8)', shadow: 'inset 0 4px 0 rgba(255,255,255,.4)' },
      3: { h: 112, bg: 'linear-gradient(180deg,#e08a5a,#b05f30)', shadow: 'inset 0 4px 0 rgba(255,255,255,.3)' },
    } as const;

    const PodiumStep = ({ player, rank, revealed }: { player: typeof p1; rank: 1|2|3; revealed: boolean }) => {
      const { h, bg, shadow } = PILLAR[rank];
      const avatarSize = rank === 1 ? 84 : 72;
      const borderColor = rank === 1 ? '#ffb020' : rank === 2 ? '#cfd4e2' : '#e08a5a';
      const borderDeep  = rank === 1 ? '#c98700' : rank === 2 ? '#9aa2b8' : '#b05f30';
      const glowShadow  = rank === 1 ? `,0 0 44px rgba(255,176,32,.4)` : '';
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* champ section */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 14,
            opacity: revealed ? undefined : 0,
            transform: revealed ? undefined : 'translateY(26px) scale(.85)',
            animation: revealed ? 'champ-in .6s cubic-bezier(.2,.7,.3,1.3) forwards' : undefined,
          }}>
            {rank === 1 && (
              <span style={{
                fontSize: 30, lineHeight: 1, marginBottom: -8, zIndex: 2,
                filter: 'drop-shadow(0 3px 0 rgba(0,0,0,.25))',
                opacity: revealed ? undefined : 0,
                transform: revealed ? undefined : 'translateY(10px) rotate(-14deg)',
                animation: revealed ? 'crown-in .5s cubic-bezier(.2,.7,.3,1.3) .25s forwards' : undefined,
              }}>👑</span>
            )}
            {player ? (
              <div style={{
                width: avatarSize, height: avatarSize, borderRadius: '50%',
                background: '#fff', display: 'grid', placeItems: 'center',
                fontSize: rank === 1 ? 42 : 36,
                border: `4px solid #1c1430`,
                boxShadow: `0 0 0 4px ${borderColor},0 6px 0 ${borderDeep}${glowShadow}`,
              }}>
                <AvatarDisplay emoji={player.avatar} size={rank === 1 ? 'xl' : 'lg'} />
              </div>
            ) : (
              <div style={{ width: avatarSize, height: avatarSize, borderRadius: '50%', background: 'rgba(255,255,255,.08)', border: `4px solid rgba(255,255,255,.15)` }} />
            )}
            <span style={{ marginTop: 12, fontWeight: 800, fontSize: 17, color: '#fff' }}>
              {player?.name ?? '—'}
            </span>
            <span style={{ fontFamily: 'var(--ap-font-mono)', fontWeight: 700, fontSize: rank === 1 ? 17 : 15, color: rank === 1 ? '#ffb020' : '#b6aed0', marginTop: 2 }}>
              {(player?.score ?? 0).toLocaleString('fr-FR')} pts
            </span>
          </div>
          {/* pillar */}
          <div style={{
            width: '100%', borderRadius: '18px 18px 0 0',
            display: 'grid', placeItems: 'center',
            height: h, background: bg, boxShadow: shadow,
            transform: revealed ? undefined : 'scaleY(0)',
            transformOrigin: 'bottom',
            animation: revealed ? 'grow .55s cubic-bezier(.2,.7,.3,1) forwards' : undefined,
          }}>
            <span style={{
              fontFamily: 'var(--ap-font-display)', fontWeight: 600, fontSize: 44,
              color: 'rgba(255,255,255,.92)', textShadow: '0 3px 0 rgba(0,0,0,.18)',
              opacity: revealed ? undefined : 0,
              animation: revealed ? 'fade .3s .4s forwards' : undefined,
            }}>{rank}</span>
          </div>
        </div>
      );
    };

    return (
      <div style={{
        minHeight: '100vh',
        background: 'radial-gradient(1100px 600px at 50% -10%,#2d2150 0%,transparent 60%),#1c1430',
        fontFamily: 'var(--ap-font-body)',
        color: '#fff',
        display: 'flex',
        overflow: 'hidden',
        WebkitFontSmoothing: 'antialiased',
      }}>
        <style>{`
          @keyframes twinkle    { 50% { opacity:.12; transform:scale(.7); } }
          @keyframes champ-in   { to  { opacity:1; transform:none; } }
          @keyframes crown-in   { to  { opacity:1; transform:rotate(-8deg); } }
          @keyframes grow       { to  { transform:scaleY(1); } }
          @keyframes fade       { to  { opacity:1; } }
          @keyframes rise       { to  { opacity:1; transform:none; } }
          @keyframes night-slide{ to  { opacity:1; transform:none; } }
          @keyframes bounce-dot { 40% { transform:translateY(-6px); } }
          @keyframes floatUp    { 0%{opacity:1;transform:translateY(0) scale(1);}80%{opacity:.8;}100%{opacity:0;transform:translateY(-200px) scale(1.02);} }
          .reaction-float { animation:floatUp 2.8s ease-out forwards; pointer-events:none; position:fixed; z-index:9999; }
        `}</style>

        <Fireworks />

        {/* Floating reaction bubbles */}
        {(() => {
          const fpMap: Record<string,{bg:string;border:string;nameColor:string;textColor:string}> = {};
          if (p1) fpMap[p1.name] = { bg:'linear-gradient(135deg,#FFE566,#FFCC00)', border:'#e5aa00', nameColor:'#7a4000', textColor:'#5a2e00' };
          if (p2) fpMap[p2.name] = { bg:'linear-gradient(135deg,#E8E8E8,#C0C0C0)', border:'#aaa',    nameColor:'#333',    textColor:'#222' };
          if (p3) fpMap[p3.name] = { bg:'linear-gradient(135deg,#E8A87C,#CD7F32)', border:'#a06030', nameColor:'#4a2000', textColor:'#3a1800' };
          return floatingReactions.map((r) => {
            const ps = fpMap[r.playerName];
            return (
              <div key={r.id} className="reaction-float" style={{ left:`${r.x}%`, bottom:'20%' }}>
                <div style={{
                  display:'flex', alignItems:'center', gap:6,
                  background: ps ? ps.bg : 'rgba(0,0,0,.78)',
                  backdropFilter: ps ? undefined : 'blur(10px)',
                  border: `1.5px solid ${ps ? ps.border : 'rgba(255,255,255,.2)'}`,
                  borderRadius:999, padding:'6px 14px',
                  boxShadow:'0 4px 20px rgba(0,0,0,.25)',
                }}>
                  <div style={{ flexShrink:0 }}><AvatarDisplay emoji={r.avatar} size="xs" /></div>
                  <span style={{ color: ps ? ps.nameColor : '#fff', fontSize:11, fontWeight:700, flexShrink:0, fontFamily:'var(--ap-font-body)' }}>{r.playerName}</span>
                  <span style={{ fontSize: r.isEmoji ? '1.4rem' : 12, color: ps ? ps.textColor : 'rgba(255,255,255,.9)', fontFamily:'var(--ap-font-body)' }}>{r.text}</span>
                </div>
              </div>
            );
          });
        })()}

        {/* ── Main content ── */}
        <div style={{
          flex: 1, position:'relative', zIndex:2,
          display:'flex', flexDirection:'column', alignItems:'center',
          padding:'40px 24px 60px', overflowY:'auto',
        }}>
          {/* Header */}
          <header style={{ textAlign:'center', marginBottom:12, width:'100%', maxWidth:1080 }}>
            <span style={{
              display:'inline-flex', alignItems:'center', gap:8,
              fontSize:12.5, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase',
              color:'#ffb020', background:'rgba(255,176,32,.1)',
              border:'2px solid rgba(255,176,32,.35)',
              padding:'6px 15px', borderRadius:999, marginBottom:18,
            }}>🏁 Session terminée</span>
            <h1 style={{
              fontFamily:'var(--ap-font-display)', fontWeight:600,
              fontSize:'clamp(30px,4vw,46px)', letterSpacing:'-.01em', lineHeight:1.1, color:'#fff',
            }}>{quiz.title}</h1>
            <p style={{ marginTop:8, fontWeight:700, fontSize:15, color:'#b6aed0' }}>
              {players.length} joueur{players.length > 1 ? 's' : ''} · {quiz.questions.length} question{quiz.questions.length > 1 ? 's' : ''}
            </p>
          </header>

          {/* Suspense text */}
          <p style={{
            textAlign:'center', minHeight:34, margin:'18px 0 6px',
            fontFamily:'var(--ap-font-display)', fontWeight:600, fontSize:21,
            color:'#ffb020',
            opacity: revealPhase === 'suspense' ? 1 : 0,
            transition:'opacity .4s',
          }} role="status" aria-live="polite">
            {revealPhase === 'suspense' && <>Et la première place revient à<span>
              {[0,1,2].map(i => <i key={i} style={{ display:'inline-block', animation:`bounce-dot 1s ${i*150}ms infinite` }}>.</i>)}
            </span></>}
          </p>

          {/* Podium — order: 2nd | 1st | 3rd */}
          <section style={{
            display:'grid', gridTemplateColumns:'repeat(3,minmax(0,200px))',
            justifyContent:'center', alignItems:'end', gap:22,
            margin:'26px 0 10px', minHeight:380, width:'100%', maxWidth:660,
          }} aria-label="Podium des trois premiers">
            <PodiumStep player={p2} rank={2} revealed={phaseAfter('silver')} />
            <PodiumStep player={p1} rank={1} revealed={phaseAfter('gold')} />
            <PodiumStep player={p3} rank={3} revealed={phaseAfter('bronze')} />
          </section>

          {/* Podium floor */}
          <div style={{ height:10, maxWidth:760, width:'100%', background:'rgba(255,255,255,.08)', borderRadius:999 }} aria-hidden="true" />

          {/* Stats */}
          {phaseAfter('stats') && (
            <section style={{
              display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14,
              maxWidth:760, width:'100%', margin:'34px auto 0',
              opacity:0, transform:'translateY(16px)',
              animation:'rise .5s cubic-bezier(.2,.7,.3,1) forwards',
            }} aria-label="Statistiques de la session">
              <div style={{ background:'rgba(255,255,255,.05)', border:'2px solid rgba(255,255,255,.1)', borderRadius:16, padding:'15px 18px', textAlign:'center' }}>
                <b style={{ display:'block', fontFamily:'var(--ap-font-display)', fontWeight:600, fontSize:26, color:'#15c08a', fontVariantNumeric:'tabular-nums' }}>{avgCorrect}%</b>
                <small style={{ fontSize:12, fontWeight:800, letterSpacing:'.06em', textTransform:'uppercase', color:'#b6aed0' }}>Réussite moyenne</small>
              </div>
              <div style={{ background:'rgba(255,255,255,.05)', border:'2px solid rgba(255,255,255,.1)', borderRadius:16, padding:'15px 18px', textAlign:'center' }}>
                <b style={{ display:'block', fontFamily:'var(--ap-font-display)', fontWeight:600, fontSize:26, fontVariantNumeric:'tabular-nums' }}>{players.length}/{players.length}</b>
                <small style={{ fontSize:12, fontWeight:800, letterSpacing:'.06em', textTransform:'uppercase', color:'#b6aed0' }}>Participation</small>
              </div>
              <div style={{ background:'rgba(255,255,255,.05)', border:'2px solid rgba(255,255,255,.1)', borderRadius:16, padding:'15px 18px', textAlign:'center' }}>
                <b style={{ display:'block', fontFamily:'var(--ap-font-display)', fontWeight:600, fontSize:26, color:'#ffb020', fontVariantNumeric:'tabular-nums' }}>{p1?.score.toLocaleString('fr-FR') ?? '—'}</b>
                <small style={{ fontSize:12, fontWeight:800, letterSpacing:'.06em', textTransform:'uppercase', color:'#b6aed0' }}>Meilleur score</small>
              </div>
            </section>
          )}

          {/* Full leaderboard (4th place and beyond) */}
          {phaseAfter('stats') && sortedPlayers.length > 3 && (
            <section style={{ maxWidth:560, width:'100%', margin:'30px auto 0' }} aria-label="Suite du classement">
              <h2 style={{
                fontSize:12, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase',
                color:'#b6aed0', marginBottom:12, display:'flex', alignItems:'center', gap:12,
              }}>
                Classement complet
                <span style={{ flex:1, height:2, background:'rgba(255,255,255,.1)', borderRadius:2, display:'block' }} />
              </h2>
              {sortedPlayers.slice(3).map((player, i) => (
                <div
                  key={player.id}
                  style={{
                    display:'flex', alignItems:'center', gap:13,
                    background:'rgba(255,255,255,.05)', border:'2px solid rgba(255,255,255,.09)',
                    borderRadius:16, padding:'10px 15px', marginBottom:8,
                    opacity:0, transform:'translateX(-14px)',
                    animation:`night-slide .4s cubic-bezier(.2,.7,.3,1) ${i * 110}ms forwards`,
                  }}
                >
                  <span style={{ fontFamily:'var(--ap-font-display)', fontWeight:600, width:24, textAlign:'center', color:'#b6aed0' }}>{i + 4}</span>
                  <div style={{ width:34, height:34, borderRadius:'50%', background:'rgba(255,255,255,.1)', display:'grid', placeItems:'center', fontSize:17, flexShrink:0 }}>
                    <AvatarDisplay emoji={player.avatar} size="xs" />
                  </div>
                  <span style={{ flex:1, fontWeight:800, fontSize:14.5 }}>{player.name}</span>
                  <span style={{ fontFamily:'var(--ap-font-mono)', fontWeight:700, fontSize:14, color:'#b6aed0', fontVariantNumeric:'tabular-nums' }}>{player.score.toLocaleString('fr-FR')} pts</span>
                </div>
              ))}
            </section>
          )}

          {/* Actions */}
          {isHost && phaseAfter('stats') && (
            <section style={{
              display:'flex', flexWrap:'wrap', gap:13, justifyContent:'center', marginTop:38,
              opacity:0, transform:'translateY(16px)',
              animation:'rise .5s cubic-bezier(.2,.7,.3,1) .6s forwards',
            }}>
              <button
                onClick={exportResults}
                style={{
                  display:'inline-flex', alignItems:'center', gap:9,
                  fontFamily:'var(--ap-font-body)', fontWeight:800, fontSize:15,
                  padding:'13px 24px', borderRadius:999, border:'none', cursor:'pointer',
                  color:'#241b3a', background:'#ffb020',
                  boxShadow:'0 5px 0 #c98700',
                  transition:'transform .15s,box-shadow .15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow='0 7px 0 #c98700'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform=''; (e.currentTarget as HTMLElement).style.boxShadow='0 5px 0 #c98700'; }}
              >
                <Download style={{ width:16, height:16 }} />
                Exporter les résultats
              </button>
              <button
                onClick={() => window.location.href = '/'}
                style={{
                  display:'inline-flex', alignItems:'center', gap:9,
                  fontFamily:'var(--ap-font-body)', fontWeight:800, fontSize:15,
                  padding:'13px 24px', borderRadius:999, border:'none', cursor:'pointer',
                  color:'#fff', background:'rgba(255,255,255,.08)',
                  boxShadow:'0 5px 0 rgba(0,0,0,.35),inset 0 0 0 2px rgba(255,255,255,.16)',
                  transition:'transform .15s,box-shadow .15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow='0 7px 0 rgba(0,0,0,.35),inset 0 0 0 2px rgba(255,255,255,.3)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow='0 5px 0 rgba(0,0,0,.35),inset 0 0 0 2px rgba(255,255,255,.16)'; }}
              >
                🎮 Nouveau Quiz
              </button>
            </section>
          )}
        </div>

        {/* ── Live reactions sidebar (host only) ── */}
        {isHost && (
          <div style={{
            width:240, flexShrink:0,
            display:'flex', flexDirection:'column', padding:16,
            borderLeft:'2px solid rgba(255,255,255,.1)',
            background:'rgba(255,255,255,.04)',
            position:'sticky', top:0, height:'100vh', overflow:'hidden',
          }}>
            <div style={{
              marginBottom:12, flexShrink:0,
              fontSize:11, fontWeight:800, letterSpacing:'.08em', textTransform:'uppercase',
              color:'#b6aed0', fontFamily:'var(--ap-font-display)',
            }}>Réactions live</div>
            {reactionComments.length === 0 ? (
              <div style={{
                flex:1, display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:12, textAlign:'center', color:'#b6aed0', fontFamily:'var(--ap-font-body)',
              }}>En attente de réactions…</div>
            ) : (
              <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
                {(() => {
                  const podiumMap: Record<string,{bg:string;border:string;nameColor:string;textColor:string}> = {};
                  if (p1) podiumMap[p1.name] = { bg:'linear-gradient(135deg,#FFE566,#FFCC00)', border:'#e5aa00', nameColor:'#7a4000', textColor:'#5a2e00' };
                  if (p2) podiumMap[p2.name] = { bg:'linear-gradient(135deg,#E8E8E8,#C0C0C0)', border:'#aaa',    nameColor:'#333',    textColor:'#222' };
                  if (p3) podiumMap[p3.name] = { bg:'linear-gradient(135deg,#E8A87C,#CD7F32)', border:'#a06030', nameColor:'#4a2000', textColor:'#3a1800' };
                  return reactionComments.map((c, i) => {
                    const ps = podiumMap[c.playerName];
                    return (
                      <div
                        key={`${c.playerName}-${c.ts}-${i}`}
                        style={{
                          display:'flex', alignItems:'center', gap:8,
                          padding:'6px 10px',
                          background: ps ? ps.bg : 'rgba(255,255,255,.06)',
                          border: `1.5px solid ${ps ? ps.border : 'rgba(255,255,255,.12)'}`,
                          borderRadius:12,
                        }}
                      >
                        <div style={{ flexShrink:0 }}><AvatarDisplay emoji={c.avatar} size="xs" /></div>
                        <div style={{ minWidth:0, flex:1 }}>
                          <span style={{ fontWeight:700, fontSize:11, display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color: ps ? ps.nameColor : '#b6aed0', fontFamily:'var(--ap-font-display)' }}>{c.playerName}</span>
                          <span style={{ fontSize:12, fontWeight:600, color: ps ? ps.textColor : 'rgba(255,255,255,.85)', fontFamily:'var(--ap-font-body)', wordBreak:'break-word', lineHeight:1.3 }}>{c.text}</span>
                        </div>
                      </div>
                    );
                  });
                })()}
                <div ref={reactionsEndRef} />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }


  return null;
};
