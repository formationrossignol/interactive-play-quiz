import { describe, expect, it } from "vitest";
import { applySlideLayout, createSlideFromLayout } from "../slideLayouts";
import type { Slide, TextElement } from "../../types/presentation";

const text: TextElement = {
  id: "existing-title",
  type: "text",
  x: 4,
  y: 5,
  width: 100,
  height: 40,
  rotation: 0,
  zIndex: 1,
  opacity: 1,
  locked: false,
  visible: true,
  richText: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Mon contenu" }] }] },
};

describe("slide layouts", () => {
  it("creates a ready-to-edit title and content slide", () => {
    const slide = createSlideFromLayout("slide-1", 0, "title-body", 1280, 720);
    expect(slide.layoutId).toBe("title-body");
    expect(slide.elements.filter((element) => element.type === "text")).toHaveLength(2);
    expect(slide.elements.every((element) => element.width > 0 && element.height > 0)).toBe(true);
  });

  it("repositions existing text without replacing its content or id", () => {
    const slide: Slide = { id: "slide-1", order: 0, hidden: false, elements: [text] };
    const result = applySlideLayout(slide, "title-body", 1280, 720);
    const existing = result.elements.find((element) => element.id === text.id);

    expect(existing).toMatchObject({
      id: "existing-title",
      type: "text",
      layoutSlotId: "title",
      x: 90,
    });
    expect((existing as TextElement).richText).toEqual(text.richText);
  });

  it("keeps manually-added extras when applying a new layout", () => {
    const manualShape = {
      id: "manual",
      type: "rect" as const,
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      rotation: 0,
      zIndex: 2,
      opacity: 1,
      locked: false,
      visible: true,
      fill: "#fff000",
    };
    const slide: Slide = { id: "slide-1", order: 0, hidden: false, elements: [text, manualShape] };
    const result = applySlideLayout(slide, "quote", 1280, 720);
    expect(result.elements.some((element) => element.id === "manual")).toBe(true);
  });
});
