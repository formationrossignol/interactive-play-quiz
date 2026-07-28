import { useEffect, useRef, useState } from "react";
import { useDocStore } from "../store/useDocStore";
import { createContent, updateContent } from "@/lib/content/contentRepo";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 1500;

export function useAutosave(initialContentId: string | null, userId: string) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [contentId, setContentId] = useState<string | null>(initialContentId);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const initializedRef = useRef(false);
  const lastSavedRef = useRef<string | null>(null);
  // Guards against a second createContent firing for the same document: if
  // an edit lands while the first create is still in flight, contentId is
  // still null, so without this the effect would schedule another create —
  // two content rows for one document, whichever resolves last silently
  // orphaning the other.
  const creatingRef = useRef(false);

  const presentation = useDocStore((s) => s.presentation);

  useEffect(() => {
    if (!presentation) return;

    const presentationJson = JSON.stringify(presentation);

    // On first effect run, just snapshot and return
    if (!initializedRef.current) {
      initializedRef.current = true;
      lastSavedRef.current = presentationJson;
      return;
    }

    // Only trigger save if presentation actually changed from the last
    // *successfully saved* snapshot (lastSavedRef is only updated on success
    // below — see the try/catch) — a change compared against a snapshot
    // taken before a failed attempt would make that failed save look
    // already-handled and it would never be retried.
    if (presentationJson === lastSavedRef.current) {
      return;
    }

    clearTimeout(timerRef.current);
    setStatus("saving");
    timerRef.current = setTimeout(async () => {
      // A create for this document is already in flight — don't start a
      // second one. lastSavedRef is deliberately left untouched so this
      // effect reruns and retries (via updateContent, once contentId is
      // set) instead of silently dropping this edit.
      if (!contentId && creatingRef.current) return;

      try {
        if (contentId) {
          await updateContent(contentId, { data: presentation as unknown as Record<string, unknown> });
        } else {
          creatingRef.current = true;
          try {
            const row = await createContent(userId, "slide", presentation as unknown as Record<string, unknown>);
            setContentId(row.id);
            useDocStore.getState().load({ ...presentation, id: row.id });
          } finally {
            creatingRef.current = false;
          }
        }
        lastSavedRef.current = presentationJson;
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timerRef.current);
  }, [presentation, contentId, userId]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (status !== "saving") return;
      e.preventDefault();
      e.returnValue = "Des modifications ne sont pas encore enregistrées.";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status]);

  return { status, contentId };
}
