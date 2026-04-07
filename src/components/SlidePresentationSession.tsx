import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MultiStepProgress } from "@/components/MultiStepProgress";
import { SlidePreview } from "@/components/SlidePreview";
import type { SavedQuiz } from "@/lib/quizStorage";

interface SlidePresentationSessionProps {
  presentation: SavedQuiz;
}

interface SlideItem {
  id?: string;
  backgroundColor?: string;
  elements?: any[];
}

export const SlidePresentationSession = ({ presentation }: SlidePresentationSessionProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const totalSlides = presentation.questions.length;
  const currentSlide = useMemo(
    () => presentation.questions[currentIndex] as SlideItem,
    [presentation.questions, currentIndex]
  );

  if (totalSlides === 0) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 text-slate-100">
        <div className="mx-auto max-w-5xl">
          <Card className="border border-slate-700/60 bg-slate-900/80 shadow-2xl">
            <CardContent className="space-y-4 p-8 text-center">
              <h1 className="text-3xl font-bold text-white drop-shadow-lg">{presentation.title || "Présentation"}</h1>
              <p className="text-slate-300">
                Cette présentation ne contient encore aucune diapositive. Ajoutez du contenu pour la lancer.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const goNext = () => {
    setCurrentIndex((index) => Math.min(index + 1, totalSlides - 1));
  };

  const goPrevious = () => {
    setCurrentIndex((index) => Math.max(index - 1, 0));
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-4 text-center">
          <div className="flex items-center justify-between gap-4 text-sm text-slate-300">
            <Badge variant="secondary" className="border border-slate-700/60 bg-slate-800/70 text-slate-200">
              Présentation en direct
            </Badge>
            <span>
              Diapositive {currentIndex + 1} / {totalSlides}
            </span>
          </div>
          <MultiStepProgress totalSteps={totalSlides} currentStep={currentIndex} />
        </header>

        <Card className="overflow-hidden border border-slate-700/60 bg-slate-900/80 shadow-2xl">
          <CardContent className="p-0">
            <SlidePreview slide={currentSlide} />
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={goPrevious}
            disabled={currentIndex === 0}
            className="border border-slate-700/60 bg-slate-800/70 text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          >
            Précédent
          </Button>
          <Button variant="hero" onClick={goNext} disabled={currentIndex === totalSlides - 1}>
            {currentIndex === totalSlides - 1 ? "Dernière diapo" : "Diapo suivante"}
          </Button>
        </div>
      </div>
    </div>
  );
};
