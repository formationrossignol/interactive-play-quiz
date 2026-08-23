import { describe, expect, it } from "vitest";
import { extractTranslationSegments, applyTranslations } from "../localization";

const snapshot = {
  id: "content-1",
  type: "course",
  title: "Bienvenue",
  hex: "#ff0000",
  modules: [
    {
      id: "m1",
      title: "Module 1",
      lessons: [
        { id: "l1", type: "text", title: "Leçon 1", content: "<p>Bonjour</p>", scormPackageId: "not-a-text-field" },
        { id: "l2", type: "quiz", title: "Quiz", content: "" },
      ],
    },
  ],
  questions: [
    { id: "q1", text: "2 + 2 = ?", correct_answer: "4", options: [{ id: "o1", text: "3" }, { id: "o2", text: "4" }] },
  ],
};

describe("extractTranslationSegments", () => {
  it("extracts text from allowlisted keys at every depth", () => {
    const byPath = new Map(extractTranslationSegments(snapshot).map((s) => [s.path, s.source_text]));
    expect(byPath.get("title")).toBe("Bienvenue");
    expect(byPath.get("modules[0].title")).toBe("Module 1");
    expect(byPath.get("modules[0].lessons[0].content")).toBe("<p>Bonjour</p>");
    expect(byPath.get("questions[0].text")).toBe("2 + 2 = ?");
    expect(byPath.get("questions[0].options[1].text")).toBe("4");
  });

  it("never extracts ids, type discriminators, or scoring data", () => {
    const paths = new Set(extractTranslationSegments(snapshot).map((s) => s.path));
    expect(paths.has("id")).toBe(false);
    expect(paths.has("hex")).toBe(false);
    expect(paths.has("type")).toBe(false);
    expect(paths.has("modules[0].id")).toBe(false);
    expect(paths.has("questions[0].correct_answer")).toBe(false);
    expect(paths.has("modules[0].lessons[0].scormPackageId")).toBe(false);
  });

  it("skips empty strings", () => {
    const paths = new Set(extractTranslationSegments(snapshot).map((s) => s.path));
    expect(paths.has("modules[0].lessons[1].content")).toBe(false);
  });
});

describe("applyTranslations", () => {
  it("substitutes translated text at the correct path without mutating the source", () => {
    const result = applyTranslations(snapshot, [{ path: "title", translated_text: "Welcome" }]);
    expect(result.title).toBe("Welcome");
    expect(snapshot.title).toBe("Bienvenue");
  });

  it("falls back to the source text for untranslated segments", () => {
    const result = applyTranslations(snapshot, [{ path: "title", translated_text: null }]);
    expect(result.title).toBe("Bienvenue");
  });

  it("leaves non-translated fields (ids, scoring data) untouched", () => {
    const result = applyTranslations(snapshot, [{ path: "title", translated_text: "Welcome" }]) as typeof snapshot;
    expect(result.questions[0].correct_answer).toBe("4");
    expect(result.modules[0].id).toBe("m1");
  });
});
