import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle, Upload, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { saveQuiz } from "@/lib/quizStorage";
import {
  parseQuizYaml,
  parseQuizCsv,
  parseFlashcardMarkdown,
  parseSlideMarkdown,
} from "@/lib/importParsers";

interface Props {
  open: boolean;
  onClose: () => void;
  quizType: "quiz" | "poll" | "flashcard" | "slide";
}

// ── Format documentation ────────────────────────────────────────────────────

const QUIZ_YAML_DOC = `title: Mon Quiz
description: Description optionnelle
category: Géographie
questions:
  - type: multiple-choice
    question: Quelle est la capitale de la France ?
    answers:
      - Paris
      - Lyon
      - Marseille
      - Bordeaux
    correctAnswer: 0       # index (0 = Paris)
    timeLimit: 30
    points: 100
  - type: true-false
    question: La Terre est plate.
    correctAnswer: false
    timeLimit: 20
    points: 50
  - type: short-answer
    question: Capitale de l'Espagne ?
    correctAnswer: Madrid
    timeLimit: 30
    points: 80`;

const QUIZ_CSV_DOC = `type,question,answer1,answer2,answer3,answer4,correctAnswer,timeLimit,points
multiple-choice,Capitale de la France ?,Paris,Lyon,Marseille,Bordeaux,0,30,100
true-false,La Terre est plate.,,,,,false,20,50
short-answer,Capitale de l'Espagne ?,,,,, Madrid,30,80`;

const POLL_YAML_DOC = `title: Mon Sondage
category: Satisfaction
questions:
  - type: single-choice
    question: Votre préférence ?
    answers:
      - Option A
      - Option B
      - Option C
  - type: likert-scale
    question: Je suis satisfait du service.
    scale:
      - Tout à fait d'accord
      - D'accord
      - Neutre
      - Pas d'accord
      - Pas du tout d'accord
  - type: open-text
    question: Vos commentaires ?`;

const POLL_CSV_DOC = `type,question,option1,option2,option3,option4,option5
single-choice,Votre préférence ?,Option A,Option B,Option C,,
likert-scale,Satisfaction ?,Tout à fait d'accord,D'accord,Neutre,Pas d'accord,Pas du tout
open-text,Vos commentaires ?,,,,, `;

const FLASHCARD_MD_DOC = `# Titre du jeu de cartes

Q: Quelle est la capitale de la France ?
R: Paris

Q: Quelle est la capitale de l'Allemagne ?
R: Berlin

Q: Quel est l'élément chimique de symbole O ?
R: Oxygène`;

const SLIDE_MD_DOC = `# Titre de la présentation

---

## Introduction

Bienvenue dans cette présentation.

- Point clé 1
- Point clé 2

---

## Développement

Contenu détaillé de la deuxième diapositive.

---

## Conclusion

Message de fin et prochaines étapes.`;

// ── Docs modal ──────────────────────────────────────────────────────────────

interface DocsModalProps {
  open: boolean;
  onClose: () => void;
  quizType: "quiz" | "poll" | "flashcard" | "slide";
}

const DocsModal = ({ open, onClose, quizType }: DocsModalProps) => {
  const isMarkdown = quizType === "flashcard" || quizType === "slide";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Format d'import — {quizType}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 text-sm">
          {quizType === "quiz" && (
            <>
              <section>
                <h3 className="font-semibold text-slate-900 mb-2">YAML (.yaml / .yml)</h3>
                <p className="text-slate-500 mb-2">
                  Types de questions : <code className="bg-slate-100 px-1 rounded">multiple-choice</code>,{" "}
                  <code className="bg-slate-100 px-1 rounded">true-false</code>,{" "}
                  <code className="bg-slate-100 px-1 rounded">short-answer</code>
                </p>
                <pre className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs leading-relaxed overflow-x-auto whitespace-pre">
                  {QUIZ_YAML_DOC}
                </pre>
              </section>
              <section>
                <h3 className="font-semibold text-slate-900 mb-2">CSV (.csv)</h3>
                <p className="text-slate-500 mb-2">
                  Première ligne = en-têtes. <code className="bg-slate-100 px-1 rounded">correctAnswer</code> = index (0-based) pour choix multiple, <code className="bg-slate-100 px-1 rounded">true</code>/<code className="bg-slate-100 px-1 rounded">false</code> pour vrai/faux, texte pour réponse courte.
                </p>
                <pre className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs leading-relaxed overflow-x-auto whitespace-pre">
                  {QUIZ_CSV_DOC}
                </pre>
              </section>
            </>
          )}

          {quizType === "poll" && (
            <>
              <section>
                <h3 className="font-semibold text-slate-900 mb-2">YAML (.yaml / .yml)</h3>
                <p className="text-slate-500 mb-2">
                  Types : <code className="bg-slate-100 px-1 rounded">single-choice</code>,{" "}
                  <code className="bg-slate-100 px-1 rounded">multiple-choice</code>,{" "}
                  <code className="bg-slate-100 px-1 rounded">likert-scale</code>,{" "}
                  <code className="bg-slate-100 px-1 rounded">open-text</code>,{" "}
                  <code className="bg-slate-100 px-1 rounded">star-rating</code>,{" "}
                  <code className="bg-slate-100 px-1 rounded">nps-scale</code>
                </p>
                <pre className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs leading-relaxed overflow-x-auto whitespace-pre">
                  {POLL_YAML_DOC}
                </pre>
              </section>
              <section>
                <h3 className="font-semibold text-slate-900 mb-2">CSV (.csv)</h3>
                <p className="text-slate-500 mb-2">
                  Colonnes <code className="bg-slate-100 px-1 rounded">option1…option5</code> pour les choix. Pour <code className="bg-slate-100 px-1 rounded">likert-scale</code>, les options deviennent l'échelle.
                </p>
                <pre className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs leading-relaxed overflow-x-auto whitespace-pre">
                  {POLL_CSV_DOC}
                </pre>
              </section>
            </>
          )}

          {quizType === "flashcard" && (
            <section>
              <h3 className="font-semibold text-slate-900 mb-2">Markdown (.md)</h3>
              <p className="text-slate-500 mb-2">
                Titre du jeu avec <code className="bg-slate-100 px-1 rounded"># Titre</code>. Chaque carte commence par{" "}
                <code className="bg-slate-100 px-1 rounded">Q:</code> (recto) suivi de{" "}
                <code className="bg-slate-100 px-1 rounded">R:</code> (verso), séparés par un saut de ligne.
              </p>
              <pre className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs leading-relaxed overflow-x-auto whitespace-pre">
                {FLASHCARD_MD_DOC}
              </pre>
            </section>
          )}

          {quizType === "slide" && (
            <section>
              <h3 className="font-semibold text-slate-900 mb-2">Markdown (.md)</h3>
              <p className="text-slate-500 mb-2">
                Titre de la présentation avec <code className="bg-slate-100 px-1 rounded"># Titre</code>. Chaque diapositive est séparée par <code className="bg-slate-100 px-1 rounded">---</code> et peut avoir un titre avec <code className="bg-slate-100 px-1 rounded">## Titre slide</code>.
              </p>
              <pre className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs leading-relaxed overflow-x-auto whitespace-pre">
                {SLIDE_MD_DOC}
              </pre>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ── Main import modal ───────────────────────────────────────────────────────

export const ImportFileModal = ({ open, onClose, quizType }: Props) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);

  const isMarkdown = quizType === "flashcard" || quizType === "slide";
  const acceptedExts = isMarkdown ? ".md,.markdown" : ".yaml,.yml,.csv";

  const typeLabel = {
    quiz: "Quiz",
    poll: "Sondage",
    flashcard: "Flashcards",
    slide: "Présentation",
  }[quizType];

  const handleFile = async (file: File) => {
    const content = await file.text();
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

    try {
      let draft;
      if (quizType === "flashcard") {
        draft = parseFlashcardMarkdown(content);
      } else if (quizType === "slide") {
        draft = parseSlideMarkdown(content);
      } else if (ext === "csv") {
        draft = parseQuizCsv(content, quizType);
      } else {
        draft = parseQuizYaml(content, quizType);
      }

      const saved = saveQuiz(draft);
      toast.success(
        `${draft.questions.length} élément${draft.questions.length > 1 ? "s" : ""} importé${draft.questions.length > 1 ? "s" : ""}`,
        { description: draft.title }
      );
      onClose();
      navigate(`/builder?type=${quizType}&quizId=${saved.id}`);
    } catch (err: any) {
      toast.error("Erreur d'import", {
        description: err?.message ?? "Vérifiez le format du fichier.",
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Importer — {typeLabel}</DialogTitle>
              <button
                onClick={() => setDocsOpen(true)}
                className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                title="Voir le format attendu"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Format
              </button>
            </div>
          </DialogHeader>

          <p className="text-sm text-slate-500">
            {isMarkdown
              ? "Importez un fichier Markdown (.md) pour créer vos "
              : "Importez un fichier YAML ou CSV pour créer votre "}
            {typeLabel.toLowerCase()}.
          </p>

          {/* Drop zone */}
          <div
            className={cn(
              "mt-2 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 transition-colors cursor-pointer",
              dragOver
                ? "border-indigo-400 bg-indigo-50"
                : "border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40"
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
              {dragOver ? (
                <Upload className="h-6 w-6 text-indigo-600 animate-bounce" />
              ) : (
                <FileText className="h-6 w-6 text-indigo-600" />
              )}
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-800">
                Glissez votre fichier ici
              </p>
              <p className="mt-1 text-xs text-slate-400">
                ou cliquez pour sélectionner
              </p>
              <p className="mt-2 text-xs font-medium text-indigo-500">
                {isMarkdown ? ".md · .markdown" : ".yaml · .yml · .csv"}
              </p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedExts}
            className="hidden"
            onChange={handleInputChange}
          />

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" className="rounded-full" onClick={onClose}>
              Annuler
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DocsModal
        open={docsOpen}
        onClose={() => setDocsOpen(false)}
        quizType={quizType}
      />
    </>
  );
};
