import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, Trophy, Zap, Crown, Medal, Award } from "lucide-react";
import { cn } from "@/lib/utils";

interface Player {
  id: string;
  name: string;
  score: number;
  correctAnswers: number;
  position: number;
  avatar?: string;
}

interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  question: string;
  answers: string[];
  correctAnswer: number | string;
  timeLimit: number;
  points: number;
}

export const LiveQuiz = () => {
  const [gameState, setGameState] = useState<'waiting' | 'question' | 'results' | 'leaderboard' | 'final'>('waiting');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [players] = useState<Player[]>([
    { id: '1', name: 'Alice', score: 2850, correctAnswers: 8, position: 1 },
    { id: '2', name: 'Bob', score: 2650, correctAnswers: 7, position: 2 },
    { id: '3', name: 'Charlie', score: 2400, correctAnswers: 6, position: 3 },
    { id: '4', name: 'Diana', score: 2200, correctAnswers: 6, position: 4 },
    { id: '5', name: 'Eve', score: 1950, correctAnswers: 5, position: 5 },
  ]);

  const questions: QuizQuestion[] = [
    {
      id: '1',
      type: 'multiple-choice',
      question: 'What is the capital of France?',
      answers: ['London', 'Berlin', 'Paris', 'Madrid'],
      correctAnswer: 2,
      timeLimit: 30,
      points: 100
    },
    {
      id: '2',
      type: 'multiple-choice',
      question: 'Which planet is known as the Red Planet?',
      answers: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
      correctAnswer: 1,
      timeLimit: 30,
      points: 100
    }
  ];

  const currentQuestion = questions[currentQuestionIndex];

  // Timer effect
  useEffect(() => {
    if (gameState === 'question' && timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && gameState === 'question') {
      setGameState('results');
      setShowCorrectAnswer(true);
    }
  }, [timeLeft, gameState]);

  const handleAnswerSelect = (answerIndex: number) => {
    if (gameState === 'question' && selectedAnswer === null) {
      setSelectedAnswer(answerIndex);
      setGameState('results');
      setShowCorrectAnswer(true);
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowCorrectAnswer(false);
      setTimeLeft(questions[currentQuestionIndex + 1].timeLimit);
      setGameState('question');
    } else {
      setGameState('final');
    }
  };

  const startQuiz = () => {
    setGameState('question');
    setTimeLeft(currentQuestion.timeLimit);
  };

  const showLeaderboard = () => {
    setGameState('leaderboard');
  };

  if (gameState === 'waiting') {
    return <WaitingRoom onStart={startQuiz} players={players} />;
  }

  if (gameState === 'leaderboard') {
    return <LeaderboardView players={players} onContinue={() => setGameState('question')} />;
  }

  if (gameState === 'final') {
    return <FinalResults players={players} />;
  }

  return (
    <div className="min-h-screen bg-gradient-hero p-4">
      <div className="max-w-4xl mx-auto">
        {/* Quiz Header */}
        <div className="flex items-center justify-between mb-6 text-white">
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
              Question {currentQuestionIndex + 1} of {questions.length}
            </Badge>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>{players.length} players</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <span className="text-2xl font-bold">{timeLeft}</span>
            </div>
            <Button variant="quiz" onClick={showLeaderboard}>
              <Trophy className="w-4 h-4 mr-2" />
              Leaderboard
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <Progress 
            value={(currentQuestionIndex / questions.length) * 100} 
            className="h-2 bg-white/20"
          />
        </div>

        {/* Question Card */}
        <Card className="bg-white/10 backdrop-blur-lg border-white/20 mb-6 shadow-glow">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                {currentQuestion.question}
              </h2>
              <div className="flex items-center justify-center gap-4 text-white/80">
                <div className="flex items-center gap-1">
                  <Zap className="w-4 h-4" />
                  <span>{currentQuestion.points} points</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{currentQuestion.timeLimit}s</span>
                </div>
              </div>
            </div>

            {/* Answer Options */}
            <div className="grid md:grid-cols-2 gap-4">
              {currentQuestion.answers.map((answer, index) => (
                <Button
                  key={index}
                  variant="quiz"
                  size="lg"
                  className={cn(
                    "h-auto p-6 text-left justify-start text-lg font-semibold transition-all duration-300",
                    selectedAnswer === index && "ring-2 ring-white",
                    showCorrectAnswer && index === currentQuestion.correctAnswer && "bg-success/80 hover:bg-success/80",
                    showCorrectAnswer && selectedAnswer === index && index !== currentQuestion.correctAnswer && "bg-danger/80 hover:bg-danger/80"
                  )}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={gameState === 'results'}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span>{answer}</span>
                  </div>
                </Button>
              ))}
            </div>

            {/* Results Actions */}
            {gameState === 'results' && (
              <div className="text-center mt-8">
                <div className="mb-6">
                  {selectedAnswer === currentQuestion.correctAnswer ? (
                    <div className="text-white">
                      <div className="text-4xl mb-2">🎉</div>
                      <h3 className="text-2xl font-bold text-success">Correct!</h3>
                      <p>You earned {currentQuestion.points} points</p>
                    </div>
                  ) : (
                    <div className="text-white">
                      <div className="text-4xl mb-2">😔</div>
                      <h3 className="text-2xl font-bold text-danger">Incorrect</h3>
                      <p>The correct answer was: {currentQuestion.answers[currentQuestion.correctAnswer as number]}</p>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-4 justify-center">
                  <Button variant="quiz" onClick={showLeaderboard}>
                    View Leaderboard
                  </Button>
                  <Button variant="quiz" onClick={nextQuestion}>
                    {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Final Results'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const WaitingRoom = ({ onStart, players }: { onStart: () => void; players: Player[] }) => {
  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="max-w-2xl mx-auto text-center">
        <Card className="bg-white/10 backdrop-blur-lg border-white/20 shadow-glow">
          <CardContent className="p-8">
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-white mb-4">Geography Quiz</h1>
              <p className="text-white/80 text-lg">Waiting for players to join...</p>
            </div>

            <div className="mb-8">
              <div className="text-6xl font-mono text-white mb-2 tracking-wider">ABC123</div>
              <p className="text-white/60">Game Code</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
              {players.map((player) => (
                <div key={player.id} className="bg-white/20 rounded-lg p-3 text-white text-sm">
                  {player.name}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-2 mb-6 text-white/80">
              <Users className="w-5 h-5" />
              <span>{players.length} players joined</span>
            </div>

            <Button variant="hero" size="lg" onClick={onStart} className="px-12">
              Start Quiz
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const LeaderboardView = ({ players, onContinue }: { players: Player[]; onContinue: () => void }) => {
  return (
    <div className="min-h-screen bg-gradient-hero p-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-4 animate-fade-in">🏆 Leaderboard</h1>
          <p className="text-white/80 text-lg">Current standings</p>
        </div>

        <div className="space-y-4 mb-8">
          {players.map((player, index) => (
            <Card 
              key={player.id} 
              className={cn(
                "bg-white/10 backdrop-blur-lg border-white/20 transition-all duration-500 animate-slide-up",
                index === 0 && "bg-gradient-primary/20 border-yellow-400/30 shadow-glow",
                index === 1 && "bg-white/15",
                index === 2 && "bg-white/12"
              )}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg",
                      index === 0 && "bg-yellow-500",
                      index === 1 && "bg-gray-400", 
                      index === 2 && "bg-amber-600",
                      index > 2 && "bg-white/20"
                    )}>
                      {index === 0 ? <Crown className="w-6 h-6" /> :
                       index === 1 ? <Medal className="w-6 h-6" /> :
                       index === 2 ? <Award className="w-6 h-6" /> :
                       player.position}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{player.name}</h3>
                      <p className="text-white/60">{player.correctAnswers} correct answers</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">{player.score.toLocaleString()}</div>
                    <div className="text-white/60 text-sm">points</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Button variant="hero" size="lg" onClick={onContinue} className="px-12">
            Continue Quiz
          </Button>
        </div>
      </div>
    </div>
  );
};

const FinalResults = ({ players }: { players: Player[] }) => {
  const winner = players[0];

  return (
    <div className="min-h-screen bg-gradient-hero p-4 relative overflow-hidden">
      {/* Confetti Animation */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-yellow-400 animate-confetti"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 2}s`
            }}
          />
        ))}
      </div>

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <div className="mb-12 animate-fade-in">
          <div className="text-8xl mb-4">🏆</div>
          <h1 className="text-6xl font-bold text-white mb-4">Quiz Complete!</h1>
          <p className="text-2xl text-white/80 mb-8">Congratulations to our winner!</p>
        </div>

        {/* Winner Spotlight */}
        <Card className="bg-gradient-primary/30 backdrop-blur-lg border-yellow-400/30 shadow-glow mb-8 animate-scale-bounce">
          <CardContent className="p-8">
            <div className="flex items-center justify-center gap-6">
              <div className="w-20 h-20 bg-yellow-500 rounded-full flex items-center justify-center">
                <Crown className="w-10 h-10 text-white" />
              </div>
              <div>
                <h2 className="text-4xl font-bold text-white mb-2">{winner.name}</h2>
                <div className="text-2xl text-yellow-400 font-bold">{winner.score.toLocaleString()} points</div>
                <div className="text-white/80">{winner.correctAnswers} correct answers</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top 3 Podium */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {players.slice(0, 3).map((player, index) => (
            <Card 
              key={player.id}
              className={cn(
                "bg-white/10 backdrop-blur-lg border-white/20",
                index === 0 && "bg-yellow-500/20 border-yellow-400/30",
                index === 1 && "bg-gray-400/20 border-gray-300/30",
                index === 2 && "bg-amber-600/20 border-amber-500/30"
              )}
            >
              <CardContent className="p-6 text-center">
                <div className={cn(
                  "w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center text-white font-bold",
                  index === 0 && "bg-yellow-500",
                  index === 1 && "bg-gray-400",
                  index === 2 && "bg-amber-600"
                )}>
                  {index + 1}
                </div>
                <h3 className="text-xl font-bold text-white mb-1">{player.name}</h3>
                <div className="text-lg text-white/80">{player.score.toLocaleString()}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-4 justify-center">
          <Button variant="hero" size="lg" onClick={() => window.location.reload()}>
            Play Again
          </Button>
          <Button variant="quiz" size="lg">
            View Detailed Results
          </Button>
        </div>
      </div>
    </div>
  );
};