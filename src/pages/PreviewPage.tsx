import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { QuizPreview } from "@/components/QuizPreview";
import { CircularTimer } from "@/components/CircularTimer";
import { MultiStepProgress } from "@/components/MultiStepProgress";
import { PLAYER_ANSWER_SHAPES } from "@/lib/answerVisuals";
import { getPollOptions } from "@/lib/pollResults";
import { Trophy, LogOut, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Play, X, RotateCcw } from "lucide-react";
import type { SavedQuiz } from "@/lib/quizStorage";
import type { EditableQuestion } from "@/lib/questionTypes";

interface ParticipantPreviewProps {
  question: EditableQuestion;
  questionIndex: number;
  totalQuestions: number;
  isPoll: boolean;
}

/**
 * Réplique fidèle de l'écran joueur (PlayerView) : fond violet marque,
 * carte blanche flottante, timer circulaire réel, cartes réponses
 * Arcade Pop et écran de feedback vert/rouge identique au live.
 */
const ParticipantPreview = ({ question, questionIndex, totalQuestions, isPoll }: ParticipantPreviewProps) => {
  const [picked, setPicked] = useState<number | string | null>(null);
  const [phase, setPhase] = useState<"question" | "feedback">("question");
  const [timeLeft, setTimeLeft] = useState<number>(question?.timeLimit ?? 20);
  const [sliderValue, setSliderValue] = useState<number>(question?.min ?? 0);

  useEffect(() => {
    setPicked(null);
    setPhase("question");
    setTimeLeft(question?.timeLimit ?? 20);
    setSliderValue(question?.min ?? 0);
  }, [question]);

  // Compte à rebours réel, comme en session
  useEffect(() => {
    if (isPoll || phase !== "question") return;
    if (timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, phase, isPoll]);

  if (!question) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center" style={{ background: "var(--ap-brand)" }}>
        <p className="text-white/80 text-sm font-bold" style={{ fontFamily: "var(--ap-font-body)" }}>
          Aucune question à prévisualiser
        </p>
      </div>
    );
  }

  const points = question.points ?? 1000;

  const handlePick = (answer: number | string) => {
    if (phase === "feedback") return;
    setPicked(answer);
    setPhase("feedback");
  };

  const isCorrect = (() => {
    if (isPoll) return true;
    if (picked === null) return false;
    if (question.type === "true-false") {
      return (picked === "true") === (question.correctAnswer === true || question.correctAnswer === "true" || question.correctAnswer === 0);
    }
    if (question.type === "short-answer") {
      return String(picked).toLowerCase().trim() === String(question.correctAnswer ?? "").toLowerCase().trim();
    }
    if (question.type === "slider") {
      const target = question.correctValue ?? question.correctAnswer;
      return target === undefined || Number(picked) === Number(target);
    }
    return picked === question.correctAnswer;
  })();

  const correctAnswerText = (() => {
    if (question.type === "multiple-choice" || question.type === "single-choice") {
      const idx = typeof question.correctAnswer === "number" ? question.correctAnswer : Number(question.correctAnswer);
      return question.answers?.[idx] ?? "";
    }
    if (question.type === "true-false") {
      return question.correctAnswer === "true" || question.correctAnswer === true
        ? (question.answers?.[0] ?? "Vrai")
        : (question.answers?.[1] ?? "Faux");
    }
    if (question.type === "short-answer") return String(question.correctAnswer ?? "");
    if (question.type === "slider") return String(question.correctValue ?? question.correctAnswer ?? "");
    return "";
  })();

  const retryButton = (
    <button
      onClick={() => { setPicked(null); setPhase("question"); setTimeLeft(question?.timeLimit ?? 20); }}
      style={{
        marginTop: 20, display: "inline-flex", alignItems: "center", gap: 6,
        background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.3)",
        borderRadius: 999, color: "#fff", fontFamily: "var(--ap-font-body)",
        fontWeight: 700, fontSize: 12, padding: "7px 16px", cursor: "pointer",
      }}
    >
      <RotateCcw style={{ width: 12, height: 12 }} />
      Rejouer la question
    </button>
  );

  // ── Écran feedback : réplique exacte de PlayerView 'answer-feedback' ──
  if (phase === "feedback") {
    if (isPoll) {
      return (
        <div className="flex h-full flex-col items-center justify-center p-4 text-center" style={{ background: "var(--ap-brand)" }}>
          <div className="text-6xl mb-3 drop-shadow-xl">📬</div>
          <h2 className="text-white font-bold" style={{ fontFamily: "var(--ap-font-display)", fontSize: 22 }}>
            Réponse envoyée !
          </h2>
          <p className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.6)", fontFamily: "var(--ap-font-body)", fontWeight: 700 }}>
            En attente de la suite…
          </p>
          {retryButton}
        </div>
      );
    }
    return (
      <div
        className="flex h-full flex-col items-center justify-center p-4 text-center overflow-y-auto"
        style={{ background: isCorrect ? "var(--ap-pres)" : "var(--ap-quiz-deep)" }}
      >
        <div className="text-6xl mb-3 drop-shadow-xl">{isCorrect ? "✅" : "❌"}</div>
        <h2 className="text-white" style={{ fontFamily: "var(--ap-font-display)", fontWeight: 600, fontSize: 24 }}>
          {isCorrect ? "Bonne réponse !" : "Mauvaise réponse !"}
        </h2>

        {!isCorrect && correctAnswerText && (
          <p className="mt-2 px-3 text-sm" style={{ color: "rgba(255,255,255,0.75)", fontFamily: "var(--ap-font-body)", fontWeight: 600 }}>
            La bonne réponse était : <span className="font-bold text-white">{correctAnswerText}</span>
          </p>
        )}

        <div
          className="mt-4 w-full max-w-[240px] p-4"
          style={{ background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.25)", borderRadius: "var(--ap-r-xl)" }}
        >
          <div className="text-4xl font-bold text-white" style={{ fontFamily: "var(--ap-font-display)" }}>
            +{isCorrect ? points : 0}
          </div>
          <div style={{ color: "rgba(255,255,255,0.75)", fontWeight: 700, fontFamily: "var(--ap-font-body)", fontSize: 13 }}>
            points gagnés
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.2)", marginTop: 12, paddingTop: 12, color: "rgba(255,255,255,0.85)", fontWeight: 700, fontFamily: "var(--ap-font-body)", fontSize: 13 }}>
            Total : <span className="text-white font-bold">{isCorrect ? points : 0} pts</span>
          </div>
        </div>

        <p className="mt-3 text-xs" style={{ color: "rgba(255,255,255,0.5)", fontFamily: "var(--ap-font-body)" }}>
          En attente de la suite…
        </p>
        {retryButton}
      </div>
    );
  }

  // ── Écran question : réplique de PlayerView 'question' ──
  const renderAnswers = () => {
    if (["multiple-choice", "single-choice"].includes(question.type)) {
      return (
        <div className="ap-answers">
          {(question.answers ?? []).map((answer: string, index: number) => (
            <button
              key={index}
              className={`ap-answer ap-answer--${(index % 4) + 1}`}
              onClick={() => handlePick(index)}
              style={{ fontSize: 13, padding: "12px 12px", gap: 9 }}
            >
              <span className="ap-answer__shape" style={{ width: 28, height: 28 }}>{PLAYER_ANSWER_SHAPES[index % 4]}</span>
              <span className="ap-answer__text">{answer || `Réponse ${index + 1}`}</span>
            </button>
          ))}
        </div>
      );
    }

    if (question.type === "true-false") {
      return (
        <div className="ap-answers">
          {[{ label: question.answers?.[0] ?? "Vrai", value: "true" }, { label: question.answers?.[1] ?? "Faux", value: "false" }].map(({ label, value }, index) => (
            <button
              key={value}
              className={`ap-answer ap-answer--${index + 1}`}
              onClick={() => handlePick(value)}
              style={{ fontSize: 13, padding: "12px 12px", gap: 9 }}
            >
              <span className="ap-answer__shape" style={{ width: 28, height: 28, fontWeight: 800 }}>{index === 0 ? "V" : "F"}</span>
              <span className="ap-answer__text">{label}</span>
            </button>
          ))}
        </div>
      );
    }

    if (question.type === "short-answer" || question.type === "open-text") {
      return (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem("answer") as HTMLInputElement;
            if (input.value.trim()) handlePick(input.value.trim());
          }}
        >
          <input
            name="answer"
            type="text"
            placeholder="Votre réponse…"
            autoComplete="off"
            className="w-full rounded-xl p-3 text-sm outline-none"
            style={{ border: "2px solid var(--ap-line)", background: "var(--ap-paper)", color: "var(--ap-ink)", fontFamily: "var(--ap-font-body)", fontWeight: 600 }}
          />
          <button type="submit" className="ap-btn ap-btn--pill" style={{ background: "var(--ap-ink)", fontSize: 14, padding: "10px 20px" }}>
            Valider
          </button>
        </form>
      );
    }

    if (question.type === "slider") {
      return (
        <div className="flex flex-col gap-3">
          <div className="text-center font-bold" style={{ color: "var(--ap-ink)", fontSize: 26, fontFamily: "var(--ap-font-display)" }}>
            {sliderValue}
          </div>
          <input
            type="range"
            min={question.min ?? 0}
            max={question.max ?? 100}
            step={question.step ?? 1}
            value={sliderValue}
            onChange={(e) => setSliderValue(Number(e.target.value))}
            style={{ accentColor: "var(--ap-brand)", width: "100%" }}
          />
          <div className="flex justify-between text-xs font-bold" style={{ color: "var(--ap-muted)" }}>
            <span>{question.minLabel ?? question.min ?? 0}</span>
            <span>{question.maxLabel ?? question.max ?? 100}</span>
          </div>
          <button className="ap-btn ap-btn--pill" style={{ background: "var(--ap-ink)", fontSize: 14, padding: "10px 20px" }} onClick={() => handlePick(sliderValue)}>
            Valider
          </button>
        </div>
      );
    }

    if (["likert-scale", "frequency-scale"].includes(question.type)) {
      const options = getPollOptions(question);
      return (
        <div className="flex flex-col gap-2">
          {options.map((option: string, index: number) => (
            <button
              key={index}
              className="rounded-xl px-3 py-2.5 text-sm font-bold text-left transition-colors"
              style={{ border: "2px solid var(--ap-line)", background: "var(--ap-card)", color: "var(--ap-ink)", boxShadow: "0 3px 0 var(--ap-line)", fontFamily: "var(--ap-font-body)" }}
              onClick={() => handlePick(index)}
            >
              {option}
            </button>
          ))}
        </div>
      );
    }

    if (question.type === "star-rating") {
      const options = getPollOptions(question);
      return (
        <div className="flex justify-center gap-1.5 flex-wrap">
          {options.map((_: string, index: number) => (
            <button
              key={index}
              aria-label={`${index + 1} étoile${index > 0 ? "s" : ""}`}
              className="text-3xl transition-transform hover:scale-125"
              onClick={() => handlePick(index)}
            >
              ⭐
            </button>
          ))}
        </div>
      );
    }

    if (question.type === "nps-scale") {
      const options = getPollOptions(question);
      return (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-[10px] font-bold" style={{ color: "var(--ap-muted)" }}>
            <span>{question.minLabel ?? "Pas du tout probable"}</span>
            <span>{question.maxLabel ?? "Très probable"}</span>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {options.map((option: string, index: number) => (
              <button
                key={index}
                className="rounded-lg py-2 text-sm font-bold"
                style={{ border: "2px solid var(--ap-line)", background: "var(--ap-card)", color: "var(--ap-ink)", fontFamily: "var(--ap-font-body)" }}
                onClick={() => handlePick(index)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <p className="text-center text-xs italic" style={{ color: "var(--ap-muted)", fontFamily: "var(--ap-font-body)" }}>
        Type avancé — jouable en session réelle
      </p>
    );
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-3" style={{ background: "var(--ap-brand)" }}>
      {/* Header joueur (pill question + score + quitter) */}
      <div className="flex items-center justify-between mb-3 text-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <span
            className="ap-pill"
            style={{ background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: 11, padding: "4px 10px" }}
          >
            {isPoll ? "📊 " : ""}Question {questionIndex + 1}
          </span>
          {!isPoll && (
            <span className="flex items-center gap-1 text-sm" style={{ fontFamily: "var(--ap-font-display)", fontWeight: 600 }}>
              <Trophy className="w-3.5 h-3.5" />0
            </span>
          )}
        </div>
        <span
          className="inline-flex items-center justify-center rounded-lg"
          style={{ background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.2)", width: 28, height: 28 }}
          aria-hidden
        >
          <LogOut className="w-3.5 h-3.5" />
        </span>
      </div>

      {/* Progression */}
      <div className="mb-3 flex-shrink-0">
        <MultiStepProgress totalSteps={Math.min(totalQuestions, 15)} currentStep={questionIndex} className="h-2" />
      </div>

      {/* Carte question blanche — identique au live */}
      <div className="ap-card ap-card--floaty" style={{ padding: 16 }}>
        {!isPoll && (
          <div className="flex justify-center mb-3" style={{ transform: "scale(0.72)", transformOrigin: "center top", marginBottom: -8 }}>
            <CircularTimer timeLeft={timeLeft} totalTime={question.timeLimit ?? 20} />
          </div>
        )}

        <h2 className="text-center mb-4" style={{ fontFamily: "var(--ap-font-display)", fontWeight: 600, fontSize: 15, lineHeight: 1.4, color: "var(--ap-ink)" }}>
          {question.question || question.text || "Posez votre question…"}
        </h2>

        {renderAnswers()}
      </div>
    </div>
  );
};

const PreviewPage = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<SavedQuiz | null>(null);
  const [currentQ, setCurrentQ] = useState(0);

  useEffect(() => {
    if (!quizId) return;
    for (const key of [`quiz-${quizId}`, `poll-${quizId}`, quizId]) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try { setQuiz(JSON.parse(raw)); return; } catch { /* try next key */ }
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
    // Les aperçus portent un id "preview-<timestamp>" : on génère un vrai
    // code de partie à 6 chiffres pour que le lobby affiche un code propre
    // et scannable, comme pour un quiz sauvegardé.
    if (quizId?.startsWith("preview-")) {
      const gameCode = (Math.floor(Math.random() * 900000) + 100000).toString();
      localStorage.setItem(`quiz-${gameCode}`, JSON.stringify({ ...quiz, id: gameCode }));
      navigate(`/quiz/${gameCode}`);
      return;
    }
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
      <div style={{ flex: 1, display: "flex", gap: 28, padding: "24px 24px 0", alignItems: "flex-start", justifyContent: "center", position: "relative", zIndex: 1 }}>

        {/* Host panel */}
        <div style={{ flex: "1 1 0", minWidth: 0, maxWidth: 960, display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: 13, color: "rgba(255,255,255,.6)", margin: 0, letterSpacing: "0.03em" }}>
            Écran du présentateur — tel qu'il sera projeté
          </p>
          <div
            style={{
              width: "100%",
              aspectRatio: "16/9",
              borderRadius: 14,
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

        {/* Participant panel — phone mockup (même bezel que le builder) */}
        <div style={{ flexShrink: 0, width: 300, display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: 13, color: "rgba(255,255,255,.6)", margin: 0, letterSpacing: "0.03em" }}>
            Écran des participants — interactif, essayez !
          </p>
          <div
            style={{
              width: 300,
              background: "var(--ap-ink)",
              borderRadius: 38,
              padding: 10,
              boxShadow: "0 10px 0 #16102a, 0 30px 50px rgba(0,0,0,.55)",
            }}
          >
            <div style={{ borderRadius: 28, overflow: "hidden", height: 560, position: "relative" }}>
              {/* Notch */}
              <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 88, height: 20, background: "var(--ap-ink)", borderRadius: "0 0 13px 13px", zIndex: 20 }} />
              <ParticipantPreview
                question={question}
                questionIndex={currentQ}
                totalQuestions={total || 1}
                isPoll={isPoll}
                key={currentQ}
              />
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
          Lancer en réel
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
