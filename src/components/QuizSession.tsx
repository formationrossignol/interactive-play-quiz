import { useState, useEffect, useMemo, useCallback } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import { DEFAULT_THEME_ID, THEMES } from "@/lib/themes";
import { hexToRgba } from "@/lib/color";
import {
  ensureSessionState,
  ensureSessionInSupabase,
  getSessionStorageKey,
  patchSessionState,
  readSessionState,
  subscribeToSessionState,
  type SharedPlayer,
} from "@/lib/sessionState";

interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  previousScore?: number;
  correctAnswers: number;
  joinedAt: Date;
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

export const QuizSession = ({ quiz, isHost = false }: QuizSessionProps) => {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  
  const [gameState, setGameState] = useState<'waiting' | 'transition' | 'question' | 'answer-distribution' | 'leaderboard' | 'final'>('waiting');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [answerDistribution, setAnswerDistribution] = useState<number[]>([]);
  const [sessionStats, setSessionStats] = useState({
    totalPlayers: 0,
    averageScore: 0,
    questionsAnswered: 0,
    duration: 0
  });

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
  }), []);

  const syncFromStorage = useCallback(() => {
    const session = readSessionState(quiz.gameCode);
    const mappedPlayers = session.players.map(normalizeSharedPlayer);
    setPlayers(mappedPlayers);

    if (session.gameState && session.gameState !== gameState) {
      setGameState(session.gameState);
    }

    if (
      typeof session.currentQuestionIndex === 'number' &&
      session.currentQuestionIndex !== currentQuestionIndex &&
      session.currentQuestionIndex >= 0 &&
      session.currentQuestionIndex < quiz.questions.length
    ) {
      setCurrentQuestionIndex(session.currentQuestionIndex);
      const nextQuestion = quiz.questions[session.currentQuestionIndex];
      if (nextQuestion?.timeLimit) {
        setTimeLeft(nextQuestion.timeLimit);
      }
    }

    if (gameState === 'question') {
      setTimeLeft(session.timeLeft);
    }

    setHasSyncedPlayers(true);
  }, [gameState, currentQuestionIndex, normalizeSharedPlayer, quiz.gameCode, quiz.questions]);

  useEffect(() => {
    ensureSessionState(quiz.gameCode);
    ensureSessionInSupabase(quiz.gameCode);
    syncFromStorage();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === getSessionStorageKey(quiz.gameCode)) {
        syncFromStorage();
      }
    };

    window.addEventListener('storage', handleStorage);
    // Host only syncs player list from Supabase — NOT game state.
    // Subscribing to game state creates a write→event→sync→write feedback loop
    // because the host's own patchSessionState calls trigger the subscription.
    const channel = subscribeToSessionState(quiz.gameCode, (state) => {
      const mappedPlayers = state.players.map(normalizeSharedPlayer);
      setPlayers(mappedPlayers);
    });

    return () => {
      window.removeEventListener('storage', handleStorage);
      channel.unsubscribe();
    };
  }, [quiz.gameCode, syncFromStorage, normalizeSharedPlayer]);

  useEffect(() => {
    if (!isHost || !hasSyncedPlayers) {
      return;
    }

    const playersForStorage: SharedPlayer[] = players.map((player) => ({
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      score: player.score,
      correctAnswers: player.correctAnswers,
      previousScore: player.previousScore,
      joinedAt: player.joinedAt.toISOString(),
    }));

    patchSessionState(quiz.gameCode, { players: playersForStorage });
  }, [hasSyncedPlayers, isHost, players, quiz.gameCode]);

  // Timer effect for questions
  useEffect(() => {
    if (gameState === 'question' && timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (gameState === 'question' && timeLeft === 0) {
      // Auto-advance when timer reaches 0
      showAnswerDistribution();
    }
  }, [gameState, timeLeft]);

  useEffect(() => {
    if (!isHost || gameState !== 'question') {
      return;
    }

    patchSessionState(quiz.gameCode, {
      timeLeft,
    });
  }, [gameState, isHost, quiz.gameCode, timeLeft]);

  // Check if all players have answered
  useEffect(() => {
    if (gameState === 'question') {
      // In a real app, track answered players
      // For demo: simulate checking if all answered
      // If all answered, skip timer
      const checkAllAnswered = () => {
        // This would be connected to real player answers
        // For now, this is a placeholder for the logic
      };
      checkAllAnswered();
    }
  }, [gameState, players]);

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
    console.log('Start quiz clicked! Players:', players.length, 'Current game state:', gameState);
    setGameState('question');
    setTimeLeft(currentQuestion.timeLimit);
    console.log('Game state changed to: question', 'Timer set to:', currentQuestion.timeLimit);
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
    setCurrentQuestionIndex(prev => prev + 1);
    setGameState('question');
    setTimeLeft(quiz.questions[currentQuestionIndex + 1].timeLimit);
    if (isHost) {
      patchSessionState(quiz.gameCode, {
        gameState: 'question',
        currentQuestionIndex: currentQuestionIndex + 1,
        timeLeft: quiz.questions[currentQuestionIndex + 1].timeLimit,
      });
    }
  };

  const showAnswerDistribution = () => {
    // Mock answer distribution (in real app this would come from actual answers)
    const mockDistribution = currentQuestion.answers
      ? currentQuestion.answers.map(() => Math.floor(Math.random() * 50))
      : [];
    setAnswerDistribution(mockDistribution);
    setGameState('answer-distribution');
    if (isHost) {
      patchSessionState(quiz.gameCode, {
        gameState: 'answer-distribution',
        currentQuestionIndex,
      });
    }
  };

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

          <div className="grid gap-6 lg:grid-cols-3">
            {/* QR Code & Join Info */}
            <div className="space-y-4 lg:col-span-1">
              <QRCodeGenerator gameCode={quiz.gameCode} joinUrl={joinUrl} />
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
                        <div className="text-2xl">
                          {player.avatar}
                        </div>
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
    return (
      <ThemedBackground className="p-4 text-slate-100">
        <div className="mx-auto max-w-4xl">
          {/* Quiz Header */}
          <div className="flex items-center justify-between mb-6 text-white">
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="border border-white/20 bg-black/40 text-white shadow">
                Question {currentQuestionIndex + 1} / {quiz.questions.length}
              </Badge>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>{players.length} joueurs</span>
              </div>
            </div>

            {isHost && (
              <div className="flex gap-2">
                <BackgroundMusic isPlaying={gameState === 'question'} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowExitDialog(true)}
                  className="border-white/30 bg-black/40 text-slate-100 backdrop-blur hover:bg-black/60"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Quitter
                </Button>
                <Button variant="quiz" onClick={showAnswerDistribution}>
                  Afficher les résultats
                </Button>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <MultiStepProgress 
              totalSteps={quiz.questions.length}
              currentStep={currentQuestionIndex}
              className="h-3"
            />
          </div>
          
          <ExitQuizDialog 
            open={showExitDialog}
            onOpenChange={setShowExitDialog}
            onConfirm={handleExitQuiz}
          />

          {/* Dynamic Question Component */}
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

          {/* Standard Question Types */}
          {['multiple-choice', 'single-choice', 'true-false', 'short-answer'].includes(currentQuestion.type) && (
            <Card className="border border-white/10 bg-black/40 shadow-2xl backdrop-blur">
              <CardContent className="p-8">
                <div className="mb-8 text-center">
                  {questionImage && (
                    <div className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-xl">
                      <img
                        src={questionImage}
                        alt={currentQuestion.question}
                        className="max-h-72 w-full object-cover"
                      />
                    </div>
                  )}

                  <h2 className="mb-6 text-3xl font-bold text-white drop-shadow-lg md:text-4xl">
                    {currentQuestion.question}
                  </h2>

                  <div className="flex items-center justify-center gap-6 mb-6">
                    <CircularTimer timeLeft={timeLeft} totalTime={currentQuestion.timeLimit} />
                    <div className="text-white">
                      <div className="mb-2 flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-4 py-2 backdrop-blur-sm">
                        <Trophy className="w-5 h-5 text-yellow-300" />
                        <span className="text-xl font-bold">{currentQuestion.points} points</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Multiple Choice */}
                {['multiple-choice', 'single-choice'].includes(currentQuestion.type) && currentQuestion.answers && (
                  <div className="mx-auto grid max-w-2xl gap-4 md:grid-cols-2">
                    {currentQuestion.answers.map((answer, index) => (
                      <Button
                        key={index}
                        variant="quiz"
                        size="lg"
                        className="h-20 p-6 text-lg font-semibold text-white transition-transform border border-white/10 bg-black/40 backdrop-blur hover:scale-105 hover:bg-black/60 shadow-xl"
                        onClick={() => console.log('Answer:', index)}
                      >
                        <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary/80 text-sm font-bold text-white shadow-inner">
                          {String.fromCharCode(65 + index)}
                        </div>
                        {answer}
                      </Button>
                    ))}
                  </div>
                )}

                {/* True/False */}
                {currentQuestion.type === 'true-false' && (
                  <div className="mx-auto flex max-w-md gap-4 justify-center">
                    <Button
                      variant="quiz"
                      size="lg"
                      className="flex-1 h-20 border-2 border-emerald-400/60 bg-emerald-600/40 text-xl font-bold text-white shadow-xl transition-transform hover:scale-105 hover:bg-emerald-500/60"
                      onClick={() => console.log('Answer: true')}
                    >
                      ✓ Vrai
                    </Button>
                    <Button
                      variant="quiz"
                      size="lg"
                      className="flex-1 h-20 border-2 border-rose-400/60 bg-rose-600/40 text-xl font-bold text-white shadow-xl transition-transform hover:scale-105 hover:bg-rose-500/60"
                      onClick={() => console.log('Answer: false')}
                    >
                      ✗ Faux
                    </Button>
                  </div>
                )}

                {/* Short Answer */}
                {currentQuestion.type === 'short-answer' && (
                  <div className="mx-auto max-w-md">
                    <div className="mb-4 rounded-lg border border-white/10 bg-black/30 p-4 backdrop-blur">
                      <input
                        type="text"
                        placeholder="Tapez votre réponse..."
                        className="w-full border-none bg-transparent text-center text-xl text-white outline-none placeholder:text-slate-300"
                        maxLength={100}
                        onKeyPress={(e) => e.key === 'Enter' && console.log('Answer:', e.currentTarget.value)}
                      />
                    </div>
                    <Button
                      variant="hero"
                      size="lg"
                      className="w-full"
                      onClick={() => console.log('Submit answer')}
                    >
                      Envoyer la réponse
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
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
        />
      </ThemedBackground>
    );
  }

  if (gameState === 'final') {
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];

    return (
      <ThemedBackground className="overflow-hidden p-4 text-slate-100">
        {/* Confetti Animation */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 80 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 rounded-full animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                backgroundColor: ['#fbbf24', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'][Math.floor(Math.random() * 5)],
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="mb-8 animate-scale-in">
            <div className="mb-4 text-8xl drop-shadow-2xl animate-bounce">🎉</div>
            <h1 className="mb-6 text-6xl font-bold text-white drop-shadow-2xl md:text-7xl">
              Quiz Terminé !
            </h1>
            {winner && (
              <div className="mb-8 rounded-2xl border-2 border-yellow-400/50 bg-gradient-to-r from-yellow-500/45 to-orange-500/35 p-10 shadow-2xl backdrop-blur-xl animate-pulse">
                <div className="mb-4 text-6xl drop-shadow-xl animate-bounce">👑</div>
                <h2 className="mb-3 text-4xl font-bold text-white drop-shadow-lg">Félicitations</h2>
                <div className="text-3xl font-bold text-white drop-shadow-lg">{winner.name}</div>
                <div className="mt-2 text-xl font-semibold text-white">
                  {winner.score} points 🎯 • {winner.correctAnswers} bonnes réponses ✅
                </div>
              </div>
            )}
          </div>

          <div className="mb-8 grid gap-6 md:grid-cols-3">
            {sortedPlayers.slice(0, 3).map((player, index) => (
              <Card key={player.id} className={cn(
                "transform border border-white/10 bg-black/35 backdrop-blur-xl shadow-xl transition-all hover:scale-105",
                index === 0 && "border-yellow-400/60 bg-yellow-500/25",
                index === 1 && "border-slate-300/60 bg-slate-400/20",
                index === 2 && "border-orange-400/60 bg-orange-500/25"
              )}>
                <CardContent className="p-8 text-center">
                  <div className="mb-3 text-5xl drop-shadow">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                  </div>
                  <div className="mb-2 text-2xl font-bold text-white drop-shadow-lg">{player.name}</div>
                  <div className="text-lg font-semibold text-white">{player.score} points</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {isHost && (
            <div className="flex justify-center gap-4">
              <Button
                variant="outline"
                onClick={exportResults}
                className="border-white/30 bg-black/40 text-lg font-bold text-slate-100 shadow-xl backdrop-blur hover:bg-black/60"
              >
                <Download className="w-5 h-5 mr-2" />
                Exporter les résultats
              </Button>
              <Button variant="hero" onClick={() => window.location.href = '/'} className="text-lg font-bold shadow-xl">
                🎮 Nouveau Quiz
              </Button>
            </div>
          )}
        </div>
      </ThemedBackground>
    );
  }

  return null;
};
