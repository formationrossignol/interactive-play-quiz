import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { hexToRgba } from "@/lib/color";
import type { Theme } from "@/lib/themes";
import { t } from "@/lib/i18n";

interface FlashcardContent {
  recto: string;
  verso: string;
  rectoImage?: string;
  versoImage?: string;
}

interface FlashcardPreviewProps {
  flashcard: FlashcardContent;
  theme?: Theme;
}

export const FlashcardPreview = ({ flashcard, theme }: FlashcardPreviewProps) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const palette = theme?.palette ?? [];
  const primaryColor = palette[0] ?? "#0f172a";
  const secondaryColor = palette[palette.length - 1] ?? "#1d4ed8";
  const overlay = hexToRgba(secondaryColor, 0.25);

  const backgroundStyle = useMemo(() => {
    if (!theme) {
      return {
        background: "linear-gradient(135deg, rgba(15,23,42,0.85), rgba(30,64,175,0.75))",
      };
    }

    return {
      backgroundImage: theme.background,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }, [theme]);

  return (
    <div className="relative flex h-full items-center justify-center p-8">
      <div className="absolute inset-0" style={backgroundStyle} aria-hidden />
      <div className="absolute inset-0" style={{ background: overlay }} aria-hidden />
      <div className="relative z-10 w-full max-w-3xl">
        <div
          className="relative w-full max-w-2xl cursor-pointer"
          style={{ perspective: "1000px", margin: "0 auto" }}
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <div
            className={cn(
              "relative h-[420px] w-full transition-transform duration-500",
              "transform-gpu"
            )}
            style={{
              transformStyle: "preserve-3d",
              transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
            }}
          >
            {/* Recto */}
            <Card
              className={cn(
                "absolute inset-0 flex flex-col items-center justify-center gap-4 p-8",
                "backface-hidden overflow-hidden bg-white/90 shadow-2xl"
              )}
              style={{
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
              }}
            >
              <div className="absolute top-4 left-4">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg font-bold"
                  style={{
                    backgroundColor: hexToRgba(primaryColor, 0.16),
                    color: primaryColor,
                  }}
                >
                  R
                </div>
              </div>

              {flashcard.rectoImage && (
                <div className="mb-4 w-full max-w-md overflow-hidden rounded-lg shadow-lg">
                  <img
                    src={flashcard.rectoImage}
                    alt="Recto"
                    className="h-48 w-full object-cover"
                  />
                </div>
              )}

              <div className="px-4 text-center text-2xl font-semibold text-foreground">
                {flashcard.recto || t("flashcardRectoEmpty")}
              </div>

              <div className="absolute bottom-4 text-sm text-muted-foreground">
                {t("flashcardClickToFlip")}
              </div>
            </Card>

            {/* Verso */}
            <Card
              className={cn(
                "absolute inset-0 flex flex-col items-center justify-center gap-4 p-8",
                "backface-hidden overflow-hidden bg-white/90 shadow-2xl"
              )}
              style={{
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
              }}
            >
              <div className="absolute top-4 left-4">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg font-bold"
                  style={{
                    backgroundColor: hexToRgba(primaryColor, 0.16),
                    color: primaryColor,
                  }}
                >
                  V
                </div>
              </div>

              {flashcard.versoImage && (
                <div className="mb-4 w-full max-w-md overflow-hidden rounded-lg shadow-lg">
                  <img
                    src={flashcard.versoImage}
                    alt="Verso"
                    className="h-48 w-full object-cover"
                  />
                </div>
              )}

              <div className="px-4 text-center text-2xl font-semibold text-foreground">
                {flashcard.verso || t("flashcardVersoEmpty")}
              </div>

              <div className="absolute bottom-4 text-sm text-muted-foreground">
                {t("flashcardClickToFlip")}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
