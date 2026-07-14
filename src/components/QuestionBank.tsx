import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Database, Plus, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import type { QuizQuestionType, PollQuestionType } from "@/lib/questionTypes";

export interface SavedQuestion {
  id: string;
  type: QuizQuestionType | PollQuestionType;
  question: string;
  answers: string[];
  correctAnswer?: number | string;
  timeLimit?: number;
  points?: number;
  createdAt: string;
  [key: string]: unknown;
}

interface QuestionBankProps {
  onSelectQuestion: (question: SavedQuestion) => void;
}

export const QuestionBank = ({ onSelectQuestion }: QuestionBankProps) => {
  const [savedQuestions, setSavedQuestions] = useState<SavedQuestion[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = () => {
    const stored = localStorage.getItem('questionBank');
    if (stored) {
      setSavedQuestions(JSON.parse(stored));
    }
  };

  const saveQuestions = (questions: SavedQuestion[]) => {
    localStorage.setItem('questionBank', JSON.stringify(questions));
    setSavedQuestions(questions);
  };

  const deleteQuestion = (id: string) => {
    const updated = savedQuestions.filter(q => q.id !== id);
    saveQuestions(updated);
    toast.success("Question supprimée");
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet) as Record<string, string>[];

        const imported: SavedQuestion[] = jsonData.map((row, index) => ({
          id: `import-${Date.now()}-${index}`,
          type: (row.type || 'multiple-choice') as QuizQuestionType | PollQuestionType,
          question: row.question || '',
          answers: row.answers ? row.answers.split('|') : [],
          correctAnswer: row.correctAnswer || 0,
          timeLimit: parseInt(row.timeLimit) || 30,
          points: parseInt(row.points) || 100,
          createdAt: new Date().toISOString()
        }));

        const updated = [...savedQuestions, ...imported];
        saveQuestions(updated);
        toast.success(`${imported.length} questions importées`);
      } catch (error) {
        toast.error("Erreur lors de l'import du fichier");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const exportToExcel = () => {
    const exportData = savedQuestions.map(q => ({
      question: q.question,
      type: q.type,
      answers: q.answers.join('|'),
      correctAnswer: q.correctAnswer,
      timeLimit: q.timeLimit,
      points: q.points
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Questions");
    XLSX.writeFile(wb, "questions-export.xlsx");
    toast.success("Questions exportées");
  };

  const filteredQuestions = savedQuestions.filter(q => {
    const matchesSearch = q.question.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || q.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <Database className="w-5 h-5 mr-2" />
            Banque de Questions ({savedQuestions.length})
          </CardTitle>
          <div className="flex gap-2">
            <label htmlFor="import-file">
              <Button variant="outline" size="sm" asChild>
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  Importer
                </span>
              </Button>
            </label>
            <input
              id="import-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileImport}
              className="hidden"
            />
            <Button variant="outline" size="sm" onClick={exportToExcel} disabled={savedQuestions.length === 0}>
              Exporter
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border rounded-lg bg-background"
            >
              <option value="all">Tous types</option>
              <option value="multiple-choice">QCM</option>
              <option value="true-false">Vrai/Faux</option>
              <option value="short-answer">Réponse courte</option>
              <option value="ranking">Classement</option>
            </select>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2">
            {filteredQuestions.map((q) => (
              <div key={q.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{q.question}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {q.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {q.timeLimit}s • {q.points}pts
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelectQuestion(q)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteQuestion(q.id)}
                    className="text-danger hover:text-danger"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {filteredQuestions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>Aucune question trouvée</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};