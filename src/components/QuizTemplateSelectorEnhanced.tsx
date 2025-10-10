import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { QUIZ_TEMPLATES, QuizTemplate } from "@/lib/quizTemplates";
import { Search } from "lucide-react";

interface QuizTemplateSelectorProps {
  selectedTemplateId?: string | null;
  onSelectTemplate: (template: QuizTemplate) => void;
}

export const QuizTemplateSelectorEnhanced = ({ 
  selectedTemplateId, 
  onSelectTemplate 
}: QuizTemplateSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTemplates = QUIZ_TEMPLATES.filter(template => 
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un template de quiz..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {filteredTemplates.map((template) => (
          <Card
            key={template.id}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedTemplateId === template.id
                ? 'border-primary border-2'
                : 'border hover:border-primary/50'
            }`}
            onClick={() => onSelectTemplate(template)}
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="text-4xl">{template.icon}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg mb-1 text-foreground truncate">
                    {template.name}
                  </h3>
                  <Badge variant="secondary" className="mb-2 text-xs">
                    {template.category}
                  </Badge>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {template.description}
                  </p>
                  <div className="text-xs text-muted-foreground">
                    {template.questions.length} questions
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Aucun template trouvé</p>
        </div>
      )}
    </div>
  );
};
