import type { JSONContent } from "@tiptap/react";

export type PresentationFormat = "16:9" | "4:3" | "custom";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SlideBackground {
  type: "color" | "gradient" | "image";
  value: string; // css color / css gradient string / image URL
}

export interface BaseElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  zIndex: number;
  opacity: number; // 0-1
  locked: boolean;
  visible: boolean;
  groupId?: string;
}

export interface TextElement extends BaseElement {
  type: "text";
  richText: JSONContent;
}

export interface ImageElement extends BaseElement {
  type: "image";
  src: string;
  crop?: Rect;
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
}

export interface ShapeElement extends BaseElement {
  type: "rect" | "circle";
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface LineElement extends BaseElement {
  type: "line" | "arrow";
  points: [number, number][];
  stroke: string;
  strokeWidth: number;
}

export interface VideoElement extends BaseElement {
  type: "video";
  src: string;
  provider: "upload" | "youtube" | "vimeo";
}

export interface GroupElement extends BaseElement {
  type: "group";
  childIds: string[];
}

export type SlideElement =
  | TextElement
  | ImageElement
  | ShapeElement
  | LineElement
  | VideoElement
  | GroupElement;

export interface Slide {
  id: string;
  order: number;
  hidden: boolean;
  background?: SlideBackground;
  elements: SlideElement[];
}

export interface Presentation {
  id: string;
  title: string;
  format: PresentationFormat;
  width: number;
  height: number;
  themeId?: string; // forward-compat placeholder only, unused in this phase
  slides: Slide[];
}

export const PRESENTATION_FORMAT_SIZE: Record<Exclude<PresentationFormat, "custom">, { width: number; height: number }> = {
  "16:9": { width: 1280, height: 720 },
  "4:3": { width: 1024, height: 768 },
};

export function createBlankPresentation(id: string, title = "Sans titre"): Presentation {
  const slideId = `${id}-s1`;
  return {
    id,
    title,
    format: "16:9",
    width: PRESENTATION_FORMAT_SIZE["16:9"].width,
    height: PRESENTATION_FORMAT_SIZE["16:9"].height,
    slides: [{ id: slideId, order: 0, hidden: false, elements: [] }],
  };
}
