export type QuestionLayoutId =
  | "standard"
  | "media-top"
  | "media-left"
  | "media-right"
  | "media-background";

export interface QuestionLayoutDefinition {
  id: QuestionLayoutId;
  label: string;
  description: string;
  mediaPosition: "none" | "top" | "left" | "right" | "background";
}

export const QUESTION_LAYOUTS: QuestionLayoutDefinition[] = [
  {
    id: "standard",
    label: "Standard",
    description: "La question au centre, sans mise en avant du média.",
    mediaPosition: "none",
  },
  {
    id: "media-top",
    label: "Image en haut",
    description: "Le média précède la question.",
    mediaPosition: "top",
  },
  {
    id: "media-left",
    label: "Image à gauche",
    description: "Question et média sont disposés côte à côte.",
    mediaPosition: "left",
  },
  {
    id: "media-right",
    label: "Image à droite",
    description: "Le texte reste prioritaire à gauche.",
    mediaPosition: "right",
  },
  {
    id: "media-background",
    label: "Plein écran",
    description: "Le média devient un fond immersif avec texte superposé.",
    mediaPosition: "background",
  },
];

export function getQuestionLayout(id?: string): QuestionLayoutDefinition {
  return QUESTION_LAYOUTS.find((layout) => layout.id === id) ?? QUESTION_LAYOUTS[0];
}
