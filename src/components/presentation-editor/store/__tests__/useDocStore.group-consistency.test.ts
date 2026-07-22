import { describe, it, expect, beforeEach } from "vitest";
import { useDocStore } from "../useDocStore";
import { createBlankPresentation } from "../../types/presentation";
import type { ShapeElement, GroupElement } from "../../types/presentation";

const rect = (id: string, overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id, type: "rect", x: 0, y: 0, width: 100, height: 100, rotation: 0, zIndex: 0, opacity: 1, locked: false, visible: true, fill: "#fff",
  ...overrides,
});

beforeEach(() => {
  useDocStore.getState().load(createBlankPresentation("p1"));
});

describe("groupElements - consistency check", () => {
  it("groupElements with mixed existing/non-existing ids stores all ids in childIds", () => {
    const store = useDocStore.getState();
    const slideId = store.presentation!.slides[0].id;
    store.addElement(slideId, rect("r1"));
    store.addElement(slideId, rect("r2"));
    
    // Pass ["r1", "nonexistent"]
    const groupId = store.groupElements(slideId, ["r1", "nonexistent"]);
    
    const elements = useDocStore.getState().presentation!.slides[0].elements;
    const group = elements.find(e => e.id === groupId) as GroupElement | undefined;
    
    expect(group).toBeDefined();
    expect(group?.childIds).toEqual(["r1", "nonexistent"]);  // All ids stored
    expect(elements.find(e => e.id === "r1")?.groupId).toBe(groupId);  // r1 has groupId set
    expect(elements.find(e => e.id === "r2")?.groupId).toBeUndefined();  // r2 not in group
    // "nonexistent" doesn't exist, so can't have groupId set
  });

  it("groupElements with all non-existing ids returns early without creating group", () => {
    const store = useDocStore.getState();
    const slideId = store.presentation!.slides[0].id;
    store.addElement(slideId, rect("r1"));
    
    const before = useDocStore.getState().presentation!.slides[0].elements.length;
    store.groupElements(slideId, ["nonexistent1", "nonexistent2"]);
    const after = useDocStore.getState().presentation!.slides[0].elements.length;
    
    expect(before).toBe(after);  // No group created
  });

  it("ungroupElements with mismatched childIds still clears groupId correctly", () => {
    const store = useDocStore.getState();
    const slideId = store.presentation!.slides[0].id;
    store.addElement(slideId, rect("r1"));
    store.addElement(slideId, rect("r2"));
    
    // Create group with mismatched childIds
    const groupId = store.groupElements(slideId, ["r1", "nonexistent"]);
    
    // Ungroup
    store.ungroupElements(slideId, groupId);
    
    const elements = useDocStore.getState().presentation!.slides[0].elements;
    const r1 = elements.find(e => e.id === "r1");
    const r2 = elements.find(e => e.id === "r2");
    const group = elements.find(e => e.id === groupId);
    
    expect(group).toBeUndefined();  // Group removed
    expect(r1?.groupId).toBeUndefined();  // r1's groupId cleared
    expect(r2?.groupId).toBeUndefined();  // r2 was never grouped
  });
});
