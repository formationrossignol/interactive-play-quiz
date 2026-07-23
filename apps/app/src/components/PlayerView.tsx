import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { EditableQuestion } from "@/lib/questionTypes";
import { Button } from "@/components/ui/button";
import { Users, LogOut, Zap, Ban, OctagonX, PartyPopper } from "lucide-react";
import { AvatarDisplay } from "./BetterAvatars";
import { MultiStepProgress } from "./MultiStepProgress";
import { AudioControls } from "./AudioControls";
import { useGameAudio } from "@/hooks/useGameAudio";
import { ExitQuizDialog } from "./ExitQuizDialog";
import { TransitionCountdown, CountdownSplash } from "./TransitionTimer";
import { cn } from "@/lib/utils";
import {
  ensureSessionState,
  fetchSessionStateFromSupabase,
  getSessionStorageKey,
  readSessionState,
  subscribeToSessionState,
  submitAnswerToServer,
  upsertPlayerInSession,
  writeSessionState,
  normalizeControl,
  DEFAULT_SESSION_CONTROL,
  type SharedPlayer,
  type SharedGameState,
  type SessionControl,
} from "@/lib/sessionState";
import { supabase } from "@/lib/supabase";
import { getPollOptions } from "@/lib/pollResults";
import { PLAYER_ANSWER_SHAPES as answerShapes } from "@/lib/answerVisuals";

interface PlayerViewProps {
  gameCode: string;
  playerName: string;
}


export const PlayerView = ({ gameCode, playerName }: PlayerViewProps) => {
  const navigate = useNavigate();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerAvatar, setPlayerAvatar] = useState<string>('🎮');
  const [gameState, setGameState] = useState<'waiting' | 'countdown' | 'question-intro' | 'question' | 'answer-feedback' | 'leaderboard' | 'transition' | 'final' | 'abandoned'>('waiting');

  const [ambianceId, setAmbianceId] = useState<string>('arcade');
  // Host-authoritative control state (room lock / global mute / kick list).
  const [control, setControl] = useState<SessionControl>({ ...DEFAULT_SESSION_CONTROL });
  const isKicked = !!playerId && control.kickedIds.includes(playerId);
  const isKickedRef = useRef(false);
  useEffect(() => { isKickedRef.current = isKicked; }, [isKicked]);
  const audio = useGameAudio({ ambianceId, gameState, isHost: false, globalMuted: control.globalMuted });

  // Autoplay policy: unlock on the first user tap anywhere.
  useEffect(() => {
    const onFirst = () => audio.unlock();
    window.addEventListener('pointerdown', onFirst, { once: true });
    return () => window.removeEventListener('pointerdown', onFirst);
  }, [audio]);
  const [allPlayers, setAllPlayers] = useState<{ id: string; name: string; avatar: string; score: number }[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [answerPending, setAnswerPending] = useState(false);
  const [playerScore, setPlayerScore] = useState(0);
  const [playerRank, setPlayerRank] = useState(1);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [transitionTotal, setTransitionTotal] = useState(5);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [lastEarnedPoints, setLastEarnedPoints] = useState(0);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false);
  const [streak, setStreak] = useState(0);
  const [lastAnsweredQuestion, setLastAnsweredQuestion] = useState<EditableQuestion | null>(null);
  // Answer key for lastAnsweredQuestion, as returned by submit-answer for the
  // player's OWN submission of the CURRENT question. liveQuestion itself no
  // longer carries these fields (create-session's stripAnswers scrubs them),
  // so this is the only source for the "La bonne réponse était" reveal text.
  const [answerKey, setAnswerKey] = useState<{
    correctAnswer: unknown;
    correctValue: unknown;
    correctOrder: number[] | null;
    correctMatches: { leftId: string; rightId: string }[] | null;
    blanks: unknown;
  } | null>(null);

  const [quizQuestions, setQuizQuestions] = useState<EditableQuestion[]>([]);
  // Poll mode: no timer, no points, neutral confirmations
  const [isPoll, setIsPoll] = useState(false);
  const [openTextValue, setOpenTextValue] = useState('');

  // Type-specific answer state
  const [rankingOrder, setRankingOrder] = useState<string[]>([]);
  const [blankValues, setBlankValues] = useState<string[]>([]);
  const [sliderValue, setSliderValue] = useState<number>(0);
  const [matchingSelectedLeft, setMatchingSelectedLeft] = useState<string | null>(null);
  const [matchingPairs, setMatchingPairs] = useState<Record<string, string>>({});

  // Reactions (final screen)
  const [reactionComment, setReactionComment] = useState('');
  const [lastSentEmoji, setLastSentEmoji] = useState<string | null>(null);
  const lastEmojiTimeRef = useRef<number>(0);
  const lastCommentTimeRef = useRef<number>(0);
  const totalQuestions = quizQuestions.length || 1;
  const liveQuestion = quizQuestions[currentQuestion] ?? null;

  // Declared before syncFromSession so the callback can reference it without TDZ issues
  const answeredForIndexRef = useRef<number | null>(null);
  // Synchronous guard — useState is stale under rapid clicks within the same render cycle
  const hasAnsweredRef = useRef(false);
  // Tracks whether this player was ever found in session.players (to detect kick)
  const wasSeenInSessionRef = useRef(false);
  // Highest question index for which the player has entered the 'question' phase.
  // Once a question is live for the player, a late/stale event must never drag
  // them back to 'question-intro'/'countdown' for that same index (regression:
  // "answers vanish, only the question shows"). PlayerView has no other ordering
  // guard, unlike the host (QuizSession STATE_ORDER).
  const enteredQuestionIndexRef = useRef<number>(-1);
  const shouldApplyPhase = useCallback((mapped: string, newIndex: number) => {
    // Back to lobby (replay of the same session): clear the guard so the next
    // run's question 0 intro/countdown is not swallowed.
    if (mapped === 'waiting') {
      enteredQuestionIndexRef.current = -1;
      return true;
    }
    if ((mapped === 'question-intro' || mapped === 'countdown') && newIndex === enteredQuestionIndexRef.current) {
      return false;
    }
    return true;
  }, []);

  const syncFromSession = useCallback(() => {
    const session = readSessionState(gameCode);
    setTotalPlayers(session.players.length);
    setControl(normalizeControl(session.control));
    // Map host states to player states (host uses 'answer-distribution', player uses 'answer-feedback')
    const mapped = session.gameState === 'answer-distribution' ? 'answer-feedback' : session.gameState;
    const newIndex = session.currentQuestionIndex ?? 0;
    if (shouldApplyPhase(mapped, newIndex)) {
      if (mapped === 'question') enteredQuestionIndexRef.current = newIndex;
      setGameState((prev) => (prev !== mapped ? mapped : prev));
      if (session.gameState === 'question' || session.gameState === 'question-intro') {
        // Reset answer UI immediately when a new question arrives via storage/realtime event.
        // Without this, the player sees "Réponse envoyée!" for up to 6s (poll throttle + realtime skip).
        if (newIndex !== answeredForIndexRef.current) {
          hasAnsweredRef.current = false;
          setHasAnswered(false);
          setSelectedAnswer(null);
        }
        setCurrentQuestion(newIndex);
        if (session.timeLeft > 0) {
          setTimeLeft(session.timeLeft);
        }
      }
    }

    if (playerId) {
      const player = session.players.find((p) => p.id === playerId);
      if (player) {
        wasSeenInSessionRef.current = true;
        setPlayerScore(player.score ?? 0);
        const sorted = [...session.players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        const index = sorted.findIndex((p) => p.id === playerId);
        setPlayerRank(index >= 0 ? index + 1 : 1);
      }
    }
  }, [gameCode, playerId, shouldApplyPhase]);

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
        setPlayerAvatar(storedPlayer.avatar || '🎮');
        // Don't re-add ourselves if the host already excluded us.
        if (!readSessionState(gameCode).control.kickedIds.includes(storedPlayer.id)) {
          upsertPlayerInSession(gameCode, storedPlayer);
        }
      } catch (error) {
        console.warn('Failed to parse stored player information', error);
      }
    } else {
      // No stored session — reject URL-param spoofing and send through the proper join flow
      navigate(`/join/${gameCode}`, { replace: true });
    }
    // Do NOT call syncFromSession() here — localStorage may be stale from a previous run
    // (e.g. gameState = 'final'). Let the Supabase fetch in the mount effect + 2s polling
    // drive the initial game state instead.
  }, [gameCode, navigate]);

  // Holds the last submitted answer payload so retries can resend it
  // "quiz" entries retry via submit-answer (server-side scoring); "poll" entries
  // retry via the pre-existing direct upsertPlayerInSession path — polls have
  // no session_quiz_answers row for submit-answer to look up (see submitAnswer).
  // (No gameCode field on the quiz variant — every retry closure already reads
  // the outer gameCode prop, which is fixed for the lifetime of this component.)
  const pendingAnswerRef = useRef<
    | { kind: 'quiz'; playerId: string; questionIndex: number; answer: number | string }
    | { kind: 'poll'; player: SharedPlayer; questionIndex: number }
    | null
  >(null);
  // Guards against two scheduled retries (1.5s/4s/9s/18s) overlapping if the
  // first is still in flight when the next timer fires — without this, both
  // could resolve ok and each add earnedPoints to the local playerScore
  // accumulator, double-counting client-side (server-side idempotency
  // protects the DB, but not this display value).
  const retryInFlightRef = useRef(false);

  // Wall-clock end time of the current timed phase (question or transition)
  const timerEndRef = useRef<number | null>(null);
  // Last question index for which we set timerEndRef — prevents mid-question Supabase resyncs
  const lastTimerQuestionRef = useRef<number>(-1);
  // Same guard for transition phase — prevents mid-transition poll from resetting timer to full duration
  const lastTimerTransitionRef = useRef<number>(-1);

  // Tracks when Supabase Realtime last fired — poll skips if realtime is healthy
  const lastRealtimeFireRef = useRef<number>(0);

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
    const channel = subscribeToSessionState(gameCode, (state) => {
      lastRealtimeFireRef.current = Date.now();
      // Set timer directly from realtime payload — poll is throttled 4s after realtime fires,
      // so without this the countdown never starts (or stays at 0) in the normal case.
      if (
        state.gameState === 'question' &&
        state.currentQuestionIndex !== lastTimerQuestionRef.current
      ) {
        timerEndRef.current = Date.now() + state.timeLeft * 1000;
        lastTimerQuestionRef.current = state.currentQuestionIndex;
      }
      if (
        state.gameState === 'transition' &&
        state.currentQuestionIndex !== lastTimerTransitionRef.current
      ) {
        timerEndRef.current = Date.now() + state.timeLeft * 1000;
        lastTimerTransitionRef.current = state.currentQuestionIndex;
        if (state.timeLeft > 0) setTransitionTotal(state.timeLeft);
      }
      syncRef.current();
    });

    return () => {
      window.removeEventListener('storage', handleStorage);
      channel.unsubscribe();
    };
  }, [gameCode]); // stable — only recreated if gameCode changes

  // Poll Supabase directly and update React state — bypasses localStorage chain.
  // Runs every 2s as fallback when realtime is unavailable (e.g. mobile background throttle).
  // Skips the round-trip when Supabase Realtime fired within the last 4s to avoid redundant reads.
  // quiz_data (all questions) is fetched once then excluded from subsequent polls to save bandwidth.
  useEffect(() => {
    let prevUpdatedAt = '';
    let hasQuizData = false;
    // The control column may not be deployed yet — degrade gracefully if so.
    let hasControlColumn = true;

    const poll = async () => {
      // Realtime is healthy — skip this poll tick
      if (Date.now() - lastRealtimeFireRef.current < 4000) return;

      const ctrlCol = hasControlColumn ? ',control' : '';
      const cols = hasQuizData
        ? `game_state,current_question_index,time_left,players${ctrlCol},updated_at`
        : `game_state,current_question_index,time_left,players${ctrlCol},updated_at,quiz_data`;

      const { data: rawData, error } = await supabase
        .from('session_state')
        .select(cols)
        .eq('game_code', gameCode)
        .single();

      // Retry without the control column if it isn't there yet (pre-deploy).
      if (error && hasControlColumn && /control/i.test(error.message)) {
        hasControlColumn = false;
        return;
      }

      if (!rawData) return;
      // Dynamic column list defeats the supabase type parser — cast to a plain row
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = rawData as Record<string, any>;

      // Load quiz questions once when available, then stop requesting quiz_data
      if (data.quiz_data?.questions && Array.isArray(data.quiz_data.questions)) {
        setQuizQuestions((prev) => prev.length === 0 ? data.quiz_data.questions : prev);
        if (data.quiz_data.type === 'poll') setIsPoll(true);
        if (typeof data.quiz_data.ambianceId === 'string') setAmbianceId(data.quiz_data.ambianceId);
        hasQuizData = true;
      }

      // Control state (lock / global mute / kick list) is host-authoritative.
      setControl(normalizeControl(data.control));

      // Skip state sync if nothing changed
      if (data.updated_at === prevUpdatedAt) return;
      prevUpdatedAt = data.updated_at;

      const remoteState = (data.game_state ?? 'waiting') as SharedGameState;
      const players = Array.isArray(data.players) ? (data.players as SharedPlayer[]) : [];

      // Map host game states → player game states
      let mapped: 'waiting' | 'countdown' | 'question-intro' | 'question' | 'answer-feedback' | 'leaderboard' | 'transition' | 'final' | 'abandoned' = 'waiting';
      if (remoteState === 'countdown') mapped = 'countdown';
      else if (remoteState === 'question-intro') mapped = 'question-intro';
      else if (remoteState === 'question') mapped = 'question';
      else if (remoteState === 'leaderboard') mapped = 'leaderboard';
      else if (remoteState === 'final') mapped = 'final';
      else if (remoteState === 'answer-distribution') mapped = 'answer-feedback';
      else if (remoteState === 'transition') mapped = 'transition';
      else if (remoteState === 'abandoned') mapped = 'abandoned';

      // Reset answer state when a NEW question starts (index changed), on either intro or active phase
      const newIndex = data.current_question_index ?? 0;
      // Never regress to intro/countdown for a question the player already started.
      const applyPhase = shouldApplyPhase(mapped, newIndex);
      if (applyPhase) {
        if (mapped === 'question') enteredQuestionIndexRef.current = newIndex;
        if ((mapped === 'question' || mapped === 'question-intro') && newIndex !== answeredForIndexRef.current) {
          hasAnsweredRef.current = false;
          setHasAnswered(false);
          setSelectedAnswer(null);
        }
        setGameState(mapped);
      }

      // Keep a sorted snapshot for leaderboard + final screens
      if (players.length > 0) {
        setAllPlayers(
          [...players]
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
            .map(p => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.score ?? 0 }))
        );
      }

      // Only update totalPlayers when we have data — avoids overwriting with 0 on edge polls
      if (players.length > 0) setTotalPlayers(players.length);

      if (applyPhase && remoteState === 'question-intro') {
        // Show question text; timer not yet running — just update the index.
        setCurrentQuestion(data.current_question_index ?? 0);
      } else if (applyPhase && remoteState === 'question') {
        const newIndex = data.current_question_index ?? 0;
        setCurrentQuestion(newIndex);
        // Set the wall-clock end time only when a NEW question starts.
        // Skipping mid-question resyncs prevents jarring timer jumps.
        if (newIndex !== lastTimerQuestionRef.current) {
          timerEndRef.current = Date.now() + (data.time_left ?? 0) * 1000;
          lastTimerQuestionRef.current = newIndex;
        }
      } else if (remoteState === 'transition') {
        const tIdx = data.current_question_index ?? 0;
        setCurrentQuestion(tIdx);
        // Guard: only set timer on first encounter of this transition index.
        // Re-setting with stale time_left mid-transition (poll-only mode) would jump timer to full duration.
        if (tIdx !== lastTimerTransitionRef.current) {
          const tl = data.time_left ?? 0;
          timerEndRef.current = Date.now() + tl * 1000;
          lastTimerTransitionRef.current = tIdx;
          if (tl > 0) setTransitionTotal(tl);
        }
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
  }, [gameCode, playerId, shouldApplyPhase]);

  // Timer countdown — Date.now()-based interval, no drift, smooth 250ms updates
  useEffect(() => {
    const isActive = (gameState === 'question' && !hasAnswered) || gameState === 'transition';
    if (!isActive) return;
    const interval = setInterval(() => {
      if (timerEndRef.current === null) return;
      const remaining = Math.max(0, Math.ceil((timerEndRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);
    }, 250);
    return () => clearInterval(interval);
  }, [gameState, hasAnswered, currentQuestion]);

  // Heartbeat: signals liveness to host every 5s so disconnects can be detected.
  // Only sent during 'question' — the only phase where the host checks for disconnects.
  useEffect(() => {
    if (!playerId || gameState !== 'question') return;
    const beat = () => {
      if (isKickedRef.current) return; // excluded — stop re-adding ourselves
      const raw = sessionStorage.getItem(`quiz-player-${gameCode}`);
      if (!raw) return;
      try {
        const stored = JSON.parse(raw) as SharedPlayer;
        const updated: SharedPlayer = { ...stored, lastHeartbeat: new Date().toISOString() };
        sessionStorage.setItem(`quiz-player-${gameCode}`, JSON.stringify(updated));
        upsertPlayerInSession(gameCode, updated);
      } catch { /* ignore */ }
    };
    beat();
    const interval = setInterval(beat, 5000);
    return () => clearInterval(interval);
  }, [playerId, gameCode, gameState]);

  // Excluded by the host: purge our stored identity so no effect re-adds us,
  // and remove ourselves from the shared player list immediately.
  useEffect(() => {
    if (!isKicked) return;
    sessionStorage.removeItem(`quiz-player-${gameCode}`);
  }, [isKicked, gameCode]);

  // Retry a failed submit-answer call at 1.5s, 4s, 9s, 18s after initial send.
  // submit-answer is idempotent (same game_code/player_id/question_index
  // returns the already-stored result), so a retry after a late success is safe.
  //
  // answerPending is in the deps (not just hasAnswered) because submitAnswer is
  // now async: hasAnswered flips true (and this effect first runs, seeing a still-
  // empty pendingAnswerRef) BEFORE the initial submitAnswerToServer call settles
  // and populates the ref. Without answerPending here, this effect would never
  // re-run once hasAnswered stops changing, so a failed initial call would never
  // get retried.
  useEffect(() => {
    if (!hasAnswered || !pendingAnswerRef.current) return;
    const { questionIndex } = pendingAnswerRef.current;

    const retry = async () => {
      const pending = pendingAnswerRef.current;
      if (!pending || pending.questionIndex !== questionIndex) return;

      if (pending.kind === 'poll') {
        upsertPlayerInSession(gameCode, pending.player, true);
        return;
      }

      if (retryInFlightRef.current) return;
      retryInFlightRef.current = true;
      try {
        const result = await submitAnswerToServer(gameCode, pending.playerId, pending.questionIndex, pending.answer);
        if (result.ok) {
          setLastAnswerCorrect(result.correct);
          setStreak((s) => (result.correct ? s + 1 : 0));
          audio.playSfx(result.correct ? 'answer-correct' : 'answer-wrong');
          setLastEarnedPoints(result.earnedPoints);
          setPlayerScore((prev) => prev + result.earnedPoints);
          setAnswerKey({
            correctAnswer: result.correctAnswer,
            correctValue: result.correctValue,
            correctOrder: result.correctOrder,
            correctMatches: result.correctMatches,
            blanks: result.blanks,
          });
          // Mirror into sessionStorage, same as the initial call — otherwise a
          // refresh mid-reveal restores the stale "failed" snapshot even
          // though this retry succeeded (see "Restore answer feedback" effect).
          const storedPlayerRaw = sessionStorage.getItem(`quiz-player-${gameCode}`);
          if (storedPlayerRaw) {
            try {
              const storedPlayer = JSON.parse(storedPlayerRaw) as SharedPlayer;
              const updated: SharedPlayer = {
                ...storedPlayer,
                score: storedPlayer.score + result.earnedPoints,
                correctAnswers: (storedPlayer.correctAnswers ?? 0) + (result.correct ? 1 : 0),
                lastAnswerQuestionIndex: pending.questionIndex,
                lastAnswerCorrect: result.correct,
                lastEarnedPoints: result.earnedPoints,
              };
              sessionStorage.setItem(`quiz-player-${gameCode}`, JSON.stringify(updated));
            } catch { /* ignore */ }
          }
          pendingAnswerRef.current = null;
        }
      } finally {
        retryInFlightRef.current = false;
      }
    };

    const t1 = setTimeout(retry, 1500);
    const t2 = setTimeout(retry, 4000);
    const t3 = setTimeout(retry, 9000);
    const t4 = setTimeout(retry, 18000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [hasAnswered, answerPending, gameCode]);

  // Clear pending answer when question changes. Also resets answerPending/
  // answerKey defensively: today a new question can't arrive before the prior
  // submit-answer round trip settles, but that's an implicit assumption about
  // host pacing, not an enforced invariant — without this, a violation of that
  // assumption would leave the player stuck on "Vérification en cours…" (or
  // showing the previous question's answer key) for every subsequent question.
  useEffect(() => {
    pendingAnswerRef.current = null;
    retryInFlightRef.current = false;
    setAnswerPending(false);
    setAnswerKey(null);
  }, [currentQuestion]);

  // Reset type-specific state when question or question data changes
  useEffect(() => {
    if (!liveQuestion) return;
    if (liveQuestion.type === 'ranking') setRankingOrder([...(liveQuestion.items ?? [])]);
    if (liveQuestion.type === 'fill-blank') setBlankValues((liveQuestion.blanks ?? []).map(() => ''));
    if (liveQuestion.type === 'slider') setSliderValue(liveQuestion.min ?? 0);
    if (liveQuestion.type === 'matching') { setMatchingSelectedLeft(null); setMatchingPairs({}); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion, liveQuestion?.type]);

  // Restore answer feedback state after a page refresh
  useEffect(() => {
    if (gameState !== 'answer-feedback') return;
    if (hasAnsweredRef.current) return; // already set this session, no need to restore
    const raw = sessionStorage.getItem(`quiz-player-${gameCode}`);
    if (!raw) return;
    try {
      const stored = JSON.parse(raw) as SharedPlayer;
      if (stored.lastAnswerQuestionIndex !== currentQuestion) return;
      setLastAnswerCorrect(stored.lastAnswerCorrect ?? false);
      setLastEarnedPoints(stored.lastEarnedPoints ?? 0);
      setHasAnswered(true);
      hasAnsweredRef.current = true;
    } catch { /* ignore */ }
  }, [gameState, currentQuestion, gameCode]);

  const handleExitQuiz = () => {
    navigate("/");
  };

  const REACTION_EMOJIS = ['🎉', '🔥', '💯', '👏', '😍', '🤩', '😂', '🎊', '💪', '🤯', '😎', '❤️'];
  const EMOJI_COOLDOWN_MS = 500;
  const COMMENT_COOLDOWN_MS = 5000;

  const sendReaction = (emoji: string, comment?: string) => {
    const now = Date.now();
    if (now - lastEmojiTimeRef.current < EMOJI_COOLDOWN_MS) return;
    if (comment && now - lastCommentTimeRef.current < COMMENT_COOLDOWN_MS) return;
    lastEmojiTimeRef.current = now;
    if (comment) lastCommentTimeRef.current = now;

    const raw = sessionStorage.getItem(`quiz-player-${gameCode}`);
    if (!raw) return;
    try {
      const stored = JSON.parse(raw) as SharedPlayer;
      const updated: SharedPlayer = {
        ...stored,
        lastReaction: {
          emoji,
          comment: comment?.trim().slice(0, 100) || undefined,
          sentAt: new Date().toISOString(),
        },
      };
      sessionStorage.setItem(`quiz-player-${gameCode}`, JSON.stringify(updated));
      upsertPlayerInSession(gameCode, updated, true);
      setLastSentEmoji(emoji);
      setReactionComment('');
      setTimeout(() => setLastSentEmoji(null), 1500);
    } catch { /* ignore */ }
  };

  const submitAnswer = async (answer: number | string) => {
    if (hasAnsweredRef.current || hasAnswered || !liveQuestion) return;
    hasAnsweredRef.current = true;

    setLastAnsweredQuestion(liveQuestion);
    setSelectedAnswer(answer);
    setHasAnswered(true);
    answeredForIndexRef.current = currentQuestion;

    // Polls have no correct answer and never get a session_quiz_answers row —
    // only create-session (called exclusively by the quiz-live host,
    // QuizSession.tsx) populates that table for a game_code. submit-answer is
    // scoped to the quiz-live path only; polls keep the pre-existing direct
    // upsertPlayerInSession client path here, unchanged, to avoid a 404 from
    // an Edge Function that has no row to look up for this game_code.
    if (isPoll) {
      setLastAnswerCorrect(false);
      setLastEarnedPoints(0);
      const storedPlayerRaw = sessionStorage.getItem(`quiz-player-${gameCode}`);
      if (storedPlayerRaw) {
        try {
          const storedPlayer = JSON.parse(storedPlayerRaw) as SharedPlayer;
          const updated: SharedPlayer = {
            ...storedPlayer,
            lastAnswer: typeof answer === 'number' ? answer : answer === 'true' ? 0 : answer === 'false' ? 1 : undefined,
            lastAnswerText:
              typeof answer === 'string' && answer !== 'true' && answer !== 'false' &&
              (liveQuestion.type === 'open-text' || liveQuestion.type === 'short-answer')
                ? String(answer).slice(0, 500)
                : undefined,
            lastAnswerQuestionIndex: currentQuestion,
            lastAnswerCorrect: false,
            lastEarnedPoints: 0,
          };
          sessionStorage.setItem(`quiz-player-${gameCode}`, JSON.stringify(updated));
          pendingAnswerRef.current = { kind: 'poll', player: updated, questionIndex: currentQuestion };
          upsertPlayerInSession(gameCode, updated, true); // urgent — bypasses debounce
        } catch { /* ignore */ }
      }
      return;
    }

    if (!playerId) return;
    setAnswerPending(true);

    try {
      const result = await submitAnswerToServer(gameCode, playerId, currentQuestion, answer);

      setLastAnswerCorrect(result.correct);
      setStreak((s) => (result.correct ? s + 1 : 0));
      audio.playSfx(result.correct ? 'answer-correct' : 'answer-wrong');
      setLastEarnedPoints(result.earnedPoints);
      setPlayerScore((prev) => prev + (result.ok ? result.earnedPoints : 0));
      // Only set answerKey on success — on failure result.correctAnswer etc.
      // are all null (EMPTY_ANSWER_KEY), and rendering that as-is would show
      // a specific, plausible-looking (but fabricated) "correct answer" for
      // several question types instead of leaving the reveal text blank
      // until a retry actually succeeds.
      if (result.ok) {
        setAnswerKey({
          correctAnswer: result.correctAnswer,
          correctValue: result.correctValue,
          correctOrder: result.correctOrder,
          correctMatches: result.correctMatches,
          blanks: result.blanks,
        });
      }

      // Mirror the result into sessionStorage so a page refresh mid-reveal
      // (handled by the "Restore answer feedback" effect below) shows the
      // same correct/points instead of resetting to a blank state.
      const storedPlayerRaw = sessionStorage.getItem(`quiz-player-${gameCode}`);
      if (storedPlayerRaw) {
        try {
          const storedPlayer = JSON.parse(storedPlayerRaw) as SharedPlayer;
          const updated: SharedPlayer = {
            ...storedPlayer,
            score: storedPlayer.score + (result.ok ? result.earnedPoints : 0),
            correctAnswers: (storedPlayer.correctAnswers ?? 0) + (result.correct ? 1 : 0),
            lastAnswerQuestionIndex: currentQuestion,
            lastAnswerCorrect: result.correct,
            lastEarnedPoints: result.earnedPoints,
          };
          sessionStorage.setItem(`quiz-player-${gameCode}`, JSON.stringify(updated));
        } catch { /* ignore */ }
      }

      if (!result.ok) {
        // submitAnswerToServer already logged the error; retry effect below
        // will attempt again.
        pendingAnswerRef.current = { kind: 'quiz', playerId, questionIndex: currentQuestion, answer };
      } else {
        pendingAnswerRef.current = null;
      }
    } catch (err) {
      // submitAnswerToServer is designed to never throw (it catches its own
      // errors and returns { ok: false, ... }), but guard anyway: without
      // this, an unexpected throw here would leave answerPending stuck true
      // forever (nothing else clears it once this function exits early),
      // locking the player on "Vérification en cours…" for every subsequent
      // question too, since the pending state isn't otherwise question-scoped.
      console.error('[submitAnswer unexpected error]', gameCode, err);
      pendingAnswerRef.current = { kind: 'quiz', playerId, questionIndex: currentQuestion, answer };
    } finally {
      setAnswerPending(false);
    }
  };

  // Excluded by the host — takes priority over every game phase.
  if (isKicked) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: 'var(--ap-brand)' }}
      >
        <div className="max-w-md w-full text-center text-white">
          <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'rgba(255,255,255,0.14)', border: '2px solid rgba(255,255,255,0.3)', display: 'grid', placeItems: 'center', margin: '0 auto 20px' }}>
            <Ban style={{ width: 40, height: 40 }} strokeWidth={2} />
          </div>
          <h2 style={{ fontFamily: 'var(--ap-font-display)', fontSize: '1.8rem', fontWeight: 700, marginBottom: 12 }}>
            Vous avez été exclu
          </h2>
          <p style={{ opacity: 0.75, marginBottom: 28, fontFamily: 'var(--ap-font-body)', fontSize: 16 }}>
            L'hôte vous a retiré de la partie.
          </p>
          <button className="ap-btn ap-btn--pill" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '2px solid rgba(255,255,255,0.4)' }} onClick={() => navigate('/')}>
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'abandoned') {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: 'var(--ap-brand)' }}
      >
        <div className="max-w-md w-full text-center text-white">
          <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'rgba(255,255,255,0.14)', border: '2px solid rgba(255,255,255,0.3)', display: 'grid', placeItems: 'center', margin: '0 auto 20px' }}>
            <OctagonX style={{ width: 40, height: 40 }} strokeWidth={2} />
          </div>
          <h2 style={{ fontFamily: 'var(--ap-font-display)', fontSize: '1.8rem', fontWeight: 700, marginBottom: 12 }}>
            Quiz arrêté
          </h2>
          <p style={{ opacity: 0.75, marginBottom: 28, fontFamily: 'var(--ap-font-body)', fontSize: 16 }}>
            L'hôte a mis fin à la session.
          </p>
          <button className="ap-btn ap-btn--pill" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '2px solid rgba(255,255,255,0.4)' }} onClick={() => navigate('/')}>
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

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
              {isPoll ? 'En attente du début du sondage…' : 'En attente du début du quiz…'}
            </p>
            <div className="flex items-center justify-center gap-4" style={{ color: "rgba(255,255,255,0.75)" }}>
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>{totalPlayers} joueur{totalPlayers !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          {/* Reaction panel (lobby) — quiz only, the poll host has no reactions feed */}
          {!isPoll && (
          <div
            className="mt-5"
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: '2px solid rgba(255,255,255,0.2)',
              borderRadius: 'var(--ap-r-xl)',
              padding: '14px',
            }}
          >
            <p style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700, fontSize: '12px', marginBottom: '10px', fontFamily: 'var(--ap-font-body)' }}>
              Envoie une réaction !
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {REACTION_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => sendReaction(e)}
                  style={{
                    fontSize: '1.5rem',
                    background: lastSentEmoji === e ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)',
                    border: '2px solid rgba(255,255,255,0.2)',
                    borderRadius: '10px',
                    padding: '5px 8px',
                    cursor: 'pointer',
                    transition: 'transform 0.1s, background 0.1s',
                    transform: lastSentEmoji === e ? 'scale(1.2)' : 'scale(1)',
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          )}

          <div className="mt-6 animate-pulse">
            <div className="w-8 h-8 rounded-full mx-auto" style={{ background: "rgba(255,255,255,0.3)" }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'countdown') {
    return <CountdownSplash />;
  }

  if (gameState === 'question-intro') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6 gap-8"
        style={{ background: 'var(--ap-brand)' }}
      >
        {liveQuestion ? (
          <>
            <p
              style={{
                fontFamily: 'var(--ap-font-display)',
                fontSize: '0.8rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.55)',
                margin: 0,
              }}
            >
              Question {currentQuestion + 1}
            </p>
            <p
              className="text-center text-white leading-snug"
              style={{
                fontFamily: 'var(--ap-font-display)',
                fontSize: 'clamp(1.3rem, 4vw, 1.9rem)',
                fontWeight: 700,
                maxWidth: 600,
                textShadow: '0 2px 12px rgba(0,0,0,0.3)',
                margin: 0,
              }}
            >
              {liveQuestion.question}
            </p>
            <p
              style={{
                fontFamily: 'var(--ap-font-body)',
                fontSize: '0.9rem',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.6)',
                margin: 0,
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            >
              ⏳ Les réponses arrivent…
            </p>
            <style>{`@keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }`}</style>
          </>
        ) : (
          <p className="text-white text-lg animate-pulse" style={{ fontFamily: 'var(--ap-font-display)' }}>
            Chargement…
          </p>
        )}
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
          <div className="flex items-center gap-2 mb-4 text-white">
            <span style={{ fontWeight: 900, fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
              {isPoll ? '📊 ' : ''}Question {currentQuestion + 1}/{totalQuestions}
            </span>
            {!isPoll && streak >= 2 && (
              <span
                style={{
                  display: "flex", alignItems: "center", gap: 4, fontWeight: 900, fontSize: 12,
                  color: "var(--ap-flash-deep)", background: "var(--ap-flash-soft)",
                  border: "2px solid var(--ap-flash)", borderRadius: 999, padding: "3px 10px",
                }}
                aria-label={`Série de ${streak}`}
              >
                🔥 ×{streak}
              </span>
            )}
            <div style={{ flex: 1 }} />
            {!isPoll && (
              <span
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  fontFamily: "var(--ap-font-mono, var(--ap-font-display))", fontWeight: 800, fontSize: 14,
                  background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.25)",
                  borderRadius: 999, padding: "5px 13px", color: "#fff",
                }}
              >
                <Zap className="w-3.5 h-3.5" style={{ fill: "var(--ap-flash)", color: "var(--ap-flash)" }} />
                {playerScore.toLocaleString('fr-FR')}
              </span>
            )}
            <AudioControls audio={audio} />
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
            {!isPoll && (
              <div
                style={{ height: 8, background: "var(--ap-paper-2)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: 99, overflow: "hidden", marginBottom: 16 }}
                role="timer"
                aria-label={`Temps restant : ${timeLeft} secondes`}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.max(0, Math.min(100, (liveQuestion.timeLimit > 0 ? timeLeft / liveQuestion.timeLimit : 0) * 100))}%`,
                    background: timeLeft <= 5 ? "var(--ap-quiz)" : "var(--ap-brand)",
                    borderRadius: 99,
                    transition: "width .3s linear, background .3s",
                  }}
                />
              </div>
            )}

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
                      `ap-answer ap-answer--solid ap-answer--${(index % 4) + 1}`,
                      selectedAnswer === index && "ap-answer--selected",
                      hasAnswered && selectedAnswer !== index && "ap-answer--dim"
                    )}
                    onClick={() => submitAnswer(index)}
                    disabled={hasAnswered}
                  >
                    <span className="ap-answer__shape">{answerShapes[index % 4]}</span>
                    <span className="ap-answer__text">{answer}</span>
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
                      `ap-answer ap-answer--solid ap-answer--${index + 1}`,
                      selectedAnswer === value && "ap-answer--selected",
                      hasAnswered && selectedAnswer !== value && "ap-answer--dim"
                    )}
                    onClick={() => submitAnswer(value)}
                    disabled={hasAnswered}
                  >
                    <span className="ap-answer__shape">{index === 0 ? 'V' : 'F'}</span>
                    <span className="ap-answer__text">{label}</span>
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
            {/* Slider */}
            {liveQuestion.type === 'slider' && !hasAnswered && (
              <div className="flex flex-col gap-4 px-2">
                <div className="text-center text-white text-3xl font-bold">{sliderValue}</div>
                <input
                  type="range"
                  min={liveQuestion.min ?? 0}
                  max={liveQuestion.max ?? 100}
                  step={liveQuestion.step ?? 1}
                  value={sliderValue}
                  onChange={(e) => setSliderValue(Number(e.target.value))}
                  className="w-full accent-white"
                />
                <div className="flex justify-between text-white/60 text-sm">
                  <span>{liveQuestion.minLabel ?? liveQuestion.min ?? 0}</span>
                  <span>{liveQuestion.maxLabel ?? liveQuestion.max ?? 100}</span>
                </div>
                <button className="ap-btn ap-btn--lg ap-btn--pill" style={{ background: "var(--ap-ink)" }} onClick={() => submitAnswer(sliderValue)}>
                  Valider
                </button>
              </div>
            )}

            {/* Fill in the blank */}
            {liveQuestion.type === 'fill-blank' && !hasAnswered && (
              <form className="flex flex-col gap-3 px-2" onSubmit={(e) => {
                e.preventDefault();
                if (blankValues.some(v => !v.trim())) return;
                submitAnswer(JSON.stringify(blankValues.map(v => v.trim())));
              }}>
                <p className="text-white/80 text-sm text-center" style={{ fontFamily: 'var(--ap-font-body)' }}>
                  {(liveQuestion.text ?? '').split('{{blank}}').map((segment: string, i: number, arr: string[]) => (
                    <span key={i}>
                      {segment}
                      {i < arr.length - 1 && (
                        <input
                          className="inline-block mx-1 rounded-lg border-b-2 border-white bg-white/15 text-white px-2 py-1 text-sm w-24 outline-none focus:border-white/80"
                          value={blankValues[i] ?? ''}
                          onChange={(e) => setBlankValues(prev => { const next = [...prev]; next[i] = e.target.value; return next; })}
                          autoComplete="off"
                        />
                      )}
                    </span>
                  ))}
                </p>
                <button type="submit" className="ap-btn ap-btn--lg ap-btn--pill" style={{ background: "var(--ap-ink)" }}>
                  Valider
                </button>
              </form>
            )}

            {/* Ranking */}
            {liveQuestion.type === 'ranking' && !hasAnswered && (
              <div className="flex flex-col gap-2 px-2">
                {rankingOrder.map((item, idx) => (
                  <div key={item} className="flex items-center gap-3 rounded-xl px-4 py-3 text-white font-bold" style={{ background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.2)' }}>
                    <span className="text-white/50 w-5 text-center text-sm">{idx + 1}</span>
                    <span className="flex-1 text-sm">{item}</span>
                    <div className="flex flex-col gap-1">
                      <button
                        className="text-white/70 hover:text-white disabled:opacity-30 text-xs leading-none"
                        disabled={idx === 0}
                        onClick={() => setRankingOrder(prev => { const next = [...prev]; [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]; return next; })}
                      >▲</button>
                      <button
                        className="text-white/70 hover:text-white disabled:opacity-30 text-xs leading-none"
                        disabled={idx === rankingOrder.length - 1}
                        onClick={() => setRankingOrder(prev => { const next = [...prev]; [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]; return next; })}
                      >▼</button>
                    </div>
                  </div>
                ))}
                <button
                  className="ap-btn ap-btn--lg ap-btn--pill mt-2"
                  style={{ background: "var(--ap-ink)" }}
                  onClick={() => {
                    const originalItems: string[] = liveQuestion.items ?? [];
                    const order = rankingOrder.map(item => originalItems.indexOf(item));
                    submitAnswer(JSON.stringify(order));
                  }}
                >
                  Valider l'ordre
                </button>
              </div>
            )}

            {/* Matching */}
            {liveQuestion.type === 'matching' && !hasAnswered && (() => {
              const left: { id?: string; text?: string }[] = liveQuestion.leftColumn ?? [];
              const right: { id?: string; text?: string }[] = liveQuestion.rightColumn ?? [];
              const paired = Object.keys(matchingPairs);
              const allPaired = left.length > 0 && paired.length === left.length;
              return (
                <div className="flex flex-col gap-3 px-2">
                  <p className="text-white/60 text-xs text-center" style={{ fontFamily: 'var(--ap-font-body)' }}>
                    {matchingSelectedLeft ? 'Choisissez la correspondance →' : 'Sélectionnez un élément de gauche'}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-2">
                      {left.map(l => (
                        <button
                          key={l.id}
                          className={cn(
                            'rounded-xl px-3 py-2 text-sm font-bold text-white text-left border-2 transition-all',
                            matchingSelectedLeft === l.id ? 'border-white bg-white/30' : matchingPairs[l.id] ? 'border-green-400/60 bg-green-500/20' : 'border-white/20 bg-white/10'
                          )}
                          onClick={() => setMatchingSelectedLeft(prev => prev === l.id ? null : l.id)}
                          disabled={!!matchingPairs[l.id]}
                        >
                          {l.text}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-col gap-2">
                      {right.map(r => {
                        const isPaired = Object.values(matchingPairs).includes(r.id);
                        return (
                          <button
                            key={r.id}
                            className={cn(
                              'rounded-xl px-3 py-2 text-sm font-bold text-white text-left border-2 transition-all',
                              isPaired ? 'border-green-400/60 bg-green-500/20' : matchingSelectedLeft ? 'border-white/50 bg-white/15 hover:bg-white/25' : 'border-white/20 bg-white/10 opacity-50'
                            )}
                            disabled={isPaired || !matchingSelectedLeft}
                            onClick={() => {
                              if (!matchingSelectedLeft) return;
                              setMatchingPairs(prev => ({ ...prev, [matchingSelectedLeft]: r.id }));
                              setMatchingSelectedLeft(null);
                            }}
                          >
                            {r.text}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {allPaired && (
                    <button
                      className="ap-btn ap-btn--lg ap-btn--pill mt-2"
                      style={{ background: "var(--ap-ink)" }}
                      onClick={() => submitAnswer(JSON.stringify(matchingPairs))}
                    >
                      Valider les associations
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Poll scales: Likert / frequency / star rating / NPS */}
            {['likert-scale', 'frequency-scale', 'star-rating', 'nps-scale'].includes(liveQuestion.type) && !hasAnswered && (() => {
              const options = getPollOptions(liveQuestion);
              if (options.length === 0) return null;
              if (liveQuestion.type === 'nps-scale') {
                return (
                  <div className="flex flex-col gap-3 px-2">
                    <div className="flex justify-between text-white/60 text-xs font-bold">
                      <span>{liveQuestion.minLabel ?? 'Pas du tout probable'}</span>
                      <span>{liveQuestion.maxLabel ?? 'Très probable'}</span>
                    </div>
                    <div className="grid grid-cols-6 gap-2">
                      {options.map((option, index) => (
                        <button
                          key={index}
                          className="rounded-xl border-2 border-white/25 bg-white/12 py-3 text-white font-bold text-base transition-all hover:bg-white/25"
                          style={{ background: 'rgba(255,255,255,0.12)' }}
                          onClick={() => submitAnswer(index)}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }
              if (liveQuestion.type === 'star-rating') {
                return (
                  <div className="flex justify-center gap-2 px-2 flex-wrap">
                    {options.map((_, index) => (
                      <button
                        key={index}
                        aria-label={`${index + 1} étoile${index > 0 ? 's' : ''}`}
                        className="text-4xl transition-transform hover:scale-125"
                        style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' }}
                        onClick={() => submitAnswer(index)}
                      >
                        ⭐
                      </button>
                    ))}
                  </div>
                );
              }
              // Likert / frequency: vertical option list
              return (
                <div className="flex flex-col gap-2 px-2">
                  {options.map((option, index) => (
                    <button
                      key={index}
                      className="rounded-xl border-2 border-white/25 px-4 py-3 text-white font-bold text-sm text-left transition-all hover:bg-white/25"
                      style={{ background: 'rgba(255,255,255,0.12)' }}
                      onClick={() => submitAnswer(index)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              );
            })()}

            {/* Poll open text */}
            {liveQuestion.type === 'open-text' && !hasAnswered && (
              <form
                className="flex flex-col gap-3 px-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (openTextValue.trim()) {
                    submitAnswer(openTextValue.trim());
                    setOpenTextValue('');
                  }
                }}
              >
                <textarea
                  value={openTextValue}
                  onChange={(e) => setOpenTextValue(e.target.value.slice(0, liveQuestion.maxLength ?? 500))}
                  placeholder="Votre réponse…"
                  rows={4}
                  className="w-full rounded-xl border-2 border-white/30 bg-white/15 p-4 text-white placeholder-white/50 text-base outline-none focus:border-white/60 resize-none"
                />
                <div className="flex justify-between items-center">
                  <span className="text-white/50 text-xs font-bold">
                    {openTextValue.length}/{liveQuestion.maxLength ?? 500}
                  </span>
                  <button
                    type="submit"
                    className="ap-btn ap-btn--pill"
                    style={{ background: "var(--ap-ink)", opacity: openTextValue.trim() ? 1 : 0.5 }}
                    disabled={!openTextValue.trim()}
                  >
                    Envoyer
                  </button>
                </div>
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
              <div className="text-4xl mb-3">{isPoll ? '🙏' : '⏳'}</div>
              <h3 className="ap-h3 text-white">{isPoll ? 'Merci pour votre réponse !' : 'Réponse envoyée !'}</h3>
              <p className="mt-2" style={{ color: "rgba(255,255,255,0.75)", fontFamily: "var(--ap-font-body)", fontSize: "14px" }}>
                {isPoll ? 'En attente de la question suivante…' : 'En attente des autres joueurs…'}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (gameState === 'answer-feedback') {
    // Sourced from the submit-answer response (answerKey), not from
    // lastAnsweredQuestion itself — liveQuestion (and therefore
    // lastAnsweredQuestion, which is a copy of it) no longer carries
    // correctAnswer/correctValue/correctOrder/correctMatches/blanks now that
    // create-session's stripAnswers scrubs them from the public quiz_data.
    // lastAnsweredQuestion is still used below for display-only lookups
    // (answers/items/leftColumn/rightColumn text), which are not scrubbed.
    const correctAnswerText = (() => {
      if (!lastAnsweredQuestion || !answerKey) return '';
      const q = lastAnsweredQuestion;
      if (q.type === 'multiple-choice' || q.type === 'single-choice') {
        const idx = typeof answerKey.correctAnswer === 'number' ? answerKey.correctAnswer : Number(answerKey.correctAnswer);
        return q.answers?.[idx] ?? '';
      }
      if (q.type === 'true-false') {
        return answerKey.correctAnswer === 'true' ? (q.answers?.[0] ?? 'Vrai') : (q.answers?.[1] ?? 'Faux');
      }
      if (q.type === 'short-answer') return String(answerKey.correctAnswer ?? '');
      if (q.type === 'slider') return String(answerKey.correctValue ?? answerKey.correctAnswer ?? '');
      if (q.type === 'fill-blank') return ((answerKey.blanks as { correctAnswer?: string }[]) ?? []).map((b) => b.correctAnswer).join(' / ');
      if (q.type === 'ranking') {
        const items: string[] = q.items ?? [];
        const order: number[] = answerKey.correctOrder ?? [];
        return (order.length ? order.map((i: number) => items[i]).filter(Boolean) : items).join(' → ');
      }
      if (q.type === 'matching') return (answerKey.correctMatches ?? []).map((m) => {
        const l = (q.leftColumn ?? []).find((c) => c.id === m.leftId)?.text ?? m.leftId;
        const r = (q.rightColumn ?? []).find((c) => c.id === m.rightId)?.text ?? m.rightId;
        return `${l} ↔ ${r}`;
      }).join(', ');
      return '';
    })();

    // Relative standing — "Tu es 2ᵉ · 140 pts derrière Camille"
    const ahead = playerRank > 1 ? allPlayers[playerRank - 2] : null;
    const deltaBehind = ahead ? Math.max(0, ahead.score - playerScore) : 0;
    const ordinal = playerRank === 1 ? '1er' : `${playerRank}ᵉ`;

    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: answerPending ? "var(--ap-brand)" : (lastAnswerCorrect ? "var(--ap-pres)" : "var(--ap-quiz-deep)") }}
      >
        <div className="max-w-md w-full text-center">
          {answerPending ? (
            <div className="flex flex-col items-center justify-center text-center">
              <div className="text-6xl mb-4 animate-pulse">⏳</div>
              <div className="text-2xl font-bold text-white">Vérification en cours…</div>
            </div>
          ) : (
            <>
              <div className="text-7xl mb-3 drop-shadow-xl">{lastAnswerCorrect ? '🎉' : '😅'}</div>
              <h2 className="ap-h2 text-white mb-3" style={{ fontSize: 34 }}>
                {lastAnswerCorrect ? 'Bonne réponse !' : 'Pas cette fois !'}
              </h2>

              {/* Points earned pill */}
              <div
                style={{
                  display: 'inline-block',
                  fontFamily: 'var(--ap-font-mono, var(--ap-font-display))', fontWeight: 800, fontSize: 22,
                  color: '#fff', background: 'rgba(255,255,255,0.2)', borderRadius: 999, padding: '6px 20px',
                }}
              >
                {lastAnswerCorrect ? `+ ${lastEarnedPoints.toLocaleString('fr-FR')} pts` : '+ 0 pt'}
              </div>

              {/* Streak */}
              {lastAnswerCorrect && streak >= 2 && (
                <div style={{ marginTop: 12, fontWeight: 900, fontSize: 14, color: '#fff' }}>
                  🔥 Série de {streak}
                </div>
              )}

              {/* Wrong → reveal the right answer */}
              {!lastAnswerCorrect && correctAnswerText && (
                <p className="mt-3" style={{ color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--ap-font-body)', fontWeight: 700 }}>
                  La bonne réponse était{' '}
                  <span className="font-bold text-white">{correctAnswerText}</span> ⭐
                </p>
              )}

              {/* Relative standing */}
              <p className="mt-4" style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 800, fontSize: 14, fontFamily: 'var(--ap-font-body)' }}>
                {playerRank === 1
                  ? 'Tu es en tête 🏆'
                  : ahead
                    ? `Tu es ${ordinal} · ${deltaBehind.toLocaleString('fr-FR')} pts derrière ${ahead.name}`
                    : `Tu es ${ordinal}`}
              </p>

              <p className="mt-3 text-sm" style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--ap-font-body)' }}>
                Total : {playerScore.toLocaleString('fr-FR')} pts · en attente de la suite…
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (gameState === 'transition') {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "var(--ap-brand)" }}
      >
        <TransitionCountdown
          timeLeft={timeLeft}
          total={transitionTotal}
          badge={totalQuestions > 1 ? `Question ${Math.min(currentQuestion + 2, totalQuestions)} / ${totalQuestions}` : undefined}
        />
      </div>
    );
  }

  if (gameState === 'leaderboard') {
    const MEDALS = ['🥇', '🥈', '🥉'];
    const top3 = allPlayers.slice(0, 3);
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "var(--ap-brand)" }}
      >
        <div className="max-w-md w-full text-center">
          <div className="mb-4 text-6xl drop-shadow-xl animate-bounce">🏆</div>
          <h2 className="ap-h2 text-white mb-6">Classement</h2>

          <div className="space-y-4 mb-6">
            {/* Own rank */}
            <div
              className="flex items-center gap-4 p-4 text-white"
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "2px solid rgba(255,255,255,0.35)",
                borderRadius: "var(--ap-r-lg)",
              }}
            >
              <span className="text-2xl" style={{ fontFamily: "var(--ap-font-display)", fontWeight: 600 }}>
                #{playerRank}
              </span>
              <AvatarDisplay emoji={playerAvatar} size="sm" />
              <span className="flex-1 text-left font-bold">{playerName}</span>
              <span className="font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{playerScore} pts</span>
            </div>

            {/* Top 3 */}
            {top3.length > 0 && (
              <div
                className="p-4 space-y-2"
                style={{
                  background: "rgba(255,255,255,0.12)",
                  border: "2px solid rgba(255,255,255,0.2)",
                  borderRadius: "var(--ap-r-lg)",
                }}
              >
                {top3.map((p, i) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 text-white"
                    style={{ opacity: p.id === playerId ? 1 : 0.9 }}
                  >
                    <span className="text-lg w-7">{MEDALS[i]}</span>
                    <AvatarDisplay emoji={p.avatar} size="xs" />
                    <span className="flex-1 text-left text-sm font-bold truncate">
                      {p.name}{p.id === playerId ? ' (toi)' : ''}
                    </span>
                    <span className="text-sm font-bold" style={{ fontVariantNumeric: "tabular-nums", color: "rgba(255,255,255,0.85)" }}>
                      {p.score} pts
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div
              className="p-4 text-sm font-bold"
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
      </div>
    );
  }

  // final state — poll: simple thanks, no podium/scores
  if (isPoll) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "var(--ap-brand)" }}
      >
        <div className="max-w-md w-full text-center text-white">
          <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'rgba(255,255,255,0.14)', border: '2px solid rgba(255,255,255,0.3)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
            <PartyPopper style={{ width: 40, height: 40 }} strokeWidth={2} />
          </div>
          <h2 className="ap-h2 text-white mb-3">Merci d'avoir participé !</h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontFamily: 'var(--ap-font-body)', fontWeight: 700, marginBottom: 28 }}>
            Le sondage est terminé. Vos réponses ont bien été enregistrées.
          </p>
          <button
            className="ap-btn ap-btn--lg ap-btn--pill"
            style={{ background: 'var(--ap-ink)', boxShadow: '0 5px 0 rgba(0,0,0,0.3)' }}
            onClick={() => navigate('/')}
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  const fp1 = allPlayers[0], fp2 = allPlayers[1], fp3 = allPlayers[2];

  return (
    <div
      className="min-h-screen overflow-auto"
      style={{ background: "var(--ap-brand)" }}
    >
      <div className="max-w-sm mx-auto px-4 pt-6 pb-8 text-center">
        {/* Title */}
        <h2
          className="mb-5"
          style={{
            fontFamily: 'var(--ap-font-display)',
            fontSize: '2.4rem',
            fontWeight: 700,
            color: '#fff',
            textShadow: '0 2px 12px rgba(0,0,0,0.3)',
          }}
        >
          🎉 Quiz terminé !
        </h2>

        {/* Player's own score + rank */}
        <div
          className="mb-6 p-4"
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: '2px solid rgba(255,255,255,0.35)',
            borderRadius: 'var(--ap-r-xl)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--ap-font-display)',
              fontSize: '3rem',
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1,
            }}
          >
            {playerScore}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>
            points
          </div>
          <div
            style={{
              fontFamily: 'var(--ap-font-display)',
              fontSize: '1.3rem',
              fontWeight: 700,
              color: '#fff',
              background: playerRank <= 3 ? 'rgba(255,184,0,0.35)' : 'rgba(255,255,255,0.15)',
              padding: '5px 18px',
              borderRadius: '999px',
              display: 'inline-block',
              border: playerRank <= 3 ? '1px solid rgba(255,184,0,0.5)' : '1px solid rgba(255,255,255,0.2)',
            }}
          >
            #{playerRank} / {allPlayers.length || totalPlayers}
          </div>
        </div>

        {/* Podium (when ≥ 2 players in ranking) */}
        {allPlayers.length >= 2 && (
          <>
            <div className="flex items-end justify-center gap-0 mb-0">
              {/* 2nd */}
              {fp2 && (
                <div className="flex flex-col items-center" style={{ flex: '0 0 33%' }}>
                  <AvatarDisplay emoji={fp2.avatar} size="md" />
                  <div
                    style={{
                      width: '100%', height: 90,
                      background: 'linear-gradient(170deg,#E8E8E8,#B8B8B8)',
                      borderRadius: '10px 10px 0 0',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 4px',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
                    }}
                  >
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#444', fontFamily: 'var(--ap-font-display)', lineHeight: 1.1, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                      {fp2.name}
                    </span>
                    <span style={{ fontSize: '1.2rem' }}>🥈</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#555' }}>{fp2.score} pts</span>
                  </div>
                </div>
              )}

              {/* 1st */}
              {fp1 && (
                <div className="flex flex-col items-center" style={{ flex: '0 0 34%' }}>
                  <AvatarDisplay emoji={fp1.avatar} size="lg" />
                  <div
                    style={{
                      width: '100%', height: 130,
                      background: 'linear-gradient(170deg,#FFE566,#FFB800)',
                      borderRadius: '10px 10px 0 0',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 4px',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 -8px 28px rgba(255,184,0,0.45)',
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#7a4000', fontFamily: 'var(--ap-font-display)', lineHeight: 1.1, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                      {fp1.name}
                    </span>
                    <span style={{ fontSize: '1.6rem' }}>🥇</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#7a4000' }}>{fp1.score} pts</span>
                  </div>
                </div>
              )}

              {/* 3rd */}
              {fp3 ? (
                <div className="flex flex-col items-center" style={{ flex: '0 0 33%' }}>
                  <AvatarDisplay emoji={fp3.avatar} size="md" />
                  <div
                    style={{
                      width: '100%', height: 65,
                      background: 'linear-gradient(170deg,#E8A87C,#CD7F32)',
                      borderRadius: '10px 10px 0 0',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 4px',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
                    }}
                  >
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#4a2000', fontFamily: 'var(--ap-font-display)', lineHeight: 1.1, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                      {fp3.name}
                    </span>
                    <span style={{ fontSize: '0.95rem' }}>🥉</span>
                    <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#5a2800' }}>{fp3.score} pts</span>
                  </div>
                </div>
              ) : <div style={{ flex: '0 0 33%' }} />}
            </div>

            {/* Floor */}
            <div
              style={{
                height: 5,
                background: 'rgba(255,255,255,0.18)',
                borderRadius: '0 0 8px 8px',
                marginBottom: 20,
              }}
            />
          </>
        )}

        {/* Rest of ranking (4+) */}
        {allPlayers.length > 3 && (
          <div className="space-y-2 mb-6">
            {allPlayers.slice(3).map((p, idx) => {
              const isMe = p.id === playerId;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2"
                  style={{
                    background: isMe ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                    border: isMe ? '2px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.15)',
                  }}
                >
                  <span
                    className="font-bold text-white/70 text-sm w-5 text-center"
                    style={{ fontFamily: 'var(--ap-font-display)' }}
                  >
                    {idx + 4}
                  </span>
                  <AvatarDisplay emoji={p.avatar} size="sm" />
                  <span className="flex-1 font-bold text-white truncate text-sm text-left">{p.name}</span>
                  <span className="font-bold text-white/80 text-sm">{p.score} pts</span>
                </div>
              );
            })}
          </div>
        )}

        <style>{`.reaction-comment-input::placeholder { color: rgba(255,255,255,0.85); }`}</style>
        {/* Reaction panel */}
        <div
          className="mb-6"
          style={{
            background: 'rgba(255,255,255,0.12)',
            border: '2px solid rgba(255,255,255,0.2)',
            borderRadius: 'var(--ap-r-xl)',
            padding: '16px',
          }}
        >
          <p style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700, fontSize: '13px', marginBottom: '10px', fontFamily: 'var(--ap-font-body)' }}>
            Réagis au quiz !
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {REACTION_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => sendReaction(e, reactionComment || undefined)}
                style={{
                  fontSize: '1.8rem',
                  background: lastSentEmoji === e ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)',
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderRadius: '12px',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  transition: 'transform 0.1s, background 0.1s',
                  transform: lastSentEmoji === e ? 'scale(1.25)' : 'scale(1)',
                }}
              >
                {e}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={reactionComment}
              onChange={(e) => setReactionComment(e.target.value.slice(0, 100))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && reactionComment.trim()) {
                  sendReaction('💬', reactionComment);
                }
              }}
              className="reaction-comment-input"
              placeholder="Laisse un commentaire… (100 car. max)"
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.15)',
                border: '2px solid rgba(255,255,255,0.3)',
                borderRadius: '999px',
                padding: '8px 14px',
                color: '#fff',
                fontSize: '13px',
                fontFamily: 'var(--ap-font-body)',
                outline: 'none',
              }}
            />
            <button
              onClick={() => { if (reactionComment.trim()) sendReaction('💬', reactionComment); }}
              disabled={!reactionComment.trim()}
              style={{
                background: reactionComment.trim() ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                border: '2px solid rgba(255,255,255,0.2)',
                borderRadius: '999px',
                padding: '8px 16px',
                color: '#fff',
                fontWeight: 700,
                fontSize: '13px',
                cursor: reactionComment.trim() ? 'pointer' : 'not-allowed',
                fontFamily: 'var(--ap-font-body)',
              }}
            >
              Envoyer
            </button>
          </div>
        </div>

        <button
          className="ap-btn ap-btn--lg ap-btn--pill"
          style={{ background: 'var(--ap-ink)', boxShadow: '0 5px 0 rgba(0,0,0,0.3)' }}
          onClick={() => navigate('/')}
        >
          Retour à l&apos;accueil
        </button>
      </div>
    </div>
  );
};
