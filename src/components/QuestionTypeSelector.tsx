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
  'nps-scale': BarChart3,
  'slider': ArrowUpDown,
};

const colorMap: Partial<Record<QuizQuestionType | PollQuestionType, string>> = {
  'multiple-choice': 'bg-blue-500',
  'true-false': 'bg-green-500',
  'short-answer': 'bg-purple-500',
  'ranking': 'bg-orange-500',
  'matching': 'bg-pink-500',
  'fill-blank': 'bg-indigo-500',
  'drag-drop': 'bg-teal-500',
  'single-choice': 'bg-cyan-500',
  'likert-scale': 'bg-amber-500',
  'frequency-scale': 'bg-lime-500',
  'star-rating': 'bg-yellow-500',
  'open-text': 'bg-rose-500',
  'hotspot': 'bg-violet-500',
  'nps-scale': 'bg-emerald-500',
  'slider': 'bg-sky-500',
};

export const QuestionTypeSelector = ({ questionTypes, selectedType, onSelectType }: QuestionTypeSelectorProps) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {questionTypes.map((type) => {
        const Icon = iconMap[type] || CheckSquare;
        const bgColor = colorMap[type] || 'bg-blue-500';
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
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${bgColor} text-white shadow-sm`}>
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
