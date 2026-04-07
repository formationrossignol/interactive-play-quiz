import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Clock, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface RankingItem {
  id: string;
  text: string;
  correctPosition: number;
}

interface RankingQuestionProps {
  question: string;
  items: RankingItem[];
  timeLimit: number;
  onSubmit: (ranking: string[]) => void;
  showResults?: boolean;
  userRanking?: string[];
}

export const RankingQuestion = ({ 
  question, 
  items, 
  timeLimit, 
  onSubmit, 
  showResults = false,
  userRanking = []
}: RankingQuestionProps) => {
  const [ranking, setRanking] = useState<string[]>(items.map(item => item.id));
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [submitted, setSubmitted] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  useEffect(() => {
    if (timeLeft > 0 && !submitted) {
      const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, submitted]);

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItem(itemId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (!draggedItem) return;

    const newRanking = [...ranking];
    const draggedIndex = ranking.indexOf(draggedItem);
    
    // Remove dragged item
    newRanking.splice(draggedIndex, 1);
    // Insert at new position
    newRanking.splice(targetIndex, 0, draggedItem);
    
    setRanking(newRanking);
    setDraggedItem(null);
  };

  const moveItem = (itemId: string, direction: 'up' | 'down') => {
    const currentIndex = ranking.indexOf(itemId);
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === ranking.length - 1)
    ) {
      return;
    }

    const newRanking = [...ranking];
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    // Swap items
    [newRanking[currentIndex], newRanking[newIndex]] = [newRanking[newIndex], newRanking[currentIndex]];
    setRanking(newRanking);
  };

  const handleSubmit = () => {
    if (!submitted) {
      setSubmitted(true);
      onSubmit(ranking);
    }
  };

  const getItemByid = (id: string) => items.find(item => item.id === id);

  const isCorrectPosition = (itemId: string, position: number) => {
    const item = getItemByid(itemId);
    return item?.correctPosition === position + 1;
  };

  if (showResults) {
    const correctRanking = [...items].sort((a, b) => a.correctPosition - b.correctPosition);
    
    return (
      <Card className="bg-white/10 backdrop-blur-lg border-white/20">
        <CardContent className="p-8">
          <h2 className="text-3xl font-bold text-white mb-6 text-center">{question}</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* User's Ranking */}
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Your Ranking</h3>
              <div className="space-y-2">
                {userRanking.map((itemId, index) => {
                  const item = getItemByid(itemId);
                  const isCorrect = isCorrectPosition(itemId, index);
                  
                  return (
                    <div
                      key={itemId}
                      className={cn(
                        "p-4 rounded-lg border flex items-center gap-3",
                        isCorrect 
                          ? "bg-success/20 border-success/30 text-white" 
                          : "bg-danger/20 border-danger/30 text-white"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                        isCorrect ? "bg-success" : "bg-danger"
                      )}>
                        {index + 1}
                      </div>
                      <span className="flex-1">{item?.text}</span>
                      {isCorrect ? (
                        <Check className="w-5 h-5 text-success" />
                      ) : (
                        <X className="w-5 h-5 text-danger" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Correct Ranking */}
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Correct Ranking</h3>
              <div className="space-y-2">
                {correctRanking.map((item, index) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-lg bg-success/20 border border-success/30 text-white flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-success flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <span className="flex-1">{item.text}</span>
                    <Check className="w-5 h-5 text-success" />
                  </div>
                ))}
              </div>
            </div>
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
          <div className="flex items-center justify-center gap-4 text-white/80">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{timeLeft}s remaining</span>
            </div>
            <Badge variant="secondary" className="bg-white/20 text-white">
              Drag to reorder
            </Badge>
          </div>
        </div>

        <div className="max-w-2xl mx-auto space-y-2 mb-6">
          {ranking.map((itemId, index) => {
            const item = getItemByid(itemId);
            return (
              <div
                key={itemId}
                draggable={!submitted && timeLeft > 0}
                onDragStart={(e) => handleDragStart(e, itemId)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                className={cn(
                  "p-4 rounded-lg border bg-white/10 border-white/20 text-white cursor-move transition-all duration-200",
                  "hover:bg-white/15 flex items-center gap-3",
                  draggedItem === itemId && "opacity-50",
                  submitted && "cursor-default"
                )}
              >
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold">
                  {index + 1}
                </div>
                <GripVertical className="w-5 h-5 text-white/60" />
                <span className="flex-1">{item?.text}</span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveItem(itemId, 'up')}
                    disabled={submitted || timeLeft === 0 || index === 0}
                    className="text-white/60 hover:text-white h-8 w-8 p-0"
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveItem(itemId, 'down')}
                    disabled={submitted || timeLeft === 0 || index === ranking.length - 1}
                    className="text-white/60 hover:text-white h-8 w-8 p-0"
                  >
                    ↓
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <Button
            onClick={handleSubmit}
            disabled={submitted || timeLeft === 0}
            variant="quiz"
            size="lg"
          >
            {submitted ? "Submitted!" : "Submit Ranking"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};