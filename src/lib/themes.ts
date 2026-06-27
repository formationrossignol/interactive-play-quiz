import { hexToRgba } from "./color";

export interface Theme {
  id: string;
  name: string;
  preview: string;
  background: string;
  imageUrl: string;
  palette: string[];
  imageDescription: string;
}

const createThemeBackground = (imageUrl: string, palette: readonly string[]) => {
  const startColor = palette[0] ?? "#000000";
  const endColor = palette[palette.length - 1] ?? startColor;

  return `linear-gradient(135deg, ${hexToRgba(startColor, 0.76)}, ${hexToRgba(endColor, 0.88)}), url(${imageUrl})`;
};

const HORIZON_SYNTHWAVE_PALETTE = ["#ff0080", "#7928ca", "#2d00f7", "#120458"] as const;
const HORIZON_SYNTHWAVE_IMAGE =
  "https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=1200&q=80";

const ATELIER_NATUREL_PALETTE = ["#d9d0b4", "#a7b38d", "#606c38", "#283618"] as const;
const ATELIER_NATUREL_IMAGE =
  "https://images.unsplash.com/photo-1483794344563-d27a8d18014e?auto=format&fit=crop&w=1200&q=80";

const QUARTZ_DIGITAL_PALETTE = ["#e0e0e0", "#a0aec0", "#1a202c", "#4fd1c5"] as const;
const QUARTZ_DIGITAL_IMAGE =
  "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80";

const LUNE_PALE_PALETTE = ["#1b1b2f", "#3d5af1", "#b2b1cf", "#f0f0f0"] as const;
const LUNE_PALE_IMAGE =
  "https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?auto=format&fit=crop&w=1200&q=80";

const STUDIO_CREATIF_PALETTE = ["#ff595e", "#ffca3a", "#8ac926", "#1982c4"] as const;
const STUDIO_CREATIF_IMAGE =
  "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80";

const MONOLITHE_NOIR_PALETTE = ["#0a0a0a", "#1e1e1e", "#2d2d2d", "#4b4b4b"] as const;
const MONOLITHE_NOIR_IMAGE =
  "https://images.unsplash.com/photo-1508711041724-63f3c3d86ae9?auto=format&fit=crop&w=1200&q=80";

const VIVA_POP_PALETTE = ["#ff006e", "#fb5607", "#ffbe0b", "#8338ec", "#3a86ff"] as const;
const VIVA_POP_IMAGE =
  "https://images.unsplash.com/photo-1518085250887-2f903c200fee?auto=format&fit=crop&w=1200&q=80";

const SABLE_A_AUBE_PALETTE = ["#f7ede2", "#f5cac3", "#84a59d", "#f28482"] as const;
const SABLE_A_AUBE_IMAGE =
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80";

const AGORA_MODERNE_PALETTE = ["#ffffff", "#e5e5e5", "#3d405b", "#81b29a", "#e07a5f"] as const;
const AGORA_MODERNE_IMAGE =
  "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1200&q=80";

const OR_IMPERIAL_PALETTE = ["#f5f3e7", "#d2b48c", "#a67c52", "#4b4237"] as const;
const OR_IMPERIAL_IMAGE =
  "https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=1200&q=80";

export const THEMES: Theme[] = [
  {
    id: "horizon-synthwave",
    name: "Horizon Synthwave",
    imageUrl: HORIZON_SYNTHWAVE_IMAGE,
    preview: createThemeBackground(HORIZON_SYNTHWAVE_IMAGE, HORIZON_SYNTHWAVE_PALETTE),
    background: createThemeBackground(HORIZON_SYNTHWAVE_IMAGE, HORIZON_SYNTHWAVE_PALETTE),
    palette: [...HORIZON_SYNTHWAVE_PALETTE],
    imageDescription: "Néons roses et violets sur horizon rétro futuriste",
  },
  {
    id: "atelier-naturel",
    name: "Atelier Naturel",
    imageUrl: ATELIER_NATUREL_IMAGE,
    preview: createThemeBackground(ATELIER_NATUREL_IMAGE, ATELIER_NATUREL_PALETTE),
    background: createThemeBackground(ATELIER_NATUREL_IMAGE, ATELIER_NATUREL_PALETTE),
    palette: [...ATELIER_NATUREL_PALETTE],
    imageDescription: "Bois, feuilles et textures naturelles pour une ambiance organique",
  },
  {
    id: "quartz-digital",
    name: "Quartz Digital",
    imageUrl: QUARTZ_DIGITAL_IMAGE,
    preview: createThemeBackground(QUARTZ_DIGITAL_IMAGE, QUARTZ_DIGITAL_PALETTE),
    background: createThemeBackground(QUARTZ_DIGITAL_IMAGE, QUARTZ_DIGITAL_PALETTE),
    palette: [...QUARTZ_DIGITAL_PALETTE],
    imageDescription: "Surfaces métalliques, verre et circuits tech stylisés",
  },
  {
    id: "lune-pale",
    name: "Lune Pâle",
    imageUrl: LUNE_PALE_IMAGE,
    preview: createThemeBackground(LUNE_PALE_IMAGE, LUNE_PALE_PALETTE),
    background: createThemeBackground(LUNE_PALE_IMAGE, LUNE_PALE_PALETTE),
    palette: [...LUNE_PALE_PALETTE],
    imageDescription: "Ciel nocturne, lune et nuages aux tons froids et doux",
  },
  {
    id: "studio-creatif",
    name: "Studio Créatif",
    imageUrl: STUDIO_CREATIF_IMAGE,
    preview: createThemeBackground(STUDIO_CREATIF_IMAGE, STUDIO_CREATIF_PALETTE),
    background: createThemeBackground(STUDIO_CREATIF_IMAGE, STUDIO_CREATIF_PALETTE),
    palette: [...STUDIO_CREATIF_PALETTE],
    imageDescription: "Matériel créatif, post-its et compositions colorées",
  },
  {
    id: "monolithe-noir",
    name: "Monolithe Noir",
    imageUrl: MONOLITHE_NOIR_IMAGE,
    preview: createThemeBackground(MONOLITHE_NOIR_IMAGE, MONOLITHE_NOIR_PALETTE),
    background: createThemeBackground(MONOLITHE_NOIR_IMAGE, MONOLITHE_NOIR_PALETTE),
    palette: [...MONOLITHE_NOIR_PALETTE],
    imageDescription: "Surfaces sombres avec reflets discrets et lumière minimale",
  },
  {
    id: "viva-pop",
    name: "Viva Pop",
    imageUrl: VIVA_POP_IMAGE,
    preview: createThemeBackground(VIVA_POP_IMAGE, VIVA_POP_PALETTE),
    background: createThemeBackground(VIVA_POP_IMAGE, VIVA_POP_PALETTE),
    palette: [...VIVA_POP_PALETTE],
    imageDescription: "Confettis, couleurs saturées et motifs pop art joyeux",
  },
  {
    id: "sable-aube",
    name: "Sable & Aube",
    imageUrl: SABLE_A_AUBE_IMAGE,
    preview: createThemeBackground(SABLE_A_AUBE_IMAGE, SABLE_A_AUBE_PALETTE),
    background: createThemeBackground(SABLE_A_AUBE_IMAGE, SABLE_A_AUBE_PALETTE),
    palette: [...SABLE_A_AUBE_PALETTE],
    imageDescription: "Dunes, ciel à l'aube et textures sableuses",
  },
  {
    id: "agora-moderne",
    name: "Agora Moderne",
    imageUrl: AGORA_MODERNE_IMAGE,
    preview: createThemeBackground(AGORA_MODERNE_IMAGE, AGORA_MODERNE_PALETTE),
    background: createThemeBackground(AGORA_MODERNE_IMAGE, AGORA_MODERNE_PALETTE),
    palette: [...AGORA_MODERNE_PALETTE],
    imageDescription: "Espaces modernes, bibliothèques stylisées et formes équilibrées",
  },
  {
    id: "or-imperial",
    name: "Or Impérial",
    imageUrl: OR_IMPERIAL_IMAGE,
    preview: createThemeBackground(OR_IMPERIAL_IMAGE, OR_IMPERIAL_PALETTE),
    background: createThemeBackground(OR_IMPERIAL_IMAGE, OR_IMPERIAL_PALETTE),
    palette: [...OR_IMPERIAL_PALETTE],
    imageDescription: "Marbre, dorures et textures nobles à la lumière chaleureuse",
  },
];

const QUI_VEUT_GAGNER_PALETTE = ["#05080f", "#0a0e24", "#0f1440", "#C8A000"] as const;

THEMES.push({
  id: "qui-veut-gagner",
  name: "Qui veut gagner",
  imageUrl: MONOLITHE_NOIR_IMAGE,
  preview: "linear-gradient(135deg,#1a2366 0%,#050814 100%)",
  background: [
    "repeating-conic-gradient(from 0deg at 50% 40%,rgba(200,160,0,0.08) 0deg 1deg,transparent 1deg 9deg)",
    "radial-gradient(ellipse 130% 90% at 50% 40%,#1e2870 0%,#090d30 50%,#050814 100%)",
  ].join(","),
  palette: [...QUI_VEUT_GAGNER_PALETTE],
  imageDescription: "Fond sombre avec rayons dorés style Qui veut gagner des millions",
});

export const DEFAULT_THEME_ID = THEMES[0]?.id ?? "horizon-synthwave";

export const getTheme = (id: string): Theme | undefined => {
  return THEMES.find((t) => t.id === id);
};
