import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Sparkles, ArrowRight } from "lucide-react";
import { Header } from "@/components/Header";
import { PollTemplateSelectorEnhanced } from "@/components/PollTemplateSelectorEnhanced";
import { QuizTemplateSelectorEnhanced } from "@/components/QuizTemplateSelectorEnhanced";
import { FlashcardTemplateSelectorEnhanced } from "@/components/FlashcardTemplateSelectorEnhanced";
import { SlideTemplateSelectorEnhanced } from "@/components/SlideTemplateSelectorEnhanced";
import { t } from "@/lib/i18n";
import type { PollTemplate } from "@/lib/pollTemplates";
import type { QuizTemplate } from "@/lib/quizTemplates";
import type { FlashcardTemplate } from "@/lib/flashcardTemplates";
import type { SlideTemplate } from "@/lib/slideTemplates";

export const QuizBuilderStart = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const quizType = (searchParams.get('type') || 'quiz') as 'quiz' | 'poll' | 'flashcard' | 'slide';
  
  const [showTemplates, setShowTemplates] = useState(false);
  const isPoll = quizType === 'poll';
  const isFlashcard = quizType === 'flashcard';
  const isSlide = quizType === 'slide';

  const handleFromScratch = () => {
    navigate(`/builder?type=${quizType}`);
  };

  const handleSelectTemplate = (template: PollTemplate | QuizTemplate | FlashcardTemplate | SlideTemplate) => {
    navigate(`/builder?type=${quizType}&templateId=${template.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header subtitle={isSlide ? "Créateur de Présentations" : isFlashcard ? t('flashcardBuilder') : (isPoll ? t('pollBuilder') : t('quizBuilder'))} />
      
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            {isSlide ? "Créer une nouvelle présentation" : isFlashcard ? t('createNewFlashcard') : (isPoll ? t('createNewPoll') : t('createNewQuiz'))}
          </h1>
          <p className="text-muted-foreground">
            {isSlide ? "Choisissez comment commencer votre présentation" : isFlashcard ? t('chooseFlashcardStart') : (isPoll ? t('choosePollStart') : t('chooseQuizStart'))}
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
                  {isSlide ? "Créez votre présentation de zéro, diapositive par diapositive" : isFlashcard ? t('createFlashcardFromScratchDesc') : (isPoll ? t('createPollFromScratchDesc') : t('createQuizFromScratchDesc'))}
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
                  {isSlide ? "Démarrez avec un modèle de présentation prêt à l'emploi" : isFlashcard ? t('createFlashcardFromTemplateDesc') : (isPoll ? t('createPollFromTemplateDesc') : t('createQuizFromTemplateDesc'))}
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
            {isPoll ? (
              <PollTemplateSelectorEnhanced
                selectedTemplateId={null}
                onSelectTemplate={handleSelectTemplate}
              />
            ) : isSlide ? (
              <SlideTemplateSelectorEnhanced
                selectedTemplateId={null}
                onSelectTemplate={handleSelectTemplate}
              />
            ) : isFlashcard ? (
              <FlashcardTemplateSelectorEnhanced
                selectedTemplateId={null}
                onSelectTemplate={handleSelectTemplate}
              />
            ) : (
              <QuizTemplateSelectorEnhanced
                selectedTemplateId={null}
                onSelectTemplate={handleSelectTemplate}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizBuilderStart;
