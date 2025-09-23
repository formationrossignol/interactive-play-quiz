import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Users, Trophy, Zap, QrCode, Gamepad2 } from "lucide-react";

const Index = () => {
  const [userType, setUserType] = useState<'host' | 'player' | null>(null);

  if (userType === 'host') {
    return <HostDashboard />;
  }

  if (userType === 'player') {
    return <PlayerJoin />;
  }

  return (
    <div className="min-h-screen bg-gradient-hero relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-10 w-32 h-32 bg-white/10 rounded-full animate-pulse"></div>
        <div className="absolute top-40 right-20 w-24 h-24 bg-white/10 rounded-full animate-pulse delay-300"></div>
        <div className="absolute bottom-32 left-1/4 w-40 h-40 bg-white/10 rounded-full animate-pulse delay-700"></div>
        <div className="absolute bottom-20 right-1/3 w-28 h-28 bg-white/10 rounded-full animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="text-center max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="mb-12 animate-fade-in">
            <div className="flex items-center justify-center mb-6">
              <Zap className="w-16 h-16 text-white mr-4" />
              <h1 className="text-6xl md:text-8xl font-black text-white tracking-tight">
                QuizMaster
              </h1>
            </div>
            <p className="text-xl md:text-2xl text-white/90 mb-8 font-medium">
              Create and play interactive quizzes in real-time
            </p>
            <div className="flex items-center justify-center gap-8 text-white/80 mb-12">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <span>Multiplayer</span>
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                <span>Live Scoring</span>
              </div>
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5" />
                <span>Quick Join</span>
              </div>
            </div>
          </div>

          {/* Action Cards */}
          <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
            <Card 
              className="bg-white/10 backdrop-blur-lg border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105 cursor-pointer group shadow-card"
              onClick={() => setUserType('host')}
            >
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-primary rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Play className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Host a Quiz</h3>
                <p className="text-white/80 mb-6">
                  Create quizzes, manage sessions, and see live results
                </p>
                <Button variant="quiz" size="lg" className="w-full">
                  Start Hosting
                </Button>
              </CardContent>
            </Card>

            <Card 
              className="bg-white/10 backdrop-blur-lg border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105 cursor-pointer group shadow-card"
              onClick={() => setUserType('player')}
            >
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-secondary rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Gamepad2 className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Join a Quiz</h3>
                <p className="text-white/80 mb-6">
                  Enter a game code and compete with others
                </p>
                <Button variant="quiz" size="lg" className="w-full">
                  Join Game
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Features */}
          <div className="mt-16 text-white/70 text-sm">
            <p>✨ Multiple question types • ⚡ Real-time responses • 🏆 Dynamic leaderboards</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const HostDashboard = () => {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Host Dashboard</h1>
            <p className="text-muted-foreground">Create and manage your quizzes</p>
          </div>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Back to Home
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold mb-4">Quick Start</h3>
              <div className="space-y-4">
                <Button variant="hero" size="lg" className="w-full">
                  Create New Quiz
                </Button>
                <Button variant="outline" size="lg" className="w-full">
                  Load Existing Quiz
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold mb-4">Active Sessions</h3>
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                  <Play className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No active sessions</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {['Multiple Choice', 'True/False', 'Short Answer', 'Ranking'].map((type, index) => (
            <Card key={type} className="hover:shadow-card transition-shadow cursor-pointer">
              <CardContent className="p-4 text-center">
                <div className={`w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center ${
                  index === 0 ? 'bg-gradient-primary' :
                  index === 1 ? 'bg-gradient-secondary' :
                  index === 2 ? 'bg-gradient-success' : 'bg-warning'
                }`}>
                  <span className="text-white font-bold">{index + 1}</span>
                </div>
                <h4 className="font-semibold text-sm">{type}</h4>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

const PlayerJoin = () => {
  const [gameCode, setGameCode] = useState('');

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="max-w-md mx-auto">
        <Card className="bg-white/10 backdrop-blur-lg border-white/20 shadow-glow">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-secondary rounded-full flex items-center justify-center">
              <Gamepad2 className="w-10 h-10 text-white" />
            </div>
            
            <h2 className="text-3xl font-bold text-white mb-6">Join Quiz</h2>
            
            <div className="space-y-4 mb-6">
              <input
                type="text"
                placeholder="Enter game code"
                className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder:text-white/60 text-center text-lg font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-white/50"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value)}
                maxLength={6}
              />
              
              <input
                type="text"
                placeholder="Your nickname"
                className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder:text-white/60 text-center focus:outline-none focus:ring-2 focus:ring-white/50"
              />
            </div>

            <Button variant="quiz" size="lg" className="w-full mb-4">
              Join Game
            </Button>

            <div className="flex items-center justify-center mb-4">
              <div className="border-t border-white/30 flex-1"></div>
              <span className="px-4 text-white/60 text-sm">or</span>
              <div className="border-t border-white/30 flex-1"></div>
            </div>

            <Button variant="ghost" onClick={() => window.location.reload()} className="text-white/80 hover:text-white">
              Scan QR Code
            </Button>

            <div className="mt-6 pt-6 border-t border-white/20">
              <Button variant="link" onClick={() => window.location.reload()} className="text-white/70 hover:text-white">
                ← Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;