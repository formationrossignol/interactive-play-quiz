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
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
        <Card className="bg-white/10 backdrop-blur-lg border-white/20 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="text-6xl mb-6">
              {playerAvatar}
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-2">Connecté !</h1>
            <div className="text-white/80 mb-6">
              Bonjour <span className="font-bold text-white">{playerName}</span>
            </div>
            
            <div className="space-y-4">
              <div className="text-white/60">
                <div className="text-3xl font-mono tracking-wider font-bold text-white mb-2">
                  {gameCode}
                </div>
                <p>En attente du début du quiz...</p>
              </div>
              
              <div className="flex items-center justify-center gap-4 text-white/60">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{totalPlayers} joueurs</span>
                </div>
              </div>
            </div>
            
            <div className="mt-6 animate-pulse">
              <div className="w-8 h-8 bg-primary/30 rounded-full mx-auto"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (gameState === 'question') {
    return (
      <div className="min-h-screen bg-gradient-hero p-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 text-white">
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                Question {currentQuestion + 1}
              </Badge>
              <div className="flex items-center gap-1">
                <Trophy className="w-4 h-4" />
                <span>{playerScore}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BackgroundMusic isPlaying={gameState === 'question'} />
              <Button variant="ghost" size="sm" onClick={() => setShowExitDialog(true)} className="bg-white/10 hover:bg-white/20 text-white">
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
          <Card className="bg-white/30 backdrop-blur-xl border-white/40 shadow-2xl mb-6">
            <CardContent className="p-6">
              <div className="flex justify-center mb-6">
                <CircularTimer timeLeft={timeLeft} totalTime={mockQuestion.timeLimit} />
              </div>
              
              <h2 className="text-xl md:text-2xl font-bold text-white text-center mb-6 drop-shadow-lg">
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
                        "h-16 text-left justify-start text-lg p-4 transition-all bg-white/30 hover:bg-white/40 text-white font-semibold shadow-lg",
                        hasAnswered && "pointer-events-none opacity-70",
                        selectedAnswer === index && "ring-4 ring-white/50 bg-white/50 scale-105"
                      )}
                      onClick={() => submitAnswer(index)}
                      disabled={hasAnswered}
                    >
                      <div className="w-8 h-8 bg-white/40 rounded-full flex items-center justify-center mr-4 text-sm font-bold backdrop-blur-sm">
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
              "bg-white/30 backdrop-blur-xl animate-scale-in shadow-2xl border-4",
              isCorrect ? "border-green-400/80 bg-green-500/20" : "border-red-400/80 bg-red-500/20"
            )}>
              <CardContent className="p-6 text-center">
                <div className="text-4xl mb-4">
                  {isCorrect ? (
                    <CheckCircle className="w-16 h-16 text-green-300 mx-auto animate-bounce drop-shadow-lg" />
                  ) : (
                    <XCircle className="w-16 h-16 text-red-300 mx-auto animate-pulse drop-shadow-lg" />
                  )}
                </div>
                <h3 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">
                  {isCorrect ? "🎉 Bonne réponse !" : "😔 Mauvaise réponse"}
                </h3>
                {isCorrect && mockQuestion.correctAnswer !== undefined && (
                  <p className="text-white text-base mb-2 font-medium">
                    La bonne réponse était: <span className="font-bold text-green-200">{mockQuestion.answers[mockQuestion.correctAnswer]}</span>
                  </p>
                )}
                {!isCorrect && mockQuestion.correctAnswer !== undefined && (
                  <p className="text-white text-base mb-2 font-medium">
                    La bonne réponse était: <span className="font-bold text-green-300 bg-green-900/30 px-2 py-1 rounded">{mockQuestion.answers[mockQuestion.correctAnswer]}</span>
                  </p>
                )}
                <p className="text-white text-xl font-bold mt-3 bg-white/20 inline-block px-4 py-2 rounded-full">
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
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
        <Card className="bg-white/30 backdrop-blur-xl border-white/40 max-w-md w-full shadow-2xl">
          <CardContent className="p-8 text-center">
            <div className="text-6xl mb-4 animate-bounce">🏆</div>
            <h2 className="text-3xl font-bold text-white mb-6 drop-shadow-lg">Classement</h2>
            
            <div className="space-y-4 mb-6">
              <div className="bg-gradient-to-r from-yellow-500/30 to-orange-500/30 rounded-xl p-5 border-2 border-yellow-400/50 backdrop-blur-sm shadow-lg animate-pulse">
                <div className="text-white font-bold text-xl mb-2">{playerName}</div>
                <div className="text-white text-lg">
                  <span className="font-bold text-2xl">#{playerRank}</span> • <span className="font-bold text-yellow-200">{playerScore} points</span>
                </div>
              </div>
              
              <div className="text-white text-base font-medium bg-white/20 rounded-lg p-3 backdrop-blur-sm">
                ⏳ Attendez la prochaine question...
              </div>
            </div>

            <Button 
              variant="hero" 
              className="text-lg font-bold shadow-lg animate-pulse"
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
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <Card className="bg-white/10 backdrop-blur-lg border-white/20 max-w-md w-full">
        <CardContent className="p-8 text-center">
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-white mb-4">Quiz terminé !</h2>
          <div className="text-white/80 mb-6">
            Score final: <span className="font-bold text-white">{playerScore} points</span>
          </div>
          <div className="text-white/60">
            Rang final: #{playerRank} sur {totalPlayers}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};