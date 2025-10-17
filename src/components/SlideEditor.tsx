import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, X, AlignLeft, AlignCenter, AlignRight, Type, Palette, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SlideEditorProps {
  slide: {
    id: string;
    title: string;
    content: string;
    image?: string;
    backgroundColor?: string;
    layout?: 'title-content' | 'title-image' | 'two-column' | 'centered';
    titleSize?: 'small' | 'medium' | 'large';
    contentAlign?: 'left' | 'center' | 'right';
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
    <Tabs defaultValue="content" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="content">Contenu</TabsTrigger>
        <TabsTrigger value="design">Design</TabsTrigger>
        <TabsTrigger value="layout">Disposition</TabsTrigger>
      </TabsList>

      <TabsContent value="content" className="space-y-6 mt-6">
        <div className="space-y-2">
          <Label htmlFor="slide-title">Titre</Label>
          <Input
            id="slide-title"
            value={slide.title}
            onChange={(e) => onChange({ ...slide, title: e.target.value })}
            placeholder="Titre de la diapositive"
            className="text-lg font-semibold"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slide-content">Contenu</Label>
          <Textarea
            id="slide-content"
            value={slide.content}
            onChange={(e) => onChange({ ...slide, content: e.target.value })}
            placeholder="• Point clé 1&#10;• Point clé 2&#10;• Point clé 3"
            className="min-h-[300px] font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Utilisez • pour créer des puces, ou numérotez vos points
          </p>
        </div>

        <div className="space-y-2">
          <Label>Image</Label>
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
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="slide-image-upload"
              />
              <label htmlFor="slide-image-upload" className="cursor-pointer">
                <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Ajouter une image</p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG jusqu'à 10MB
                </p>
              </label>
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="design" className="space-y-6 mt-6">
        <div className="space-y-2">
          <Label htmlFor="title-size">Taille du titre</Label>
          <Select
            value={slide.titleSize || 'large'}
            onValueChange={(value: 'small' | 'medium' | 'large') => 
              onChange({ ...slide, titleSize: value })
            }
          >
            <SelectTrigger id="title-size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">
                <div className="flex items-center gap-2">
                  <Type className="h-3 w-3" />
                  Petit
                </div>
              </SelectItem>
              <SelectItem value="medium">
                <div className="flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  Moyen
                </div>
              </SelectItem>
              <SelectItem value="large">
                <div className="flex items-center gap-2">
                  <Type className="h-5 w-5" />
                  Grand
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Alignement du contenu</Label>
          <div className="flex gap-2">
            <Button
              variant={slide.contentAlign === 'left' || !slide.contentAlign ? 'default' : 'outline'}
              size="sm"
              onClick={() => onChange({ ...slide, contentAlign: 'left' })}
            >
              <AlignLeft className="h-4 w-4" />
            </Button>
            <Button
              variant={slide.contentAlign === 'center' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onChange({ ...slide, contentAlign: 'center' })}
            >
              <AlignCenter className="h-4 w-4" />
            </Button>
            <Button
              variant={slide.contentAlign === 'right' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onChange({ ...slide, contentAlign: 'right' })}
            >
              <AlignRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

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
            {['#ffffff', '#f8fafc', '#1e293b', '#3b82f6', '#8b5cf6'].map(color => (
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

      <TabsContent value="layout" className="space-y-6 mt-6">
        <div className="space-y-2">
          <Label>Disposition de la diapositive</Label>
          <div className="grid grid-cols-2 gap-4">
            <button
              className={cn(
                "border-2 rounded-lg p-4 hover:border-primary transition-colors",
                slide.layout === 'title-content' || !slide.layout ? 'border-primary bg-primary/5' : 'border-border'
              )}
              onClick={() => onChange({ ...slide, layout: 'title-content' })}
            >
              <div className="space-y-2">
                <div className="h-3 bg-foreground/20 rounded w-3/4 mx-auto" />
                <div className="h-2 bg-foreground/10 rounded" />
                <div className="h-2 bg-foreground/10 rounded" />
                <div className="h-2 bg-foreground/10 rounded w-4/5" />
              </div>
              <p className="text-xs mt-2 font-medium">Titre + Contenu</p>
            </button>

            <button
              className={cn(
                "border-2 rounded-lg p-4 hover:border-primary transition-colors",
                slide.layout === 'title-image' ? 'border-primary bg-primary/5' : 'border-border'
              )}
              onClick={() => onChange({ ...slide, layout: 'title-image' })}
            >
              <div className="space-y-2">
                <div className="h-3 bg-foreground/20 rounded w-3/4 mx-auto" />
                <div className="h-16 bg-foreground/10 rounded" />
              </div>
              <p className="text-xs mt-2 font-medium">Titre + Image</p>
            </button>

            <button
              className={cn(
                "border-2 rounded-lg p-4 hover:border-primary transition-colors",
                slide.layout === 'two-column' ? 'border-primary bg-primary/5' : 'border-border'
              )}
              onClick={() => onChange({ ...slide, layout: 'two-column' })}
            >
              <div className="space-y-2">
                <div className="h-3 bg-foreground/20 rounded w-3/4 mx-auto" />
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <div className="h-2 bg-foreground/10 rounded" />
                    <div className="h-2 bg-foreground/10 rounded" />
                  </div>
                  <div className="flex-1 h-12 bg-foreground/10 rounded" />
                </div>
              </div>
              <p className="text-xs mt-2 font-medium">Deux colonnes</p>
            </button>

            <button
              className={cn(
                "border-2 rounded-lg p-4 hover:border-primary transition-colors",
                slide.layout === 'centered' ? 'border-primary bg-primary/5' : 'border-border'
              )}
              onClick={() => onChange({ ...slide, layout: 'centered' })}
            >
              <div className="flex items-center justify-center h-full">
                <div className="space-y-2 w-full">
                  <div className="h-4 bg-foreground/20 rounded w-3/4 mx-auto" />
                  <div className="h-2 bg-foreground/10 rounded w-2/3 mx-auto" />
                </div>
              </div>
              <p className="text-xs mt-2 font-medium">Centré</p>
            </button>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
};
