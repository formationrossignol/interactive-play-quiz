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

    // Only trigger save if presentation actually changed from snapshot
    if (presentationJson === lastSavedRef.current) {
      return;
    }

    lastSavedRef.current = presentationJson;

    clearTimeout(timerRef.current);
    setStatus("saving");
    timerRef.current = setTimeout(async () => {
      try {
        if (contentId) {
          await updateContent(contentId, { data: presentation as unknown as Record<string, unknown> });
        } else {
          const row = await createContent(userId, "slide", presentation as unknown as Record<string, unknown>);
          setContentId(row.id);
          useDocStore.getState().load({ ...presentation, id: row.id });
        }
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
