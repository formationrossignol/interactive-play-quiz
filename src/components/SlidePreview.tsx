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
  backgroundColor?: string;
  layout?: 'title-content' | 'title-image' | 'two-column' | 'centered';
  titleSize?: 'small' | 'medium' | 'large';
  contentAlign?: 'left' | 'center' | 'right';
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
  const overlay = hexToRgba(secondaryColor, 0.1);

  const layout = slide.layout || 'title-content';
  const titleSize = slide.titleSize || 'large';
  const contentAlign = slide.contentAlign || 'left';
  const bgColor = slide.backgroundColor || '#ffffff';

  const backgroundStyle = useMemo(() => {
    if (!theme) {
      return {
        background: bgColor,
      };
    }

    return {
      backgroundColor: bgColor,
    };
  }, [theme, bgColor]);

  const titleSizeClass = {
    small: 'text-2xl',
    medium: 'text-3xl',
    large: 'text-5xl',
  }[titleSize];

  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }[contentAlign];

  const formatContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('•')) {
        return (
          <li key={i} className="ml-4">
            {trimmed.substring(1).trim()}
          </li>
        );
      }
      if (/^\d+\./.test(trimmed)) {
        return (
          <li key={i} className="ml-4 list-decimal">
            {trimmed.replace(/^\d+\.\s*/, '')}
          </li>
        );
      }
      return <p key={i}>{trimmed || <br />}</p>;
    });
  };

  const renderLayout = () => {
    switch (layout) {
      case 'title-image':
        return (
          <div className="space-y-8">
            {slide.title && (
              <h1 className={cn("font-bold", titleSizeClass, alignClass)} style={{ color: primaryColor }}>
                {slide.title}
              </h1>
            )}
            {slide.image && (
              <div className="w-full overflow-hidden rounded-lg shadow-lg">
                <img src={slide.image} alt={slide.title} className="w-full h-96 object-cover" />
              </div>
            )}
          </div>
        );

      case 'two-column':
        return (
          <div className="space-y-6">
            {slide.title && (
              <h1 className={cn("font-bold text-center", titleSizeClass)} style={{ color: primaryColor }}>
                {slide.title}
              </h1>
            )}
            <div className="grid grid-cols-2 gap-8">
              <div className={cn("prose prose-lg max-w-none", alignClass)}>
                {slide.content && (
                  <div className="text-lg space-y-2">
                    {formatContent(slide.content)}
                  </div>
                )}
              </div>
              <div>
                {slide.image && (
                  <img src={slide.image} alt={slide.title} className="w-full h-full object-cover rounded-lg shadow-lg" />
                )}
              </div>
            </div>
          </div>
        );

      case 'centered':
        return (
          <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
            {slide.title && (
              <h1 className={cn("font-bold text-center", titleSizeClass)} style={{ color: primaryColor }}>
                {slide.title}
              </h1>
            )}
            {slide.content && (
              <div className={cn("prose prose-lg text-center max-w-2xl", alignClass)}>
                <div className="text-xl">{formatContent(slide.content)}</div>
              </div>
            )}
          </div>
        );

      default: // title-content
        return (
          <div className="space-y-8">
            {slide.title && (
              <h1 className={cn("font-bold", titleSizeClass, alignClass)} style={{ color: primaryColor }}>
                {slide.title}
              </h1>
            )}
            {slide.image && (
              <div className="w-full overflow-hidden rounded-lg shadow-lg mb-6">
                <img src={slide.image} alt={slide.title} className="w-full h-64 object-cover" />
              </div>
            )}
            {slide.content && (
              <div className={cn("prose prose-lg max-w-none", alignClass)}>
                <div className="text-lg leading-relaxed space-y-2">
                  {formatContent(slide.content)}
                </div>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="relative flex h-full items-center justify-center p-8" style={backgroundStyle}>
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
      
      <div className="relative z-10 w-full max-w-5xl">
        <div className="p-16">
          {!slide.title && !slide.content ? (
            <p className="text-center text-muted-foreground text-lg">
              Diapositive vide - Cliquez sur Éditer pour ajouter du contenu
            </p>
          ) : (
            renderLayout()
          )}
        </div>
      </div>
    </div>
  );
};
