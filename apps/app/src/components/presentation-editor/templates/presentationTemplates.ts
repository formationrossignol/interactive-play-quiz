import type { PresentationTheme } from "../types/presentation";

export interface PresentationTemplate {
  id: string;
  label: string;
  description: string;
  theme: PresentationTheme;
}

export const PRESENTATION_TEMPLATES: PresentationTemplate[] = [
  {
    id: "brivia",
    label: "Brivia",
    description: "Clair, pédagogique et polyvalent",
    theme: {
      templateId: "brivia",
      fontFamily: "'Sora Variable', 'Sora', sans-serif",
      textColor: "#24202d",
      accentColor: "#6c63ff",
      backgroundColor: "#ffffff",
      defaultLayoutId: "title-body",
    },
  },
  {
    id: "classe",
    label: "Classe",
    description: "Bleu calme, titres structurés",
    theme: {
      templateId: "classe",
      fontFamily: "'Montserrat Variable', 'Montserrat', sans-serif",
      textColor: "#183153",
      accentColor: "#2f7bff",
      backgroundColor: "#f4f8ff",
      defaultLayoutId: "section",
    },
  },
  {
    id: "editorial",
    label: "Éditorial",
    description: "Chaleureux, contrasté et narratif",
    theme: {
      templateId: "editorial",
      fontFamily: "Georgia, serif",
      textColor: "#4a2a23",
      accentColor: "#e76f51",
      backgroundColor: "#fff8f0",
      defaultLayoutId: "title-body",
    },
  },
  {
    id: "studio",
    label: "Studio sombre",
    description: "Fort contraste pour la projection",
    theme: {
      templateId: "studio",
      fontFamily: "'Manrope', sans-serif",
      textColor: "#f7f7fb",
      accentColor: "#9b91ff",
      backgroundColor: "#202331",
      defaultLayoutId: "title",
    },
  },
];

export const DEFAULT_PRESENTATION_THEME = PRESENTATION_TEMPLATES[0].theme;

export const PRESENTATION_TEXT_COLORS = [
  "#24202d",
  "#ffffff",
  "#183153",
  "#2f7bff",
  "#6c63ff",
  "#e76f51",
  "#d63b50",
  "#18794e",
];

export const PRESENTATION_FONT_OPTIONS = [
  { label: "Sora", value: "'Sora Variable', 'Sora', sans-serif" },
  { label: "Montserrat", value: "'Montserrat Variable', 'Montserrat', sans-serif" },
  { label: "Manrope", value: "'Manrope', sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
];
