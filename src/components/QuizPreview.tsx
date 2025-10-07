import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Trophy } from "lucide-react";
import { getQuestionTypeLabel } from "@/lib/questionTypes";
import { t } from "@/lib/i18n";

interface QuizPreviewProps {
  title: string;
  description: string;
  category: string;
  headerImage?: string;
  questions: any[];
  isPoll: boolean;
}

export const QuizPreview = ({ title, description, category, headerImage, questions, isPoll }: QuizPreviewProps) => {
  return (
    <Card className="sticky top-6">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <span className="text-2xl">👁️</span>
          {t('livePreview')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {headerImage && (
          <div className="w-full h-40 rounded-lg overflow-hidden">
            <img src={headerImage} alt="Header" className="w-full h-full object-cover" />
          </div>
        )}
        
        <div>
          <h3 className="text-2xl font-bold text-foreground mb-2">
            {title || t('untitled')}
          </h3>
          <p className="text-muted-foreground text-sm mb-3">
            {description || t('noDescription')}
          </p>
          <Badge variant="secondary">{category}</Badge>
        </div>

        {questions.length > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <p className="text-sm font-semibold text-foreground">
              {questions.length} {questions.length === 1 ? t('question') : t('questions')}
            </p>
            {questions.map((q, idx) => (
              <div key={idx} className="p-3 bg-muted/30 rounded-lg">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-sm font-medium text-foreground">
                    {idx + 1}. {q.question || t('noQuestionText')}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs">
                    {getQuestionTypeLabel(q.type)}
                  </Badge>
                  {!isPoll && (
                    <>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {q.timeLimit}s
                      </span>
                      <span className="flex items-center gap-1">
                        <Trophy className="w-3 h-3" />
                        {q.points}pts
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {questions.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            {t('noQuestionsYet')}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
