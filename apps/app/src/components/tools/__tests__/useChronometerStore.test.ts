import { beforeEach, describe, expect, it, vi } from "vitest";
import { currentElapsed, useChronometerStore } from "../useChronometerStore";

beforeEach(() => {
  useChronometerStore.setState({ elapsed: 0, startedAt: null, running: false, laps: [], widgetOpen: false });
  vi.restoreAllMocks();
});

describe("global chronometer", () => {
  it("keeps elapsed time in the shared store while the widget changes", () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(1_000).mockReturnValueOnce(2_500).mockReturnValueOnce(2_500);
    useChronometerStore.getState().start();
    useChronometerStore.getState().setWidgetOpen(true);
    expect(currentElapsed(useChronometerStore.getState())).toBe(1_500);
    useChronometerStore.getState().pause();
    expect(useChronometerStore.getState()).toMatchObject({ elapsed: 1_500, running: false, widgetOpen: true });
  });
});
