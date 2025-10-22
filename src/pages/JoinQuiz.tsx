import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AvatarSelector } from "@/components/AvatarSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const JoinQuiz = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const [quizExists, setQuizExists] = useState<boolean | null>(null);

  useEffect(() => {
    if (gameCode) {
      // Check if quiz/poll exists in localStorage
      const quizData = localStorage.getItem(`quiz-${gameCode}`);
      const pollData = localStorage.getItem(`poll-${gameCode}`);
      
      if (!quizData && !pollData) {
        setQuizExists(false);
        toast.error("Quiz ou sondage introuvable", {
          description: "Le code que vous avez entré n'existe pas ou a expiré."
        });
      } else {
        setQuizExists(true);
      }
    }
  }, [gameCode]);

  const handleAvatarComplete = (name: string, avatar: string) => {
    // Navigate with both name and avatar
    navigate(`/quiz/${gameCode}?player=${encodeURIComponent(name)}&avatar=${encodeURIComponent(avatar)}`);
  };

  if (!gameCode || quizExists === false) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
        <Card className="bg-white/30 backdrop-blur-xl border-white/40 shadow-2xl">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-yellow-300 mx-auto mb-4 animate-pulse drop-shadow-lg" />
            <h2 className="text-3xl font-bold text-white mb-4 drop-shadow-lg">Code invalide</h2>
            <p className="text-white text-lg mb-6 font-medium">Ce code de quiz ou sondage n'existe pas.</p>
            <Button variant="hero" onClick={() => navigate("/")} className="text-lg font-bold shadow-lg">
              🏠 Retour
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (quizExists === null) {
    return null; // Loading state
  }

  return <AvatarSelector gameCode={gameCode} onComplete={handleAvatarComplete} />;
};

export default JoinQuiz;