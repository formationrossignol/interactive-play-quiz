import { describe, it, expect, beforeEach } from "vitest";
import { useEditorUIStore } from "../useEditorUIStore";

beforeEach(() => useEditorUIStore.getState().reset());

describe("selection", () => {
  it("select replaces the selection; toggleSelect adds/removes", () => {
    const store = useEditorUIStore.getState();
    store.select(["a"]);
    expect([...useEditorUIStore.getState().selectedIds]).toEqual(["a"]);

    store.toggleSelect("b");
    expect(new Set(useEditorUIStore.getState().selectedIds)).toEqual(new Set(["a", "b"]));

    store.toggleSelect("a");
    expect([...useEditorUIStore.getState().selectedIds]).toEqual(["b"]);
  });

  it("clearSelection empties it", () => {
    const store = useEditorUIStore.getState();
    store.select(["a", "b"]);
    store.clearSelection();
    expect(useEditorUIStore.getState().selectedIds.size).toBe(0);
  });
});

describe("zoom", () => {
  it("setZoom clamps between 0.1 and 4", () => {
    const store = useEditorUIStore.getState();
    store.setZoom(10);
    expect(useEditorUIStore.getState().zoom).toBe(4);
    store.setZoom(-1);
    expect(useEditorUIStore.getState().zoom).toBe(0.1);
    store.setZoom(1.5);
    expect(useEditorUIStore.getState().zoom).toBe(1.5);
  });

  it("uses fit zoom as the editor 100% reference", () => {
    const store = useEditorUIStore.getState();
    store.setFitZoom(.62);
    expect(useEditorUIStore.getState()).toMatchObject({ fitZoom: .62, zoom: .62, isZoomFit: true });
    store.setZoom(.8);
    store.setFitZoom(.5);
    expect(useEditorUIStore.getState()).toMatchObject({ fitZoom: .5, zoom: .8, isZoomFit: false });
    useEditorUIStore.getState().fitToCanvas();
    expect(useEditorUIStore.getState()).toMatchObject({ zoom: .5, isZoomFit: true });
  });
});

describe("tool and drag flags", () => {
  it("setActiveTool/setDragging update independently of selection", () => {
    const store = useEditorUIStore.getState();
    store.select(["a"]);
    store.setActiveTool("rect");
    store.setDragging(true);
    const state = useEditorUIStore.getState();
    expect(state.activeTool).toBe("rect");
    expect(state.isDragging).toBe(true);
    expect([...state.selectedIds]).toEqual(["a"]);
  });
});

describe("canvas guides", () => {
  it("toggles grid and rulers independently", () => {
    const store = useEditorUIStore.getState();
    expect(store.showGrid).toBe(false);
    expect(store.showRulers).toBe(true);
    store.toggleGrid();
    store.toggleRulers();
    expect(useEditorUIStore.getState().showGrid).toBe(true);
    expect(useEditorUIStore.getState().showRulers).toBe(false);
  });
});
