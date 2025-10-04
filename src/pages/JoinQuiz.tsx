import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AvatarSelector } from "@/components/AvatarSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

const JoinQuiz = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const [showAvatarSelector, setShowAvatarSelector] = useState(true);

  const handleAvatarComplete = (name: string, avatar: string) => {
    // Navigate with both name and avatar
    navigate(`/quiz/${gameCode}?player=${encodeURIComponent(name)}&avatar=${encodeURIComponent(avatar)}`);
  };

  if (!gameCode) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">Code invalide</h2>
            <p className="text-white/80 mb-6">Ce code de quiz n'existe pas.</p>
            <Button variant="hero" onClick={() => navigate("/")}>
              Retour
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <AvatarSelector gameCode={gameCode} onComplete={handleAvatarComplete} />;
};

export default JoinQuiz;