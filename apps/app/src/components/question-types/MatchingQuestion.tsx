import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface MatchingPair {
  leftId: string;
  rightId: string;
}

interface MatchingQuestionProps {
  question: {
    question: string;
    leftColumn: { id: string; text: string }[];
    rightColumn: { id: string; text: string }[];
    correctMatches?: MatchingPair[];
  };
  onAnswer?: (matches: MatchingPair[]) => void;
  showAnswer?: boolean;
}

export const MatchingQuestion = ({ question, onAnswer, showAnswer }: MatchingQuestionProps) => {
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchingPair[]>([]);

  const handleLeftClick = (leftId: string) => {
    setSelectedLeft(leftId);
  };

  const handleRightClick = (rightId: string) => {
    if (selectedLeft) {
      const newMatches = [...matches.filter(m => m.leftId !== selectedLeft), { leftId: selectedLeft, rightId }];
      setMatches(newMatches);
      setSelectedLeft(null);
      onAnswer?.(newMatches);
    }
  };

  const getMatchedRight = (leftId: string) => {
    return matches.find(m => m.leftId === leftId)?.rightId;
  };

  const isCorrectMatch = (leftId: string, rightId: string) => {
    return question.correctMatches?.some(m => m.leftId === leftId && m.rightId === rightId);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold text-white mb-6">{question.question}</h3>
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-3">
          {question.leftColumn.map((item) => {
            const matchedRightId = getMatchedRight(item.id);
            const isCorrect = matchedRightId && isCorrectMatch(item.id, matchedRightId);
            
            return (
              <Card
                key={item.id}
                className={`cursor-pointer transition-all ${
                  selectedLeft === item.id 
                    ? 'border-primary border-2 bg-primary/20' 
                    : matchedRightId
                    ? showAnswer
                      ? isCorrect ? 'border-green-500 bg-green-500/20' : 'border-red-500 bg-red-500/20'
                      : 'border-blue-500 bg-blue-500/20'
                    : 'hover:bg-white/10'
                }`}
                onClick={() => !showAnswer && handleLeftClick(item.id)}
              >
                <CardContent className="p-4">
                  <p className="text-white">{item.text}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <div className="space-y-3">
          {question.rightColumn.map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer hover:bg-white/10 transition-all"
              onClick={() => !showAnswer && handleRightClick(item.id)}
            >
              <CardContent className="p-4">
                <p className="text-white">{item.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
