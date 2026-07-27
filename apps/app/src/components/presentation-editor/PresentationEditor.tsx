import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  Grid2X2,
  Home,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Plus,
  Presentation as PresenterIcon,
  Scan,
  Upload,
} from "lucide-react";
import { useDocStore } from "./store/useDocStore";
import { useEditorUIStore } from "./store/useEditorUIStore";
import { useAutosave } from "./hooks/useAutosave";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { EditorToolbar } from "./EditorToolbar";
import { SlideNavigator } from "./SlideNavigator";
import { SlideCanvas } from "./SlideCanvas";
import { PropertiesPanel } from "./PropertiesPanel";
import { PresentationMode } from "./PresentationMode";
import { PresenterMode } from "./PresenterMode";
import { getContent } from "@/lib/content/contentRepo";
import { isLegacySlideShape, migrateLegacySlideToPresentation } from "./utils/migrateLegacySlide";
import { createBlankPresentation, type Presentation } from "./types/presentation";
import { CollaboratorsButton } from "@/components/CollaboratorsButton";
import { Skeleton } from "@/components/ui/skeleton";
import { showError } from "@/lib/errorTaxonomy";
import { PresentationImportDialog } from "./import/PresentationImportDialog";
import { createSlideFromLayout } from "./layouts/slideLayouts";
import { PresentationExportMenu } from "./export/PresentationExportMenu";
import { SlideOverview } from "./SlideOverview";

interface PresentationEditorProps {
  contentId: string | null;
  userId: string;
  initialPresenting?: boolean;
}

export function PresentationEditor({ contentId, userId, initialPresenting = false }: PresentationEditorProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!!contentId);
  const [presenting, setPresenting] = useState(initialPresenting);
  const [presenterMode, setPresenterMode] = useState(false);
  const presentation = useDocStore((s) => s.presentation);
  const load = useDocStore((s) => s.load);
  const setTitle = useDocStore((s) => s.setTitle);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [contentOwnerId, setContentOwnerId] = useState(userId);
  const [importOpen, setImportOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const activeSlideId = useEditorUIStore((s) => s.activeSlideId);
  const setActiveSlideId = useEditorUIStore((s) => s.setActiveSlideId);
  const setZoom = useEditorUIStore((s) => s.setZoom);
  const zoom = useEditorUIStore((s) => s.zoom);
  const fitZoom = useEditorUIStore((s) => s.fitZoom);
  const fitToCanvas = useEditorUIStore((s) => s.fitToCanvas);
  const relativeZoom = fitZoom > 0 ? zoom / fitZoom : 1;

  const { status, contentId: savedContentId } = useAutosave(contentId, userId);
  useKeyboardShortcuts(activeSlideId ?? "", presenting);

  useEffect(() => {
    if (!contentId && savedContentId) {
      navigate(`/presentation-editor?id=${savedContentId}`, { replace: true });
    }
  }, [contentId, navigate, savedContentId]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!contentId) {
        const blank = createBlankPresentation(`new-${Date.now()}`);
        blank.slides = [
          createSlideFromLayout(blank.slides[0].id, 0, "title", blank.width, blank.height),
        ];
        if (!cancelled) {
          load(blank);
          setActiveSlideId(blank.slides[0].id);
          useEditorUIStore.getState().fitToCanvas();
          setLoading(false);
        }
        return;
      }
      try {
        const row = await getContent(contentId);
        if (cancelled) return;
        if (row) setContentOwnerId(row.user_id);
        const raw = row?.data ?? {};
        const pres: Presentation = isLegacySlideShape(raw)
          ? migrateLegacySlideToPresentation(raw as Parameters<typeof migrateLegacySlideToPresentation>[0])
          : (raw as unknown as Presentation);
        load(pres.slides?.length ? pres : createBlankPresentation(contentId));
        setActiveSlideId(pres.slides?.[0]?.id ?? null);
        useEditorUIStore.getState().fitToCanvas();
      } catch (err) {
        if (cancelled) return;
        showError(err, "PresentationEditor.load", "Impossible de charger cette présentation. Réessayez ou revenez à vos contenus.");
          load(createBlankPresentation(contentId));
          setActiveSlideId(null);
          useEditorUIStore.getState().fitToCanvas();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, [contentId, load, setActiveSlideId]);

  if (loading || !presentation || !activeSlideId) {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ height: 56, padding: "8px 16px", display: "flex", gap: 12, alignItems: "center", borderBottom: "var(--ap-border-w) solid var(--ap-line)" }}>
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-5 w-52" />
          <Skeleton className="ml-auto h-9 w-28 rounded-full" />
        </div>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "220px minmax(0, 1fr) 280px", gap: 16, padding: 16 }}>
          <div>{[0, 1, 2].map((item) => <Skeleton key={item} className="mb-3 h-28 w-full" />)}</div>
          <Skeleton className="h-full min-h-96 w-full rounded-2xl" />
          <div>{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="mb-4 h-12 w-full" />)}</div>
        </div>
      </div>
    );
  }

  if (presenting) {
    return <PresentationMode onExit={() => setPresenting(false)} />;
  }
  if (presenterMode) {
    return <PresenterMode onExit={() => setPresenterMode(false)} />;
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderBottom: "var(--ap-border-w) solid var(--ap-line)" }}>
        <nav aria-label="Fil d'ariane" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <button
            onClick={() => { window.location.href = "/"; }}
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
          <CollaboratorsButton
            contentId={savedContentId}
            contentTitle={presentation.title}
            canManage={contentOwnerId === userId}
          />
          <button
            className="ap-btn ap-btn--sm ap-btn--ghost ap-icon-btn"
            aria-label="Réduire le zoom"
            title="Réduire le zoom"
            onClick={() => setZoom(fitZoom * Math.max(.25, relativeZoom - .1))}
          >
            <Minus size={16} aria-hidden="true" />
          </button>
          <span style={{ fontSize: 12, width: 44, textAlign: "center" }}>{Math.round(relativeZoom * 100)}%</span>
          <button
            className="ap-btn ap-btn--sm ap-btn--ghost ap-icon-btn"
            aria-label="Augmenter le zoom"
            title="Augmenter le zoom"
            onClick={() => setZoom(fitZoom * Math.min(4, relativeZoom + .1))}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
          <button className="ap-btn ap-btn--sm ap-btn--ghost" onClick={fitToCanvas}>
            <Scan size={15} aria-hidden="true" />
            Ajuster
          </button>
          <button className="ap-btn ap-btn--sm ap-btn--ghost" onClick={() => setOverviewOpen(true)}>
            <Grid2X2 size={15} aria-hidden="true" />
            Toutes les slides
          </button>
          <PresentationExportMenu presentation={presentation} activeSlideId={activeSlideId} />
          <button className="ap-btn ap-btn--sm ap-btn--ghost" onClick={() => setImportOpen(true)}>
            <Upload size={15} aria-hidden="true" />
            Importer
          </button>
          <button className="ap-btn ap-btn--sm ap-btn--pill" onClick={() => setPresenting(true)}>
            <Play size={15} aria-hidden="true" />
            Présenter
          </button>
          <button className="ap-btn ap-btn--sm ap-btn--ghost" onClick={() => setPresenterMode(true)}>
            <PresenterIcon size={15} aria-hidden="true" />
            Mode présentateur
          </button>
        </div>
      </div>
      <EditorToolbar slideId={activeSlideId} />
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        {leftPanelOpen ? (
          <div style={{ position: "relative", flexShrink: 0, borderRight: "var(--ap-border-w) solid var(--ap-line)", background: "var(--ap-card)" }}>
            <SlideNavigator />
            <button
              type="button"
              className="ap-btn ap-btn--ghost ap-icon-btn"
              aria-label="Rétracter les miniatures"
              title="Rétracter les miniatures"
              onClick={() => setLeftPanelOpen(false)}
              style={{ position: "absolute", top: 8, right: -14, zIndex: 6, width: 30, height: 30, background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)" }}
            >
              <PanelLeftClose size={16} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            aria-label="Afficher les miniatures"
            title="Afficher les miniatures"
            onClick={() => setLeftPanelOpen(true)}
            style={{ width: 38, flexShrink: 0, border: 0, borderRight: "var(--ap-border-w) solid var(--ap-line)", background: "var(--ap-card)", color: "var(--ap-muted)", cursor: "pointer" }}
          >
            <PanelLeftOpen size={18} />
          </button>
        )}
        <SlideCanvas userId={userId} />
        {rightPanelOpen ? (
          <div style={{ position: "relative", flexShrink: 0, borderLeft: "var(--ap-border-w) solid var(--ap-line)", background: "var(--ap-card)", overflowY: "auto" }}>
            <button
              type="button"
              className="ap-btn ap-btn--ghost ap-icon-btn"
              aria-label="Rétracter les propriétés"
              title="Rétracter les propriétés"
              onClick={() => setRightPanelOpen(false)}
              style={{ position: "absolute", top: 8, left: -14, zIndex: 6, width: 30, height: 30, background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)" }}
            >
              <PanelRightClose size={16} />
            </button>
            <PropertiesPanel slideId={activeSlideId} />
          </div>
        ) : (
          <button
            type="button"
            aria-label="Afficher les propriétés"
            title="Afficher les propriétés"
            onClick={() => setRightPanelOpen(true)}
            style={{ width: 38, flexShrink: 0, border: 0, borderLeft: "var(--ap-border-w) solid var(--ap-line)", background: "var(--ap-card)", color: "var(--ap-muted)", cursor: "pointer" }}
          >
            <PanelRightOpen size={18} />
          </button>
        )}
      </div>
      <PresentationImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={(imported) => {
          const next = { ...imported, id: contentId ?? imported.id };
          load(next);
          setActiveSlideId(next.slides[0]?.id ?? null);
          useEditorUIStore.getState().fitToCanvas();
        }}
      />
      <SlideOverview open={overviewOpen} onClose={() => setOverviewOpen(false)} />
    </div>
  );
}
