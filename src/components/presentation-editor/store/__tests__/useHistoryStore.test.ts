import { describe, it, expect, beforeEach } from "vitest";
import { useHistoryStore, MAX_HISTORY } from "../useHistoryStore";
import { useDocStore } from "../useDocStore";
import { createBlankPresentation } from "../../types/presentation";

beforeEach(() => {
  useDocStore.getState().load(createBlankPresentation("p1"));
  useHistoryStore.getState().reset();
});

describe("commit/undo/redo", () => {
  it("commit snapshots the current document; undo restores the previous one", () => {
    useHistoryStore.getState().commit();
    useDocStore.getState().addSlide();
    expect(useDocStore.getState().presentation!.slides).toHaveLength(2);

    useHistoryStore.getState().commit();
    useHistoryStore.getState().undo();
    expect(useDocStore.getState().presentation!.slides).toHaveLength(1);
  });

  it("redo re-applies an undone change", () => {
    useHistoryStore.getState().commit();
    useDocStore.getState().addSlide();
    useHistoryStore.getState().commit();

    useHistoryStore.getState().undo();
    expect(useDocStore.getState().presentation!.slides).toHaveLength(1);

    useHistoryStore.getState().redo();
    expect(useDocStore.getState().presentation!.slides).toHaveLength(2);
  });

  it("a new commit after undo discards the redo branch", () => {
    useHistoryStore.getState().commit();
    useDocStore.getState().addSlide();
    useHistoryStore.getState().commit();
    useHistoryStore.getState().undo();

    useDocStore.getState().addSlide();
    useHistoryStore.getState().commit();

    expect(useHistoryStore.getState().canRedo()).toBe(false);
  });

  it("caps the stack at MAX_HISTORY entries", () => {
    for (let i = 0; i < MAX_HISTORY + 20; i++) {
      useDocStore.getState().addSlide();
      useHistoryStore.getState().commit();
    }
    expect(useHistoryStore.getState().past.length).toBeLessThanOrEqual(MAX_HISTORY);
  });

  it("undo/redo are no-ops at the ends of the stack", () => {
    useHistoryStore.getState().undo(); // nothing committed yet
    expect(useDocStore.getState().presentation!.slides).toHaveLength(1);
    useHistoryStore.getState().commit();
    useHistoryStore.getState().redo(); // nothing to redo
    expect(useDocStore.getState().presentation!.slides).toHaveLength(1);
  });
});
