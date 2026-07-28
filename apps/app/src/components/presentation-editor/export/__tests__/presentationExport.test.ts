import { describe, expect, it } from "vitest";
import { createBlankPresentation, type TableElement, type TextElement } from "../../types/presentation";
import { serializeSlideToSvg } from "../presentationExport";

describe("serializeSlideToSvg", () => {
  it("includes text, tables, footer and slide number", () => {
    const presentation = createBlankPresentation("p1", "Cours");
    presentation.footer = { showSlideNumber: true, text: "Mathématiques", skipTitleSlide: false };
    presentation.slides[0].elements = [
      {
        id: "text",
        type: "text",
        x: 40,
        y: 30,
        width: 600,
        height: 80,
        rotation: 0,
        zIndex: 1,
        opacity: 1,
        locked: false,
        visible: true,
        richText: { type: "doc", content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Les triangles" }] }] },
      } satisfies TextElement,
      {
        id: "table",
        type: "table",
        x: 40,
        y: 150,
        width: 500,
        height: 220,
        rotation: 0,
        zIndex: 2,
        opacity: 1,
        locked: false,
        visible: true,
        rows: 2,
        columns: 2,
        cells: ["Type", "Côtés", "Isocèle", "2"],
        headerRow: true,
        borderColor: "#cccccc",
        borderWidth: 2,
        headerFill: "#eeeeff",
        cellFill: "#ffffff",
        textColor: "#222222",
      } satisfies TableElement,
    ];

    const svg = serializeSlideToSvg(presentation, presentation.slides[0], 1);
    expect(svg).toContain("Les triangles");
    expect(svg).toContain("Isocèle");
    expect(svg).toContain("Mathématiques");
    expect(svg).toContain(">1</text>");
  });
});
