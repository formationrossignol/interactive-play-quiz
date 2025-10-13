import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Trash2 } from "lucide-react";
import { t } from "@/lib/i18n";

interface FlashcardEditorProps {
  flashcard: {
    id?: string;
    recto: string;
    verso: string;
    rectoImage?: string;
    versoImage?: string;
  };
  onChange: (flashcard: any) => void;
}

export const FlashcardEditor = ({ flashcard, onChange }: FlashcardEditorProps) => {
  const handleImageUpload = (side: 'recto' | 'verso', file: File | null) => {
    if (!file) {
      onChange({ ...flashcard, [`${side}Image`]: '' });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      onChange({ ...flashcard, [`${side}Image`]: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      {/* Recto Section */}
      <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold text-sm">
            R
          </div>
          <Label className="text-base font-semibold">Recto (Question)</Label>
        </div>
        
        <div>
          <Textarea
            value={flashcard.recto}
            onChange={(e) => onChange({ ...flashcard, recto: e.target.value })}
            placeholder="Ex: Quelle est la capitale de l'Italie ?"
            className="min-h-[100px]"
          />
        </div>

        {flashcard.rectoImage && (
          <div className="relative overflow-hidden rounded-lg border bg-muted/40">
            <img
              src={flashcard.rectoImage}
              alt="Recto"
              className="h-40 w-full object-cover"
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-2 bg-black/60 text-white hover:bg-black/80"
              onClick={() => handleImageUpload('recto', null)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        <label htmlFor="recto-image">
          <Button variant="outline" size="sm" asChild className="w-full mt-2">
            <span className="flex items-center justify-center gap-2">
              <Upload className="h-4 w-4" />
              {flashcard.rectoImage ? t('changeImage') : t('addImage')}
            </span>
          </Button>
        </label>
        <input
          id="recto-image"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            handleImageUpload('recto', file);
            e.target.value = '';
          }}
        />
      </div>

      {/* Verso Section */}
      <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/10 text-secondary font-semibold text-sm">
            V
          </div>
          <Label className="text-base font-semibold">Verso (Réponse)</Label>
        </div>
        
        <div>
          <Textarea
            value={flashcard.verso}
            onChange={(e) => onChange({ ...flashcard, verso: e.target.value })}
            placeholder="Ex: Rome"
            className="min-h-[100px]"
          />
        </div>

        {flashcard.versoImage && (
          <div className="relative overflow-hidden rounded-lg border bg-muted/40">
            <img
              src={flashcard.versoImage}
              alt="Verso"
              className="h-40 w-full object-cover"
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-2 bg-black/60 text-white hover:bg-black/80"
              onClick={() => handleImageUpload('verso', null)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        <label htmlFor="verso-image">
          <Button variant="outline" size="sm" asChild className="w-full mt-2">
            <span className="flex items-center justify-center gap-2">
              <Upload className="h-4 w-4" />
              {flashcard.versoImage ? t('changeImage') : t('addImage')}
            </span>
          </Button>
        </label>
        <input
          id="verso-image"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            handleImageUpload('verso', file);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
};
