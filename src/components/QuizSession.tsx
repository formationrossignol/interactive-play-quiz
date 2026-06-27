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

  // Live reactions (waiting + final screens)
  const [floatingReactions, setFloatingReactions] = useState<Array<{ id: string; emoji: string; x: number; playerName: string; avatar: string; text: string; isEmoji: boolean }>>([]);
  const [reactionComments, setReactionComments] = useState<Array<{ playerName: string; avatar: string; text: string; ts: number }>>([]);
  const seenReactionKeysRef = useRef<Set<string>>(new Set());

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
  useEffect(() => {
    hasAutoAdvancedRef.current = false;
    isShowingDistRef.current = false;
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
    const STATE_ORDER = ['waiting', 'transition', 'question', 'answer-distribution', 'leaderboard', 'final'];
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

        // Add ALL reactions (emoji + text) to feed
        setReactionComments((prev) =>
          [{ playerName: p.name, avatar: p.avatar, text: reactionText, ts: Date.now() }, ...prev].slice(0, 30)
        );
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

  const startQuiz = () => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
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
      <div style={{ background: 'var(--ap-paper)', minHeight: '100vh', fontFamily: 'var(--ap-font-body)', overflow: 'hidden' }} className="p-4 relative">
        <style>{`
          @keyframes floatUpLobby {
            0%   { opacity: 1; transform: translateY(0) scale(1); }
            80%  { opacity: 0.8; }
            100% { opacity: 0; transform: translateY(-200px) scale(1.02); }
          }
          .reaction-float-lobby { animation: floatUpLobby 2.8s ease-out forwards; pointer-events: none; position: absolute; z-index: 50; }
        `}</style>
        {floatingReactions.map((r) => (
          <div key={r.id} className="reaction-float-lobby" style={{ left: `${r.x}%`, bottom: '15%' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
              border: '1.5px solid rgba(255,255,255,0.18)',
              borderRadius: 999, padding: '5px 12px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            }}>
              <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{r.avatar}</span>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: 700, flexShrink: 0, fontFamily: 'var(--ap-font-body)' }}>{r.playerName}</span>
              <span style={{ fontSize: r.isEmoji ? '1.4rem' : '12px', color: '#fff', fontFamily: 'var(--ap-font-body)', overflow: 'hidden', maxWidth: 100 }}>{r.text}</span>
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
                  <button onClick={() => setShowExitDialog(true)} className="ap-btn ap-btn--ghost ap-btn--sm">
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
                    🚀 Lancer le quiz ({players.length} joueurs)
                  </button>
                </div>
              </div>
            </div>
          )}

          <ExitQuizDialog open={showExitDialog} onOpenChange={setShowExitDialog} onConfirm={handleExitQuiz} />

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
                  <span>{players.length} joueur(s) en attente</span>
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
                        <span className="text-sm" style={{ color: 'var(--ap-muted)' }}>{run.players.length} joueur(s) · {run.questionCount} questions</span>
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
      <RaceLeaderboard
        players={players}
        onComplete={nextQuestion}
        isHost={isHost}
        isLastQuestion={currentQuestionIndex >= quiz.questions.length - 1}
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
          <span style={{ fontSize: height >= 140 ? '2rem' : '1.5rem' }}>{medal}</span>
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
          .reaction-float { animation: floatUp 2.8s ease-out forwards; pointer-events: none; position: absolute; }
        `}</style>
        <Fireworks />

        {/* Floating reaction bubbles */}
        {floatingReactions.map((r) => (
          <div key={r.id} className="reaction-float z-20" style={{ left: `${r.x}%`, bottom: '20%' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
              border: '1.5px solid rgba(255,255,255,0.18)',
              borderRadius: 999, padding: '5px 12px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            }}>
              <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{r.avatar}</span>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: 700, flexShrink: 0, fontFamily: 'var(--ap-font-body)' }}>{r.playerName}</span>
              <span style={{ fontSize: r.isEmoji ? '1.4rem' : '12px', color: '#fff', fontFamily: 'var(--ap-font-body)', overflow: 'hidden', maxWidth: 110 }}>{r.text}</span>
            </div>
          </div>
        ))}

        <div className="relative z-10 flex min-h-screen">
          {/* ── Main content ── */}
          <div className="flex-1 flex flex-col overflow-auto px-4 pt-8 text-center">
            {/* Title */}
            <h1
              className="mb-4 flex-shrink-0"
              style={{
                fontFamily: 'var(--ap-font-display)',
                fontSize: 'clamp(2.2rem, 5vw, 3.5rem)',
                fontWeight: 700,
                color: 'var(--ap-ink)',
                letterSpacing: '-1px',
              }}
            >
              Quiz Terminé !
            </h1>

            {/* Players 4+ — scrollable middle zone */}
            {sortedPlayers.length > 3 ? (
              <div className="flex-1 overflow-y-auto space-y-2 mb-6 max-w-lg mx-auto w-full">
                {sortedPlayers.slice(3).map((player, idx) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 px-4 py-2.5"
                    style={{
                      background: 'var(--ap-card)',
                      border: '2px solid var(--ap-line)',
                      borderRadius: 'var(--ap-r-md)',
                      boxShadow: 'var(--ap-shadow-soft)',
                    }}
                  >
                    <span
                      className="text-sm w-5 text-center flex-shrink-0"
                      style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 700, color: 'var(--ap-muted)' }}
                    >
                      {idx + 4}
                    </span>
                    <AvatarDisplay emoji={player.avatar} size="sm" />
                    <span
                      className="flex-1 text-left truncate text-sm"
                      style={{ fontFamily: 'var(--ap-font-body)', fontWeight: 700, color: 'var(--ap-ink)' }}
                    >
                      {player.name}
                    </span>
                    <span
                      className="text-sm flex-shrink-0"
                      style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 700, color: 'var(--ap-ink)' }}
                    >
                      {player.score.toLocaleString()} pts
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1" />
            )}

            {/* Podium — order: 2nd | 1st | 3rd — pinned to bottom */}
            <div className="flex items-end justify-center gap-0 flex-shrink-0">
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
              className="flex-shrink-0"
              style={{ height: 7, background: 'var(--ap-line)', borderRadius: '0 0 10px 10px' }}
            />

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
                Classement · {sortedPlayers.length} joueurs
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

              {/* Live reactions feed */}
              {reactionComments.length > 0 && (
                <div className="flex-shrink-0 mt-3">
                  <div
                    className="uppercase tracking-wider text-xs font-bold mb-2 flex-shrink-0"
                    style={{ color: 'var(--ap-muted)', fontFamily: 'var(--ap-font-display)' }}
                  >
                    Réactions live
                  </div>
                  <div className="space-y-1.5 overflow-y-auto" style={{ maxHeight: '180px' }}>
                    {reactionComments.map((c, i) => (
                      <div
                        key={`${c.playerName}-${c.ts}-${i}`}
                        className="flex items-start gap-1.5 px-2 py-1.5"
                        style={{
                          background: 'var(--ap-paper)',
                          border: '1px solid var(--ap-line)',
                          borderRadius: 'var(--ap-r-sm)',
                        }}
                      >
                        <AvatarDisplay emoji={c.avatar} size="sm" />
                        <div style={{ minWidth: 0 }}>
                          <span
                            className="font-bold text-xs block truncate"
                            style={{ color: 'var(--ap-brand)', fontFamily: 'var(--ap-font-display)' }}
                          >
                            {c.playerName}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--ap-ink)', fontFamily: 'var(--ap-font-body)', wordBreak: 'break-word' }}>
                            {c.text}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};
