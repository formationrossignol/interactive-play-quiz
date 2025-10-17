import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Type, Image as ImageIcon, Square, Plus } from "lucide-react";
import { SlideCanvas, SlideElement } from "./SlideCanvas";

interface SlideEditorProps {
  slide: {
    id: string;
    backgroundColor?: string;
    elements?: SlideElement[];
  };
  onChange: (slide: any) => void;
}

export const SlideEditor = ({ slide, onChange }: SlideEditorProps) => {
  const elements = slide.elements || [];

  const addElement = (type: 'text' | 'image' | 'shape') => {
    const newElement: SlideElement = {
      id: `element-${Date.now()}`,
      type,
      content: type === 'text' ? 'Nouveau texte' : '',
      x: 50,
      y: 50,
      width: type === 'text' ? 300 : 200,
      height: type === 'text' ? 100 : 150,
      fontSize: type === 'text' ? 24 : undefined,
      fontWeight: type === 'text' ? 'normal' : undefined,
      color: type === 'text' ? '#000000' : undefined,
      backgroundColor: type === 'shape' ? '#3b82f6' : undefined,
    };

    onChange({ ...slide, elements: [...elements, newElement] });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const newElement: SlideElement = {
        id: `element-${Date.now()}`,
        type: 'image',
        content: '',
        x: 50,
        y: 50,
        width: 400,
        height: 300,
        imageUrl: reader.result as string,
      };
      onChange({ ...slide, elements: [...elements, newElement] });
    };
    reader.readAsDataURL(file);
  };

  return (
    <Tabs defaultValue="canvas" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="canvas">Éditeur</TabsTrigger>
        <TabsTrigger value="design">Fond</TabsTrigger>
      </TabsList>

      <TabsContent value="canvas" className="space-y-4 mt-6">
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => addElement('text')}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            <Type className="h-4 w-4" />
            Ajouter du texte
          </Button>
          
          <div>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              id="add-image"
            />
            <label htmlFor="add-image">
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                asChild
              >
                <span>
                  <ImageIcon className="h-4 w-4" />
                  Ajouter une image
                </span>
              </Button>
            </label>
          </div>

          <Button
            onClick={() => addElement('shape')}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            <Square className="h-4 w-4" />
            Ajouter une forme
          </Button>
        </div>

        <SlideCanvas
          elements={elements}
          backgroundColor={slide.backgroundColor}
          onChange={(newElements) => onChange({ ...slide, elements: newElements })}
        />

        <p className="text-xs text-muted-foreground">
          Cliquez sur un élément pour le sélectionner, déplacez-le et redimensionnez-le.
        </p>
      </TabsContent>

      <TabsContent value="design" className="space-y-6 mt-6">
        <div className="space-y-2">
          <Label htmlFor="bg-color">Couleur de fond</Label>
          <div className="flex gap-2">
            <Input
              id="bg-color"
              type="color"
              value={slide.backgroundColor || '#ffffff'}
              onChange={(e) => onChange({ ...slide, backgroundColor: e.target.value })}
              className="w-20 h-10 cursor-pointer"
            />
            <Input
              type="text"
              value={slide.backgroundColor || '#ffffff'}
              onChange={(e) => onChange({ ...slide, backgroundColor: e.target.value })}
              placeholder="#ffffff"
              className="flex-1"
            />
          </div>
          <div className="flex gap-2 mt-2">
            {['#ffffff', '#f8fafc', '#1e293b', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'].map(color => (
              <button
                key={color}
                className="w-8 h-8 rounded border-2 border-border hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                onClick={() => onChange({ ...slide, backgroundColor: color })}
              />
            ))}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
};
