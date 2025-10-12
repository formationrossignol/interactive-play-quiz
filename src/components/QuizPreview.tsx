import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Trophy } from "lucide-react";
import { getQuestionTypeLabel } from "@/lib/questionTypes";
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

export const QuizPreview = ({ title, description, category, headerImage, questions, isPoll, theme = DEFAULT_THEME_ID, selectedQuestionIndex }: QuizPreviewLiveProps) => {
  const selectedTheme = THEMES.find(t => t.id === theme) ?? THEMES[0];

  const themeBackgroundStyle = selectedTheme
    ? {
        background: selectedTheme.background,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    : {};

  const overlayGradient = selectedTheme?.palette
    ? `linear-gradient(135deg, ${hexToRgba(selectedTheme.palette[0], 0.58)}, ${hexToRgba(selectedTheme.palette[2], 0.62)})`
    : 'linear-gradient(135deg, rgba(15,26,61,0.58), rgba(29,42,85,0.62))';

  const surfaceColor = selectedTheme?.palette
    ? hexToRgba(selectedTheme.palette[0], 0.22)
    : 'rgba(255, 255, 255, 0.12)';

  const surfaceBorderColor = selectedTheme?.palette
    ? hexToRgba(selectedTheme.palette[2], 0.42)
    : 'rgba(255, 255, 255, 0.25)';

  const chipBackground = selectedTheme?.palette
    ? hexToRgba(selectedTheme.palette[1], 0.35)
    : 'rgba(255, 255, 255, 0.25)';

  const chipBorder = selectedTheme?.palette
    ? hexToRgba(selectedTheme.palette[2], 0.4)
    : 'rgba(255, 255, 255, 0.3)';
  
  // Afficher la question sélectionnée ou la première si aucune sélection
  const questionToShow = selectedQuestionIndex !== null && selectedQuestionIndex !== undefined && questions[selectedQuestionIndex]
    ? questions[selectedQuestionIndex]
    : questions[0];
  
  const questionIndex = selectedQuestionIndex !== null && selectedQuestionIndex !== undefined 
    ? selectedQuestionIndex 
    : 0;

  if (!questionToShow) {
    return (
      <Card className="sticky top-6 overflow-hidden border-0 bg-transparent shadow-2xl">
        <CardHeader className="bg-background/80 backdrop-blur-sm">
          <CardTitle className="text-foreground flex items-center gap-2">
            <span className="text-2xl">👁️</span>
            {t('livePreview')}
          </CardTitle>
        </CardHeader>
        <CardContent className="relative overflow-hidden p-0" style={themeBackgroundStyle}>
          <div className="absolute inset-0" aria-hidden style={{ background: overlayGradient }} />
          <div className="relative z-10 space-y-4 pt-10 pb-12 px-6 text-center text-white/85">
            <p className="text-sm leading-relaxed">
              {t('noQuestionsYet')}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="sticky top-6 overflow-hidden border-0 bg-transparent shadow-2xl">
      <CardHeader className="bg-background/80 backdrop-blur-sm">
        <CardTitle className="text-foreground flex items-center gap-2">
          <span className="text-2xl">👁️</span>
          {t('livePreview')}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative overflow-hidden p-0" style={themeBackgroundStyle}>
        <div className="absolute inset-0" aria-hidden style={{ background: overlayGradient }} />
        <div className="relative z-10 space-y-4 px-6 pb-8 pt-6">
          {/* Question preview comme en mode live */}
          <div
            className="overflow-hidden rounded-2xl border p-6 backdrop-blur-md shadow-lg"
            title={selectedTheme?.imageDescription}
            style={{ backgroundColor: surfaceColor, borderColor: surfaceBorderColor }}
          >
            <div className="mb-4 flex items-center justify-between">
              <Badge
                variant="secondary"
                className="border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-white"
                style={{ backgroundColor: chipBackground, borderColor: chipBorder }}
              >
                Question {questionIndex + 1} / {questions.length}
              </Badge>
              {category && (
                <Badge
                  variant="secondary"
                  className="border px-3 py-1 text-xs font-medium text-white/90"
                  style={{ backgroundColor: hexToRgba(selectedTheme?.palette?.[3] ?? '#ffffff', 0.2), borderColor: chipBorder }}
                >
                  {category}
                </Badge>
              )}
            </div>

            <h2 className="text-xl font-bold text-white mb-6">
              {questionToShow.question || t('noQuestionText')}
            </h2>

            {/* Affichage des réponses selon le type */}
            {(questionToShow.type === 'multiple-choice' || questionToShow.type === 'single-choice') && questionToShow.answers && (
              <div className="space-y-3">
                {questionToShow.answers.map((answer: string, index: number) => (
                  <div
                    key={index}
                    className="rounded-xl border p-4 text-white backdrop-blur-sm transition-transform duration-300 hover:-translate-y-0.5"
                    style={{ backgroundColor: surfaceColor, borderColor: surfaceBorderColor }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                        style={{
                          backgroundColor: hexToRgba(selectedTheme?.palette?.[3] ?? '#ffffff', 0.28),
                          color: '#fff',
                        }}
                      >
                        {String.fromCharCode(65 + index)}
                      </div>
                      <span>{answer || `Réponse ${index + 1}`}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {questionToShow.type === 'true-false' && (
              <div className="space-y-3">
                <div
                  className="rounded-xl border p-4 text-white backdrop-blur-sm"
                  style={{ backgroundColor: surfaceColor, borderColor: surfaceBorderColor }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                      style={{ backgroundColor: hexToRgba(selectedTheme?.palette?.[3] ?? '#ffffff', 0.28), color: '#fff' }}
                    >
                      A
                    </div>
                    <span>Vrai</span>
                  </div>
                </div>
                <div
                  className="rounded-xl border p-4 text-white backdrop-blur-sm"
                  style={{ backgroundColor: surfaceColor, borderColor: surfaceBorderColor }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                      style={{ backgroundColor: hexToRgba(selectedTheme?.palette?.[3] ?? '#ffffff', 0.28), color: '#fff' }}
                    >
                      B
                    </div>
                    <span>Faux</span>
                  </div>
                </div>
              </div>
            )}

            {questionToShow.type === 'short-answer' && (
              <div
                className="rounded-xl border p-4 backdrop-blur-sm"
                style={{ backgroundColor: surfaceColor, borderColor: surfaceBorderColor }}
              >
                <input
                  type="text"
                  placeholder="Votre réponse..."
                  className="w-full bg-transparent text-white placeholder:text-white/50 outline-none"
                  disabled
                />
              </div>
            )}

            {questionToShow.type === 'open-text' && (
              <div
                className="rounded-xl border p-4 backdrop-blur-sm"
                style={{ backgroundColor: surfaceColor, borderColor: surfaceBorderColor }}
              >
                <textarea
                  placeholder="Votre réponse..."
                  className="w-full bg-transparent text-white placeholder:text-white/50 outline-none resize-none"
                  rows={4}
                  disabled
                />
              </div>
            )}

            {(questionToShow.type === 'likert-scale' || questionToShow.type === 'frequency-scale') && questionToShow.scale && (
              <div className="space-y-2">
                {questionToShow.scale.map((option: string, index: number) => (
                  <div
                    key={index}
                    className="rounded-xl border p-3 text-white text-center backdrop-blur-sm"
                    style={{ backgroundColor: surfaceColor, borderColor: surfaceBorderColor }}
                  >
                    {option}
                  </div>
                ))}
              </div>
            )}

            {questionToShow.type === 'star-rating' && (
              <div className="flex justify-center gap-2">
                {Array.from({ length: questionToShow.maxStars || 5 }).map((_, index) => (
                  <span
                    key={index}
                    className="text-3xl"
                    style={{ color: hexToRgba(selectedTheme?.palette?.[1] ?? '#ffffff', 0.85) }}
                  >
                    ★
                  </span>
                ))}
              </div>
            )}

            {questionToShow.type === 'nps-scale' && (
              <div className="space-y-4">
                <div className="flex justify-between text-sm" style={{ color: hexToRgba(selectedTheme?.palette?.[3] ?? '#ffffff', 0.85) }}>
                  <span>{questionToShow.minLabel || "Pas du tout probable"}</span>
                  <span>{questionToShow.maxLabel || "Extrêmement probable"}</span>
                </div>
                <div className="grid grid-cols-11 gap-2">
                  {Array.from({ length: 11 }).map((_, index) => (
                    <div
                      key={index}
                      className="rounded-xl border p-2 text-center font-bold text-white backdrop-blur-sm"
                      style={{ backgroundColor: surfaceColor, borderColor: surfaceBorderColor }}
                    >
                      {index}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Info sur le type de question */}
          <div
            className="flex items-center justify-between border-t pt-4 text-sm"
            style={{
              borderColor: chipBorder,
              color: hexToRgba(selectedTheme?.palette?.[3] ?? '#ffffff', 0.85),
            }}
          >
            <Badge
              variant="secondary"
              className="border px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-white"
              style={{ backgroundColor: chipBackground, borderColor: chipBorder }}
            >
              {getQuestionTypeLabel(questionToShow.type)}
            </Badge>
            {!isPoll && (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" style={{ color: hexToRgba(selectedTheme?.palette?.[1] ?? '#ffffff', 0.85) }} />
                  {questionToShow.timeLimit}s
                </span>
                <span className="flex items-center gap-1">
                  <Trophy className="h-3 w-3" style={{ color: hexToRgba(selectedTheme?.palette?.[0] ?? '#ffffff', 0.85) }} />
                  {questionToShow.points}pts
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
