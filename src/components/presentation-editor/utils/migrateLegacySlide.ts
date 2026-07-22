import type { Presentation, Slide, TextElement, ImageElement } from "../types/presentation";
import { PRESENTATION_FORMAT_SIZE } from "../types/presentation";

interface LegacyQuestion {
  title?: string;
  content?: string;
  image?: string;
}

interface LegacySlideQuiz {
  id?: string;
  title?: string;
  questions?: LegacyQuestion[];
}

export function isLegacySlideShape(value: unknown): value is LegacySlideQuiz {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.questions) && !Array.isArray(v.slides);
}

function textEl(id: string, x: number, y: number, width: number, height: number, text: string, bold: boolean): TextElement {
  return {
    id, type: "text", x, y, width, height, rotation: 0, zIndex: bold ? 2 : 1, opacity: 1, locked: false, visible: true,
    richText: {
      type: "doc",
      content: [{
        type: "paragraph",
        content: text ? [{ type: "text", marks: bold ? [{ type: "bold" }] : undefined, text }] : [],
      }],
    },
  };
}

function imageEl(id: string, x: number, y: number, width: number, height: number, src: string): ImageElement {
  return {
    id, type: "image", x, y, width, height, rotation: 0, zIndex: 1, opacity: 1, locked: false, visible: true,
    src, borderRadius: 0, borderWidth: 0, borderColor: "transparent",
  };
}

export function migrateLegacySlideToPresentation(legacy: LegacySlideQuiz): Presentation {
  const id = legacy.id ?? `presentation-${Date.now()}`;
  const { width, height } = PRESENTATION_FORMAT_SIZE["16:9"];
  const questions = legacy.questions ?? [];

  const slides: Slide[] = questions.map((q, i) => {
    const slideId = `${id}-slide-${i}`;
    const hasImage = !!q.image;
    const contentWidth = hasImage ? width - 480 : width - 96;

    return {
      id: slideId,
      order: i,
      hidden: false,
      elements: [
        textEl(`${slideId}-title`, 48, 48, contentWidth, 90, q.title ?? "", true),
        textEl(`${slideId}-body`, 48, 160, contentWidth, height - 220, q.content ?? "", false),
        ...(hasImage ? [imageEl(`${slideId}-image`, width - 400, 48, 352, height - 96, q.image as string)] : []),
      ],
    };
  });

  return {
    id,
    title: legacy.title ?? "Sans titre",
    format: "16:9",
    width,
    height,
    slides: slides.length > 0 ? slides : [{ id: `${id}-slide-0`, order: 0, hidden: false, elements: [] }],
  };
}
