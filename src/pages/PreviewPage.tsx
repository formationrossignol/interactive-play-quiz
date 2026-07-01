import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { QuizPreview } from "@/components/QuizPreview";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ANSWER_COLORS = ["#E74C3C", "#3498DB", "#F39C12", "#2ECC71"];
const ANSWER_SHAPES = ["▲", "◆", "●", "■"];

interface ParticipantPreviewProps {
  question: any;
  isPoll: boolean;
}

const ParticipantPreview = ({ question, isPoll }: ParticipantPreviewProps) => {
  const [picked, setPicked] = useState<number | string | null>(null);
  const [phase, setPhase] = useState<"question" | "feedback">("question");

  useEffect(() => {
    setPicked(null);
    setPhase("question");
  }, [question]);

  if (!question) return null;

  const handlePick = (answer: number | string) => {
    if (phase === "feedback") return;
    setPicked(answer);
    setPhase("feedback");
  };

  const isCorrect = (() => {
    if (picked === null) return false;
    if (question.type === "true-false") return (picked === "true") === (question.correctAnswer === true || question.correctAnswer === "true");
    if (question.type === "short-answer") return String(picked).toLowerCase().trim() === String(question.correctAnswer ?? "").toLowerCase().trim();
    return picked === question.correctAnswer;
  })();

  const points = question.points ?? 100;

  if (phase === "feedback") {
    return (
      <div
        className="flex flex-col items-center justify-center h-full text-center px-4"
        style={{ background: isCorrect ? "var(--ap-brand)" : "#1a1a2e" }}
      >
        <div style={{ fontSize: 72, marginBottom: 16 }}>{isCorrect ? "✅" : "❌"}</div>
        <h2 style={{ fontFamily: "var(--ap-font-display)", fontSize: "1.5rem", fontWeight: 800, color: "#fff", marginBottom: 8 }}>
          {isCorrect ? "Bonne réponse !" : "Mauvaise réponse !"}
        </h2>
        {isCorrect && (
          <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 999, padding: "8px 28px", marginTop: 12 }}>
            <span style={{ fontFamily: "var(--ap-font-display)", fontWeight: 900, fontSize: "2rem", color: "#fff" }}>
              +{points}
            </span>
          </div>
        )}
        <button
          style={{
            marginTop: 28,
            background: "rgba(255,255,255,0.15)",
            border: "2px solid rgba(255,255,255,0.3)",
            borderRadius: 999,
            color: "#fff",
            fontFamily: "var(--ap-font-body)",
            fontWeight: 700,
            fontSize: 13,
            padding: "8px 20px",
            cursor: "pointer",
          }}
          onClick={() => { setPicked(null); setPhase("question"); }}
        >
          Réessayer
        </button>
      </div>
    );
  }

  const renderAnswers = () => {
    if (question.type === "multiple-choice" || question.type === "single-choice") {
      return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {(question.answers ?? []).map((answer: string, i: number) => (
            <button
              key={i}
              onClick={() => handlePick(i)}
              style={{
                background: ANSWER_COLORS[i % 4],
                border: "none",
                borderRadius: 12,
                padding: "12px 8px",
                color: "#fff",
                fontFamily: "var(--ap-font-body)",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                textAlign: "left",
                transition: "filter .1s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.15)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.filter = "")}
            >
              <span style={{ flexShrink: 0 }}>{ANSWER_SHAPES[i % 4]}</span>
              <span style={{ flex: 1 }}>{answer}</span>
            </button>
          ))}
        </div>
      );
    }
    if (question.type === "true-false") {
      return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[{ label: question.answers?.[0] ?? "Vrai", value: "true" }, { label: question.answers?.[1] ?? "Faux", value: "false" }].map(({ label, value }, i) => (
            <button
              key={value}
              onClick={() => handlePick(value)}
              style={{
                background: i === 0 ? "#27AE60" : "#E74C3C",
                border: "none",
                borderRadius: 12,
                padding: "14px 8px",
                color: "#fff",
                fontFamily: "var(--ap-font-body)",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 20 }}>{i === 0 ? "✓" : "✗"}</span> {label}
            </button>
          ))}
        </div>
      );
    }
    if (question.type === "short-answer") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            placeholder="Votre réponse…"
            style={{
              width: "100%",
              borderRadius: 12,
              border: "2px solid rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              padding: "12px 14px",
              fontFamily: "var(--ap-font-body)",
              fontWeight: 600,
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
            onKeyDown={(e) => e.key === "Enter" && handlePick((e.target as HTMLInputElement).value.trim())}
          />
          <button
            style={{ background: "rgba(255,255,255,0.2)", border: "2px solid rgba(255,255,255,0.3)", borderRadius: 999, color: "#fff", fontWeight: 700, fontSize: 14, padding: "10px", cursor: "pointer" }}
            onClick={(e) => {
              const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
              if (input?.value.trim()) handlePick(input.value.trim());
            }}
          >
            Valider
          </button>
        </div>
      );
    }
    if (question.type === "slider") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ color: "#fff", textAlign: "center", fontWeight: 800, fontSize: 28, fontFamily: "var(--ap-font-display)" }}>
            {question.min ?? 0}
          </div>
          <input type="range" min={question.min ?? 0} max={question.max ?? 100} step={question.step ?? 1} defaultValue={question.min ?? 0} style={{ accentColor: "#fff", width: "100%" }} />
          <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,.6)", fontSize: 12 }}>
            <span>{question.minLabel ?? question.min ?? 0}</span>
            <span>{question.maxLabel ?? question.max ?? 100}</span>
          </div>
          <button style={{ background: "rgba(255,255,255,0.2)", border: "2px solid rgba(255,255,255,0.3)", borderRadius: 999, color: "#fff", fontWeight: 700, fontSize: 14, padding: "10px", cursor: "pointer" }} onClick={() => handlePick(0)}>
            Valider
          </button>
        </div>
      );
    }
    return (
      <p style={{ color: "rgba(255,255,255,.6)", fontSize: 13, textAlign: "center", fontStyle: "italic" }}>
        {isPoll ? "Sondage interactif" : "Type de question avancé"}
      </p>
    );
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--ap-brand)" }}>
      {/* Timer bar */}
      <div style={{ height: 6, background: "rgba(255,255,255,.3)", borderRadius: 999, margin: "12px 16px 0" }}>
        <div style={{ height: "100%", width: "60%", background: "#fff", borderRadius: 999, transition: "width 1s linear" }} />
      </div>

      {/* Question */}
      <div style={{ padding: "16px 16px 10px", flex: "0 0 auto" }}>
        <h3 style={{ fontFamily: "var(--ap-font-display)", fontWeight: 800, fontSize: 15, color: "#fff", lineHeight: 1.4, margin: 0 }}>
          {question.question || "Question"}
        </h3>
      </div>

      {/* Answers */}
      <div style={{ padding: "0 12px 16px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        {renderAnswers()}
      </div>
    </div>
  );
};

const PreviewPage = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<any>(null);
  const [currentQ, setCurrentQ] = useState(0);

  useEffect(() => {
    if (!quizId) return;
    for (const key of [`quiz-${quizId}`, `poll-${quizId}`, quizId]) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try { setQuiz(JSON.parse(raw)); return; } catch {}
      }
    }
  }, [quizId]);

  if (!quiz) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", color: "#fff" }}>
      Chargement…
    </div>
  );

  const questions = quiz.questions ?? [];
  const total = questions.length;
  const isPoll = quiz.type === "poll";
  const question = questions[currentQ] ?? null;

  const go = (idx: number) => setCurrentQ(Math.max(0, Math.min(total - 1, idx)));

  const launchDemo = () => {
    navigate(`/quiz/${quizId}`);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#0a0a1a",
        overflow: "hidden",
      }}
    >
      {/* Background blur */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: "radial-gradient(ellipse at 20% 30%, rgba(112,72,255,.35) 0%, transparent 60%), radial-gradient(ellipse at 80% 70%, rgba(0,212,255,.2) 0%, transparent 60%)",
          pointerEvents: "none",
        }}
      />

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", gap: 24, padding: "24px 24px 0", alignItems: "flex-start", position: "relative", zIndex: 1 }}>

        {/* Host panel */}
        <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: 13, color: "rgba(255,255,255,.6)", margin: 0, letterSpacing: "0.03em" }}>
            Affichage du présentateur
          </p>
          <div
            style={{
              width: "100%",
              aspectRatio: "16/9",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 8px 40px rgba(0,0,0,.6)",
              border: "2px solid rgba(255,255,255,.1)",
            }}
          >
            <QuizPreview
              title={quiz.title ?? ""}
              description={quiz.description ?? ""}
              category={quiz.category ?? ""}
              headerImage={quiz.headerImage}
              questions={questions}
              isPoll={isPoll}
              theme={quiz.theme}
              fontFamily={quiz.font}
              selectedQuestionIndex={currentQ}
            />
          </div>
        </div>

        {/* Participant panel — phone mockup */}
        <div style={{ flexShrink: 0, width: 260, display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: 13, color: "rgba(255,255,255,.6)", margin: 0, letterSpacing: "0.03em" }}>
            Affichage des participants
          </p>
          <div
            style={{
              width: 260,
              height: 480,
              borderRadius: 24,
              overflow: "hidden",
              boxShadow: "0 8px 40px rgba(0,0,0,.6)",
              border: "3px solid rgba(255,255,255,.15)",
              background: "var(--ap-brand)",
              position: "relative",
            }}
          >
            {/* Phone notch */}
            <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", width: 60, height: 5, borderRadius: 999, background: "rgba(0,0,0,.3)", zIndex: 10 }} />
            <div style={{ paddingTop: 20, height: "100%", boxSizing: "border-box" }}>
              <ParticipantPreview question={question} isPoll={isPoll} key={currentQ} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom navigation bar */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 24px",
          background: "rgba(0,0,0,.7)",
          backdropFilter: "blur(12px)",
          borderTop: "1px solid rgba(255,255,255,.1)",
          marginTop: 16,
        }}
      >
        {/* Quit */}
        <button
          onClick={() => navigate(-1)}
          style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,.8)", background: "none", border: "none", fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: 14, cursor: "pointer", padding: "6px 12px" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#fff")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,.8)")}
        >
          <X style={{ width: 16, height: 16 }} />
          Quitter
        </button>

        {/* Navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <NavBtn onClick={() => go(0)} disabled={currentQ === 0}><ChevronsLeft style={{ width: 16, height: 16 }} /></NavBtn>
          <NavBtn onClick={() => go(currentQ - 1)} disabled={currentQ === 0}><ChevronLeft style={{ width: 16, height: 16 }} /></NavBtn>
          <span style={{ color: "#fff", fontFamily: "var(--ap-font-display)", fontWeight: 700, fontSize: 14, padding: "0 12px", minWidth: 60, textAlign: "center" }}>
            {currentQ + 1} / {total}
          </span>
          <NavBtn onClick={() => go(currentQ + 1)} disabled={currentQ >= total - 1}><ChevronRight style={{ width: 16, height: 16 }} /></NavBtn>
          <NavBtn onClick={() => go(total - 1)} disabled={currentQ >= total - 1}><ChevronsRight style={{ width: 16, height: 16 }} /></NavBtn>
        </div>

        {/* Launch demo */}
        <button
          onClick={launchDemo}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "var(--ap-brand)",
            border: "none",
            borderRadius: 999,
            color: "#fff",
            fontFamily: "var(--ap-font-display)",
            fontWeight: 800,
            fontSize: 14,
            padding: "10px 22px",
            cursor: "pointer",
            boxShadow: "0 4px 0 var(--ap-brand-deep)",
            transition: "transform .1s",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "")}
        >
          <Play style={{ width: 15, height: 15 }} />
          Lancer la démo
        </button>
      </div>
    </div>
  );
};

const NavBtn = ({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      background: "rgba(255,255,255,.1)",
      border: "1px solid rgba(255,255,255,.2)",
      borderRadius: 8,
      color: disabled ? "rgba(255,255,255,.3)" : "#fff",
      width: 32,
      height: 32,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: disabled ? "default" : "pointer",
      transition: "background .1s",
    }}
    onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,.2)"; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,.1)"; }}
  >
    {children}
  </button>
);

export default PreviewPage;
