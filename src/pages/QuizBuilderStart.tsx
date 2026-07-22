import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { ArrowRight, Plus } from "lucide-react";
import { Header } from "@/components/Header";
import { PollTemplateSelectorEnhanced } from "@/components/PollTemplateSelectorEnhanced";
import { QuizTemplateSelectorEnhanced } from "@/components/QuizTemplateSelectorEnhanced";
import { FlashcardTemplateSelectorEnhanced } from "@/components/FlashcardTemplateSelectorEnhanced";
import { SlideTemplateSelectorEnhanced } from "@/components/SlideTemplateSelectorEnhanced";
import { QUIZ_TEMPLATES } from "@/lib/quizTemplates";
import { POLL_TEMPLATES } from "@/lib/pollTemplates";
import { t } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getUserQuizzes } from "@/lib/quizStorage";
import { CONTENT_CAPS, CONTENT_KIND_LABELS, getPlan, type ContentKind } from "@/lib/plans";
import { PlanLimitBlocker } from "@/components/PlanLimitBlocker";
import type { PollTemplate } from "@/lib/pollTemplates";
import type { QuizTemplate } from "@/lib/quizTemplates";
import type { FlashcardTemplate } from "@/lib/flashcardTemplates";
import type { SlideTemplate } from "@/lib/slideTemplates";

// Pastel gradient backgrounds for template cards — cycles by index
const CARD_GRADIENTS = [
  "linear-gradient(135deg, #6C63FF 0%, #4ECDC4 100%)",
  "linear-gradient(135deg, #FF6B6B 0%, #FFE66D 100%)",
  "linear-gradient(135deg, #2ECC71 0%, #1ABC9C 100%)",
  "linear-gradient(135deg, #F093FB 0%, #F5576C 100%)",
  "linear-gradient(135deg, #4FACFE 0%, #00F2FE 100%)",
  "linear-gradient(135deg, #43E97B 0%, #38F9D7 100%)",
];

const PREVIEW_COUNT = 5;

export const QuizBuilderStart = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const quizType = (searchParams.get("type") || "quiz") as "quiz" | "poll" | "flashcard" | "slide";

  const user = getCurrentUser();
  const plan = getPlan(user);
  const cap = CONTENT_CAPS[plan][quizType as ContentKind];
  const used = user ? getUserQuizzes(user.id).filter((q) => q.type === quizType).length : 0;
  const atCap = cap !== null && used >= cap;

  if (quizType === "slide" && !atCap) return <Navigate to="/presentation-editor" replace />;

  const [showAll, setShowAll] = useState(false);
  const isPoll = quizType === "poll";
  const isFlashcard = quizType === "flashcard";
  const isSlide = quizType === "slide";

  const handleFromScratch = () => navigate(`/builder?type=${quizType}`);
  const handleSelectTemplate = (template: PollTemplate | QuizTemplate | FlashcardTemplate | SlideTemplate) => {
    navigate(`/builder?type=${quizType}&templateId=${template.id}`);
  };

  const pageTitle = isSlide
    ? "Créer une nouvelle présentation"
    : isFlashcard
    ? t("createNewFlashcard")
    : isPoll
    ? t("createNewPoll")
    : t("createNewQuiz");

  const previewTemplates = isPoll
    ? POLL_TEMPLATES.slice(0, PREVIEW_COUNT)
    : QUIZ_TEMPLATES.slice(0, PREVIEW_COUNT);

  if (atCap) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <Header subtitle={pageTitle} />
        <PlanLimitBlocker
          title="Limite du plan Starter atteinte"
          description={`Le plan Starter est limité à ${cap} ${CONTENT_KIND_LABELS[quizType as ContentKind]}. Passez au plan Pro pour créer sans limite.`}
        />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <Header
        subtitle={
          isSlide
            ? "Créateur de Présentations"
            : isFlashcard
            ? t("flashcardBuilder")
            : isPoll
            ? t("pollBuilder")
            : t("quizBuilder")
        }
      />

      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-10 text-center">
          <h1 className="ap-h2" style={{ fontSize: "28px", marginBottom: "8px" }}>{pageTitle}</h1>
          <p className="ap-muted">
            {isPoll ? t("choosePollStart") : isFlashcard ? t("chooseFlashcardStart") : isSlide ? "Choisissez comment commencer" : t("chooseQuizStart")}
          </p>
        </div>

        {showAll ? (
          <div className="space-y-5">
            <button
              onClick={() => setShowAll(false)}
              className="ap-btn ap-btn--ghost ap-btn--sm"
              style={{ alignSelf: "flex-start" }}
            >
              ← {t("back")}
            </button>
            {isPoll ? (
              <PollTemplateSelectorEnhanced selectedTemplateId={null} onSelectTemplate={handleSelectTemplate} />
            ) : isSlide ? (
              <SlideTemplateSelectorEnhanced selectedTemplateId={null} onSelectTemplate={handleSelectTemplate} />
            ) : isFlashcard ? (
              <FlashcardTemplateSelectorEnhanced selectedTemplateId={null} onSelectTemplate={handleSelectTemplate} />
            ) : (
              <QuizTemplateSelectorEnhanced selectedTemplateId={null} onSelectTemplate={handleSelectTemplate} />
            )}
          </div>
        ) : (
          <div>
            {/* Section heading */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
              <h2 className="ap-h3" style={{ margin: 0, fontSize: "17px" }}>Commencer depuis un modèle</h2>
            </div>

            {/* Horizontal scrollable strip */}
            <div
              style={{
                display: "flex",
                gap: "14px",
                overflowX: "auto",
                paddingBottom: "12px",
                scrollbarWidth: "thin",
              }}
            >
              {/* Blank card */}
              <button
                onClick={handleFromScratch}
                style={{
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "12px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  width: 140,
                }}
              >
                <div
                  style={{
                    width: 140,
                    height: 100,
                    borderRadius: "var(--ap-r-md)",
                    border: "var(--ap-border-w) dashed var(--ap-line)",
                    background: "var(--ap-card)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "border-color .15s, background .15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = "var(--ap-brand)";
                    (e.currentTarget as HTMLDivElement).style.background = "var(--ap-brand-soft)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = "var(--ap-line)";
                    (e.currentTarget as HTMLDivElement).style.background = "var(--ap-card)";
                  }}
                >
                  <Plus style={{ width: 28, height: 28, color: "var(--ap-muted)" }} />
                </div>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ap-ink)", fontFamily: "var(--ap-font-body)" }}>
                  Vierge
                </span>
              </button>

              {/* Template cards */}
              {(isFlashcard || isSlide ? [] : previewTemplates).map((tpl, idx) => (
                <button
                  key={tpl.id}
                  onClick={() => handleSelectTemplate(tpl)}
                  style={{
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "12px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    width: 140,
                  }}
                >
                  <div
                    style={{
                      width: 140,
                      height: 100,
                      borderRadius: "var(--ap-r-md)",
                      background: CARD_GRADIENTS[idx % CARD_GRADIENTS.length],
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "36px",
                      boxShadow: "0 4px 16px rgba(0,0,0,.10)",
                      transition: "transform .15s, box-shadow .15s",
                      position: "relative",
                      overflow: "hidden",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
                      (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(0,0,0,.16)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.transform = "";
                      (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,.10)";
                    }}
                  >
                    <span style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,.2))" }}>{tpl.icon}</span>
                  </div>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "var(--ap-ink)",
                      fontFamily: "var(--ap-font-body)",
                      textAlign: "center",
                      maxWidth: 130,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={tpl.name}
                  >
                    {tpl.name}
                  </span>
                </button>
              ))}

              {/* Browse all card */}
              <button
                onClick={() => setShowAll(true)}
                style={{
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "12px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  width: 140,
                }}
              >
                <div
                  style={{
                    width: 140,
                    height: 100,
                    borderRadius: "var(--ap-r-md)",
                    background: "linear-gradient(135deg, var(--ap-brand) 0%, var(--ap-flash) 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 16px rgba(0,0,0,.10)",
                    transition: "transform .15s, box-shadow .15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(0,0,0,.16)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = "";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,.10)";
                  }}
                >
                  <ArrowRight style={{ width: 28, height: 28, color: "#fff" }} />
                </div>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ap-ink)", fontFamily: "var(--ap-font-body)" }}>
                  Voir tout
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizBuilderStart;
