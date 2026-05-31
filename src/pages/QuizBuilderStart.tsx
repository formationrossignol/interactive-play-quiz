import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, Sparkles, ArrowRight, Upload, Database } from "lucide-react";
import { Header } from "@/components/Header";
import { PollTemplateSelectorEnhanced } from "@/components/PollTemplateSelectorEnhanced";
import { QuizTemplateSelectorEnhanced } from "@/components/QuizTemplateSelectorEnhanced";
import { FlashcardTemplateSelectorEnhanced } from "@/components/FlashcardTemplateSelectorEnhanced";
import { SlideTemplateSelectorEnhanced } from "@/components/SlideTemplateSelectorEnhanced";
import { ImportFileModal } from "@/components/ImportFileModal";
import { t } from "@/lib/i18n";
import type { PollTemplate } from "@/lib/pollTemplates";
import type { QuizTemplate } from "@/lib/quizTemplates";
import type { FlashcardTemplate } from "@/lib/flashcardTemplates";
import type { SlideTemplate } from "@/lib/slideTemplates";

export const QuizBuilderStart = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const quizType = (searchParams.get("type") || "quiz") as "quiz" | "poll" | "flashcard" | "slide";

  const [showTemplates, setShowTemplates] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
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

  const pageSubtitle = isSlide
    ? "Choisissez comment commencer votre présentation"
    : isFlashcard
    ? t("chooseFlashcardStart")
    : isPoll
    ? t("choosePollStart")
    : t("chooseQuizStart");

  return (
    <div style={{ minHeight: "100vh", background: "var(--ap-paper)" }}>
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

      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-10 text-center">
          <h1 className="ap-h2" style={{ fontSize: "28px", marginBottom: "8px" }}>{pageTitle}</h1>
          <p className="ap-muted">{pageSubtitle}</p>
        </div>

        {!showTemplates ? (
          <div className="space-y-5">
          <div className="grid md:grid-cols-2 gap-5">
            {/* From scratch */}
            <div
              className="ap-card ap-card--hover"
              style={{ cursor: "pointer", padding: "28px" }}
              onClick={handleFromScratch}
            >
              <div
                className="ap-tile__icon"
                style={{ background: "var(--ap-brand)", boxShadow: "0 5px 0 var(--ap-brand-deep)", marginBottom: "20px" }}
              >
                <FileText className="h-6 w-6" color="#fff" />
              </div>
              <h2 className="ap-h3" style={{ marginBottom: "8px" }}>{t("fromScratch")}</h2>
              <p className="ap-muted" style={{ fontSize: "13.5px", lineHeight: 1.5, marginBottom: "24px" }}>
                {isSlide
                  ? "Créez votre présentation de zéro, diapositive par diapositive"
                  : isFlashcard
                  ? t("createFlashcardFromScratchDesc")
                  : isPoll
                  ? t("createPollFromScratchDesc")
                  : t("createQuizFromScratchDesc")}
              </p>
              <button
                className="ap-btn ap-btn--pill ap-btn--sm"
                onClick={(e) => { e.stopPropagation(); handleFromScratch(); }}
              >
                {t("startFromScratch")}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {/* From template */}
            <div
              className="ap-card ap-card--hover"
              style={{ cursor: "pointer", padding: "28px" }}
              onClick={() => setShowTemplates(true)}
            >
              <div
                className="ap-tile__icon"
                style={{ background: "var(--ap-flash)", boxShadow: "0 5px 0 var(--ap-flash-deep)", marginBottom: "20px" }}
              >
                <Sparkles className="h-6 w-6" color="#fff" />
              </div>
              <h2 className="ap-h3" style={{ marginBottom: "8px" }}>{t("fromTemplate")}</h2>
              <p className="ap-muted" style={{ fontSize: "13.5px", lineHeight: 1.5, marginBottom: "24px" }}>
                {isSlide
                  ? "Démarrez avec un modèle de présentation prêt à l'emploi"
                  : isFlashcard
                  ? t("createFlashcardFromTemplateDesc")
                  : isPoll
                  ? t("createPollFromTemplateDesc")
                  : t("createQuizFromTemplateDesc")}
              </p>
              <button
                className="ap-btn ap-btn--ghost ap-btn--pill ap-btn--sm"
                onClick={(e) => { e.stopPropagation(); setShowTemplates(true); }}
              >
                {t("browseTemplates")}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Import buttons */}
          <div className="relative flex items-center gap-3">
            <div className="flex-1 border-t border-slate-100" />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">ou</span>
            <div className="flex-1 border-t border-slate-100" />
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate("/question-bank")}
              className="ap-btn ap-btn--ghost"
              style={{ width: "100%", justifyContent: "center" }}
            >
              <Database className="h-4 w-4" />
              Importer depuis la banque
            </button>

            <button
              onClick={() => setImportOpen(true)}
              style={{
                display: "flex", width: "100%", alignItems: "center", justifyContent: "center",
                gap: "10px", borderRadius: "var(--ap-r-md)", border: "2px dashed var(--ap-line-2)",
                background: "var(--ap-card)", padding: "16px 24px", fontSize: "14px",
                fontWeight: 700, fontFamily: "var(--ap-font-body)", color: "var(--ap-muted)",
                cursor: "pointer", transition: "border-color .12s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--ap-brand)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--ap-line-2)"; }}
            >
              <Upload className="h-4 w-4" />
              Importer depuis un fichier
            </button>
          </div>
          </div>
        ) : (
          <div className="space-y-5">
            <button
              onClick={() => setShowTemplates(false)}
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
        )}
      </div>
      <ImportFileModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        quizType={quizType}
      />
    </div>
  );
};

export default QuizBuilderStart;
