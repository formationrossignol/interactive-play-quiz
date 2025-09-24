import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, Clock, Trophy, Settings, Download, Share2 } from "lucide-react";
import { QRCodeGenerator } from "./QRCodeGenerator";
import { WordCloudQuestion } from "./WordCloudQuestion";
import { RankingQuestion } from "./RankingQuestion";
import { cn } from "@/lib/utils";

interface Player {
  id: string;
  name: string;
  score: number;
  correctAnswers: number;
  joinedAt: Date;
}

interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer' | 'ranking' | 'word-cloud';
  question: string;
  answers?: string[];
  correctAnswer?: number | string;
  timeLimit: number;
  points: number;
  items?: Array<{ id: string; text: string; correctPosition: number }>;
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
}

interface QuizSessionProps {
  quiz: QuizSession;
  isHost?: boolean;
}

export const QuizSession = ({ quiz, isHost = false }: QuizSessionProps) => {
  const [players, setPlayers] = useState<Player[]>([
    { id: '1', name: 'Alice', score: 2850, correctAnswers: 8, joinedAt: new Date() },
    { id: '2', name: 'Bob', score: 2650, correctAnswers: 7, joinedAt: new Date() },
    { id: '3', name: 'Charlie', score: 2400, correctAnswers: 6, joinedAt: new Date() },
  ]);
  
  const [gameState, setGameState] = useState<'waiting' | 'question' | 'results' | 'leaderboard' | 'final'>('waiting');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    totalPlayers: 0,
    averageScore: 0,
    questionsAnswered: 0,
    duration: 0
  });

  const joinUrl = `${window.location.origin}/join/${quiz.gameCode}`;
  const currentQuestion = quiz.questions[currentQuestionIndex];

  // Simulate real-time player updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (gameState === 'waiting') {
        setPlayers(prev => {
          if (prev.length < 10 && Math.random() > 0.7) {
            const newPlayer: Player = {
              id: Date.now().toString(),
              name: `Player${prev.length + 1}`,
              score: 0,
              correctAnswers: 0,
              joinedAt: new Date()
            };
            return [...prev, newPlayer];
          }
          return prev;
        });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [gameState]);

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
    setGameState('question');
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setGameState('question');
    } else {
      setGameState('final');
    }
  };

  const showLeaderboard = () => {
    setGameState('leaderboard');
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
      <div className="min-h-screen bg-gradient-hero p-4">
        <div className="max-w-6xl mx-auto">
          {/* Host Controls */}
          {isHost && (
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-white">{quiz.title}</h1>
                <p className="text-white/80">{quiz.description}</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowSettings(!showSettings)}>
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
                <Button variant="hero" size="lg" onClick={startQuiz} disabled={players.length === 0}>
                  Start Quiz ({players.length} players)
                </Button>
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-6">
            {/* QR Code & Join Info */}
            <div className="lg:col-span-1">
              <QRCodeGenerator gameCode={quiz.gameCode} joinUrl={joinUrl} />
            </div>

            {/* Players List */}
            <div className="lg:col-span-2">
              <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Players ({players.length})
                    </h3>
                    {isHost && (
                      <Button variant="outline" size="sm" onClick={exportResults}>
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </Button>
                    )}
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                    {players.map((player) => (
                      <div 
                        key={player.id} 
                        className="bg-white/10 rounded-lg p-3 text-white text-sm animate-fade-in flex items-center gap-2"
                      >
                        <div className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center text-xs font-bold">
                          {player.name.charAt(0)}
                        </div>
                        <span className="flex-1 truncate">{player.name}</span>
                      </div>
                    ))}
                    {players.length === 0 && (
                      <div className="col-span-full text-center py-8 text-white/60">
                        <p>Waiting for players to join...</p>
                        <p className="text-sm mt-2">Share the QR code or game code</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Quiz Preview */}
          {isHost && (
            <Card className="mt-6 bg-white/10 backdrop-blur-lg border-white/20">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-white mb-4">Quiz Preview</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{quiz.questions.length}</div>
                    <div className="text-white/60 text-sm">Questions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">
                      {Math.round(quiz.questions.reduce((sum, q) => sum + q.timeLimit, 0) / 60)}m
                    </div>
                    <div className="text-white/60 text-sm">Est. Duration</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">
                      {quiz.questions.reduce((sum, q) => sum + q.points, 0)}
                    </div>
                    <div className="text-white/60 text-sm">Total Points</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{players.length}</div>
                    <div className="text-white/60 text-sm">Joined Players</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  if (gameState === 'question') {
    return (
      <div className="min-h-screen bg-gradient-hero p-4">
        <div className="max-w-4xl mx-auto">
          {/* Quiz Header */}
          <div className="flex items-center justify-between mb-6 text-white">
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                Question {currentQuestionIndex + 1} of {quiz.questions.length}
              </Badge>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>{players.length} players</span>
              </div>
            </div>
            
            {isHost && (
              <div className="flex gap-2">
                <Button variant="quiz" onClick={showLeaderboard}>
                  <Trophy className="w-4 h-4 mr-2" />
                  Leaderboard
                </Button>
                <Button variant="quiz" onClick={nextQuestion}>
                  Next Question
                </Button>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <Progress 
              value={(currentQuestionIndex / quiz.questions.length) * 100} 
              className="h-2 bg-white/20"
            />
          </div>

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
          {['multiple-choice', 'true-false', 'short-answer'].includes(currentQuestion.type) && (
            <Card className="bg-white/10 backdrop-blur-lg border-white/20 shadow-glow">
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                    {currentQuestion.question}
                  </h2>
                  <div className="flex items-center justify-center gap-4 text-white/80">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{currentQuestion.timeLimit}s</span>
                    </div>
                  </div>
                </div>

                {/* Answer options would go here based on question type */}
                <div className="text-center text-white/60">
                  <p>Question interface for {currentQuestion.type}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Other game states (leaderboard, final) would be similar to LiveQuiz component
  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="text-center text-white">
        <h2 className="text-2xl font-bold mb-4">Game State: {gameState}</h2>
        <Button variant="hero" onClick={() => setGameState('waiting')}>
          Back to Waiting Room
        </Button>
      </div>
    </div>
  );
};
