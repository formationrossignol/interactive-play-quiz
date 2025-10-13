import { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FlashcardPreviewProps {
  flashcard: {
    recto: string;
    verso: string;
    rectoImage?: string;
    versoImage?: string;
  };
  theme?: any;
}

export const FlashcardPreview = ({ flashcard, theme }: FlashcardPreviewProps) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const currentSide = isFlipped ? 'verso' : 'recto';
  const currentText = isFlipped ? flashcard.verso : flashcard.recto;
  const currentImage = isFlipped ? flashcard.versoImage : flashcard.rectoImage;

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div 
        className="relative w-full max-w-2xl cursor-pointer"
        style={{ perspective: '1000px' }}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div
          className={cn(
            "relative h-[400px] w-full transition-transform duration-500",
            "transform-gpu"
          )}
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Recto */}
          <Card
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center gap-4 p-8",
              "backface-hidden overflow-hidden"
            )}
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
          >
            <div className="absolute top-4 left-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold">
                R
              </div>
            </div>
            
            {flashcard.rectoImage && (
              <div className="mb-4 w-full max-w-md overflow-hidden rounded-lg">
                <img
                  src={flashcard.rectoImage}
                  alt="Recto"
                  className="h-48 w-full object-cover"
                />
              </div>
            )}
            
            <div className="text-center text-2xl font-semibold px-4">
              {flashcard.recto || "Recto vide"}
            </div>
            
            <div className="absolute bottom-4 text-sm text-muted-foreground">
              Cliquez pour retourner
            </div>
          </Card>

          {/* Verso */}
          <Card
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center gap-4 p-8",
              "backface-hidden overflow-hidden"
            )}
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <div className="absolute top-4 left-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10 text-secondary font-bold">
                V
              </div>
            </div>
            
            {flashcard.versoImage && (
              <div className="mb-4 w-full max-w-md overflow-hidden rounded-lg">
                <img
                  src={flashcard.versoImage}
                  alt="Verso"
                  className="h-48 w-full object-cover"
                />
              </div>
            )}
            
            <div className="text-center text-2xl font-semibold px-4">
              {flashcard.verso || "Verso vide"}
            </div>
            
            <div className="absolute bottom-4 text-sm text-muted-foreground">
              Cliquez pour retourner
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
