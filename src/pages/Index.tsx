import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users, Zap, Trophy, Play, Plus, QrCode, Clock, Star, ArrowRight, Gamepad2 } from "lucide-react";

const Index = () => {
  const [gameCode, setGameCode] = useState("");
  const navigate = useNavigate();

  const joinQuiz = () => {
    if (gameCode.trim()) {
      navigate(`/join/${gameCode.toUpperCase()}`);
    }
  };

  const createQuiz = () => {
    navigate('/builder');
  };

  const startDemo = () => {
    navigate('/quiz/DEMO123');
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Navigation */}
      <nav className="p-6 border-b border-white/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">QuizMaster</h1>
              <p className="text-white/60 text-sm">Interactive Quiz Platform</p>
            </div>
          </div>
          
          <Badge variant="secondary" className="bg-white/10 text-white border-white/20">
            <Star className="w-3 h-3 mr-1" />
            Live Multiplayer
          </Badge>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center mb-16 mt-8">
          <h2 className="text-6xl font-bold text-white mb-6 animate-fade-in">
            Create <span className="bg-gradient-primary bg-clip-text text-transparent">Interactive</span> Quizzes
          </h2>
          <p className="text-xl text-white/80 mb-12 max-w-3xl mx-auto leading-relaxed">
            Engage your audience with real-time multiplayer quizzes featuring QR code joining, 
            live leaderboards, multiple question types, and beautiful animations.
          </p>
        </div>

        {/* Main Actions */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {/* Host a Quiz */}
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 hover:bg-white/15 transition-all duration-300 group shadow-glow">
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 bg-gradient-primary rounded-2xl mx-auto mb-6 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Gamepad2 className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Host a Quiz</h3>
              <p className="text-white/80 mb-8 leading-relaxed">
                Create and host interactive quizzes with real-time participation. 
                Perfect for classrooms, meetings, or events.
              </p>
              <Button onClick={createQuiz} variant="hero" size="lg" className="w-full text-lg">
                <Plus className="w-5 h-5 mr-2" />
                Create New Quiz
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Join a Quiz */}
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 hover:bg-white/15 transition-all duration-300 group shadow-glow">
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 bg-gradient-secondary rounded-2xl mx-auto mb-6 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Join a Quiz</h3>
              <p className="text-white/80 mb-6 leading-relaxed">
                Enter a game code or scan a QR code to join an active quiz session.
              </p>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="game-code" className="text-white text-sm font-medium">
                    Game Code
                  </Label>
                  <Input
                    id="game-code"
                    placeholder="Enter code (e.g. ABC123)"
                    value={gameCode}
                    onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                    onKeyPress={(e) => e.key === 'Enter' && joinQuiz()}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 text-center text-xl font-mono tracking-wider mt-2"
                    maxLength={6}
                  />
                </div>
                <Button 
                  onClick={joinQuiz} 
                  disabled={!gameCode.trim()}
                  variant="quiz" 
                  size="lg" 
                  className="w-full text-lg"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Join Quiz
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 hover:bg-white/15 transition-all duration-300 group">
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <QrCode className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-white">QR Code Joining</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-white/80">Players join instantly by scanning QR codes. No apps to download, no accounts needed!</p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-lg border-white/20 hover:bg-white/15 transition-all duration-300 group">
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-secondary rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-white">Multiple Question Types</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-white/80">Multiple choice, true/false, short answer, ranking, and word clouds for diverse engagement!</p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-lg border-white/20 hover:bg-white/15 transition-all duration-300 group">
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-success rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-white">Live Leaderboards</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-white/80">Animated rankings with podium celebrations. Points based on speed and accuracy!</p>
            </CardContent>
          </Card>
        </div>

        {/* Demo Section */}
        <Card className="bg-gradient-primary/20 backdrop-blur-lg border-white/20 shadow-glow">
          <CardContent className="p-8 text-center">
            <h3 className="text-3xl font-bold text-white mb-4">Try the Live Demo</h3>
            <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
              Experience QuizMaster in action with our interactive demo featuring real questions and animations.
            </p>
            <Button onClick={startDemo} variant="hero" size="lg" className="text-lg px-12">
              <Play className="w-5 h-5 mr-2" />
              Start Demo Quiz
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;