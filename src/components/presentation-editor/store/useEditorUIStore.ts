import { create } from "zustand";

export type EditorTool = "select" | "text" | "image" | "rect" | "circle" | "line" | "arrow" | "video";

interface EditorUIState {
  selectedIds: Set<string>;
  activeSlideId: string | null;
  activeTool: EditorTool;
  zoom: number;
  isDragging: boolean;
  activePanel: "properties" | null;
  editingElementId: string | null;

  select: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  setActiveSlideId: (id: string | null) => void;
  setActiveTool: (tool: EditorTool) => void;
  setZoom: (zoom: number) => void;
  setDragging: (dragging: boolean) => void;
  setActivePanel: (panel: "properties" | null) => void;
  setEditingElementId: (id: string | null) => void;
  reset: () => void;
}

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 4;

const initial = {
  selectedIds: new Set<string>(),
  activeSlideId: null as string | null,
  activeTool: "select" as EditorTool,
  zoom: 1,
  isDragging: false,
  activePanel: null as "properties" | null,
  editingElementId: null as string | null,
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
  setZoom: (zoom) => set({ zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)) }),
  setDragging: (dragging) => set({ isDragging: dragging }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  setEditingElementId: (id) => set({ editingElementId: id }),
  reset: () => set({ ...initial, selectedIds: new Set() }),
}));
