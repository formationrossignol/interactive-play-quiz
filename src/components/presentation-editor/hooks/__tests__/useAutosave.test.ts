import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutosave } from "../useAutosave";
import { useDocStore } from "../../store/useDocStore";
import { createBlankPresentation } from "../../types/presentation";

vi.mock("@/lib/content/contentRepo", () => ({
  updateContent: vi.fn(async () => {}),
  createContent: vi.fn(async () => ({ id: "new-row-id" })),
}));
import { updateContent, createContent } from "@/lib/content/contentRepo";

beforeEach(() => {
  vi.clearAllTimers();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  updateContent.mockClear();
  createContent.mockClear();
  useDocStore.getState().load(createBlankPresentation("existing-id"));
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("useAutosave", () => {
  it("debounces: rapid changes within the window only trigger one save", async () => {
    const { result, unmount } = renderHook(() => useAutosave("row-1", "user-1"));
    act(() => {
      useDocStore.getState().addSlide();
      useDocStore.getState().addSlide();
      useDocStore.getState().addSlide();
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    await vi.waitFor(() => expect(result.current.status).toBe("saved"));
    expect(updateContent).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("does nothing when nothing changed", () => {
    let result, unmount;
    act(() => {
      const rendered = renderHook(() => useAutosave("row-1", "user-1"));
      result = rendered.result;
      unmount = rendered.unmount;
    });
    expect(result.current.status).toBe("idle");
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(updateContent).not.toHaveBeenCalled();
    unmount();
  });

  it("creates a content row on first save when contentId is null", async () => {
    const { result, rerender, unmount } = renderHook(({ id }) => useAutosave(id, "user-1"), { initialProps: { id: null as string | null } });
    act(() => {
      useDocStore.getState().addSlide();
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    await vi.waitFor(() => expect(createContent).toHaveBeenCalledTimes(1));
    rerender({ id: null });
    expect(result.current.contentId).toBe("new-row-id");
    unmount();
  });
});
