import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { flashcardTemplates, type FlashcardTemplate } from "@/lib/flashcardTemplates";
import { Book, ArrowRight } from "lucide-react";

interface FlashcardTemplateSelectorEnhancedProps {
  selectedTemplateId: string | null;
  onSelectTemplate: (template: FlashcardTemplate) => void;
}

export const FlashcardTemplateSelectorEnhanced = ({
  selectedTemplateId,
  onSelectTemplate,
}: FlashcardTemplateSelectorEnhancedProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">Templates de flashcards</h2>
        <p className="text-muted-foreground">
          Démarrez rapidement avec un modèle pré-rempli
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {flashcardTemplates.map((template) => (
          <Card
            key={template.id}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedTemplateId === template.id ? "border-primary border-2" : "border-2"
            }`}
          >
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Book className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-lg">{template.name}</CardTitle>
              <CardDescription>{template.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="rounded-full">
                  {template.category}
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  {template.cards.length} cartes
                </Badge>
              </div>
              <Button
                className="w-full"
                variant={selectedTemplateId === template.id ? "default" : "outline"}
                onClick={() => onSelectTemplate(template)}
              >
                {selectedTemplateId === template.id ? "Template sélectionné" : "Utiliser ce template"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
