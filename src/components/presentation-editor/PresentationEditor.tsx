import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useDocStore } from "./store/useDocStore";
import { useEditorUIStore } from "./store/useEditorUIStore";
import { useAutosave } from "./hooks/useAutosave";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { EditorToolbar } from "./EditorToolbar";
import { SlideNavigator } from "./SlideNavigator";
import { SlideCanvas } from "./SlideCanvas";
import { PropertiesPanel } from "./PropertiesPanel";
import { PresentationMode, exportPresentationAsFile, importPresentationFromFile } from "./PresentationMode";
import { getContent } from "@/lib/content/contentRepo";
import { isLegacySlideShape, migrateLegacySlideToPresentation } from "./utils/migrateLegacySlide";
import { createBlankPresentation, type Presentation } from "./types/presentation";

interface PresentationEditorProps {
  contentId: string | null;
  userId: string;
  initialPresenting?: boolean;
}

export function PresentationEditor({ contentId, userId, initialPresenting = false }: PresentationEditorProps) {
  const [loading, setLoading] = useState(!!contentId);
  const [presenting, setPresenting] = useState(initialPresenting);
  const presentation = useDocStore((s) => s.presentation);
  const load = useDocStore((s) => s.load);
  const activeSlideId = useEditorUIStore((s) => s.activeSlideId);
  const setActiveSlideId = useEditorUIStore((s) => s.setActiveSlideId);
  const setZoom = useEditorUIStore((s) => s.setZoom);
  const zoom = useEditorUIStore((s) => s.zoom);

  const { status } = useAutosave(contentId, userId);
  useKeyboardShortcuts(activeSlideId ?? "", presenting);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!contentId) {
        const blank = createBlankPresentation(`new-${Date.now()}`);
        if (!cancelled) { load(blank); setActiveSlideId(blank.slides[0].id); setLoading(false); }
        return;
      }
      const row = await getContent(contentId);
      if (cancelled) return;
      const raw = row?.data ?? {};
      const pres: Presentation = isLegacySlideShape(raw)
        ? migrateLegacySlideToPresentation(raw as Parameters<typeof migrateLegacySlideToPresentation>[0])
        : (raw as unknown as Presentation);
      load(pres.slides?.length ? pres : createBlankPresentation(contentId));
      setActiveSlideId(pres.slides?.[0]?.id ?? null);
      setLoading(false);
    }
    init();
    return () => { cancelled = true; };
  }, [contentId, load, setActiveSlideId]);

  if (loading || !presentation || !activeSlideId) {
    return <div style={{ padding: 40, textAlign: "center" }}>Chargement…</div>;
  }

  if (presenting) {
    return <PresentationMode onExit={() => setPresenting(false)} />;
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderBottom: "var(--ap-border-w) solid var(--ap-line)" }}>
        <span style={{ fontFamily: "var(--ap-font-display)", fontWeight: 700 }}>{presentation.title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "var(--ap-muted)" }}>
            {status === "saving" ? "Enregistrement…" : status === "saved" ? "Enregistré" : status === "error" ? "Erreur d'enregistrement" : ""}
          </span>
          <button className="ap-btn ap-btn--sm ap-btn--ghost" onClick={() => setZoom(zoom - 0.1)}>−</button>
          <span style={{ fontSize: 12, width: 40, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
          <button className="ap-btn ap-btn--sm ap-btn--ghost" onClick={() => setZoom(zoom + 0.1)}>+</button>
          <button className="ap-btn ap-btn--sm ap-btn--ghost" onClick={exportPresentationAsFile}>Exporter JSON</button>
          <label className="ap-btn ap-btn--sm ap-btn--ghost" style={{ cursor: "pointer" }}>
            Importer JSON
            <input type="file" accept="application/json" style={{ display: "none" }} onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              importPresentationFromFile(f).catch((err: Error) => toast.error(err.message));
            }} />
          </label>
          <button className="ap-btn ap-btn--sm ap-btn--pill" onClick={() => setPresenting(true)}>▶ Présenter</button>
        </div>
      </div>
      <EditorToolbar slideId={activeSlideId} />
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <SlideNavigator />
        <SlideCanvas />
        <PropertiesPanel slideId={activeSlideId} />
      </div>
    </div>
  );
}
