import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!!contentId);
  const [presenting, setPresenting] = useState(initialPresenting);
  const presentation = useDocStore((s) => s.presentation);
  const load = useDocStore((s) => s.load);
  const setTitle = useDocStore((s) => s.setTitle);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
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
      try {
        const row = await getContent(contentId);
        if (cancelled) return;
        const raw = row?.data ?? {};
        const pres: Presentation = isLegacySlideShape(raw)
          ? migrateLegacySlideToPresentation(raw as Parameters<typeof migrateLegacySlideToPresentation>[0])
          : (raw as unknown as Presentation);
        load(pres.slides?.length ? pres : createBlankPresentation(contentId));
        setActiveSlideId(pres.slides?.[0]?.id ?? null);
      } catch (err) {
        if (cancelled) return;
        toast.error("Impossible de charger cette présentation.");
        load(createBlankPresentation(contentId));
        setActiveSlideId(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
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
        <nav aria-label="Fil d'ariane" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <button
            onClick={() => navigate("/")}
            aria-label="Accueil"
            style={{
              display: "grid", placeItems: "center", width: 32, height: 32,
              borderRadius: "50%", border: "var(--ap-border-w) solid var(--ap-line)",
              background: "var(--ap-card)", cursor: "pointer", flexShrink: 0,
            }}
          >
            <Home style={{ width: 15, height: 15, color: "var(--ap-ink)" }} />
          </button>
          <ChevronRight style={{ width: 14, height: 14, color: "var(--ap-line-2)", flexShrink: 0 }} />
          <button
            onClick={() => navigate("/my-slides")}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: 0,
              fontFamily: "var(--ap-font-body)", fontSize: 14, fontWeight: 700,
              color: "var(--ap-muted)", whiteSpace: "nowrap",
            }}
          >
            Mes Slides
          </button>
          <ChevronRight style={{ width: 14, height: 14, color: "var(--ap-line-2)", flexShrink: 0 }} />
          {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => { setTitle(titleDraft.trim() || "Sans titre"); setEditingTitle(false); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") { setEditingTitle(false); }
            }}
            style={{
              fontFamily: "var(--ap-font-display)", fontWeight: 700, fontSize: "inherit",
              border: "var(--ap-border-w) solid var(--ap-brand)", borderRadius: "var(--ap-r-sm)",
              padding: "2px 6px", background: "var(--ap-card)", color: "var(--ap-ink)",
            }}
          />
        ) : (
          <span
            style={{ fontFamily: "var(--ap-font-display)", fontWeight: 700, cursor: "text", padding: "2px 6px", borderRadius: "var(--ap-r-sm)" }}
            title="Cliquer pour renommer"
            onClick={() => { setTitleDraft(presentation.title); setEditingTitle(true); }}
          >
            {presentation.title}
          </span>
        )}
        </nav>
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
        <SlideCanvas userId={userId} />
        <PropertiesPanel slideId={activeSlideId} />
      </div>
    </div>
  );
}
