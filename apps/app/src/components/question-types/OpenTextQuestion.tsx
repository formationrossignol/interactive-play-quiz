import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

interface OpenTextQuestionProps {
  question: {
    question: string;
    maxLength?: number;
    minLength?: number;
  };
  onAnswer?: (text: string) => void;
  showResults?: boolean;
  results?: string[];
}

export const OpenTextQuestion = ({ question, onAnswer, showResults, results }: OpenTextQuestionProps) => {
  const [text, setText] = useState("");

  const handleChange = (value: string) => {
    if (!question.maxLength || value.length <= question.maxLength) {
      setText(value);
      onAnswer?.(value);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-white mb-6">{question.question}</h3>
      
      {!showResults ? (
        <div>
          <Textarea
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Saisissez votre réponse..."
            className="min-h-32 text-white bg-white/10 border-white/20"
            maxLength={question.maxLength}
          />
          {question.maxLength && (
            <p className="text-white/60 text-sm mt-2">
              {text.length} / {question.maxLength} caractères
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-white font-semibold">{results?.length || 0} réponses</p>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {results?.map((response, index) => (
              <Card key={index} className="bg-white/10 backdrop-blur-lg border-white/20">
                <CardContent className="p-4">
                  <p className="text-white">{response}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
