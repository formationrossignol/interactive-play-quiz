import { useEffect } from "react";
import { ArrowRight, BarChart3, Flag, Trophy } from "lucide-react";
import { AnswerDistribution } from "./AnswerDistribution";
import type { EditableQuestion } from "@/lib/questionTypes";

interface QuizSessionAnswerDistributionProps {
  currentQuestion: EditableQuestion;
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
  useEffect(() => {
    if (!isHost || !autoAdvance) return;
    const timeout = setTimeout(() => onNext(), 3500);
    return () => clearTimeout(timeout);
  }, [isHost, autoAdvance, onNext]);

  const totalVotes = answerDistribution.reduce((total, count) => total + count, 0);
  const percentages = answerDistribution.map((count) =>
    totalVotes > 0 ? Math.round(count / totalVotes * 100) : 0
  );

  const answers: string[] | undefined = currentQuestion.answers?.length
    ? currentQuestion.answers
    : currentQuestion.type === 'true-false'
      ? ['Vrai', 'Faux']
      : undefined;

  return (
    <main className="live-results-shell">
      <section className="live-results-frame" aria-labelledby="results-question">
        <header className="live-results-header">
          <div className="live-results-heading">
            <span className="live-results-icon"><BarChart3 aria-hidden="true" /></span>
            <div>
              <span className="live-results-kicker">Résultats de la question</span>
              <span className="live-results-votes">{totalVotes} réponse{totalVotes !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <h1 id="results-question">{currentQuestion.question}</h1>
        </header>

        {answers && (
          <AnswerDistribution
            answers={answers}
            distribution={percentages}
            correctAnswer={currentQuestion.correctAnswer}
          />
        )}

        {isHost && (
          <footer className="live-results-actions">
            {onSkipToNext && (
              <button onClick={onSkipToNext} className="live-results-action live-results-action--secondary">
                Question suivante <ArrowRight aria-hidden="true" />
              </button>
            )}
            <button onClick={onNext} className="live-results-action live-results-action--primary">
              {isLastQuestion ? <Flag aria-hidden="true" /> : <Trophy aria-hidden="true" />}
              {isLastQuestion ? 'Voir les résultats finaux' : 'Voir le classement'}
            </button>
          </footer>
        )}
      </section>
    </main>
  );
};
