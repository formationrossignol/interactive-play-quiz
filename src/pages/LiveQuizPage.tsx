import { useParams, useSearchParams } from "react-router-dom";
import { QuizSession } from "@/components/QuizSession";
import { PlayerView } from "@/components/PlayerView";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

const LiveQuizPage = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const [searchParams] = useSearchParams();
  const playerName = searchParams.get('player');

  // Mock quiz data - in real app this would come from backend
  const mockQuiz = {
    id: "1",
    title: "Geography Quiz",
    description: "Test your knowledge of world geography",
    gameCode: gameCode || "ABC123",
    hostId: "host1",
    isActive: true,
    createdAt: new Date(),
    questions: [
      {
        id: "1",
        type: "multiple-choice" as const,
        question: "What is the capital of France?",
        answers: ["London", "Berlin", "Paris", "Madrid"],
        correctAnswer: 2,
        timeLimit: 30,
        points: 100
      },
      {
        id: "2",
        type: "word-cloud" as const,
        question: "Name one word that describes innovation",
        timeLimit: 45,
        points: 150
      },
      {
        id: "3",
        type: "ranking" as const,
        question: "Rank these planets by distance from the Sun (closest to farthest)",
        timeLimit: 60,
        points: 200,
        items: [
          { id: "venus", text: "Venus", correctPosition: 2 },
          { id: "earth", text: "Earth", correctPosition: 3 },
          { id: "mercury", text: "Mercury", correctPosition: 1 },
          { id: "mars", text: "Mars", correctPosition: 4 }
        ]
      }
    ]
  };

  if (!gameCode) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">Invalid Game Code</h2>
            <p className="text-white/80 mb-6">The quiz code you're looking for doesn't exist.</p>
            <Button variant="hero" onClick={() => window.location.href = "/"}>
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If player parameter is present, show player view
  if (playerName && gameCode) {
    return <PlayerView gameCode={gameCode} playerName={playerName} />;
  }

  // Otherwise show host view
  return <QuizSession quiz={mockQuiz} isHost={true} />;
};

export default LiveQuizPage;