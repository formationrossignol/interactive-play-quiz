import { describe, it, expect } from "vitest";
import { isLegacySlideShape, migrateLegacySlideToPresentation } from "../migrateLegacySlide";

describe("isLegacySlideShape", () => {
  it("is true for the old questions[] shape", () => {
    expect(isLegacySlideShape({ questions: [{ type: "slide", title: "A" }] })).toBe(true);
  });
  it("is false for the new slides[] shape", () => {
    expect(isLegacySlideShape({ slides: [] })).toBe(false);
  });
  it("is false for garbage input", () => {
    expect(isLegacySlideShape({})).toBe(false);
    expect(isLegacySlideShape(null)).toBe(false);
  });
  it("is false for a mixed shape with both questions and slides", () => {
    expect(isLegacySlideShape({ questions: [{ title: "A" }], slides: [] })).toBe(false);
  });
});

describe("migrateLegacySlideToPresentation", () => {
  it("converts each legacy question into a slide with title/body/image elements", () => {
    const legacy = {
      id: "quiz-1",
      title: "Ma présentation",
      questions: [
        { title: "Intro", content: "Bienvenue", image: "https://example.com/a.png" },
        { title: "Suite", content: "Sans image" },
      ],
    };

    const pres = migrateLegacySlideToPresentation(legacy);

    expect(pres.id).toBe("quiz-1");
    expect(pres.title).toBe("Ma présentation");
    expect(pres.slides).toHaveLength(2);

    const [s1, s2] = pres.slides;
    expect(s1.order).toBe(0);
    expect(s2.order).toBe(1);

    const titleEl = s1.elements.find((e) => e.type === "text" && e.id.endsWith("-title"));
    const bodyEl = s1.elements.find((e) => e.type === "text" && e.id.endsWith("-body"));
    const imgEl = s1.elements.find((e) => e.type === "image");
    expect(titleEl).toBeDefined();
    expect(bodyEl).toBeDefined();
    expect(imgEl).toMatchObject({ src: "https://example.com/a.png" });

    // second slide has no image in the source -> no image element
    expect(s2.elements.some((e) => e.type === "image")).toBe(false);
  });

  it("gives every slide and element a stable, unique id", () => {
    const legacy = { id: "quiz-2", title: "T", questions: [{ title: "A" }, { title: "B" }] };
    const pres = migrateLegacySlideToPresentation(legacy);
    const ids = pres.slides.flatMap((s) => [s.id, ...s.elements.map((e) => e.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("creates a single blank slide when questions is empty or missing", () => {
    const pres = migrateLegacySlideToPresentation({ id: "q", title: "T", questions: [] });
    expect(pres.slides).toHaveLength(1);
    expect(pres.slides[0].elements).toHaveLength(0);
  });
});
