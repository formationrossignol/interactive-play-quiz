import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AvatarSelector } from "@/components/AvatarSelector";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { t } from "@/lib/i18n";

const checkSupabase = async (gameCode: string): Promise<boolean | null> => {
  const { data, error } = await supabase
    .from("session_state")
    .select("game_code")
    .eq("game_code", gameCode)
    .single();

  if (data) return true;
  // PGRST116 = "0 rows" → truly not found
  if (error?.code === "PGRST116") return false;
  // Any other error (network, RLS, etc.) → unknown, caller will retry
  return null;
};

const JoinQuiz = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const [quizExists, setQuizExists] = useState<boolean | null>(null);
  const [quizTitle, setQuizTitle] = useState<string>("");

  useEffect(() => {
    if (!gameCode) return;

    // Same-device check (synchronous)
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

    // Cross-device: check Supabase with one retry to handle race conditions
    // (host may not have finished writing the session row yet)
    const run = async () => {
      let result = await checkSupabase(gameCode);

      if (result === null) {
        // Unknown error — wait 2s and retry once
        await new Promise((r) => setTimeout(r, 2000));
        result = await checkSupabase(gameCode);
      }

      if (result === true) {
        setQuizExists(true);
      } else if (result === false) {
        setQuizExists(false);
        toast.error(t("quizOrPollNotFound"), {
          description: t("quizOrPollNotFoundDesc"),
        });
      } else {
        // Still unknown after retry — let them try anyway, PlayerView will handle it
        setQuizExists(true);
      }
    };

    run();
  }, [gameCode]);

  useEffect(() => {
    if (!gameCode || quizExists !== true) return;

    // If this device already joined, skip avatar selector and go straight to player view
    const stored = sessionStorage.getItem(`quiz-player-${gameCode}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { name: string; avatar: string };
        navigate(`/quiz/${gameCode}?player=${encodeURIComponent(parsed.name)}&avatar=${encodeURIComponent(parsed.avatar)}`, { replace: true });
        return;
      } catch {
        // corrupt data — let them re-register
        sessionStorage.removeItem(`quiz-player-${gameCode}`);
      }
    }

    supabase
      .from("session_state")
      .select("quiz_data")
      .eq("game_code", gameCode)
      .single()
      .then(({ data }) => {
        const title = (data?.quiz_data as { title?: string } | null)?.title;
        if (title) setQuizTitle(title);
      });
  }, [gameCode, quizExists, navigate]);

  const handleAvatarComplete = (name: string, avatar: string) => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const player = { id, name, avatar, score: 0, correctAnswers: 0, joinedAt: new Date().toISOString() };
    try {
      sessionStorage.setItem(`quiz-player-${gameCode}`, JSON.stringify(player));
    } catch {
      // ignore storage errors — PlayerView will handle missing session
    }
    navigate(`/quiz/${gameCode}?player=${encodeURIComponent(name)}`);
  };

  if (!gameCode || quizExists === false) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "var(--ap-paper)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
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
    return (
      <div style={{ minHeight: "100vh", background: "var(--ap-brand)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-white" />
          <p className="text-white font-bold text-lg" style={{ fontFamily: "var(--ap-font-display)" }}>
            {t("checkingCode")}
          </p>
        </div>
      </div>
    );
  }

  return <AvatarSelector gameCode={gameCode} onComplete={handleAvatarComplete} quizTitle={quizTitle} />;
};

export default JoinQuiz;
