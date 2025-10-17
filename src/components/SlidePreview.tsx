import { Button } from "@/components/ui/button";
import { Edit2 } from "lucide-react";
import { SlideCanvas, SlideElement } from "./SlideCanvas";

interface SlidePreviewProps {
  slide: {
    backgroundColor?: string;
    elements?: SlideElement[];
  };
  onEdit?: () => void;
  editable?: boolean;
}

export const SlidePreview = ({ slide, onEdit, editable = false }: SlidePreviewProps) => {
  const bgColor = slide.backgroundColor || '#ffffff';
  const elements = slide.elements || [];

  return (
    <div className="relative flex h-full items-center justify-center p-8" style={{ backgroundColor: bgColor }}>
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
        {elements.length === 0 ? (
          <p className="text-center text-muted-foreground text-lg">
            Diapositive vide - Cliquez sur Éditer pour ajouter du contenu
          </p>
        ) : (
          <SlideCanvas
            elements={elements}
            backgroundColor={bgColor}
            onChange={() => {}}
            editable={false}
          />
        )}
      </div>
    </div>
  );
};
