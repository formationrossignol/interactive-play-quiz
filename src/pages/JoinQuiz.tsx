import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AvatarSelector } from "@/components/AvatarSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const JoinQuiz = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const [quizExists, setQuizExists] = useState<boolean | null>(null);

  useEffect(() => {
    if (!gameCode) return;

    // Check localStorage first (same device as host)
    const quizData = localStorage.getItem(`quiz-${gameCode}`);
    const pollData = localStorage.getItem(`poll-${gameCode}`);
    const savedQuizzes = localStorage.getItem("saved_quizzes");
    const inSaved = savedQuizzes
      ? (JSON.parse(savedQuizzes) as { id: string }[]).some((q) => q.id === gameCode)
      : false;

    if (quizData || pollData || inSaved) {
      setQuizExists(true);
      return;
    }

    // Cross-device: check Supabase for active session
    supabase
      .from("session_state")
      .select("game_code")
      .eq("game_code", gameCode)
      .single()
      .then(({ data }) => {
        if (data) {
          setQuizExists(true);
        } else {
          setQuizExists(false);
          toast.error("Quiz ou sondage introuvable", {
            description: "Le code que vous avez entré n'existe pas ou a expiré.",
          });
        }
      });
  }, [gameCode]);

  const handleAvatarComplete = (name: string, avatar: string) => {
    // Navigate with both name and avatar
    navigate(`/quiz/${gameCode}?player=${encodeURIComponent(name)}&avatar=${encodeURIComponent(avatar)}`);
  };

  if (!gameCode || quizExists === false) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--ap-paper)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
        <div className="ap-card ap-card--floaty" style={{ maxWidth: 440, width: "100%", textAlign: "center", padding: "40px" }}>
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 animate-pulse" style={{ color: "var(--ap-flash)" }} />
          <h2 className="ap-h2" style={{ fontSize: "24px", marginBottom: "12px" }}>Code invalide</h2>
          <p className="ap-muted" style={{ fontSize: "15px", marginBottom: "24px" }}>Ce code de quiz ou sondage n'existe pas.</p>
          <button className="ap-btn ap-btn--pill" onClick={() => navigate("/")}>
            Retour
          </button>
        </div>
      </div>
    );
  }

  if (quizExists === null) {
    return null; // Loading state
  }

  return <AvatarSelector gameCode={gameCode} onComplete={handleAvatarComplete} />;
};

export default JoinQuiz;