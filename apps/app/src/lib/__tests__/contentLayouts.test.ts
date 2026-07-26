import { describe, expect, it } from "vitest";
import { getQuestionLayout, QUESTION_LAYOUTS } from "../contentLayouts";

describe("question layouts", () => {
  it("exposes the five supported media compositions", () => {
    expect(QUESTION_LAYOUTS.map((layout) => layout.id)).toEqual([
      "standard",
      "media-top",
      "media-left",
      "media-right",
      "media-background",
    ]);
  });

  it("falls back to the standard layout for legacy or invalid data", () => {
    expect(getQuestionLayout().id).toBe("standard");
    expect(getQuestionLayout("legacy-layout").id).toBe("standard");
  });
});
