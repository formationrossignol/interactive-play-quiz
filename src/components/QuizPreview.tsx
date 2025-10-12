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
}: QuizPreviewLiveProps) => {
  const selectedTheme = THEMES.find((themeOption) => themeOption.id === theme) ?? THEMES[0];
  const themeOverlay = selectedTheme?.palette?.[2]
    ? hexToRgba(selectedTheme.palette[2], 0.18)
    : "rgba(15, 23, 42, 0.08)";
  const neutralOverlay = "rgba(255, 255, 255, 0.82)";
  const backgroundStyle = selectedTheme
    ? {
        backgroundImage: selectedTheme.background,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }
    : { background: themeOverlay };

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
      <div className="relative flex h-full flex-col overflow-hidden rounded-3xl">
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
    <div className="relative flex h-full flex-col overflow-hidden rounded-3xl">
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
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-2 py-4 text-foreground sm:px-4 md:px-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold leading-tight">{title}</h1>
          {description && <p className="text-base text-muted-foreground">{description}</p>}
        </div>

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("question")} {questionIndex + 1} / {questions.length}
          </p>
          <h2 className="text-3xl font-semibold leading-tight">
            {questionToShow.question?.trim() || t("noQuestionText")}
          </h2>
          {category && <p className="text-sm text-muted-foreground">{category}</p>}
          {!isPoll && (
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
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

        {headerImage && (
          <div className="max-h-72 w-full overflow-hidden">
            <img src={headerImage} alt={title} className="h-full w-full object-cover" />
          </div>
        )}

        {renderAnswers()}
      </div>
    </div>
  );
};
