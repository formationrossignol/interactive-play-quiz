import { create } from "zustand";
import { useDocStore } from "./useDocStore";
import type { Presentation } from "../types/presentation";

export const MAX_HISTORY = 100;

interface HistoryState {
  past: Presentation[];
  future: Presentation[];
  commit: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  reset: () => void;
}

function snapshot(): Presentation | null {
  const p = useDocStore.getState().presentation;
  return p ? (JSON.parse(JSON.stringify(p)) as Presentation) : null;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],

  commit: () => {
    const current = snapshot();
    if (!current) return;
    set((state) => ({
      past: [...state.past, current].slice(-MAX_HISTORY),
      future: [],
    }));
  },

  undo: () => {
    const { past } = get();
    if (past.length === 0) return;
    const current = snapshot();
    const previous = past[past.length - 1];
    set((state) => ({
      past: state.past.slice(0, -1),
      future: current ? [current, ...state.future] : state.future,
    }));
    useDocStore.getState().load(previous);
  },

  redo: () => {
    const { future } = get();
    if (future.length === 0) return;
    const current = snapshot();
    const next = future[0];
    set((state) => ({
      future: state.future.slice(1),
      past: current ? [...state.past, current].slice(-MAX_HISTORY) : state.past,
    }));
    useDocStore.getState().load(next);
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  reset: () => set({ past: [], future: [] }),
}));
