import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, Sparkles, ArrowRight } from "lucide-react";
import { Header } from "@/components/Header";
import { PollTemplateSelectorEnhanced } from "@/components/PollTemplateSelectorEnhanced";
import { QuizTemplateSelectorEnhanced } from "@/components/QuizTemplateSelectorEnhanced";
import { FlashcardTemplateSelectorEnhanced } from "@/components/FlashcardTemplateSelectorEnhanced";
import { SlideTemplateSelectorEnhanced } from "@/components/SlideTemplateSelectorEnhanced";
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
    <div className="min-h-screen bg-[#F8FAFC]">
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
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">{pageTitle}</h1>
          <p className="text-slate-500">{pageSubtitle}</p>
        </div>

        {!showTemplates ? (
          <div className="grid md:grid-cols-2 gap-5">
            {/* From scratch */}
            <div
              className="cursor-pointer rounded-2xl border-2 border-slate-100 bg-white p-7 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-card-hover"
              onClick={handleFromScratch}
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
                <FileText className="h-6 w-6 text-indigo-600" />
              </div>
              <h2 className="mb-2 text-lg font-bold text-slate-900">{t("fromScratch")}</h2>
              <p className="mb-6 text-sm leading-relaxed text-slate-500">
                {isSlide
                  ? "Créez votre présentation de zéro, diapositive par diapositive"
                  : isFlashcard
                  ? t("createFlashcardFromScratchDesc")
                  : isPoll
                  ? t("createPollFromScratchDesc")
                  : t("createQuizFromScratchDesc")}
              </p>
              <Button
                className="rounded-full bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors gap-1.5 px-5"
                onClick={(e) => { e.stopPropagation(); handleFromScratch(); }}
              >
                {t("startFromScratch")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            {/* From template */}
            <div
              className="cursor-pointer rounded-2xl border-2 border-slate-100 bg-white p-7 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-card-hover"
              onClick={() => setShowTemplates(true)}
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100">
                <Sparkles className="h-6 w-6 text-violet-600" />
              </div>
              <h2 className="mb-2 text-lg font-bold text-slate-900">{t("fromTemplate")}</h2>
              <p className="mb-6 text-sm leading-relaxed text-slate-500">
                {isSlide
                  ? "Démarrez avec un modèle de présentation prêt à l'emploi"
                  : isFlashcard
                  ? t("createFlashcardFromTemplateDesc")
                  : isPoll
                  ? t("createPollFromTemplateDesc")
                  : t("createQuizFromTemplateDesc")}
              </p>
              <Button
                variant="outline"
                className="rounded-full border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors gap-1.5 px-5"
                onClick={(e) => { e.stopPropagation(); setShowTemplates(true); }}
              >
                {t("browseTemplates")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <button
              onClick={() => setShowTemplates(false)}
              className="cursor-pointer text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1"
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
    </div>
  );
};

export default QuizBuilderStart;
