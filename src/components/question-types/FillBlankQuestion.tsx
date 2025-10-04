import { useState } from "react";
import { Input } from "@/components/ui/input";

interface FillBlankQuestionProps {
  question: {
    question: string;
    text: string;
    blanks: { id: string; correctAnswer: string }[];
  };
  onAnswer?: (answers: Record<string, string>) => void;
  showAnswer?: boolean;
}

export const FillBlankQuestion = ({ question, onAnswer, showAnswer }: FillBlankQuestionProps) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const handleChange = (blankId: string, value: string) => {
    const newAnswers = { ...answers, [blankId]: value };
    setAnswers(newAnswers);
    onAnswer?.(newAnswers);
  };

  const parts = question.text.split(/\{\{blank(\d+)\}\}/g);
  
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold text-white mb-6">{question.question}</h3>
      <div className="text-white text-lg space-y-2">
        {parts.map((part, index) => {
          if (index % 2 === 1) {
            // This is a blank placeholder
            const blankIndex = parseInt(part) - 1;
            const blank = question.blanks[blankIndex];
            const isCorrect = showAnswer && answers[blank.id]?.toLowerCase().trim() === blank.correctAnswer.toLowerCase().trim();
            
            return (
              <Input
                key={`blank-${index}`}
                value={answers[blank.id] || ''}
                onChange={(e) => handleChange(blank.id, e.target.value)}
                disabled={showAnswer}
                className={`inline-block w-32 mx-2 ${
                  showAnswer 
                    ? isCorrect 
                      ? 'border-green-500 bg-green-500/20' 
                      : 'border-red-500 bg-red-500/20'
                    : ''
                }`}
                placeholder="..."
              />
            );
          }
          return <span key={`text-${index}`}>{part}</span>;
        })}
      </div>
      {showAnswer && (
        <div className="mt-4 p-4 bg-white/10 rounded-lg">
          <p className="text-white font-semibold mb-2">Réponses correctes :</p>
          {question.blanks.map((blank, idx) => (
            <p key={blank.id} className="text-white/80">
              Blanc {idx + 1}: {blank.correctAnswer}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};
