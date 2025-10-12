import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Trophy } from "lucide-react";
import { getQuestionTypeLabel } from "@/lib/questionTypes";
import { DEFAULT_THEME_ID, THEMES } from "@/lib/themes";
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
        backgroundImage: selectedTheme.background,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    : {};

  const themedCardBackground = {
    ...themeBackgroundStyle,
    backgroundImage:
      themeBackgroundStyle.backgroundImage || 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)) 100%)',
  };
  
  // Afficher la question sélectionnée ou la première si aucune sélection
  const questionToShow = selectedQuestionIndex !== null && selectedQuestionIndex !== undefined && questions[selectedQuestionIndex]
    ? questions[selectedQuestionIndex]
    : questions[0];
  
  const questionIndex = selectedQuestionIndex !== null && selectedQuestionIndex !== undefined 
    ? selectedQuestionIndex 
    : 0;

  if (!questionToShow) {
    return (
      <Card className="sticky top-6">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <span className="text-2xl">👁️</span>
            {t('livePreview')}
          </CardTitle>
        </CardHeader>
        <CardContent className="relative overflow-hidden" style={themedCardBackground}>
          <div className="absolute inset-0 bg-black/40" aria-hidden />
          <div className="relative z-10 space-y-4 pt-4">
            <p className="text-sm text-white/80 text-center py-8">
              {t('noQuestionsYet')}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="sticky top-6">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <span className="text-2xl">👁️</span>
          {t('livePreview')}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative overflow-hidden" style={themedCardBackground}>
        <div className="absolute inset-0 bg-black/40" aria-hidden />
        <div className="relative z-10 space-y-4 pt-4">
          {/* Question preview comme en mode live */}
          <div
            className="overflow-hidden rounded-lg p-6 backdrop-blur-sm bg-black/20"
            title={selectedTheme?.imageDescription}
          >
            <div className="mb-4">
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                Question {questionIndex + 1} / {questions.length}
              </Badge>
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
                    className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4 text-white"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">
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
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4 text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">A</div>
                    <span>Vrai</span>
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4 text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">B</div>
                    <span>Faux</span>
                  </div>
                </div>
              </div>
            )}

            {questionToShow.type === 'short-answer' && (
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4">
                <input
                  type="text"
                  placeholder="Votre réponse..."
                  className="w-full bg-transparent text-white placeholder:text-white/50 outline-none"
                  disabled
                />
              </div>
            )}

            {questionToShow.type === 'open-text' && (
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4">
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
                    className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-3 text-white text-center"
                  >
                    {option}
                  </div>
                ))}
              </div>
            )}

            {questionToShow.type === 'star-rating' && (
              <div className="flex justify-center gap-2">
                {Array.from({ length: questionToShow.maxStars || 5 }).map((_, index) => (
                  <span key={index} className="text-3xl text-white/50">★</span>
                ))}
              </div>
            )}

            {questionToShow.type === 'nps-scale' && (
              <div className="space-y-4">
                <div className="flex justify-between text-white/80 text-sm">
                  <span>{questionToShow.minLabel || "Pas du tout probable"}</span>
                  <span>{questionToShow.maxLabel || "Extrêmement probable"}</span>
                </div>
                <div className="grid grid-cols-11 gap-2">
                  {Array.from({ length: 11 }).map((_, index) => (
                    <div
                      key={index}
                      className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-2 text-white text-center font-bold"
                    >
                      {index}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Info sur le type de question */}
          <div className="flex items-center justify-between text-sm text-white/80 pt-4 border-t border-white/20">
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
              {getQuestionTypeLabel(questionToShow.type)}
            </Badge>
            {!isPoll && (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-white/80" />
                  {questionToShow.timeLimit}s
                </span>
                <span className="flex items-center gap-1">
                  <Trophy className="w-3 h-3 text-white/80" />
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
