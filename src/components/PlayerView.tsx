import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, Clock, Trophy, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlayerViewProps {
  gameCode: string;
  playerName: string;
}

export const PlayerView = ({ gameCode, playerName }: PlayerViewProps) => {
  const [gameState, setGameState] = useState<'waiting' | 'question' | 'answer-feedback' | 'leaderboard' | 'final'>('waiting');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [playerScore, setPlayerScore] = useState(0);
  const [playerRank, setPlayerRank] = useState(1);
  const [totalPlayers, setTotalPlayers] = useState(5);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

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

  const submitAnswer = (answer: number | string) => {
    if (hasAnswered) return;
    
    setSelectedAnswer(answer);
    setHasAnswered(true);
    
    // Mock scoring logic
    const correct = answer === mockQuestion.correctAnswer;
    setIsCorrect(correct);
    
    if (correct) {
      const speedBonus = Math.floor((timeLeft / mockQuestion.timeLimit) * 50);
      setPlayerScore(prev => prev + mockQuestion.points + speedBonus);
    }
    
    // Show feedback then move to next state
    setTimeout(() => {
      setGameState('leaderboard');
    }, 2000);
  };

  if (gameState === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
        <Card className="bg-white/10 backdrop-blur-lg border-white/20 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-gradient-primary rounded-full mx-auto mb-6 flex items-center justify-center">
              <Users className="w-8 h-8 text-white" />
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
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
              Question {currentQuestion + 1}
            </Badge>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Trophy className="w-4 h-4" />
                <span>{playerScore}</span>
              </div>
              <div className="text-2xl font-bold">
                {timeLeft}s
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="mb-6">
            <Progress 
              value={hasAnswered ? 100 : ((mockQuestion.timeLimit - timeLeft) / mockQuestion.timeLimit) * 100} 
              className="h-2 bg-white/20"
            />
          </div>

          {/* Question */}
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 shadow-glow mb-6">
            <CardContent className="p-6">
              <h2 className="text-xl md:text-2xl font-bold text-white text-center mb-6">
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
                        "h-16 text-left justify-start text-lg p-4 transition-all",
                        hasAnswered && "pointer-events-none",
                        selectedAnswer === index && "ring-2 ring-primary"
                      )}
                      onClick={() => submitAnswer(index)}
                      disabled={hasAnswered}
                    >
                      <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center mr-4 text-sm font-bold">
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
              "bg-white/10 backdrop-blur-lg border-white/20 animate-scale-in",
              isCorrect ? "border-success/50" : "border-destructive/50"
            )}>
              <CardContent className="p-6 text-center">
                <div className="text-4xl mb-4">
                  {isCorrect ? <CheckCircle className="w-12 h-12 text-success mx-auto" /> : <XCircle className="w-12 h-12 text-destructive mx-auto" />}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {isCorrect ? "Bonne réponse !" : "Mauvaise réponse"}
                </h3>
                <p className="text-white/80">
                  {isCorrect ? `+${mockQuestion.points} points` : "0 point"}
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
        <Card className="bg-white/10 backdrop-blur-lg border-white/20 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="text-4xl mb-4">🏆</div>
            <h2 className="text-2xl font-bold text-white mb-6">Classement</h2>
            
            <div className="space-y-4 mb-6">
              <div className="bg-gradient-primary/20 rounded-lg p-4 border border-primary/30">
                <div className="text-white font-bold text-lg mb-1">{playerName}</div>
                <div className="text-white/80">#{playerRank} • {playerScore} points</div>
              </div>
              
              <div className="text-white/60 text-sm">
                Attendez la prochaine question...
              </div>
            </div>

            <Button 
              variant="hero" 
              onClick={() => {
                setGameState('question');
                setHasAnswered(false);
                setSelectedAnswer(null);
                setIsCorrect(null);
                setTimeLeft(30);
                setCurrentQuestion(prev => prev + 1);
              }}
            >
              Prêt pour la suite
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