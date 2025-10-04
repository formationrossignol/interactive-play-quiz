import { useState } from "react";
import { Button } from "@/components/ui/button";

interface LikertScaleQuestionProps {
  question: {
    question: string;
    scale: string[];
  };
  onAnswer?: (value: number) => void;
  showResults?: boolean;
  results?: Record<number, number>;
}

export const LikertScaleQuestion = ({ question, onAnswer, showResults, results }: LikertScaleQuestionProps) => {
  const [selected, setSelected] = useState<number | null>(null);

  const handleSelect = (index: number) => {
    setSelected(index);
    onAnswer?.(index);
  };

  const total = results ? Object.values(results).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-white mb-6">{question.question}</h3>
      <div className="space-y-3">
        {question.scale.map((label, index) => {
          const count = results?.[index] || 0;
          const percentage = total > 0 ? (count / total) * 100 : 0;

          return (
            <div key={index} className="relative">
              <Button
                variant={selected === index ? "default" : "outline"}
                className="w-full justify-start text-left h-auto py-4"
                onClick={() => !showResults && handleSelect(index)}
                disabled={showResults}
              >
                <span className="flex-1">{label}</span>
                {showResults && (
                  <span className="ml-4 text-sm">
                    {count} ({percentage.toFixed(1)}%)
                  </span>
                )}
              </Button>
              {showResults && percentage > 0 && (
                <div 
                  className="absolute left-0 top-0 h-full bg-primary/20 rounded-md transition-all"
                  style={{ width: `${percentage}%` }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
