import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AvatarSelector } from "@/components/AvatarSelector";
import { AlertTriangle, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { normalizeControl } from "@/lib/sessionState";
import { t } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";

/** Read the host's control state (room lock etc.) for a session. */
const fetchRoomLocked = async (gameCode: string): Promise<boolean> => {
  const { data } = await supabase
    .from("session_state")
    .select("control")
    .eq("game_code", gameCode)
    .single();
  return normalizeControl((data as { control?: unknown } | null)?.control).locked;
};

/** Read the baked-in participant cap (quiz_data.maxParticipants) and the
 *  current player count, so a join can be blocked once the room is full.
 *  Error-tolerant like fetchRoomLocked. A query failure just reports "not full".
 *  Client-only check, same as the room-lock mechanism above: two players
 *  joining the last slot near-simultaneously can both be admitted (no
 *  server-side atomic reservation). Accepted trade-off, not a bug. */
const fetchCapacity = async (gameCode: string): Promise<{ full: boolean }> => {
  const { data } = await supabase
    .from("session_state")
    .select("quiz_data, players")
    .eq("game_code", gameCode)
    .single();
  const maxParticipants = (data as { quiz_data?: { maxParticipants?: number | null } } | null)?.quiz_data?.maxParticipants;
  if (maxParticipants === null || maxParticipants === undefined) return { full: false };
  const players = (data as { players?: unknown[] } | null)?.players;
  const count = Array.isArray(players) ? players.length : 0;
  return { full: count >= maxParticipants };
};

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
  const [roomLocked, setRoomLocked] = useState(false);
  const [roomFull, setRoomFull] = useState(false);

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
        // Unknown error, wait 2s and retry once
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
        // Still unknown after retry. Let them try anyway, PlayerView will handle it.
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
        // Corrupt data, let them re-register.
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
    // Separate, error-tolerant read so a not-yet-deployed control column can't
    // break the title fetch above.
    fetchRoomLocked(gameCode).then(setRoomLocked);
    fetchCapacity(gameCode).then(({ full }) => setRoomFull(full));
  }, [gameCode, quizExists, navigate]);

  // Keep the lock state fresh so a player waiting on this screen learns the
  // moment the host locks the room (poll every 3s).
  useEffect(() => {
    if (!gameCode || quizExists !== true) return;
    const interval = setInterval(async () => {
      const [locked, capacity] = await Promise.all([fetchRoomLocked(gameCode), fetchCapacity(gameCode)]);
      setRoomLocked(locked);
      setRoomFull(capacity.full);
    }, 3000);
    return () => clearInterval(interval);
  }, [gameCode, quizExists]);

  const handleAvatarComplete = async (name: string, avatar: string) => {
    if (!gameCode) return;
    // Re-check at submit time. The host may have locked the room or it may
    // have filled up while the player was picking an avatar.
    if (await fetchRoomLocked(gameCode)) {
      setRoomLocked(true);
      toast.error("Salle verrouillée", { description: "L'hôte a fermé l'accès, impossible de rejoindre." });
      return;
    }
    if ((await fetchCapacity(gameCode)).full) {
      setRoomFull(true);
      toast.error("Session complète", { description: "Le nombre maximum de participants est atteint." });
      return;
    }
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const player = { id, name, avatar, score: 0, correctAnswers: 0, joinedAt: new Date().toISOString() };
    try {
      sessionStorage.setItem(`quiz-player-${gameCode}`, JSON.stringify(player));
    } catch {
      // Ignore storage errors. PlayerView will handle missing session.
    }
    navigate(`/quiz/${gameCode}?player=${encodeURIComponent(name)}`);
  };

  if (!gameCode || quizExists === false) {
    return (
      <div className="product-entry-shell">
        <div className="product-entry-card">
          <div className="product-entry-heading">
            <span className="product-entry-heading__icon"><AlertTriangle className="h-6 w-6" /></span>
            <h1>Code invalide</h1>
            <p>Ce code de quiz ou sondage n’existe pas. Vérifiez le lien reçu.</p>
          </div>
          <button className="ap-btn ap-btn--pill" onClick={() => { window.location.href = "/"; }}>
            Retour
          </button>
        </div>
      </div>
    );
  }

  if (roomLocked) {
    return (
      <div className="product-entry-shell">
        <div className="product-entry-card">
          <div className="product-entry-heading">
            <span className="product-entry-heading__icon">
              <Lock className="h-6 w-6" />
            </span>
            <h1>Salle verrouillée</h1>
            <p>L’hôte a fermé l’accès à cette partie. Réessayez lorsqu’il aura rouvert la salle.</p>
          </div>
          <button className="ap-btn ap-btn--pill" onClick={() => { window.location.href = "/"; }}>
            Retour
          </button>
        </div>
      </div>
    );
  }

  if (roomFull) {
    return (
      <div className="product-entry-shell">
        <div className="product-entry-card">
          <div className="product-entry-heading">
            <span className="product-entry-heading__icon">
              <Lock className="h-6 w-6" />
            </span>
            <h1>Session complète</h1>
            <p>Le nombre maximum de participants pour cette session est atteint.</p>
          </div>
          <button className="ap-btn ap-btn--pill" onClick={() => { window.location.href = "/"; }}>
            Retour
          </button>
        </div>
      </div>
    );
  }

  if (quizExists === null) {
    return (
      <div className="product-entry-shell">
        <div className="product-entry-card" role="status" aria-label={t("checkingCode")}>
          <Skeleton className="mb-5 h-12 w-12 rounded-xl" />
          <Skeleton className="mb-3 h-7 w-3/5" />
          <Skeleton className="mb-8 h-4 w-4/5" />
          <Skeleton className="mb-3 h-12 w-full" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return <AvatarSelector gameCode={gameCode} onComplete={handleAvatarComplete} quizTitle={quizTitle} />;
};

export default JoinQuiz;
