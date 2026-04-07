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

  const answerColors = [
    'bg-rose-500 hover:bg-rose-600',
    'bg-blue-500 hover:bg-blue-600',
    'bg-amber-500 hover:bg-amber-600',
    'bg-emerald-500 hover:bg-emerald-600',
  ];

  return (
    <div className="min-h-screen bg-indigo-600 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Quiz Header */}
        <div className="flex items-center justify-between mb-6 text-white">
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="bg-white/15 text-white border-0">
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
        <Card className="rounded-2xl bg-white shadow-2xl mb-6">
          <CardContent className="p-6 md:p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                {currentQuestion.question}
              </h2>
              <div className="flex items-center justify-center gap-4 text-slate-500">
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
                <button
                  key={index}
                  className={cn(
                    "cursor-pointer min-h-[56px] rounded-xl p-4 text-left text-white font-semibold text-sm transition-all duration-150",
                    answerColors[index % answerColors.length],
                    selectedAnswer === index && "ring-4 ring-white ring-offset-2",
                    showCorrectAnswer && index === currentQuestion.correctAnswer && "ring-4 ring-white ring-offset-2",
                    gameState === 'results' && "cursor-default"
                  )}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={gameState === 'results'}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span>{answer}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Results Actions */}
            {gameState === 'results' && (
              <div className="text-center mt-8">
                <div className="mb-6">
                  {selectedAnswer === currentQuestion.correctAnswer ? (
                    <div className="text-slate-900">
                      <div className="text-4xl mb-2">🎉</div>
                      <h3 className="text-2xl font-bold text-emerald-600">Correct!</h3>
                      <p className="text-slate-600">You earned {currentQuestion.points} points</p>
                    </div>
                  ) : (
                    <div className="text-slate-900">
                      <div className="text-4xl mb-2">😔</div>
                      <h3 className="text-2xl font-bold text-rose-600">Incorrect</h3>
                      <p className="text-slate-600">The correct answer was: {currentQuestion.answers[currentQuestion.correctAnswer as number]}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-4 justify-center">
                  <Button variant="quiz" onClick={showLeaderboard}>
                    View Leaderboard
                  </Button>
                  <Button className="bg-white text-indigo-600 font-bold hover:bg-indigo-50 rounded-full h-12 px-6" onClick={nextQuestion}>
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
    <div className="min-h-screen bg-indigo-600 flex items-center justify-center p-4">
      <div className="max-w-2xl mx-auto text-center">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-white mb-4 drop-shadow-lg">Geography Quiz</h1>
          <p className="text-indigo-200 text-xl font-medium">En attente des joueurs...</p>
        </div>

        <div className="mb-8 bg-white/10 border border-white/20 rounded-2xl p-6">
          <div className="text-7xl font-mono text-white mb-2 tracking-wider font-bold drop-shadow-lg animate-pulse">ABC123</div>
          <p className="text-indigo-200 text-lg font-semibold">Code du jeu</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
          {players.map((player) => (
            <div key={player.id} className="bg-white/10 border border-white/20 rounded-xl p-4 text-white text-base font-semibold animate-fade-in">
              {player.avatar} {player.name}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 mb-6 text-indigo-200 text-lg font-medium">
          <Users className="w-6 h-6" />
          <span>{players.length} joueurs connectés</span>
        </div>

        <Button onClick={onStart} className="bg-white text-indigo-600 font-bold hover:bg-indigo-50 rounded-full px-12 text-xl h-14 shadow-xl">
          🚀 Démarrer le Quiz
        </Button>
      </div>
    </div>
  );
};

const LeaderboardView = ({ players, onContinue }: { players: Player[]; onContinue: () => void }) => {
  return (
    <div className="min-h-screen bg-indigo-600 p-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-6xl font-bold text-white mb-4 animate-fade-in drop-shadow-lg">🏆 Classement</h1>
          <p className="text-indigo-200 text-xl font-semibold">Positions actuelles</p>
        </div>

        <div className="space-y-4 mb-8">
          {players.map((player, index) => (
            <div
              key={player.id}
              className={cn(
                "bg-white/10 border border-white/20 rounded-2xl p-4 text-white transition-all duration-500 animate-slide-up hover:scale-[1.02]",
                index === 0 && "border-yellow-400/50"
              )}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg",
                    index === 0 && "bg-yellow-500 animate-bounce",
                    index === 1 && "bg-gray-300",
                    index === 2 && "bg-orange-600",
                    index > 2 && "bg-white/20"
                  )}>
                    {index === 0 ? <Crown className="w-7 h-7" /> :
                     index === 1 ? <Medal className="w-7 h-7" /> :
                     index === 2 ? <Award className="w-7 h-7" /> :
                     player.position}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white drop-shadow-lg">{player.name}</h3>
                    <p className="text-indigo-200 text-base font-medium">{player.correctAnswers} bonnes réponses</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-white drop-shadow-lg">{player.score.toLocaleString()}</div>
                  <div className="text-indigo-200 text-sm font-semibold">points</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button onClick={onContinue} className="bg-white text-indigo-600 font-bold hover:bg-indigo-50 rounded-full w-full h-12 text-xl shadow-xl">
            ▶️ Continuer
          </Button>
        </div>
      </div>
    </div>
  );
};

const FinalResults = ({ players }: { players: Player[] }) => {
  const winner = players[0];

  return (
    <div className="min-h-screen bg-indigo-600 p-4 relative overflow-hidden">
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

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <div className="mb-12 animate-fade-in">
          <div className="text-9xl mb-4 animate-bounce">🏆</div>
          <h1 className="text-7xl font-bold text-white mb-6 drop-shadow-2xl">Quiz Terminé !</h1>
          <p className="text-3xl text-indigo-200 font-semibold mb-8 drop-shadow-lg">Félicitations au vainqueur !</p>
        </div>

        {/* Winner Spotlight */}
        <Card className="bg-white/10 border border-white/20 shadow-2xl mb-8">
          <CardContent className="p-10">
            <div className="flex items-center justify-center gap-8">
              <div className="w-24 h-24 bg-yellow-500 rounded-full flex items-center justify-center animate-pulse shadow-xl">
                <Crown className="w-14 h-14 text-white" />
              </div>
              <div>
                <h2 className="text-5xl font-bold text-white mb-3 drop-shadow-lg">{winner.name}</h2>
                <div className="text-3xl text-indigo-200 font-bold drop-shadow-lg">{winner.score.toLocaleString()} points 🎯</div>
                <div className="text-white text-xl font-medium">{winner.correctAnswers} bonnes réponses</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top 3 Podium */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {players.slice(0, 3).map((player, index) => (
            <Card
              key={player.id}
              className={cn(
                "bg-white/10 border border-white/20 shadow-xl transform hover:scale-105 transition-all",
                index === 0 && "border-yellow-400/50"
              )}
            >
              <CardContent className="p-8 text-center">
                <div className={cn(
                  "w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg",
                  index === 0 && "bg-yellow-500",
                  index === 1 && "bg-gray-300",
                  index === 2 && "bg-orange-600"
                )}>
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                </div>
                <h3 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">{player.name}</h3>
                <div className="text-xl text-indigo-200 font-semibold">{player.score.toLocaleString()} pts</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-4 justify-center">
          <Button onClick={() => window.location.reload()} className="bg-white text-indigo-600 font-bold hover:bg-indigo-50 rounded-full text-xl h-12 px-8 shadow-xl">
            🔄 Rejouer
          </Button>
          <Button className="bg-white/10 border border-white/20 hover:bg-white/20 text-white rounded-full text-xl h-12 px-8 shadow-xl">
            📊 Résultats détaillés
          </Button>
        </div>
      </div>
    </div>
  );
};
