import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SLIDE_TEMPLATES, type SlideTemplate } from "@/lib/slideTemplates";
import { FileText } from "lucide-react";

interface SlideTemplateSelectorEnhancedProps {
  selectedTemplateId: string | null;
  onSelectTemplate: (template: SlideTemplate) => void;
}

export const SlideTemplateSelectorEnhanced = ({
  selectedTemplateId,
  onSelectTemplate,
}: SlideTemplateSelectorEnhancedProps) => {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Choisissez un modèle de présentation
        </h2>
        <p className="text-muted-foreground">
          Sélectionnez un modèle prêt à l'emploi pour commencer rapidement
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {SLIDE_TEMPLATES.map((template) => (
          <Card
            key={template.id}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedTemplateId === template.id ? "border-primary ring-2 ring-primary" : ""
            }`}
            onClick={() => onSelectTemplate(template)}
          >
            <CardHeader>
              <div className="flex items-start justify-between mb-2">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <Badge variant="secondary">{template.slides.length} slides</Badge>
              </div>
              <CardTitle className="text-lg">{template.name}</CardTitle>
              <CardDescription>{template.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-muted-foreground">Contenu :</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {template.slides.slice(0, 3).map((slide, idx) => (
                    <li key={idx} className="flex items-center">
                      <span className="mr-2">•</span>
                      {slide.title}
                    </li>
                  ))}
                  {template.slides.length > 3 && (
                    <li className="text-xs italic">
                      ... et {template.slides.length - 3} autres slides
                    </li>
                  )}
                </ul>
              </div>
              <Button className="w-full mt-4" variant={selectedTemplateId === template.id ? "default" : "outline"}>
                {selectedTemplateId === template.id ? "Sélectionné" : "Utiliser ce modèle"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
