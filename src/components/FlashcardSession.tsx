import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MultiStepProgress } from "@/components/MultiStepProgress";
import type { SavedQuiz } from "@/lib/quizStorage";

interface FlashcardSessionProps {
  deck: SavedQuiz;
}

interface FlashcardItem {
  id?: string;
  recto?: string;
  verso?: string;
  rectoImage?: string;
  versoImage?: string;
}

export const FlashcardSession = ({ deck }: FlashcardSessionProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const totalCards = deck.questions.length;
  const currentCard = useMemo(() => deck.questions[currentIndex] as FlashcardItem, [deck.questions, currentIndex]);

  if (totalCards === 0) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 text-slate-100">
        <div className="mx-auto max-w-3xl">
          <Card className="border border-slate-700/60 bg-slate-900/80 shadow-2xl">
            <CardContent className="space-y-4 p-8 text-center">
              <h1 className="text-3xl font-bold text-white drop-shadow-lg">{deck.title || "Flashcards"}</h1>
              <p className="text-slate-300">
                Ce jeu de cartes est vide pour le moment. Ajoutez des cartes dans l'éditeur pour démarrer une session.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const goNext = () => {
    setCurrentIndex((index) => {
      const nextIndex = Math.min(index + 1, totalCards - 1);
      if (nextIndex !== index) {
        setShowAnswer(false);
      }
      return nextIndex;
    });
  };

  const goPrevious = () => {
    setCurrentIndex((index) => {
      const previousIndex = Math.max(index - 1, 0);
      if (previousIndex !== index) {
        setShowAnswer(false);
      }
      return previousIndex;
    });
  };

  const toggleAnswer = () => setShowAnswer((value) => !value);

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-4 text-center">
          <div className="flex items-center justify-between gap-4 text-sm text-slate-300">
            <Badge variant="secondary" className="border border-slate-700/60 bg-slate-800/70 text-slate-200">
              Session de révision
            </Badge>
            <span>
              Carte {currentIndex + 1} / {totalCards}
            </span>
          </div>
          <MultiStepProgress totalSteps={totalCards} currentStep={currentIndex} />
        </header>

        <Card className="border border-slate-700/60 bg-slate-900/80 shadow-2xl">
          <CardContent className="flex flex-col gap-6 p-8">
            <div className="space-y-4 text-center">
              <h1 className="text-3xl font-bold text-white drop-shadow-lg md:text-4xl">
                {deck.title || "Flashcards"}
              </h1>
              <p className="text-slate-300">
                {deck.description || "Balayez les cartes pour revoir vos connaissances."}
              </p>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-slate-700/60 bg-slate-950/70 p-8 shadow-lg">
              {showAnswer && currentCard?.versoImage && (
                <img src={currentCard.versoImage} alt="Illustration" className="mb-6 h-60 w-full rounded-2xl object-cover" />
              )}
              {!showAnswer && currentCard?.rectoImage && (
                <img src={currentCard.rectoImage} alt="Illustration" className="mb-6 h-60 w-full rounded-2xl object-cover" />
              )}

              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  {showAnswer ? "Réponse" : "Question"}
                </p>
                <p className="text-2xl font-semibold leading-snug text-white md:text-3xl">
                  {showAnswer
                    ? currentCard?.verso || "Ajoutez du contenu au verso de cette carte."
                    : currentCard?.recto || "Ajoutez du contenu au recto de cette carte."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <Button
                variant="ghost"
                onClick={toggleAnswer}
                className="border border-slate-700/60 bg-slate-800/70 text-slate-200 hover:bg-slate-700"
              >
                {showAnswer ? "Masquer la réponse" : "Afficher la réponse"}
              </Button>
              <Button
                variant="ghost"
                onClick={goPrevious}
                disabled={currentIndex === 0}
                className="border border-slate-700/60 bg-slate-800/70 text-slate-200 hover:bg-slate-700 disabled:opacity-50"
              >
                Carte précédente
              </Button>
              <Button variant="hero" onClick={goNext} disabled={currentIndex === totalCards - 1}>
                {currentIndex === totalCards - 1 ? "Dernière carte" : "Carte suivante"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
