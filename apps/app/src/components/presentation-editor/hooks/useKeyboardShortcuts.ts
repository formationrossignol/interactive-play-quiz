import { useEffect, useRef } from "react";
import { useDocStore } from "../store/useDocStore";
import { useEditorUIStore } from "../store/useEditorUIStore";
import { useHistoryStore } from "../store/useHistoryStore";
import type { SlideElement } from "../types/presentation";

const NUDGE = 1;
const NUDGE_LARGE = 10;

export function useKeyboardShortcuts(slideId: string, disabled = false) {
  const clipboardRef = useRef<SlideElement[] | null>(null);
  const lastNudgeAtRef = useRef(0);

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      return target instanceof HTMLElement && (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA");
    }

    function onKeyDown(e: KeyboardEvent) {
      if (disabled) return;
      if (isTypingTarget(e.target)) return;
      const doc = useDocStore.getState();
      const ui = useEditorUIStore.getState();
      const history = useHistoryStore.getState();
      const slide = doc.presentation?.slides.find((s) => s.id === slideId);
      if (!slide) return;
      const selected = slide.elements.filter((el) => ui.selectedIds.has(el.id));
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === "z" && !e.shiftKey) { e.preventDefault(); history.undo(); return; }
      if (mod && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); history.redo(); return; }

      if (mod && e.key === "c") {
        e.preventDefault();
        clipboardRef.current = selected.map((el) => ({ ...el }));
        return;
      }
      if (mod && e.key === "x") {
        e.preventDefault();
        clipboardRef.current = selected.map((el) => ({ ...el }));
        history.commit();
        for (const el of selected) doc.removeElement(slideId, el.id);
        return;
      }
      if (mod && e.key === "v") {
        e.preventDefault();
        if (!clipboardRef.current || clipboardRef.current.length === 0) return;
        history.commit();
        const newIds: string[] = [];
        for (const el of clipboardRef.current) {
          const id = `${el.id}-copy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          doc.addElement(slideId, { ...el, id, x: el.x + 20, y: el.y + 20 } as SlideElement);
          newIds.push(id);
        }
        ui.select(newIds);
        return;
      }
      if (mod && e.key === "d") {
        e.preventDefault();
        if (selected.length === 0) return;
        history.commit();
        const newIds: string[] = [];
        for (const el of selected) {
          const id = `${el.id}-dup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          doc.addElement(slideId, { ...el, id, x: el.x + 20, y: el.y + 20 } as SlideElement);
          newIds.push(id);
        }
        ui.select(newIds);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selected.length === 0) return;
        e.preventDefault();
        history.commit();
        for (const el of selected) doc.removeElement(slideId, el.id);
        return;
      }

      const arrowDeltas: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
      };
      if (arrowDeltas[e.key] && selected.length > 0) {
        e.preventDefault();
        const step = e.shiftKey ? NUDGE_LARGE : NUDGE;
        const [dx, dy] = arrowDeltas[e.key];
        const now = Date.now();
        if (now - lastNudgeAtRef.current > 400) history.commit();
        lastNudgeAtRef.current = now;
        doc.updateElements(slideId, selected.map((el) => ({ id: el.id, patch: { x: el.x + dx * step, y: el.y + dy * step } })));
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [slideId, disabled]);
}
