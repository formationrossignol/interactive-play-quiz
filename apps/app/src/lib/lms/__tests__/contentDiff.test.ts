import { describe, expect, it } from "vitest";
import { diffContentSnapshots, describeDiffChange } from "../contentDiff";

describe("diffContentSnapshots", () => {
  it("no diff for identical snapshots, regardless of key order", () => {
    const a = { title: "Quiz", points: 10 };
    const b = { points: 10, title: "Quiz" };
    expect(diffContentSnapshots(a, b)).toEqual([]);
  });

  it("detects a top-level added key", () => {
    const diff = diffContentSnapshots({ title: "Quiz" }, { title: "Quiz", description: "New" });
    expect(diff).toEqual([{ kind: "added", path: "description", value: "New" }]);
  });

  it("detects a top-level removed key", () => {
    const diff = diffContentSnapshots({ title: "Quiz", description: "Old" }, { title: "Quiz" });
    expect(diff).toEqual([{ kind: "removed", path: "description", value: "Old" }]);
  });

  it("detects a changed primitive value", () => {
    const diff = diffContentSnapshots({ title: "Quiz v1" }, { title: "Quiz v2" });
    expect(diff).toEqual([{ kind: "changed", path: "title", oldValue: "Quiz v1", newValue: "Quiz v2" }]);
  });

  it("id-based array diff: reorder shows as moved, not add+remove", () => {
    const a = { questions: [{ id: "q1", text: "First" }, { id: "q2", text: "Second" }] };
    const b = { questions: [{ id: "q2", text: "Second" }, { id: "q1", text: "First" }] };
    const diff = diffContentSnapshots(a, b);
    expect(diff).toEqual([
      { kind: "moved", path: "questions[id=q2]", fromIndex: 1, toIndex: 0 },
      { kind: "moved", path: "questions[id=q1]", fromIndex: 0, toIndex: 1 },
    ]);
  });

  it("id-based array diff: added and removed items by id", () => {
    const a = { questions: [{ id: "q1", text: "First" }] };
    const b = { questions: [{ id: "q1", text: "First" }, { id: "q2", text: "New question" }] };
    const diff = diffContentSnapshots(a, b);
    expect(diff).toEqual([{ kind: "added", path: "questions[1]", value: { id: "q2", text: "New question" } }]);
  });

  it("id-based array diff: nested field change surfaces at the matched item's new index", () => {
    const a = { questions: [{ id: "q1", text: "Original" }] };
    const b = { questions: [{ id: "q1", text: "Edited" }] };
    const diff = diffContentSnapshots(a, b);
    expect(diff).toEqual([{ kind: "changed", path: "questions[0].text", oldValue: "Original", newValue: "Edited" }]);
  });

  it("positional fallback when array items have no stable id", () => {
    const a = { tags: ["a", "b"] };
    const b = { tags: ["a", "c", "d"] };
    const diff = diffContentSnapshots(a, b);
    expect(diff).toEqual([
      { kind: "changed", path: "tags[1]", oldValue: "b", newValue: "c" },
      { kind: "added", path: "tags[2]", value: "d" },
    ]);
  });

  it("a type change (object -> string) is a single 'changed' entry, not a crash", () => {
    const diff = diffContentSnapshots({ meta: { author: "x" } }, { meta: "unstructured" });
    expect(diff).toEqual([{ kind: "changed", path: "meta", oldValue: { author: "x" }, newValue: "unstructured" }]);
  });

  it("describeDiffChange renders one readable line per kind", () => {
    expect(describeDiffChange({ kind: "added", path: "x", value: 1 })).toBe("+ x : 1");
    expect(describeDiffChange({ kind: "removed", path: "x", value: 1 })).toBe("− x : 1");
    expect(describeDiffChange({ kind: "changed", path: "x", oldValue: 1, newValue: 2 })).toBe("~ x : 1 → 2");
    expect(describeDiffChange({ kind: "moved", path: "x[id=1]", fromIndex: 0, toIndex: 2 })).toBe("⇅ x[id=1] : position 0 → 2");
  });

  it("truncates long values in the description", () => {
    const long = "a".repeat(100);
    const line = describeDiffChange({ kind: "added", path: "body", value: long });
    expect(line.length).toBeLessThan(long.length);
    expect(line.endsWith("…")).toBe(true);
  });
});
