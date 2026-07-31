import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import type { ComponentType } from "react";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Globe2,
  GraduationCap,
  Landmark,
  Map,
  MessageSquare,
  Microscope,
  PartyPopper,
  Plus,
  Rocket,
  UsersRound,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PollTemplateSelectorEnhanced } from "@/components/PollTemplateSelectorEnhanced";
import { QuizTemplateSelectorEnhanced } from "@/components/QuizTemplateSelectorEnhanced";
import { FlashcardTemplateSelectorEnhanced } from "@/components/FlashcardTemplateSelectorEnhanced";
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

const TEMPLATE_ICONS: Record<string, ComponentType<{ style?: React.CSSProperties }>> = {
  "culture-generale": Globe2,
  sciences: Microscope,
  histoire: Landmark,
  geographie: Map,
  "satisfaction-formation": GraduationCap,
  "engagement-equipe": UsersRound,
  "preparation-projet": Rocket,
  "feedback-produit": MessageSquare,
  icebreaker: PartyPopper,
  "pulse-survey": Activity,
};

const PREVIEW_COUNT = 5;

export const QuizBuilderStart = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const quizType = (searchParams.get("type") || "quiz") as "quiz" | "poll" | "flashcard" | "slide";
  // Hooks must run unconditionally on every render (Rules of Hooks), so declare
  // this before the early return below.
  const [showAll, setShowAll] = useState(false);

  const user = getCurrentUser();
  const plan = getPlan(user);
  const cap = CONTENT_CAPS[plan][quizType as ContentKind];
  const used = user ? getUserQuizzes(user.id).filter((q) => q.type === quizType).length : 0;
  const atCap = cap !== null && used >= cap;

  if (quizType === "slide" && !atCap) return <Navigate to="/presentation-editor" replace />;

  const isPoll = quizType === "poll";
  const isFlashcard = quizType === "flashcard";
  const templateAccent = isPoll ? "--ap-poll" : isFlashcard ? "--ap-flash" : "--ap-quiz";

  const handleFromScratch = () => navigate(`/builder?type=${quizType}`);
  const handleSelectTemplate = (template: PollTemplate | QuizTemplate | FlashcardTemplate) => {
    navigate(`/builder?type=${quizType}&templateId=${template.id}`);
  };

  const pageTitle = isFlashcard
    ? t("createNewFlashcard")
    : isPoll
    ? t("createNewPoll")
    : t("createNewQuiz");

  const previewTemplates = isPoll
    ? POLL_TEMPLATES.slice(0, PREVIEW_COUNT)
    : QUIZ_TEMPLATES.slice(0, PREVIEW_COUNT);

  if (atCap) {
    return (
      <AppLayout subtitle={pageTitle}>
        <PlanLimitBlocker
          title="Limite du plan Starter atteinte"
          description={`Le plan Starter est limité à ${cap} ${CONTENT_KIND_LABELS[quizType as ContentKind]}. Passez au plan Pro pour créer sans limite.`}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      subtitle={
        isFlashcard
          ? t("flashcardBuilder")
          : isPoll
          ? t("pollBuilder")
          : t("quizBuilder")
      }
    >

      <div className="product-page product-page--medium">
        <div className="product-template-start">
          <h1>{pageTitle}</h1>
          <p>
            {isPoll ? t("choosePollStart") : isFlashcard ? t("chooseFlashcardStart") : t("chooseQuizStart")}
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
            ) : isFlashcard ? (
              <FlashcardTemplateSelectorEnhanced selectedTemplateId={null} onSelectTemplate={handleSelectTemplate} />
            ) : (
              <QuizTemplateSelectorEnhanced selectedTemplateId={null} onSelectTemplate={handleSelectTemplate} />
            )}
          </div>
        ) : (
          <div>
            {/* Section heading */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <h2 className="ap-h3" style={{ margin: 0, fontSize: "17px" }}>Commencer depuis un modèle</h2>
            </div>

            {/* Horizontal scrollable strip */}
            <div
              className="qb-template-strip"
              style={{
                display: "flex",
                gap: "16px",
                overflowX: "auto",
                padding: "4px 4px 16px",
                margin: "0 -4px",
                scrollbarWidth: "thin",
              }}
            >
              {/* Blank card */}
              <button
                onClick={handleFromScratch}
                className="ap-card ap-card--hover qb-template-card"
                style={{
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  cursor: "pointer",
                  padding: 0,
                  width: 164,
                  overflow: "hidden",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    height: 108,
                    borderBottom: "var(--ap-border-w) solid var(--ap-line)",
                    background: "var(--ap-paper-2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "var(--ap-r-md)",
                      border: "var(--ap-border-w) dashed var(--ap-line-2)",
                      display: "grid",
                      placeItems: "center",
                      background: "var(--ap-card)",
                    }}
                  >
                    <Plus style={{ width: 24, height: 24, color: "var(--ap-muted)" }} />
                  </span>
                </div>
                <span style={{ padding: "13px 14px 14px", fontSize: "13px", fontWeight: 800, color: "var(--ap-ink)", fontFamily: "var(--ap-font-body)" }}>
                  Vierge
                </span>
              </button>

              {/* Template cards */}
              {(isFlashcard ? [] : previewTemplates).map((tpl) => {
                const TemplateIcon = TEMPLATE_ICONS[tpl.id] ?? BookOpen;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => handleSelectTemplate(tpl)}
                    className="ap-card ap-card--hover qb-template-card"
                    style={{
                      flexShrink: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      cursor: "pointer",
                      padding: 0,
                      width: 164,
                      overflow: "hidden",
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        height: 108,
                        borderBottom: "var(--ap-border-w) solid var(--ap-line)",
                        background: `color-mix(in srgb, var(${templateAccent}) 14%, var(--ap-paper-2))`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <TemplateIcon style={{ width: 38, height: 38, color: `var(${templateAccent})` }} />
                    </div>
                    <span
                      style={{
                        padding: "13px 14px 14px",
                        fontSize: "13px",
                        fontWeight: 800,
                        color: "var(--ap-ink)",
                        fontFamily: "var(--ap-font-body)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={tpl.name}
                    >
                      {tpl.name}
                    </span>
                  </button>
                );
              })}

              {/* Browse all card */}
              <button
                onClick={() => setShowAll(true)}
                className="ap-card ap-card--hover qb-template-card"
                style={{
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  cursor: "pointer",
                  padding: 0,
                  width: 164,
                  overflow: "hidden",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    height: 108,
                    borderBottom: "var(--ap-border-w) solid var(--ap-line)",
                    background: `color-mix(in srgb, var(${templateAccent}) 14%, var(--ap-paper-2))`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ArrowRight style={{ width: 34, height: 34, color: `var(${templateAccent})` }} />
                </div>
                <span style={{ padding: "13px 14px 14px", fontSize: "13px", fontWeight: 800, color: "var(--ap-ink)", fontFamily: "var(--ap-font-body)" }}>
                  Voir tout
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default QuizBuilderStart;
