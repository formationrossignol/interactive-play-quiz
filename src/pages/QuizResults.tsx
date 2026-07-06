import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { ArrowLeft, BarChart2, Calendar, ChevronDown, ChevronUp, Target, Trophy, Users } from "lucide-react";
import { readSessionHistory, type SessionRun } from "@/lib/sessionState";
import { getQuizById } from "@/lib/quizStorage";
import { AvatarDisplay } from "@/components/BetterAvatars";

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

const SessionCard = ({ run, defaultOpen }: { run: SessionRun; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const sorted = [...run.players].sort((a, b) => b.score - a.score);

  return (
    <div className="ap-card" style={{ padding: 0, overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "18px 24px",
          background: "none", border: "none", cursor: "pointer",
          fontFamily: "var(--ap-font-body)", gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
          <Calendar style={{ width: 16, height: 16, color: "var(--ap-brand)", flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--ap-ink)" }}>
            {formatDate(run.date)}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <span className="ap-pill" style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}>
            <Users style={{ width: 11, height: 11 }} />{run.players.length}
          </span>
          <span className="ap-pill" style={{ fontSize: "11px" }}>{run.questionCount} q.</span>
          {open
            ? <ChevronUp style={{ width: 16, height: 16, color: "var(--ap-muted)" }} />
            : <ChevronDown style={{ width: 16, height: 16, color: "var(--ap-muted)" }} />
          }
        </div>
      </button>

      {open && (
        <div style={{ borderTop: "2px solid var(--ap-line)", padding: "16px 24px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {sorted.length === 0 && (
            <p className="ap-muted" style={{ fontSize: "13px" }}>Aucun joueur enregistré.</p>
          )}
          {sorted.map((player, idx) => (
            <div
              key={player.id}
              style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "10px 14px", borderRadius: "var(--ap-r-md)",
                background: idx === 0 ? "rgba(245,158,11,0.06)" : "var(--ap-paper-2)",
                border: `2px solid ${idx === 0 ? "rgba(245,158,11,0.2)" : "var(--ap-line)"}`,
              }}
            >
              <span style={{
                fontFamily: "var(--ap-font-display)", fontWeight: 800,
                fontSize: "13px", width: 24, textAlign: "center", flexShrink: 0,
              }}>
                {RANK_MEDALS[idx] ?? `#${idx + 1}`}
              </span>
              <AvatarDisplay emoji={player.avatar} size="xs" />
              <span style={{ flex: 1, fontWeight: 700, fontSize: "14px", color: "var(--ap-ink)" }}>
                {player.name}
              </span>
              <span style={{ fontWeight: 800, fontSize: "14px", color: "var(--ap-brand)", flexShrink: 0 }}>
                {player.score} pts
              </span>
              <span className="ap-pill" style={{ fontSize: "11px", flexShrink: 0 }}>
                {player.correctAnswers}/{run.questionCount} ✓
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const QuizResults = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<SessionRun[]>([]);
  const [quizTitle, setQuizTitle] = useState("Quiz");

  useEffect(() => {
    if (!quizId) return;
    setRuns(readSessionHistory(quizId));
    const quiz = getQuizById(quizId);
    if (quiz) setQuizTitle(quiz.title);
  }, [quizId]);

  const allPlayers = runs.flatMap((r) => r.players);
  const totalSessions = runs.length;
  const totalParticipants = runs.reduce((s, r) => s + r.players.length, 0);
  const avgScore = allPlayers.length > 0
    ? Math.round(allPlayers.reduce((s, p) => s + p.score, 0) / allPlayers.length)
    : 0;
  const bestScore = allPlayers.length > 0
    ? Math.max(...allPlayers.map((p) => p.score))
    : 0;

  const stats = [
    { icon: <BarChart2 style={{ width: 20, height: 20, color: "var(--ap-brand)" }} />, label: "Sessions", value: totalSessions },
    { icon: <Users style={{ width: 20, height: 20, color: "var(--ap-quiz)" }} />, label: "Participants totaux", value: totalParticipants },
    { icon: <Target style={{ width: 20, height: 20, color: "var(--ap-poll)" }} />, label: "Score moyen", value: avgScore > 0 ? `${avgScore} pts` : "-" },
    { icon: <Trophy style={{ width: 20, height: 20, color: "#f59e0b" }} />, label: "Meilleur score", value: bestScore > 0 ? `${bestScore} pts` : "-" },
  ];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--ap-paper)" }}>
      <Header subtitle="Résultats du quiz" />
      <div className="mx-auto max-w-4xl px-6 py-10">
        <button
          className="ap-btn ap-btn--ghost ap-btn--sm"
          onClick={() => navigate("/my-quizzes")}
          style={{ marginBottom: "24px", display: "flex", alignItems: "center", gap: "6px" }}
        >
          <ArrowLeft style={{ width: 14, height: 14 }} />
          Mes quiz
        </button>

        <div style={{ marginBottom: "32px" }}>
          <h1 className="ap-h2" style={{ fontSize: "26px", marginBottom: "4px" }}>{quizTitle}</h1>
          <p className="ap-muted" style={{ fontSize: "14px" }}>
            {totalSessions > 0
              ? `Résultats des ${totalSessions} dernière${totalSessions > 1 ? "s" : ""} session${totalSessions > 1 ? "s" : ""}`
              : "Aucune session enregistrée"}
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "16px", marginBottom: "32px" }}>
          {stats.map(({ icon, label, value }) => (
            <div key={label} className="ap-card" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "14px" }}>
              <div className="ap-tile__icon" style={{ background: "var(--ap-paper-2)", boxShadow: "0 3px 0 var(--ap-line)", marginBottom: 0, width: 40, height: 40 }}>
                {icon}
              </div>
              <div>
                <div style={{ fontSize: "22px", fontWeight: 800, fontFamily: "var(--ap-font-display)", color: "var(--ap-ink)" }}>{value}</div>
                <div className="ap-muted" style={{ fontSize: "12px" }}>{label}</div>
              </div>
            </div>
          ))}
        </div>

        {runs.length === 0 ? (
          <div style={{ borderRadius: "var(--ap-r-lg)", border: "2px dashed var(--ap-line-2)", background: "var(--ap-paper-2)", padding: "48px 24px", textAlign: "center" }}>
            <BarChart2 style={{ width: 40, height: 40, color: "var(--ap-muted)", margin: "0 auto 12px" }} />
            <p className="ap-muted" style={{ fontSize: "14px", marginBottom: "8px" }}>Aucune session enregistrée pour ce quiz.</p>
            <p className="ap-muted" style={{ fontSize: "13px" }}>Lancez le quiz et les résultats apparaîtront ici.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 className="ap-h3" style={{ fontSize: "16px" }}>Sessions ({totalSessions})</h2>
            {runs.map((run, i) => (
              <SessionCard key={run.id} run={run} defaultOpen={i === 0} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizResults;
