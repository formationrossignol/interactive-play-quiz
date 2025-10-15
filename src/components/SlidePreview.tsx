import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hexToRgba } from "@/lib/color";
import type { Theme } from "@/lib/themes";
import { Edit2 } from "lucide-react";

interface SlideContent {
  title: string;
  content: string;
  image?: string;
}

interface SlidePreviewProps {
  slide: SlideContent;
  theme?: Theme;
  onEdit?: () => void;
  editable?: boolean;
}

export const SlidePreview = ({ slide, theme, onEdit, editable = false }: SlidePreviewProps) => {
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
      
      {editable && onEdit && (
        <Button
          variant="secondary"
          size="sm"
          className="absolute top-4 right-4 z-20"
          onClick={onEdit}
        >
          <Edit2 className="h-4 w-4 mr-2" />
          Éditer
        </Button>
      )}
      
      <div className="relative z-10 w-full max-w-4xl">
        <Card className="overflow-hidden bg-white/95 shadow-2xl p-12">
          <div className="space-y-6">
            {slide.title && (
              <h1 
                className="text-4xl font-bold text-center"
                style={{ color: primaryColor }}
              >
                {slide.title}
              </h1>
            )}

            {slide.image && (
              <div className="w-full overflow-hidden rounded-lg shadow-lg">
                <img
                  src={slide.image}
                  alt={slide.title}
                  className="w-full h-64 object-cover"
                />
              </div>
            )}

            {slide.content && (
              <div className="prose prose-lg max-w-none">
                <p className="text-lg text-foreground whitespace-pre-wrap">
                  {slide.content}
                </p>
              </div>
            )}

            {!slide.title && !slide.content && (
              <p className="text-center text-muted-foreground text-lg">
                Diapositive vide - Cliquez sur Éditer pour ajouter du contenu
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
