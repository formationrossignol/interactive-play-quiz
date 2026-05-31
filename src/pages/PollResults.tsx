import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ArrowLeft, BarChart2, Users, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { getPollResults, type PollResultsStore, type PollResultSession, type PollQuestionResult } from "@/lib/pollResults";
import { getQuizById } from "@/lib/quizStorage";

const COLORS = ["var(--ap-brand)", "var(--ap-poll)", "var(--ap-flash)", "var(--ap-quiz)", "#22c55e", "#8b5cf6", "#ec4899", "#f97316"];

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
};

const QuestionResultCard = ({ result }: { result: PollQuestionResult }) => {
  const hasChoices = result.answers && result.answers.length > 0 && result.distribution.length > 0;
  const total = result.totalResponses || 1;

  if (!hasChoices) {
    return (
      <div className="ap-card" style={{ padding: "24px" }}>
        <p className="ap-h3" style={{ fontSize: "15px", marginBottom: "12px" }}>
          <span className="ap-pill" style={{ marginRight: "8px", fontSize: "11px" }}>{result.questionIndex + 1}</span>
          {result.question}
        </p>
        <p className="ap-muted" style={{ fontSize: "13px" }}>
          {result.type === "open-text" ? "Réponses libres — non disponibles dans cette vue." : `Type : ${result.type} — ${result.totalResponses} réponse(s).`}
        </p>
      </div>
    );
  }

  const chartData = result.answers!.map((answer, i) => ({
    name: answer.length > 20 ? answer.slice(0, 20) + "…" : answer,
    fullName: answer,
    count: result.distribution[i] ?? 0,
    pct: Math.round(((result.distribution[i] ?? 0) / total) * 100),
  }));

  const maxCount = Math.max(...chartData.map((d) => d.count), 1);

  return (
    <div className="ap-card" style={{ padding: "24px" }}>
      <div style={{ marginBottom: "16px" }}>
        <p className="ap-h3" style={{ fontSize: "15px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span className="ap-pill" style={{ fontSize: "11px", flexShrink: 0 }}>{result.questionIndex + 1}</span>
          {result.question}
        </p>
        <p className="ap-muted" style={{ fontSize: "12px", marginTop: "4px" }}>{result.totalResponses} réponse{result.totalResponses > 1 ? "s" : ""}</p>
      </div>

      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--ap-line)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--ap-muted)", fontFamily: "var(--ap-font-body)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--ap-muted)" }} domain={[0, maxCount + 1]} allowDecimals={false} />
            <Tooltip
              formatter={(value: number, _name: string, props: any) => [`${value} (${props.payload.pct}%)`, props.payload.fullName]}
              contentStyle={{ fontFamily: "var(--ap-font-body)", fontSize: 13, border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)", background: "var(--ap-card)" }}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {chartData.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "12px" }}>
        {chartData.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: 12, height: 12, borderRadius: "3px", background: COLORS[i % COLORS.length], flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: "13px", fontFamily: "var(--ap-font-body)", fontWeight: 600, color: "var(--ap-ink)" }}>{d.fullName}</span>
            <span className="ap-pill" style={{ fontSize: "11px" }}>{d.count} ({d.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const SessionCard = ({ session, defaultOpen }: { session: PollResultSession; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const totalResponses = session.questions.reduce((s, q) => s + q.totalResponses, 0);

  return (
    <div className="ap-card" style={{ padding: 0, overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 24px", background: "none", border: "none", cursor: "pointer",
          fontFamily: "var(--ap-font-body)", gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
          <Calendar style={{ width: 16, height: 16, color: "var(--ap-poll)", flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--ap-ink)" }}>{formatDate(session.date)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
          <span className="ap-pill" style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}>
            <Users style={{ width: 11, height: 11 }} />{session.totalParticipants}
          </span>
          <span className="ap-pill" style={{ fontSize: "11px" }}>{totalResponses} rép.</span>
          {open ? <ChevronUp style={{ width: 16, height: 16, color: "var(--ap-muted)" }} /> : <ChevronDown style={{ width: 16, height: 16, color: "var(--ap-muted)" }} />}
        </div>
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: "12px", borderTop: "2px solid var(--ap-line)" }}>
          {session.questions.map((q) => (
            <QuestionResultCard key={q.questionIndex} result={q} />
          ))}
        </div>
      )}
    </div>
  );
};

const PollResults = () => {
  const { pollId } = useParams<{ pollId: string }>();
  const navigate = useNavigate();
  const [store, setStore] = useState<PollResultsStore | null>(null);
  const [pollTitle, setPollTitle] = useState("Sondage");

  useEffect(() => {
    if (!pollId) return;
    const results = getPollResults(pollId);
    setStore(results);

    const quiz = getQuizById(pollId);
    if (quiz) setPollTitle(quiz.title);
    else if (results) setPollTitle(results.pollTitle);
  }, [pollId]);

  const totalParticipants = store?.sessions.reduce((s, sess) => s + sess.totalParticipants, 0) ?? 0;
  const totalSessions = store?.sessions.length ?? 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--ap-paper)" }}>
      <Header subtitle="Résultats du sondage" />
      <div className="mx-auto max-w-4xl px-6 py-10">
        <button
          className="ap-btn ap-btn--ghost ap-btn--sm"
          onClick={() => navigate("/my-polls")}
          style={{ marginBottom: "24px" }}
        >
          <ArrowLeft style={{ width: 14, height: 14 }} />
          Mes sondages
        </button>

        <div style={{ marginBottom: "32px" }}>
          <h1 className="ap-h2" style={{ fontSize: "26px", marginBottom: "4px" }}>{pollTitle}</h1>
          <p className="ap-muted" style={{ fontSize: "14px" }}>Résultats centralisés de toutes les sessions</p>
        </div>

        {/* Summary stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "16px", marginBottom: "32px" }}>
          {[
            { icon: <BarChart2 style={{ width: 20, height: 20, color: "var(--ap-poll)" }} />, label: "Sessions", value: totalSessions },
            { icon: <Users style={{ width: 20, height: 20, color: "var(--ap-brand)" }} />, label: "Participants totaux", value: totalParticipants },
          ].map(({ icon, label, value }) => (
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

        {!store || store.sessions.length === 0 ? (
          <div style={{ borderRadius: "var(--ap-r-lg)", border: "2px dashed var(--ap-line-2)", background: "var(--ap-paper-2)", padding: "48px 24px", textAlign: "center" }}>
            <BarChart2 style={{ width: 40, height: 40, color: "var(--ap-muted)", margin: "0 auto 12px" }} />
            <p className="ap-muted" style={{ fontSize: "14px", marginBottom: "8px" }}>Aucune session enregistrée pour ce sondage.</p>
            <p className="ap-muted" style={{ fontSize: "13px" }}>Lancez le sondage et les résultats apparaîtront ici.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 className="ap-h3" style={{ fontSize: "16px" }}>Sessions ({totalSessions})</h2>
            {store.sessions.map((session, i) => (
              <SessionCard key={session.sessionId} session={session} defaultOpen={i === 0} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PollResults;
