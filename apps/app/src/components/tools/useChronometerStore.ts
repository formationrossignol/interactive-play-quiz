import { create } from "zustand";

interface ChronometerState {
  elapsed: number;
  startedAt: number | null;
  running: boolean;
  laps: number[];
  widgetOpen: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
  addLap: () => void;
  setWidgetOpen: (open: boolean) => void;
}

export const currentElapsed = (state: Pick<ChronometerState, "elapsed" | "running" | "startedAt">, now = Date.now()) =>
  state.running && state.startedAt != null ? state.elapsed + (now - state.startedAt) : state.elapsed;

export const formatElapsed = (ms: number) => {
  const centis = Math.floor((ms % 1000) / 10);
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const pad = (value: number, length = 2) => value.toString().padStart(length, "0");
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(centis)}`
    : `${pad(minutes)}:${pad(seconds)}.${pad(centis)}`;
};

export const useChronometerStore = create<ChronometerState>((set, get) => ({
  elapsed: 0,
  startedAt: null,
  running: false,
  laps: [],
  widgetOpen: false,
  start: () => set((state) => state.running ? state : { running: true, startedAt: Date.now() }),
  pause: () => set((state) => ({
    elapsed: currentElapsed(state),
    running: false,
    startedAt: null,
  })),
  reset: () => set({ elapsed: 0, startedAt: null, running: false, laps: [] }),
  addLap: () => {
    const state = get();
    if (!state.running) return;
    set({ laps: [currentElapsed(state), ...state.laps] });
  },
  setWidgetOpen: (widgetOpen) => set({ widgetOpen }),
}));
