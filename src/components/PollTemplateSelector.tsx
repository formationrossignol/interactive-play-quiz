import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { POLL_TEMPLATES, type PollTemplate } from "@/lib/pollTemplates";
import { Check } from "lucide-react";

interface PollTemplateSelectorProps {
  selectedTemplateId?: string | null;
  onSelectTemplate: (template: PollTemplate) => void;
}

export const PollTemplateSelector = ({ selectedTemplateId, onSelectTemplate }: PollTemplateSelectorProps) => {
  return (
    <Card className="bg-white/10 backdrop-blur-lg border-white/20">
      <CardHeader>
        <CardTitle className="text-white">Templates de Sondages</CardTitle>
        <p className="text-white/60 text-sm">Démarrez rapidement avec un modèle pré-rempli</p>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-4">
          {POLL_TEMPLATES.map((template) => (
            <Card 
              key={template.id}
              className={`cursor-pointer transition-all hover:bg-white/15 ${
                selectedTemplateId === template.id 
                  ? 'bg-white/20 border-primary' 
                  : 'bg-white/5 border-white/10'
              }`}
              onClick={() => onSelectTemplate(template)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{template.icon}</span>
                    <div>
                      <h3 className="text-white font-semibold text-sm">{template.name}</h3>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {template.category}
                      </Badge>
                    </div>
                  </div>
                  {selectedTemplateId === template.id && (
                    <Check className="w-5 h-5 text-primary" />
                  )}
                </div>
                <p className="text-white/60 text-xs mt-2">{template.description}</p>
                <div className="mt-3 flex items-center gap-2 text-white/40 text-xs">
                  <span>{template.questions.length} questions</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
