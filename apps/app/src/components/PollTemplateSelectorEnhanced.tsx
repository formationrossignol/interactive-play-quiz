import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { POLL_TEMPLATES, type PollTemplate } from "@/lib/pollTemplates";
import { Check, Search } from "lucide-react";
import { t } from "@/lib/i18n";

interface PollTemplateSelectorProps {
  selectedTemplateId?: string | null;
  onSelectTemplate: (template: PollTemplate) => void;
}

export const PollTemplateSelectorEnhanced = ({ selectedTemplateId, onSelectTemplate }: PollTemplateSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTemplates = POLL_TEMPLATES.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">{t('pollTemplates')}</CardTitle>
        <p className="text-muted-foreground text-sm">{t('pollTemplatesDesc')}</p>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un template..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-4">
          {filteredTemplates.map((template) => (
            <Card 
              key={template.id}
              className={`cursor-pointer transition-all hover:border-primary ${
                selectedTemplateId === template.id 
                  ? 'border-primary bg-accent' 
                  : 'border-border'
              }`}
              onClick={() => onSelectTemplate(template)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{template.icon}</span>
                    <div>
                      <h3 className="text-foreground font-semibold text-sm">{template.name}</h3>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {template.category}
                      </Badge>
                    </div>
                  </div>
                  {selectedTemplateId === template.id && (
                    <Check className="w-5 h-5 text-primary" />
                  )}
                </div>
                <p className="text-muted-foreground text-xs mt-2">{template.description}</p>
                <div className="mt-3 flex items-center gap-2 text-muted-foreground text-xs">
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
