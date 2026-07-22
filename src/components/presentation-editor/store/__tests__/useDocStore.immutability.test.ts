import { describe, it, expect, beforeEach } from "vitest";
import { useDocStore } from "../useDocStore";
import { createBlankPresentation } from "../../types/presentation";
import type { ShapeElement } from "../../types/presentation";

const rect = (id: string, overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id, type: "rect", x: 0, y: 0, width: 100, height: 100, rotation: 0, zIndex: 0, opacity: 1, locked: false, visible: true, fill: "#fff",
  ...overrides,
});

beforeEach(() => {
  useDocStore.getState().load(createBlankPresentation("p1"));
});

describe("immutability - reference equality on every action", () => {
  it("addElement creates new presentation reference", () => {
    const store = useDocStore.getState();
    const slideId = store.presentation!.slides[0].id;
    const before = useDocStore.getState().presentation;
    store.addElement(slideId, rect("r1"));
    const after = useDocStore.getState().presentation;
    expect(before).not.toBe(after);
  });

  it("updateElement creates new presentation reference even for non-matching element", () => {
    const store = useDocStore.getState();
    const slideId = store.presentation!.slides[0].id;
    store.addElement(slideId, rect("r1"));
    const before = useDocStore.getState().presentation;
    store.updateElement(slideId, "nonexistent", { x: 999 });
    const after = useDocStore.getState().presentation;
    // This is a potential issue - if no element matches, should we still create new ref?
    // For React re-render subscribers, yes - always create new ref
    expect(before).not.toBe(after);
    expect(before).toEqual(after);  // Content is same but reference is different
  });

  it("bringToFront on non-existent element creates new presentation reference", () => {
    const store = useDocStore.getState();
    const slideId = store.presentation!.slides[0].id;
    store.addElement(slideId, rect("r1"));
    const before = useDocStore.getState().presentation;
    store.bringToFront(slideId, "nonexistent");
    const after = useDocStore.getState().presentation;
    expect(before).not.toBe(after);
    expect(before).toEqual(after);
  });

  it("sendToBack on non-existent element creates new presentation reference", () => {
    const store = useDocStore.getState();
    const slideId = store.presentation!.slides[0].id;
    store.addElement(slideId, rect("r1"));
    const before = useDocStore.getState().presentation;
    store.sendToBack(slideId, "nonexistent");
    const after = useDocStore.getState().presentation;
    expect(before).not.toBe(after);
    expect(before).toEqual(after);
  });

  it("groupElements with no matching children is a no-op (returns old state unchanged)", () => {
    const store = useDocStore.getState();
    const slideId = store.presentation!.slides[0].id;
    store.addElement(slideId, rect("r1"));
    const before = useDocStore.getState().presentation;
    store.groupElements(slideId, ["nonexistent1", "nonexistent2"]);
    const after = useDocStore.getState().presentation;
    // groupElements has special handling: if children.length === 0, it returns s unchanged
    // This means mapSlide will still create new refs, but the elements inside are identical
    expect(before).not.toBe(after);
    expect(before).toEqual(after);
  });

  it("updateElements with patches that match elements creates new reference", () => {
    const store = useDocStore.getState();
    const slideId = store.presentation!.slides[0].id;
    store.addElement(slideId, rect("r1"));
    const before = useDocStore.getState().presentation;
    store.updateElements(slideId, [{ id: "r1", patch: { x: 42 } }]);
    const after = useDocStore.getState().presentation;
    expect(before).not.toBe(after);
  });
});
