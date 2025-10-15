import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";

interface SlideEditorProps {
  slide: {
    id: string;
    title: string;
    content: string;
    image?: string;
  };
  onChange: (slide: any) => void;
}

export const SlideEditor = ({ slide, onChange }: SlideEditorProps) => {
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      onChange({ ...slide, image: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="slide-title">Titre de la diapositive</Label>
        <Input
          id="slide-title"
          value={slide.title}
          onChange={(e) => onChange({ ...slide, title: e.target.value })}
          placeholder="Entrez le titre..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="slide-content">Contenu</Label>
        <Textarea
          id="slide-content"
          value={slide.content}
          onChange={(e) => onChange({ ...slide, content: e.target.value })}
          placeholder="Entrez le contenu de la diapositive..."
          className="min-h-[200px]"
        />
      </div>

      <div className="space-y-2">
        <Label>Image (optionnel)</Label>
        {slide.image ? (
          <div className="relative">
            <img
              src={slide.image}
              alt="Slide"
              className="w-full h-48 object-cover rounded-lg"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2"
              onClick={() => onChange({ ...slide, image: undefined })}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              id="slide-image-upload"
            />
            <label htmlFor="slide-image-upload" className="cursor-pointer">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Cliquez pour ajouter une image
              </p>
            </label>
          </div>
        )}
      </div>
    </div>
  );
};
