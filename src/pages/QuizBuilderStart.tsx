import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Sparkles, ArrowRight } from "lucide-react";
import { Header } from "@/components/Header";
import { PollTemplateSelectorEnhanced } from "@/components/PollTemplateSelectorEnhanced";
import { t } from "@/lib/i18n";
import type { PollTemplate } from "@/lib/pollTemplates";

export const QuizBuilderStart = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const quizType = (searchParams.get('type') || 'quiz') as 'quiz' | 'poll';
  
  const [showTemplates, setShowTemplates] = useState(false);
  const isPoll = quizType === 'poll';

  const handleFromScratch = () => {
    navigate(`/builder?type=${quizType}`);
  };

  const handleSelectTemplate = (template: PollTemplate) => {
    navigate(`/builder?type=${quizType}&templateId=${template.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header subtitle={isPoll ? t('pollBuilder') : t('quizBuilder')} />
      
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            {isPoll ? t('createNewPoll') : t('createNewQuiz')}
          </h1>
          <p className="text-muted-foreground">
            {isPoll ? t('choosePollStart') : t('chooseQuizStart')}
          </p>
        </div>

        {!showTemplates ? (
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="cursor-pointer hover:shadow-lg transition-all border-2 hover:border-primary">
              <CardHeader>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>{t('fromScratch')}</CardTitle>
                <CardDescription>
                  {isPoll ? t('createPollFromScratchDesc') : t('createQuizFromScratchDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full" 
                  onClick={handleFromScratch}
                >
                  {t('startFromScratch')}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-all border-2 hover:border-primary">
              <CardHeader>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>{t('fromTemplate')}</CardTitle>
                <CardDescription>
                  {isPoll ? t('createPollFromTemplateDesc') : t('createQuizFromTemplateDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => setShowTemplates(true)}
                >
                  {t('browseTemplates')}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            <Button 
              variant="ghost" 
              onClick={() => setShowTemplates(false)}
              className="mb-4"
            >
              ← {t('back')}
            </Button>
            <PollTemplateSelectorEnhanced
              selectedTemplateId={null}
              onSelectTemplate={handleSelectTemplate}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizBuilderStart;
