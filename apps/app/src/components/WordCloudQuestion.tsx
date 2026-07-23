import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface WordCloudResponse {
  word: string;
  count: number;
  player: string;
}

interface WordCloudQuestionProps {
  question: string;
  timeLimit: number;
  onSubmit: (answer: string) => void;
  responses?: WordCloudResponse[];
  showResults?: boolean;
}

export const WordCloudQuestion = ({ 
  question, 
  timeLimit, 
  onSubmit, 
  responses = [], 
  showResults = false 
}: WordCloudQuestionProps) => {
  const [answer, setAnswer] = useState("");
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (timeLeft > 0 && !submitted) {
      const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, submitted]);

  const handleSubmit = () => {
    if (answer.trim() && !submitted) {
      setSubmitted(true);
      onSubmit(answer.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  // Calculate word sizes based on frequency
  const getWordSize = (count: number, maxCount: number) => {
    const minSize = 1;
    const maxSize = 3;
    const ratio = count / maxCount;
    return minSize + (maxSize - minSize) * ratio;
  };

  const maxCount = Math.max(...responses.map(r => r.count), 1);

  if (showResults) {
    return (
      <Card className="bg-white/10 backdrop-blur-lg border-white/20">
        <CardContent className="p-8">
          <h2 className="text-3xl font-bold text-white mb-6 text-center">{question}</h2>
          
          <div className="min-h-64 flex flex-wrap items-center justify-center gap-4 p-6 bg-white/5 rounded-lg">
            {responses.length > 0 ? (
              responses.map((response, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className={cn(
                    "bg-indigo-600 text-white border-indigo-700/20 px-4 py-2 animate-fade-in",
                    `text-${getWordSize(response.count, maxCount)}xl`
                  )}
                  style={{ 
                    animationDelay: `${index * 100}ms`,
                    fontSize: `${getWordSize(response.count, maxCount)}rem`
                  }}
                >
                  {response.word} ({response.count})
                </Badge>
              ))
            ) : (
              <div className="text-white/60 text-center">
                <p>No responses yet...</p>
              </div>
            )}
          </div>

          <div className="text-center mt-6 text-white/80">
            <p>{responses.reduce((sum, r) => sum + r.count, 0)} total responses</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/10 backdrop-blur-lg border-white/20">
      <CardContent className="p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-4">{question}</h2>
          <div className="flex items-center justify-center gap-2 text-white/80">
            <Clock className="w-4 h-4" />
            <span>{timeLeft}s remaining</span>
          </div>
        </div>

        <div className="max-w-md mx-auto">
          <div className="flex gap-2">
            <Input
              placeholder="Enter your answer..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={submitted || timeLeft === 0}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
            />
            <Button
              onClick={handleSubmit}
              disabled={!answer.trim() || submitted || timeLeft === 0}
              variant="quiz"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

          {submitted && (
            <div className="text-center mt-4 text-success animate-fade-in">
              ✓ Answer submitted!
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};