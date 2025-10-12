import { Clock, Trophy } from "lucide-react";
import { DEFAULT_THEME_ID, THEMES } from "@/lib/themes";
import { hexToRgba } from "@/lib/color";
import { t } from "@/lib/i18n";

interface QuizPreviewProps {
  title: string;
  description: string;
  category: string;
  headerImage?: string;
  questions: any[];
  isPoll: boolean;
  theme?: string;
  fontFamily?: string;
}

interface QuizPreviewLiveProps extends QuizPreviewProps {
  selectedQuestionIndex?: number | null;
}

export const QuizPreview = ({
  title,
  description,
  category,
  headerImage,
  questions,
  isPoll,
  theme = DEFAULT_THEME_ID,
  selectedQuestionIndex,
  fontFamily,
}: QuizPreviewLiveProps) => {
  const selectedTheme = THEMES.find((themeOption) => themeOption.id === theme) ?? THEMES[0];
  const themeOverlay = selectedTheme?.palette?.[2]
    ? hexToRgba(selectedTheme.palette[2], 0.12)
    : "rgba(15, 23, 42, 0.08)";
  const neutralOverlay = "rgba(255, 255, 255, 0.6)";
  const backgroundStyle = selectedTheme
    ? {
        backgroundImage: selectedTheme.background,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }
    : { background: themeOverlay };

  const headerBackgroundStyle = headerImage
    ? {
        backgroundImage: `linear-gradient(120deg, ${hexToRgba("#0f172a", 0.7)}, ${hexToRgba(
          "#1e293b",
          0.35,
        )}), url(${headerImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : {
        backgroundImage: `linear-gradient(135deg, ${hexToRgba("#0f172a", 0.88)}, ${hexToRgba(
          "#1e293b",
          0.82,
        )})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };

  const questionToShow =
    selectedQuestionIndex !== null &&
    selectedQuestionIndex !== undefined &&
    questions[selectedQuestionIndex]
      ? questions[selectedQuestionIndex]
      : questions[0];

  const questionIndex =
    selectedQuestionIndex !== null && selectedQuestionIndex !== undefined
      ? selectedQuestionIndex
      : 0;

  if (!questionToShow) {
    return (
      <div className="relative flex h-full flex-col overflow-hidden">
        <div className="absolute inset-0" style={backgroundStyle} aria-hidden />
        <div
          className="absolute inset-0 backdrop-blur-sm"
          style={{ background: neutralOverlay }}
          aria-hidden
        />
        <div
          className="absolute inset-0"
          style={{ background: themeOverlay, mixBlendMode: "multiply" }}
          aria-hidden
        />
        <div className="relative z-10 flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
          {t("noQuestionsYet")}
        </div>
      </div>
    );
  }

  const optionShapes = ["▲", "◆", "■", "●"];

  const renderChoiceAnswers = (answers: string[]) => (
    <div className="grid gap-4 sm:grid-cols-2">
      {answers.map((answer, index) => (
        <div
          key={index}
          className="flex min-h-[4.25rem] items-center gap-4 rounded-2xl border border-white/40 bg-white/90 px-5 py-4 text-lg font-semibold text-foreground shadow-sm"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-base font-bold text-muted-foreground">
            {optionShapes[index % optionShapes.length]}
          </span>
          <span className="flex-1 break-words">
            {answer?.trim() || `${t("answer")} ${index + 1}`}
          </span>
        </div>
      ))}
    </div>
  );

  const renderAnswers = () => {
    switch (questionToShow.type) {
      case "multiple-choice":
      case "single-choice":
      case "true-false":
        return renderChoiceAnswers(questionToShow.answers || []);
      case "short-answer":
        return (
          <div className="bg-muted px-5 py-5 text-base text-muted-foreground">
            {questionToShow.correctAnswer?.trim() || t("answer")}
          </div>
        );
      case "open-text":
        return (
          <div className="bg-muted px-5 py-5 text-base text-muted-foreground">{t("yourQuestion")}</div>
        );
      case "ranking":
        return (
          <div className="space-y-3">
            {questionToShow.items?.map((item: string, index: number) => (
              <div key={index} className="flex items-center gap-3 bg-muted px-4 py-4 text-base font-medium text-foreground">
                <span className="w-8 text-center text-sm font-semibold text-muted-foreground">{index + 1}</span>
                <span className="flex-1 break-words">
                  {item?.trim() || `${t("answer")} ${index + 1}`}
                </span>
              </div>
            ))}
          </div>
        );
      case "matching":
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              {questionToShow.leftColumn?.map((item: any, index: number) => (
                <div key={item.id ?? index} className="bg-muted px-4 py-4 text-foreground">
                  {item.text?.trim() || `${t("answer")} ${index + 1}`}
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {questionToShow.rightColumn?.map((item: any, index: number) => (
                <div key={item.id ?? index} className="bg-muted px-4 py-4 text-foreground">
                  {item.text?.trim() || `${t("answer")} ${index + 1}`}
                </div>
              ))}
            </div>
          </div>
        );
      case "fill-blank":
        return (
          <div className="space-y-3 text-base text-foreground">
            <p>{questionToShow.text?.trim() || t("noQuestionText")}</p>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              {questionToShow.blanks?.map((blank: any, index: number) => (
                <span key={blank.id ?? index} className="bg-muted px-3 py-1">
                  {blank.correctAnswer?.trim() || `${t("answer")} ${index + 1}`}
                </span>
              ))}
            </div>
          </div>
        );
      case "slider":
        return (
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="h-2 w-full bg-muted" />
            <div className="flex justify-between">
              <span>{questionToShow.minLabel || questionToShow.min}</span>
              <span>{questionToShow.maxLabel || questionToShow.max}</span>
            </div>
          </div>
        );
      case "likert-scale":
      case "frequency-scale":
        return (
          <div className="space-y-2">
            {questionToShow.scale?.map((option: string, index: number) => (
              <div key={index} className="bg-muted px-4 py-3 text-center text-foreground">
                {option}
              </div>
            ))}
          </div>
        );
      case "star-rating":
        return (
          <div className="flex justify-center gap-2 text-4xl text-yellow-400">
            {Array.from({ length: questionToShow.maxStars || 5 }).map((_, index) => (
              <span key={index}>★</span>
            ))}
          </div>
        );
      case "nps-scale":
        return (
          <div className="space-y-4">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{questionToShow.minLabel || "0"}</span>
              <span>{questionToShow.maxLabel || "10"}</span>
            </div>
            <div className="grid grid-cols-11 gap-2 text-center text-sm font-semibold text-foreground">
              {Array.from({ length: 11 }).map((_, index) => (
                <div key={index} className="bg-muted px-3 py-2">
                  {index}
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden border border-border/60 bg-white shadow-sm"
      style={fontFamily ? { fontFamily } : undefined}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col overflow-hidden text-foreground">
        <header className="relative overflow-hidden">
          <div className="absolute inset-0" style={headerBackgroundStyle} aria-hidden />
          <div className="absolute inset-0 bg-slate-900/45" aria-hidden />
          <div className="relative z-10 flex flex-col gap-4 px-5 py-8 text-white sm:px-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  {category && (
                    <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 backdrop-blur-sm">
                      {category}
                    </span>
                  )}
                  {category?.trim() && title?.trim() && <span className="text-white/60">/</span>}
                  <span className="text-base font-semibold sm:text-lg">
                    {title?.trim() || t("untitled")}
                  </span>
                </div>
                {description && (
                  <p className="max-w-2xl text-sm text-white/85 sm:text-base">{description}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-3 text-sm text-white/90">
                <div className="rounded-full bg-white/15 px-4 py-2 font-medium text-white shadow-sm backdrop-blur">
                  {t("question")} {questionIndex + 1} / {questions.length}
                </div>
                {!isPoll && (
                  <div className="flex flex-wrap items-center justify-end gap-4">
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {questionToShow.timeLimit}s
                    </span>
                    <span className="flex items-center gap-2">
                      <Trophy className="h-4 w-4" />
                      {questionToShow.points} pts
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="relative flex-1 overflow-hidden">
          <div className="absolute inset-0" style={backgroundStyle} aria-hidden />
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: neutralOverlay }}
            aria-hidden
          />
          <div
            className="absolute inset-0"
            style={{ background: themeOverlay, mixBlendMode: "multiply" }}
            aria-hidden
          />
          <div className="relative z-10 flex h-full flex-col px-5 py-6 text-center backdrop-blur-sm sm:px-10 sm:py-8">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
              <div className="space-y-3">
                <h2 className="text-2xl font-semibold leading-snug text-foreground sm:text-3xl">
                  {questionToShow.question?.trim() || t("noQuestionText")}
                </h2>
              </div>

              {questionToShow.image && (
                <div className="mx-auto max-h-72 w-full overflow-hidden rounded-3xl border border-white/60 bg-white/90 shadow-sm sm:w-4/5">
                  <img
                    src={questionToShow.image}
                    alt={questionToShow.question || t("question")}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
            </div>

            <div className="mx-auto w-full max-w-3xl text-left">
              {renderAnswers()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
