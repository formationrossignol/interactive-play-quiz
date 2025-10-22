import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MultiStepProgress } from "@/components/MultiStepProgress";
import type { SavedQuiz } from "@/lib/quizStorage";
import { cn } from "@/lib/utils";

interface PollSessionProps {
  poll: SavedQuiz;
}

type PollQuestion = {
  id?: string;
  type: string;
  question?: string;
  answers?: string[];
  allowMultiple?: boolean;
  scale?: string[];
  items?: string[];
  maxStars?: number;
  maxLength?: number;
  minLabel?: string;
  maxLabel?: string;
  image?: string;
};

export const PollSession = ({ poll }: PollSessionProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const totalQuestions = poll.questions.length;
  const currentQuestion = useMemo(() => poll.questions[currentIndex] as PollQuestion, [poll.questions, currentIndex]);

  if (totalQuestions === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 text-slate-100">
        <div className="mx-auto max-w-4xl">
          <Card className="border border-slate-700/60 bg-slate-900/80 shadow-2xl">
            <CardContent className="space-y-4 p-8 text-center">
              <h1 className="text-3xl font-bold text-white drop-shadow-lg">{poll.title || "Sondage"}</h1>
              <p className="text-slate-300">
                Ce sondage ne contient aucune question. Ajoutez des questions dans l'éditeur avant de le lancer.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  const hasPrevious = currentIndex > 0;
  const isLast = currentIndex === totalQuestions - 1;

  const filteredAnswers = (currentQuestion?.answers || []).filter((answer) => answer?.trim());

  const goNext = () => {
    if (!isLast) {
      setCurrentIndex((index) => Math.min(index + 1, totalQuestions - 1));
    }
  };

  const goPrevious = () => {
    if (hasPrevious) {
      setCurrentIndex((index) => Math.max(index - 1, 0));
    }
  };

  const renderChoiceAnswers = (multiple: boolean) => (
    <div className="space-y-3">
      {filteredAnswers.length === 0 ? (
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-6 text-center text-slate-300">
          Aucune option configurée pour cette question.
        </div>
      ) : (
        filteredAnswers.map((answer, index) => (
          <div
            key={`${answer}-${index}`}
            className="flex items-center gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/85 px-4 py-4 text-slate-100 shadow-lg"
          >
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full bg-primary/80 text-sm font-semibold text-white shadow-inner",
              multiple && "bg-emerald-500/80"
            )}>
              {String.fromCharCode(65 + index)}
            </div>
            <span className="flex-1 text-base font-medium">{answer}</span>
          </div>
        ))
      )}
    </div>
  );

  const renderScale = (scale: string[] | undefined) => (
    <div className="space-y-3">
      {scale?.map((item, index) => (
        <div
          key={`${item}-${index}`}
          className="rounded-2xl border border-slate-700/60 bg-slate-900/80 px-4 py-4 text-center text-slate-100 shadow-lg"
        >
          {item}
        </div>
      )) || (
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-6 text-center text-slate-300">
          Aucune échelle définie pour cette question.
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    switch (currentQuestion?.type) {
      case "single-choice":
        return renderChoiceAnswers(false);
      case "multiple-choice":
        return renderChoiceAnswers(true);
      case "ranking":
        return (
          <div className="space-y-3">
            {(currentQuestion.items || []).filter((item) => item?.trim()).map((item, index) => (
              <div
                key={`${item}-${index}`}
                className="flex items-center gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/80 px-4 py-4 text-slate-100 shadow-lg"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/80 text-lg font-bold text-white shadow-inner">
                  {index + 1}
                </div>
                <span className="flex-1 text-base font-medium">{item}</span>
              </div>
            ))}
          </div>
        );
      case "likert-scale":
      case "frequency-scale":
        return renderScale(currentQuestion.scale);
      case "star-rating":
        return (
          <div className="flex justify-center gap-3 text-4xl text-yellow-400 drop-shadow">
            {Array.from({ length: currentQuestion.maxStars || 5 }).map((_, index) => (
              <span key={index}>★</span>
            ))}
          </div>
        );
      case "open-text":
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 px-5 py-6 text-slate-300">
              Réponse libre – les participants peuvent saisir jusqu'à {currentQuestion.maxLength || 500} caractères.
            </div>
          </div>
        );
      case "nps-scale":
        return (
          <div className="space-y-4">
            <div className="flex justify-between text-sm text-slate-300">
              <span>{currentQuestion.minLabel || "0"}</span>
              <span>{currentQuestion.maxLabel || "10"}</span>
            </div>
            <div className="grid grid-cols-11 gap-2 text-center text-sm font-semibold text-slate-100">
              {Array.from({ length: 11 }).map((_, index) => (
                <div key={index} className="rounded-xl border border-slate-700/60 bg-slate-900/80 px-3 py-3 shadow">
                  {index}
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return (
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-6 text-center text-slate-300">
            Ce type de question n'est pas encore pris en charge dans la prévisualisation.
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 text-slate-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="flex flex-col gap-4 text-center">
          <div className="flex items-center justify-between gap-4 text-sm text-slate-300">
            <Badge variant="secondary" className="border border-slate-700/60 bg-slate-800/70 text-slate-200">
              Sondage en direct
            </Badge>
            <span>
              Question {currentIndex + 1} / {totalQuestions}
            </span>
          </div>
          <MultiStepProgress totalSteps={totalQuestions} currentStep={currentIndex} />
        </header>

        <Card className="border border-slate-700/60 bg-slate-900/80 shadow-2xl">
          <CardContent className="space-y-8 p-8">
            <div className="space-y-4 text-center">
              <h1 className="text-3xl font-bold text-white drop-shadow-lg md:text-4xl">
                {currentQuestion?.question || `Question ${currentIndex + 1}`}
              </h1>
              {currentQuestion?.image && (
                <div className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-slate-700/60">
                  <img src={currentQuestion.image} alt="Illustration" className="h-64 w-full object-cover" />
                </div>
              )}
            </div>

            {renderContent()}
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={goPrevious}
            disabled={!hasPrevious}
            className="border border-slate-700/60 bg-slate-800/70 text-slate-200 hover:bg-slate-700"
          >
            Précédent
          </Button>
          <Button variant="hero" onClick={goNext} disabled={isLast}>
            {isLast ? "Fin du sondage" : "Question suivante"}
          </Button>
        </div>
      </div>
    </div>
  );
};
