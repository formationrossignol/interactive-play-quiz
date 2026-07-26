import type {
  ImageElement,
  ShapeElement,
  Slide,
  SlideElement,
  TextElement,
} from "../types/presentation";

export type SlideLayoutId =
  | "blank"
  | "title"
  | "title-body"
  | "section"
  | "two-columns"
  | "media-left"
  | "media-right"
  | "quote";

type Slot = {
  id: string;
  kind: "title" | "body" | "image" | "shape";
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  fill?: string;
};

export interface SlideLayoutDefinition {
  id: SlideLayoutId;
  label: string;
  description: string;
  slots: Slot[];
}

export const SLIDE_LAYOUTS: SlideLayoutDefinition[] = [
  { id: "blank", label: "Vide", description: "Une toile libre.", slots: [] },
  {
    id: "title",
    label: "Titre",
    description: "Un titre fort et un sous-titre.",
    slots: [
      { id: "title", kind: "title", x: .12, y: .31, width: .76, height: .18, text: "Titre de la présentation" },
      { id: "subtitle", kind: "body", x: .2, y: .53, width: .6, height: .1, text: "Sous-titre" },
    ],
  },
  {
    id: "title-body",
    label: "Titre et contenu",
    description: "Le layout polyvalent pour vos idées.",
    slots: [
      { id: "title", kind: "title", x: .07, y: .07, width: .86, height: .14, text: "Titre de la diapositive" },
      { id: "body", kind: "body", x: .09, y: .27, width: .82, height: .58, text: "Ajoutez vos idées principales" },
    ],
  },
  {
    id: "section",
    label: "Section",
    description: "Une respiration entre deux parties.",
    slots: [
      { id: "accent", kind: "shape", x: .08, y: .2, width: .015, height: .6, fill: "#6c63ff" },
      { id: "title", kind: "title", x: .14, y: .31, width: .72, height: .2, text: "Nouvelle section" },
      { id: "subtitle", kind: "body", x: .14, y: .55, width: .62, height: .1, text: "Présentez la prochaine partie" },
    ],
  },
  {
    id: "two-columns",
    label: "Deux colonnes",
    description: "Comparer ou structurer deux idées.",
    slots: [
      { id: "title", kind: "title", x: .07, y: .06, width: .86, height: .13, text: "Titre de la diapositive" },
      { id: "left", kind: "body", x: .07, y: .26, width: .4, height: .6, text: "Première idée" },
      { id: "right", kind: "body", x: .53, y: .26, width: .4, height: .6, text: "Deuxième idée" },
    ],
  },
  {
    id: "media-left",
    label: "Image à gauche",
    description: "Un visuel fort accompagné de texte.",
    slots: [
      { id: "image", kind: "image", x: 0, y: 0, width: .48, height: 1 },
      { id: "title", kind: "title", x: .55, y: .18, width: .38, height: .18, text: "Titre de la diapositive" },
      { id: "body", kind: "body", x: .55, y: .43, width: .36, height: .38, text: "Développez votre message" },
    ],
  },
  {
    id: "media-right",
    label: "Image à droite",
    description: "Le message d’abord, le visuel en soutien.",
    slots: [
      { id: "title", kind: "title", x: .07, y: .18, width: .38, height: .18, text: "Titre de la diapositive" },
      { id: "body", kind: "body", x: .08, y: .43, width: .36, height: .38, text: "Développez votre message" },
      { id: "image", kind: "image", x: .52, y: 0, width: .48, height: 1 },
    ],
  },
  {
    id: "quote",
    label: "Citation",
    description: "Mettre une phrase et son auteur en lumière.",
    slots: [
      { id: "quote", kind: "title", x: .17, y: .31, width: .66, height: .25, text: "Une idée mémorable mérite de l’espace." },
      { id: "author", kind: "body", x: .17, y: .64, width: .5, height: .09, text: "— Auteur" },
      { id: "mark", kind: "title", x: .1, y: .15, width: .12, height: .2, text: "“" },
    ],
  },
];

let generatedId = 0;
function nextId(prefix: string) {
  generatedId += 1;
  return `${prefix}-${Date.now()}-${generatedId}`;
}

function richText(text: string, heading: boolean): TextElement["richText"] {
  return {
    type: "doc",
    content: [{
      type: heading ? "heading" : "paragraph",
      attrs: heading ? { level: 1 } : undefined,
      content: [{ type: "text", text }],
    }],
  };
}

function geometry(slot: Slot, width: number, height: number) {
  return {
    x: Math.round(slot.x * width),
    y: Math.round(slot.y * height),
    width: Math.round(slot.width * width),
    height: Math.round(slot.height * height),
  };
}

export function createSlideFromLayout(
  id: string,
  order: number,
  layoutId: SlideLayoutId,
  width: number,
  height: number,
): Slide {
  return applySlideLayout({ id, order, hidden: false, elements: [] }, layoutId, width, height);
}

export function applySlideLayout(
  slide: Slide,
  layoutId: SlideLayoutId,
  width: number,
  height: number,
): Slide {
  const definition = SLIDE_LAYOUTS.find((layout) => layout.id === layoutId) ?? SLIDE_LAYOUTS[0];
  if (definition.id === "blank") return { ...slide, layoutId };

  const texts = slide.elements.filter((element): element is TextElement => element.type === "text");
  const images = slide.elements.filter((element): element is ImageElement => element.type === "image");
  const used = new Set<string>();
  let textIndex = 0;
  let imageIndex = 0;
  let zIndex = Math.max(0, ...slide.elements.map((element) => element.zIndex));

  const positioned = definition.slots.flatMap((slot): SlideElement[] => {
    zIndex += 1;
    const rect = geometry(slot, width, height);
    if (slot.kind === "shape") {
      return [{
        id: nextId("layout-shape"),
        type: "rect",
        ...rect,
        rotation: 0,
        zIndex,
        opacity: 1,
        locked: false,
        visible: true,
        fill: slot.fill ?? "#6c63ff",
        layoutSlotId: slot.id,
        layoutGenerated: true,
      } satisfies ShapeElement];
    }
    if (slot.kind === "image") {
      const source = images[imageIndex++];
      if (!source) return [];
      used.add(source.id);
      return [{ ...source, ...rect, zIndex, layoutSlotId: slot.id }];
    }
    const source = texts[textIndex++];
    if (source) {
      used.add(source.id);
      return [{ ...source, ...rect, zIndex, layoutSlotId: slot.id }];
    }
    return [{
      id: nextId("layout-text"),
      type: "text",
      ...rect,
      rotation: 0,
      zIndex,
      opacity: 1,
      locked: false,
      visible: true,
      richText: richText(slot.text ?? "", slot.kind === "title"),
      layoutSlotId: slot.id,
      layoutGenerated: true,
    } satisfies TextElement];
  });

  const untouched = slide.elements.filter((element) => (
    !used.has(element.id) && !element.layoutGenerated
  ));
  return { ...slide, layoutId, elements: [...untouched, ...positioned] };
}
