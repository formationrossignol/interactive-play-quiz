import { Button } from "@/components/ui/button";
import { AnswerDistribution } from "./AnswerDistribution";

interface QuizSessionAnswerDistributionProps {
  currentQuestion: any;
  answerDistribution: number[];
  onNext: () => void;
  isHost: boolean;
}

export const QuizSessionAnswerDistribution = ({
  currentQuestion,
  answerDistribution,
  onNext,
  isHost
}: QuizSessionAnswerDistributionProps) => {
  if (!currentQuestion.answers) return null;

  return (
    <div className="min-h-screen bg-gradient-hero p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-6 animate-fade-in">
            {currentQuestion.question}
          </h1>
        </div>

        <AnswerDistribution
          answers={currentQuestion.answers}
          distribution={answerDistribution}
          correctAnswer={currentQuestion.correctAnswer}
        />

        {isHost && (
          <div className="flex justify-center mt-8">
            <Button variant="hero" size="lg" onClick={onNext}>
              Voir le classement
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};