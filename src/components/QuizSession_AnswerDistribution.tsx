import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AnswerDistribution } from "./AnswerDistribution";

interface QuizSessionAnswerDistributionProps {
  currentQuestion: any;
  answerDistribution: number[];
  onNext: () => void;
  onSkipToNext?: () => void;
  isHost: boolean;
  isLastQuestion?: boolean;
  autoAdvance?: boolean;
}

export const QuizSessionAnswerDistribution = ({
  currentQuestion,
  answerDistribution,
  onNext,
  onSkipToNext,
  isHost,
  isLastQuestion = false,
  autoAdvance = false,
}: QuizSessionAnswerDistributionProps) => {
  // Auto-advance: skip answer distribution after 3.5 s when toggle is on
  useEffect(() => {
    if (!isHost || !autoAdvance) return;
    const t = setTimeout(() => onNext(), 3500);
    return () => clearTimeout(t);
  }, [isHost, autoAdvance, onNext]);

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-6 animate-fade-in">
            {currentQuestion.question}
          </h1>
        </div>

        {currentQuestion.answers && (
          <AnswerDistribution
            answers={currentQuestion.answers}
            distribution={answerDistribution}
            correctAnswer={currentQuestion.correctAnswer}
          />
        )}

        {isHost && (
          <div className="flex justify-center gap-4 mt-8">
            {onSkipToNext && (
              <Button variant="outline" size="lg" onClick={onSkipToNext}
                className="border-white/30 bg-black/40 text-slate-100 backdrop-blur hover:bg-black/60">
                ➡️ Question suivante
              </Button>
            )}
            <Button variant="hero" size="lg" onClick={onNext}>
              {isLastQuestion ? '🏁 Voir les résultats finaux' : '🏆 Voir le classement'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
