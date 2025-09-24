import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Users, Clock } from "lucide-react";

const JoinQuiz = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  // Mock quiz data - in real app this would come from backend
  const mockQuiz = {
    title: "Geography Quiz",
    description: "Test your knowledge of world geography",
    host: "Teacher Smith",
    playerCount: 5,
    status: "waiting" as const,
    estimatedDuration: "15 minutes"
  };

  const handleJoinQuiz = async () => {
    if (!playerName.trim()) return;
    
    setIsJoining(true);
    
    // Simulate joining delay
    setTimeout(() => {
      navigate(`/quiz/${gameCode}?player=${encodeURIComponent(playerName)}`);
    }, 1000);
  };

  if (!gameCode) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">Invalid Game Code</h2>
            <p className="text-white/80 mb-6">The quiz code you're looking for doesn't exist.</p>
            <Button variant="hero" onClick={() => navigate("/")}>
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Card className="bg-white/10 backdrop-blur-lg border-white/20 shadow-glow">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-primary rounded-full mx-auto mb-4 flex items-center justify-center">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Join Quiz</h1>
              <div className="text-4xl font-mono text-white/80 tracking-wider font-bold">
                {gameCode}
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-bold text-white mb-2">{mockQuiz.title}</h2>
              <p className="text-white/80 text-sm mb-4">{mockQuiz.description}</p>
              
              <div className="flex items-center justify-between text-white/60 text-sm">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{mockQuiz.playerCount} players</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{mockQuiz.estimatedDuration}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="player-name" className="text-white">
                  Your Name
                </Label>
                <Input
                  id="player-name"
                  placeholder="Enter your name to join"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleJoinQuiz()}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60 mt-2"
                  maxLength={20}
                />
              </div>

              <Button
                onClick={handleJoinQuiz}
                disabled={!playerName.trim() || isJoining}
                variant="hero"
                size="lg"
                className="w-full"
              >
                {isJoining ? "Joining..." : "Join Quiz"}
              </Button>
            </div>

            <div className="mt-6 text-center">
              <p className="text-white/60 text-sm">
                Hosted by <span className="text-white font-medium">{mockQuiz.host}</span>
              </p>
              <div className="mt-2 px-3 py-1 bg-success/20 text-success text-xs rounded-full inline-block">
                {mockQuiz.status === 'waiting' ? 'Waiting for start' : 'In progress'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default JoinQuiz;