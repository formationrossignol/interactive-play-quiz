import { Card, CardContent } from "@/components/ui/card";
import { 
  CheckSquare, 
  ToggleLeft, 
  FileText, 
  ArrowUpDown, 
  Shuffle, 
  Square,
  List,
  Star,
  BarChart3,
  MessageSquare
} from "lucide-react";
import { getQuestionTypeLabel, getQuestionTypeDescription } from "@/lib/questionTypes";
import type { QuizQuestionType, PollQuestionType } from "@/lib/questionTypes";

interface QuestionTypeSelectorProps {
  questionTypes: (QuizQuestionType | PollQuestionType)[];
  selectedType: QuizQuestionType | PollQuestionType;
  onSelectType: (type: QuizQuestionType | PollQuestionType) => void;
}

const iconMap: Partial<Record<QuizQuestionType | PollQuestionType, any>> = {
  'multiple-choice': CheckSquare,
  'true-false': ToggleLeft,
  'short-answer': FileText,
  'ranking': ArrowUpDown,
  'matching': Shuffle,
  'fill-blank': Square,
  'drag-drop': Shuffle,
  'single-choice': List,
  'likert-scale': BarChart3,
  'frequency-scale': BarChart3,
  'star-rating': Star,
  'open-text': MessageSquare,
  'hotspot': CheckSquare,
};

export const QuestionTypeSelector = ({ questionTypes, selectedType, onSelectType }: QuestionTypeSelectorProps) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {questionTypes.map((type) => {
        const Icon = iconMap[type] || CheckSquare;
        const isSelected = selectedType === type;
        
        return (
          <Card
            key={type}
            className={`cursor-pointer transition-all hover:shadow-md ${
              isSelected 
                ? 'border-2 border-primary bg-primary/5' 
                : 'border hover:border-primary/50'
            }`}
            onClick={() => onSelectType(type)}
          >
            <CardContent className="p-4 flex flex-col items-center text-center gap-3">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className={`text-sm font-medium ${
                  isSelected ? 'text-primary' : 'text-foreground'
                }`}>
                  {getQuestionTypeLabel(type)}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {getQuestionTypeDescription(type)}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
