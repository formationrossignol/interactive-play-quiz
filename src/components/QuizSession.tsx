import { useState, useEffect } from "react";
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
import { cn } from "@/lib/utils";

interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  previousScore?: number;
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
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([
    { id: '1', name: 'Alice', avatar: '🦁', score: 0, correctAnswers: 0, joinedAt: new Date() },
    { id: '2', name: 'Bob', avatar: '🐯', score: 0, correctAnswers: 0, joinedAt: new Date() },
    { id: '3', name: 'Charlie', avatar: '🐻', score: 0, correctAnswers: 0, joinedAt: new Date() },
  ]);
  
  const [gameState, setGameState] = useState<'waiting' | 'question' | 'answer-distribution' | 'leaderboard' | 'final'>('waiting');
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

  // Simulate real-time player updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (gameState === 'waiting') {
        setPlayers(prev => {
          if (prev.length < 10 && Math.random() > 0.7) {
            const avatars = ['🦁', '🐯', '🐻', '🐼', '🐨', '🐸', '🐵', '🦊'];
            const newPlayer: Player = {
              id: Date.now().toString(),
              name: `Player${prev.length + 1}`,
              avatar: avatars[Math.floor(Math.random() * avatars.length)],
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
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < quiz.questions.length - 1) {
      // Save previous scores before updating
      setPlayers(prev => prev.map(p => ({ ...p, previousScore: p.score })));
      setCurrentQuestionIndex(prev => prev + 1);
      setGameState('question');
      setTimeLeft(quiz.questions[currentQuestionIndex + 1].timeLimit);
    } else {
      setGameState('final');
    }
  };

  const showAnswerDistribution = () => {
    // Mock answer distribution (in real app this would come from actual answers)
    const mockDistribution = currentQuestion.answers 
      ? currentQuestion.answers.map(() => Math.floor(Math.random() * 50))
      : [];
    setAnswerDistribution(mockDistribution);
    setGameState('answer-distribution');
  };

  const showLeaderboard = () => {
    setGameState('leaderboard');
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
                <Button variant="outline" onClick={() => setShowExitDialog(true)}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Quitter
                </Button>
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
          
          <ExitQuizDialog 
            open={showExitDialog}
            onOpenChange={setShowExitDialog}
            onConfirm={handleExitQuiz}
          />

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
                        <div className="text-2xl">
                          {player.avatar}
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
                <BackgroundMusic isPlaying={gameState === 'question'} />
                <Button variant="outline" size="sm" onClick={() => setShowExitDialog(true)} className="bg-white/10 hover:bg-white/20 text-white">
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
          {['multiple-choice', 'true-false', 'short-answer'].includes(currentQuestion.type) && (
            <Card className="bg-white/10 backdrop-blur-lg border-white/20 shadow-glow">
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                    {currentQuestion.question}
                  </h2>
                  
                  <div className="flex items-center justify-center gap-6 mb-6">
                    <CircularTimer timeLeft={timeLeft} totalTime={currentQuestion.timeLimit} />
                    <div className="text-white/80">
                      <div className="flex items-center gap-2 mb-2">
                        <Trophy className="w-5 h-5" />
                        <span className="text-xl font-bold">{currentQuestion.points} points</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Multiple Choice */}
                {currentQuestion.type === 'multiple-choice' && currentQuestion.answers && (
                  <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                    {currentQuestion.answers.map((answer, index) => (
                      <Button
                        key={index}
                        variant="quiz"
                        size="lg"
                        className="h-20 text-lg p-6 hover:scale-105 transition-transform"
                        onClick={() => console.log('Answer:', index)}
                      >
                        {String.fromCharCode(65 + index)}. {answer}
                      </Button>
                    ))}
                  </div>
                )}

                {/* True/False */}
                {currentQuestion.type === 'true-false' && (
                  <div className="flex gap-4 justify-center max-w-md mx-auto">
                    <Button
                      variant="quiz"
                      size="lg"
                      className="flex-1 h-20 text-xl hover:scale-105 transition-transform bg-success/20 hover:bg-success/30"
                      onClick={() => console.log('Answer: true')}
                    >
                      Vrai
                    </Button>
                    <Button
                      variant="quiz"
                      size="lg"
                      className="flex-1 h-20 text-xl hover:scale-105 transition-transform bg-destructive/20 hover:bg-destructive/30"
                      onClick={() => console.log('Answer: false')}
                    >
                      Faux
                    </Button>
                  </div>
                )}

                {/* Short Answer */}
                {currentQuestion.type === 'short-answer' && (
                  <div className="max-w-md mx-auto">
                    <div className="bg-white/10 rounded-lg p-4 mb-4">
                      <input
                        type="text"
                        placeholder="Tapez votre réponse..."
                        className="w-full bg-transparent text-white placeholder:text-white/60 text-xl text-center border-none outline-none"
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
      </div>
    );
  }

  if (gameState === 'answer-distribution') {
    return (
      <QuizSessionAnswerDistribution
        currentQuestion={currentQuestion}
        answerDistribution={answerDistribution}
        onNext={showLeaderboard}
        isHost={isHost || false}
      />
    );
  }

  if (gameState === 'leaderboard') {
    return (
      <RaceLeaderboard
        players={players}
        onComplete={nextQuestion}
      />
    );
  }

  if (gameState === 'final') {
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];
    
    return (
      <div className="min-h-screen bg-gradient-hero p-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-8 animate-scale-in">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
              Quiz Terminé !
            </h1>
            {winner && (
              <div className="bg-gradient-primary/20 backdrop-blur-lg rounded-lg p-8 border border-primary/30 mb-8">
                <div className="text-4xl mb-4">👑</div>
                <h2 className="text-3xl font-bold text-white mb-2">Félicitations</h2>
                <div className="text-2xl text-white font-bold">{winner.name}</div>
                <div className="text-white/80">
                  {winner.score} points • {winner.correctAnswers} bonnes réponses
                </div>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {sortedPlayers.slice(0, 3).map((player, index) => (
              <Card key={player.id} className="bg-white/10 backdrop-blur-lg border-white/20">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl mb-2">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                  </div>
                  <div className="text-white font-bold text-lg mb-1">{player.name}</div>
                  <div className="text-white/80">{player.score} points</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {isHost && (
            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={exportResults}>
                <Download className="w-4 h-4 mr-2" />
                Exporter les résultats
              </Button>
              <Button variant="hero" onClick={() => window.location.href = '/'}>
                Nouveau Quiz
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};
