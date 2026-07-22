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

describe("slide management", () => {
  it("addSlide appends a slide with the next order", () => {
    useDocStore.getState().addSlide();
    const slides = useDocStore.getState().presentation!.slides;
    expect(slides).toHaveLength(2);
    expect(slides[1].order).toBe(1);
  });

  it("duplicateSlide inserts a copy right after the source with a new id", () => {
    const store = useDocStore.getState();
    const originalId = store.presentation!.slides[0].id;
    store.duplicateSlide(originalId);
    const slides = useDocStore.getState().presentation!.slides;
    expect(slides).toHaveLength(2);
    expect(slides[1].id).not.toBe(originalId);
    expect(slides.map((s, i) => s.order)).toEqual([0, 1]);
  });

  it("deleteSlide removes it and reindexes order", () => {
    const store = useDocStore.getState();
    store.addSlide();
    store.addSlide();
    const ids = useDocStore.getState().presentation!.slides.map((s) => s.id);
    store.deleteSlide(ids[1]);
    const slides = useDocStore.getState().presentation!.slides;
    expect(slides).toHaveLength(2);
    expect(slides.map((s) => s.order)).toEqual([0, 1]);
  });

  it("deleteSlide refuses to remove the last remaining slide", () => {
    const store = useDocStore.getState();
    const onlySlideId = store.presentation!.slides[0].id;
    store.deleteSlide(onlySlideId);
    expect(useDocStore.getState().presentation!.slides).toHaveLength(1);
  });

  it("reorderSlides moves a slide to a new index and reindexes order", () => {
    const store = useDocStore.getState();
    store.addSlide();
    store.addSlide();
    const ids = useDocStore.getState().presentation!.slides.map((s) => s.id);
    store.reorderSlides(ids[0], 2);
    const slides = useDocStore.getState().presentation!.slides;
    expect(slides.map((s) => s.id)).toEqual([ids[1], ids[2], ids[0]]);
    expect(slides.map((s) => s.order)).toEqual([0, 1, 2]);
  });

  it("toggleSlideHidden flips the hidden flag", () => {
    const store = useDocStore.getState();
    const id = store.presentation!.slides[0].id;
    store.toggleSlideHidden(id);
    expect(useDocStore.getState().presentation!.slides[0].hidden).toBe(true);
    store.toggleSlideHidden(id);
    expect(useDocStore.getState().presentation!.slides[0].hidden).toBe(false);
  });
});

describe("element management", () => {
  it("addElement appends to the given slide", () => {
    const store = useDocStore.getState();
    const slideId = store.presentation!.slides[0].id;
    store.addElement(slideId, rect("r1"));
    expect(useDocStore.getState().presentation!.slides[0].elements).toHaveLength(1);
  });

  it("updateElement patches only the matching element, in one commit", () => {
    const store = useDocStore.getState();
    const slideId = store.presentation!.slides[0].id;
    store.addElement(slideId, rect("r1"));
    store.addElement(slideId, rect("r2", { x: 500 }));
    store.updateElement(slideId, "r1", { x: 42, y: 7 });
    const elements = useDocStore.getState().presentation!.slides[0].elements;
    expect(elements.find((e) => e.id === "r1")).toMatchObject({ x: 42, y: 7 });
    expect(elements.find((e) => e.id === "r2")).toMatchObject({ x: 500 });
  });

  it("removeElement deletes it", () => {
    const store = useDocStore.getState();
    const slideId = store.presentation!.slides[0].id;
    store.addElement(slideId, rect("r1"));
    store.removeElement(slideId, "r1");
    expect(useDocStore.getState().presentation!.slides[0].elements).toHaveLength(0);
  });

  it("bringToFront/sendToBack reassign zIndex", () => {
    const store = useDocStore.getState();
    const slideId = store.presentation!.slides[0].id;
    store.addElement(slideId, rect("r1", { zIndex: 0 }));
    store.addElement(slideId, rect("r2", { zIndex: 1 }));
    store.bringToFront(slideId, "r1");
    const els = useDocStore.getState().presentation!.slides[0].elements;
    const r1 = els.find((e) => e.id === "r1")!;
    const r2 = els.find((e) => e.id === "r2")!;
    expect(r1.zIndex).toBeGreaterThan(r2.zIndex);
  });

  it("groupElements creates a GroupElement referencing the selected ids and sets their groupId", () => {
    const store = useDocStore.getState();
    const slideId = store.presentation!.slides[0].id;
    store.addElement(slideId, rect("r1"));
    store.addElement(slideId, rect("r2", { x: 200 }));
    const groupId = store.groupElements(slideId, ["r1", "r2"]);
    const els = useDocStore.getState().presentation!.slides[0].elements;
    const group = els.find((e) => e.id === groupId);
    expect(group).toMatchObject({ type: "group", childIds: ["r1", "r2"] });
    expect(els.find((e) => e.id === "r1")!.groupId).toBe(groupId);
    expect(els.find((e) => e.id === "r2")!.groupId).toBe(groupId);
  });

  it("groupElements ignores non-existent ids and only records real children", () => {
    const store = useDocStore.getState();
    const slideId = store.presentation!.slides[0].id;
    store.addElement(slideId, rect("r1"));
    const groupId = store.groupElements(slideId, ["r1", "does-not-exist"]);
    const els = useDocStore.getState().presentation!.slides[0].elements;
    const group = els.find((e) => e.id === groupId);
    expect(group).toMatchObject({ childIds: ["r1"] });
  });

  it("ungroupElements removes the group and clears children's groupId", () => {
    const store = useDocStore.getState();
    const slideId = store.presentation!.slides[0].id;
    store.addElement(slideId, rect("r1"));
    store.addElement(slideId, rect("r2", { x: 200 }));
    const groupId = store.groupElements(slideId, ["r1", "r2"]);
    store.ungroupElements(slideId, groupId);
    const els = useDocStore.getState().presentation!.slides[0].elements;
    expect(els.some((e) => e.id === groupId)).toBe(false);
    expect(els.find((e) => e.id === "r1")!.groupId).toBeUndefined();
  });
});

describe("export/import", () => {
  it("exportJSON/importJSON round-trip the presentation", () => {
    const store = useDocStore.getState();
    const slideId = store.presentation!.slides[0].id;
    store.addElement(slideId, rect("r1"));
    const json = store.exportJSON();
    store.load(createBlankPresentation("other"));
    store.importJSON(json);
    expect(useDocStore.getState().presentation!.id).toBe("p1");
    expect(useDocStore.getState().presentation!.slides[0].elements[0].id).toBe("r1");
  });
});
