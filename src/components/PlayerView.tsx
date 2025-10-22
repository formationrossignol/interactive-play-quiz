import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, Trophy, CheckCircle, XCircle, LogOut } from "lucide-react";
import { MultiStepProgress } from "./MultiStepProgress";
import { BackgroundMusic } from "./BackgroundMusic";
import { ExitQuizDialog } from "./ExitQuizDialog";
import { CircularTimer } from "./CircularTimer";
import { cn } from "@/lib/utils";

interface PlayerViewProps {
  gameCode: string;
  playerName: string;
}

export const PlayerView = ({ gameCode, playerName }: PlayerViewProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const playerAvatar = searchParams.get('avatar') || '🎮';
  const [gameState, setGameState] = useState<'waiting' | 'question' | 'answer-feedback' | 'leaderboard' | 'final'>('waiting');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [playerScore, setPlayerScore] = useState(0);
  const [playerRank, setPlayerRank] = useState(1);
  const [totalPlayers, setTotalPlayers] = useState(5);
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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border border-slate-700/80 bg-slate-900/85 text-slate-100 shadow-2xl">
          <CardContent className="p-8 text-center">
            <div className="text-6xl mb-6 drop-shadow-lg">
              {playerAvatar}
            </div>

            <h1 className="text-2xl font-bold text-white mb-2">Connecté !</h1>
            <div className="text-slate-300 mb-6">
              Bonjour <span className="font-bold text-white">{playerName}</span>
            </div>

            <div className="space-y-4">
              <div className="text-slate-300">
                <div className="text-3xl font-mono tracking-wider font-bold text-white mb-2 drop-shadow">
                  {gameCode}
                </div>
                <p className="text-slate-300">En attente du début du quiz...</p>
              </div>

              <div className="flex items-center justify-center gap-4 text-slate-300">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{totalPlayers} joueurs</span>
                </div>
              </div>
            </div>

            <div className="mt-6 animate-pulse">
              <div className="w-8 h-8 rounded-full mx-auto bg-primary/70 shadow-lg"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (gameState === 'question') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 text-slate-100">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 text-white">
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="border border-slate-700/70 bg-slate-800/80 text-white shadow">
                Question {currentQuestion + 1}
              </Badge>
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
                className="border border-slate-700/70 bg-slate-800/80 text-white hover:bg-slate-700"
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

          {/* Question */}
          <Card className="mb-6 border border-slate-700/70 bg-slate-900/85 shadow-2xl">
            <CardContent className="p-6">
              <div className="flex justify-center mb-6">
                <CircularTimer timeLeft={timeLeft} totalTime={mockQuestion.timeLimit} />
              </div>

              <h2 className="mb-6 text-center text-xl font-bold text-white drop-shadow-lg md:text-2xl">
                {mockQuestion.question}
              </h2>

              {/* Multiple Choice Answers */}
              {mockQuestion.type === 'multiple-choice' && mockQuestion.answers && (
                <div className="grid gap-3">
                  {mockQuestion.answers.map((answer, index) => (
                    <Button
                      key={index}
                      variant={selectedAnswer === index ? "hero" : "quiz"}
                      size="lg"
                      className={cn(
                        "h-16 justify-start p-4 text-left text-lg font-semibold text-white transition-all bg-slate-800/90 hover:bg-slate-700 shadow-xl",
                        hasAnswered && "pointer-events-none opacity-70",
                        selectedAnswer === index && "scale-105 bg-primary/80 ring-4 ring-primary/60"
                      )}
                      onClick={() => submitAnswer(index)}
                      disabled={hasAnswered}
                    >
                      <div className="mr-4 flex h-8 w-8 items-center justify-center rounded-full bg-primary/80 text-sm font-bold text-white shadow-inner">
                        {String.fromCharCode(65 + index)}
                      </div>
                      {answer}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Answer Feedback */}
          {hasAnswered && (
            <Card className={cn(
              "animate-scale-in border-4 shadow-2xl",
              isCorrect
                ? "border-emerald-500/80 bg-emerald-600/20"
                : "border-rose-500/80 bg-rose-600/20"
            )}>
              <CardContent className="p-6 text-center">
                <div className="text-4xl mb-4">
                  {isCorrect ? (
                    <CheckCircle className="mx-auto h-16 w-16 animate-bounce text-emerald-300 drop-shadow-lg" />
                  ) : (
                    <XCircle className="mx-auto h-16 w-16 animate-pulse text-rose-300 drop-shadow-lg" />
                  )}
                </div>
                <h3 className="mb-2 text-2xl font-bold text-white drop-shadow-lg">
                  {isCorrect ? "🎉 Bonne réponse !" : "😔 Mauvaise réponse"}
                </h3>
                {isCorrect && mockQuestion.correctAnswer !== undefined && (
                  <p className="mb-2 text-base font-medium text-white">
                    La bonne réponse était: <span className="font-bold text-emerald-200">{mockQuestion.answers[mockQuestion.correctAnswer]}</span>
                  </p>
                )}
                {!isCorrect && mockQuestion.correctAnswer !== undefined && (
                  <p className="mb-2 text-base font-medium text-white">
                    La bonne réponse était: <span className="rounded bg-slate-900/60 px-2 py-1 font-bold text-emerald-200">{mockQuestion.answers[mockQuestion.correctAnswer]}</span>
                  </p>
                )}
                <p className="mt-3 inline-block rounded-full bg-slate-900/60 px-4 py-2 text-xl font-bold text-white">
                  {isCorrect ? `+${mockQuestion.points} points 🎯` : "0 point"}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  if (gameState === 'leaderboard') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border border-slate-700/70 bg-slate-900/85 text-slate-100 shadow-2xl">
          <CardContent className="p-8 text-center">
            <div className="mb-4 text-6xl drop-shadow-xl animate-bounce">🏆</div>
            <h2 className="mb-6 text-3xl font-bold text-white drop-shadow-lg">Classement</h2>

            <div className="space-y-4 mb-6">
              <div className="rounded-xl border-2 border-yellow-400/50 bg-gradient-to-r from-yellow-500/40 to-orange-500/30 p-5 shadow-lg animate-pulse">
                <div className="mb-2 text-xl font-bold text-white">{playerName}</div>
                <div className="text-lg text-white">
                  <span className="text-2xl font-bold">#{playerRank}</span> • <span className="font-bold text-yellow-200">{playerScore} points</span>
                </div>
              </div>

              <div className="rounded-lg border border-slate-700/70 bg-slate-800/80 p-3 text-base font-medium text-slate-200">
                ⏳ Attendez la prochaine question...
              </div>
            </div>

            <Button
              variant="hero"
              className="text-lg font-bold text-white shadow-lg animate-pulse"
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
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <Card className="max-w-md w-full border border-slate-700/70 bg-slate-900/85 text-slate-100 shadow-2xl">
        <CardContent className="p-8 text-center">
          <div className="mb-4 text-4xl drop-shadow-lg">🎉</div>
          <h2 className="mb-4 text-2xl font-bold text-white">Quiz terminé !</h2>
          <div className="mb-6 text-slate-200">
            Score final: <span className="font-bold text-white">{playerScore} points</span>
          </div>
          <div className="text-slate-300">
            Rang final: #{playerRank} sur {totalPlayers}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};