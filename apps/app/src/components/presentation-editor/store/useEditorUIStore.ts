import { create } from "zustand";
import type { Editor } from "@tiptap/react";

export type EditorTool = "select" | "text" | "image" | "rect" | "circle" | "line" | "arrow" | "video" | "table";

interface EditorUIState {
  selectedIds: Set<string>;
  activeSlideId: string | null;
  activeTool: EditorTool;
  zoom: number;
  fitZoom: number;
  isZoomFit: boolean;
  showGrid: boolean;
  showRulers: boolean;
  isDragging: boolean;
  activePanel: "properties" | null;
  editingElementId: string | null;
  // The live Tiptap instance for the text element currently being edited (see
  // TextElementEditing), so the toolbar can drive it without prop-drilling.
  // `textEditorTick` is bumped on every selection/transaction so consumers
  // that read `activeTextEditor.isActive(...)` re-render — mutating the
  // editor doesn't change the object reference Zustand compares against.
  activeTextEditor: Editor | null;
  textEditorTick: number;

  select: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  setActiveSlideId: (id: string | null) => void;
  setActiveTool: (tool: EditorTool) => void;
  setZoom: (zoom: number) => void;
  setFitZoom: (zoom: number) => void;
  fitToCanvas: () => void;
  toggleGrid: () => void;
  toggleRulers: () => void;
  setDragging: (dragging: boolean) => void;
  setActivePanel: (panel: "properties" | null) => void;
  setEditingElementId: (id: string | null) => void;
  setActiveTextEditor: (editor: Editor | null) => void;
  bumpTextEditorTick: () => void;
  reset: () => void;
}

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 4;

const initial = {
  selectedIds: new Set<string>(),
  activeSlideId: null as string | null,
  activeTool: "select" as EditorTool,
  zoom: 1,
  fitZoom: 1,
  isZoomFit: true,
  showGrid: false,
  showRulers: true,
  isDragging: false,
  activePanel: null as "properties" | null,
  editingElementId: null as string | null,
  activeTextEditor: null as Editor | null,
  textEditorTick: 0,
};

export const useEditorUIStore = create<EditorUIState>((set) => ({
  ...initial,

  select: (ids) => set({ selectedIds: new Set(ids) }),
  toggleSelect: (id) => set((state) => {
    const next = new Set(state.selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    return { selectedIds: next };
  }),
  clearSelection: () => set({ selectedIds: new Set() }),
  setActiveSlideId: (id) => set({ activeSlideId: id }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setZoom: (zoom) => set({ zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)), isZoomFit: false }),
  setFitZoom: (fitZoom) => set((state) => {
    const clamped = Math.min(1, Math.max(ZOOM_MIN, fitZoom));
    return { fitZoom: clamped, zoom: state.isZoomFit ? clamped : state.zoom };
  }),
  fitToCanvas: () => set((state) => ({ zoom: state.fitZoom, isZoomFit: true })),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  toggleRulers: () => set((state) => ({ showRulers: !state.showRulers })),
  setDragging: (dragging) => set({ isDragging: dragging }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  setEditingElementId: (id) => set({ editingElementId: id }),
  setActiveTextEditor: (editor) => set({ activeTextEditor: editor }),
  bumpTextEditorTick: () => set((state) => ({ textEditorTick: state.textEditorTick + 1 })),
  reset: () => set({ ...initial, selectedIds: new Set() }),
}));
