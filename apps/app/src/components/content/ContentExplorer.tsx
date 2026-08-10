/**
 * ContentExplorer — the single shell shared by every "Mes …" creations page
 * (quiz / sondages / flashcards / cours). It owns the data (useContentCollection),
 * the unified sidebar (Bibliothèque tree + Raccourcis shortcuts), the type tabs,
 * the breadcrumb, the toolbar, folder cards in the content area, the empty states,
 * pagination, the trash view and the drag & drop wiring.
 *
 * Per-type differences (accent, labels, routes, the card/row markup and any header
 * extras) are injected via props. Quiz/poll/flashcard use the GenericCard/GenericRow
 * renderers; courses pass their own.
 */
import { useEffect, useMemo, useState, type MutableRefObject, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { DndContext, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { MaterialSymbol } from "@/components/MaterialSymbol";
import { AppLayout } from "@/components/AppLayout";
import { t, tVars } from "@/lib/i18n";
import { Breadcrumb, type BreadcrumbItem } from "@/components/Breadcrumb";
import { ShareContentModal } from "@/components/ShareContentModal";
import { showError } from "@/lib/errorTaxonomy";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination } from "@/components/Pagination";
import { TrashView } from "@/components/TrashView";
import { DeleteQuizDialog } from "@/components/DeleteQuizDialog";
import { FolderExplorer } from "@/components/FolderExplorer";
import { Skeleton } from "@/components/ui/skeleton";
import { useContentCollection } from "@/hooks/useContentCollection";
import {
  applySearchSort,
  filterActive,
  filterByFolder,
  filterFavorites,
  filterTemplates,
  filterTrashed,
  toDisplay,
  type ContentDisplay,
  type SortOption,
} from "@/lib/content/contentView";
import type { ContentType, FolderRow } from "@/lib/content/types";
import type { ItemCtx } from "./GenericItem";
import { ExplorerEmptyState } from "./ExplorerEmptyState";
import { PageHeader } from "@/components/ui/page-header";

const PAGE_SIZE = 12;

type ShortcutView = "all" | "favorites" | "templates" | "public" | "trash";

interface ExplorerPreferences {
  view?: ShortcutView;
  category?: string;
  sort?: SortOption;
}

const readPreferences = (type: ContentType): ExplorerPreferences => {
  try {
    return JSON.parse(localStorage.getItem(`content-explorer-prefs-${type}`) ?? "{}") as ExplorerPreferences;
  } catch {
    return {};
  }
};

function ContentSkeleton({ viewMode }: { viewMode: "grid" | "list" }) {
  if (viewMode === "list") {
    return (
      <div className="ap-card overflow-hidden p-0">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex items-center gap-4 px-4 py-4" style={{ borderBottom: "var(--ap-border-w) solid var(--ap-line)" }}>
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="mt-2 h-3 w-3/5" />
            </div>
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="ap-card overflow-hidden p-0">
          <Skeleton className="h-52 w-full rounded-none" />
          <div className="p-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="mt-3 h-3.5 w-full" />
            <Skeleton className="mt-2 h-3.5 w-2/3" />
            <Skeleton className="mt-5 h-9 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

const deleteTypeOf = (t: ContentType): "quiz" | "poll" | "flashcard" | "slide" =>
  t === "poll" ? "poll" : t === "flashcard" ? "flashcard" : t === "slide" ? "slide" : "quiz";

// A function (not a module-scope map) so it re-reads the active language on
// every render — a module-scope literal would freeze to whichever language
// was active the first time this module loaded.
const publicLabelFor = (type: ContentType): string => {
  if (type === "quiz") return t("explorerPublicLabelQuiz");
  if (type === "poll") return t("explorerPublicLabelPoll");
  if (type === "flashcard") return t("explorerPublicLabelFlashcard");
  if (type === "slide") return t("explorerPublicLabelSlide");
  if (type === "course") return t("explorerPublicLabelCourse");
  return t("explorerPublicLabelExam");
};

const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: "8px",
  background: active ? "var(--ap-brand-soft)" : "transparent",
  color: active ? "var(--ap-brand)" : "var(--ap-muted)",
  border: `2px solid ${active ? "var(--ap-brand)" : "var(--ap-line)"}`,
  borderRadius: "var(--ap-r-sm)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});

const triggerStyle = {
  fontFamily: "var(--ap-font-body)",
  fontWeight: 700,
  fontSize: "14px",
  border: "var(--ap-border-w) solid var(--ap-line)",
  borderRadius: "var(--ap-r-sm)",
  background: "var(--ap-card)",
  color: "var(--ap-ink)",
  height: "42px",
} as const;

const selectContentStyle = {
  background: "var(--ap-card)",
  border: "var(--ap-border-w) solid var(--ap-line)",
  borderRadius: "var(--ap-r-md)",
} as const;

/** A shortcut row in the sidebar (Favoris / Publics / Corbeille). */
function ShortcutRow({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className="product-explorer-shortcut"
      data-active={active || undefined}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: "var(--ap-r-sm)",
        fontFamily: "var(--ap-font-body)",
        fontWeight: 700,
        fontSize: 13,
        cursor: "pointer",
        userSelect: "none",
        background: active ? "var(--ap-brand-soft)" : "transparent",
        color: active ? "var(--ap-brand)" : "var(--ap-ink)",
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--ap-paper-2)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      {icon}
      <span style={{ flex: 1 }}>{label}</span>
      {count != null && count > 0 && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            padding: "2px 7px",
            borderRadius: "var(--ap-r-sm)",
            background: active ? "var(--ap-card)" : "var(--ap-paper-2)",
            color: active ? "var(--ap-brand)" : "var(--ap-muted)",
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

/** Compact folder card shown inside the content area (also a drop target). */
function FolderDropCard({ folder, count, onOpen }: { folder: FolderRow; count: number; onOpen: () => void }) {
  const { isOver, setNodeRef } = useDroppable({ id: `dropfolder:${folder.id}` });
  return (
    <div
      ref={setNodeRef}
      onClick={onOpen}
      className="ap-card ap-card--hover"
      data-ui="folder-card"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 13,
        padding: "15px 16px",
        cursor: "pointer",
        outline: isOver ? "2px solid var(--ap-brand)" : "none",
        background: isOver ? "var(--ap-brand-soft)" : undefined,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "var(--ap-r-md)",
          background: "var(--ap-brand-soft)",
          color: "var(--ap-brand)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <MaterialSymbol name="folder" size={24} filled />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <b className="ap-h3" style={{ fontSize: 15, display: "block" }}>{folder.name}</b>
        <small className="ap-muted" style={{ fontWeight: 700, fontSize: 12 }}>
          {count} {count === 1 ? t("explorerElementSingular") : t("explorerElementPlural")}
        </small>
      </div>
      <MaterialSymbol name="chevron_right" size={20} style={{ color: "var(--ap-muted)" }} />
    </div>
  );
}

export interface ContentExplorerProps {
  type: ContentType;
  accentBtn: string; // e.g. "ap-btn--quiz" — accent for the CTA buttons
  headerTitle: string;
  headerSubtitle: string;
  rootLabel: string; // "Tous les quiz"
  oneLabel: string; // "quiz", "sondage", "paquet", "cours"
  cta: { label: string; onClick: () => void };
  headerExtras?: ReactNode; // e.g. Examens button (quiz), Générer par IA (course)
  /** Full-width row rendered between the page head and the toolbar/sidebar grid — e.g. a cross-item stats summary. */
  statsRow?: ReactNode;
  /** Fixed category list; when omitted, derived from the items' categories. */
  categories?: string[];
  /** Receives the collection's reload fn so the page can refresh after external mutations. */
  reloadRef?: MutableRefObject<(() => void) | null>;
  /** Extra predicate applied on top of the active (non-trashed) items — e.g. a status filter. */
  extraFilter?: (d: ContentDisplay) => boolean;
  /** Extra control(s) rendered in the toolbar, after the category select. */
  extraToolbar?: ReactNode;
  renderCard: (d: ContentDisplay, ctx: ItemCtx) => ReactNode;
  renderRow: (d: ContentDisplay, ctx: ItemCtx) => ReactNode;
}

const SECTION_TITLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  margin: "6px 0 12px",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: ".8px",
  color: "var(--ap-muted)",
  textTransform: "uppercase",
};

const SIDE_LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: ".8px",
  color: "var(--ap-muted)",
  textTransform: "uppercase",
  padding: "2px 10px 8px",
};

export function ContentExplorer({
  type,
  accentBtn,
  headerTitle,
  headerSubtitle,
  rootLabel,
  oneLabel,
  cta,
  headerExtras,
  statsRow,
  categories: fixedCategories,
  reloadRef,
  extraFilter,
  extraToolbar,
  renderCard,
  renderRow,
}: ContentExplorerProps) {
  const navigate = useNavigate();
  const c = useContentCollection(type);

  useEffect(() => {
    if (reloadRef) reloadRef.current = c.reload;
  }, [reloadRef, c.reload]);

  const [view, setView] = useState<ShortcutView>(() => readPreferences(type).view ?? "all");
  const [viewMode, setViewModeState] = useState<"grid" | "list">(
    () => (localStorage.getItem(`view-mode-${type}`) as "grid" | "list") ?? "grid",
  );
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(() => readPreferences(type).category ?? "Tous");
  const [sort, setSort] = useState<SortOption>(() => readPreferences(type).sort ?? "newest");
  const [page, setPage] = useState(1);
  const [permDeleteTarget, setPermDeleteTarget] = useState<ContentDisplay | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [manageAccessTarget, setManageAccessTarget] = useState<{ contentId: string; title: string } | null>(null);

  const setViewMode = (mode: "grid" | "list") => {
    setViewModeState(mode);
    localStorage.setItem(`view-mode-${type}`, mode);
  };

  useEffect(() => {
    localStorage.setItem(`content-explorer-prefs-${type}`, JSON.stringify({ view, category, sort }));
  }, [type, view, category, sort]);

  const opts = useMemo(() => ({ search, category, sort }), [search, category, sort]);

  const display = useMemo(() => c.items.map(toDisplay), [c.items]);
  const active = useMemo(
    () => filterActive(display).filter((d) => (extraFilter ? extraFilter(d) : true)),
    [display, extraFilter],
  );
  const trashed = useMemo(() => filterTrashed(display), [display]);
  const favorites = useMemo(() => applySearchSort(filterFavorites(display), opts), [display, opts]);
  const templates = useMemo(() => applySearchSort(filterTemplates(display), opts), [display, opts]);
  const publicDisplay = useMemo(() => applySearchSort(c.publicItems.map(toDisplay), opts), [c.publicItems, opts]);

  // Direct active-item count per folderId (badges).
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of active) if (item.folderId) counts[item.folderId] = (counts[item.folderId] ?? 0) + 1;
    return counts;
  }, [active]);

  const derivedCategories = useMemo(() => {
    if (fixedCategories) return fixedCategories;
    const cats = new Set(active.map((i) => i.category).filter(Boolean));
    return ["Tous", ...Array.from(cats).sort()];
  }, [active, fixedCategories]);

  // Root folders and children of the current folder.
  const childFolders = useMemo(
    () => c.folders.filter((f) => f.parent_id === c.currentFolderId),
    [c.folders, c.currentFolderId],
  );

  // Items to show in library view.
  const inFolder = c.currentFolderId !== null;
  const allSorted = useMemo(() => applySearchSort(active, opts), [active, opts]);
  const folderSorted = useMemo(
    () => applySearchSort(filterByFolder(active, c.currentFolderId), opts),
    [active, c.currentFolderId, opts],
  );
  const libraryItems = inFolder ? folderSorted : allSorted;

  const breadcrumb = useMemo(() => {
    const path: FolderRow[] = [];
    let id = c.currentFolderId;
    const byId = new Map(c.folders.map((f) => [f.id, f]));
    while (id) {
      const folder = byId.get(id);
      if (!folder) break;
      path.unshift(folder);
      id = folder.parent_id;
    }
    return path;
  }, [c.currentFolderId, c.folders]);

  const searching = search.trim().length > 0 || category !== "Tous";

  // ---- data actions ----
  const goFolder = (id: string | null) => { setView("all"); c.setCurrentFolderId(id); setPage(1); };
  const goShortcut = (v: ShortcutView) => { setView(v); setPage(1); };

  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => {
    if (view !== "all") {
      const label = view === "favorites" ? t("favorites")
        : view === "templates" ? t("explorerTemplates")
        : view === "public" ? t("explorerPublicContent") : t("explorerTrash");
      return [{ label }];
    }
    const folders: BreadcrumbItem[] = breadcrumb.map((f) =>
      f.id === c.currentFolderId ? { label: f.name } : { label: f.name, onClick: () => goFolder(f.id) },
    );
    return folders;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- goFolder is stable per render, not memoized
  }, [view, breadcrumb, c.currentFolderId]);

  // Generic per-action catches keep their existing friendly copy (it's
  // already better than the raw error message would be) but now log the
  // underlying error for diagnosis instead of swallowing it silently.
  const logUnexpected = (context: string) => (e: unknown) => console.error(`[ContentExplorer.${context}]`, e);

  const handleMove = (rowId: string, folderId: string | null) =>
    c.moveContent(rowId, folderId).then(() => toast.success(t("toastMoved")))
      .catch((e) => { logUnexpected("move")(e); toast.error(t("toastMoveError")); });

  const handleFavorite = (d: ContentDisplay) =>
    c.toggleFavorite(d.id)
      .then(() => toast.success(d.isFavorite ? t("toastFavRemoved") : t("toastFavAdded")))
      .catch((e) => { logUnexpected("favorite")(e); toast.error(t("toastGenericError")); });

  const handleTrash = (rowId: string) =>
    c.trashItem(rowId).then(() => toast.success(t("toastTrashed"), {
      action: {
        label: t("toastUndo"),
        onClick: () => {
          void c.restoreItem(rowId)
            .then(() => toast.success(t("toastUndoSuccess")))
            .catch((e) => { logUnexpected("undoTrash")(e); toast.error(t("toastUndoError")); });
        },
      },
    }))
      .catch((e) => { logUnexpected("trash")(e); toast.error(t("toastGenericError")); });

  const handleDuplicate = (rowId: string) =>
    c.duplicateItem(rowId).then(() => toast.success(t("toastDuplicated")))
      .catch((e) => showError(e, "ContentExplorer.duplicate"));

  const handleRestore = (rowId: string) =>
    c.restoreItem(rowId).then(() => toast.success(t("toastRestored")))
      .catch((e) => { logUnexpected("restore")(e); toast.error(t("toastGenericError")); });

  const handleCopyLink = async (d: ContentDisplay) => {
    const id = String((d.data.id as string | undefined) ?? d.id);
    const path = d.type === "course" ? `/course/${id}`
      : d.type === "exam" ? `/join-exam/${String(d.data.joinCode ?? "")}`
      : d.type === "slide" ? `/presentation-editor?id=${id}&present=1`
      : d.type === "flashcard" ? `/preview/${id}`
      : `/quiz/${id}`;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      toast.success(t("toastLinkCopied"));
    } catch {
      toast.error(t("toastLinkCopyError"));
    }
  };

  const handlePermDeleteConfirm = () => {
    if (permDeleteTarget) {
      c.removeItem(permDeleteTarget.id).then(() => toast.success(t("toastDeletedPermanently")))
        .catch((e) => { logUnexpected("permDelete")(e); toast.error(t("toastGenericError")); });
    }
    setDeleteDialogOpen(false);
    setPermDeleteTarget(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active: dragActive, over } = event;
    if (!over) return;
    const overId = String(over.id);
    let target: string | null;
    if (overId === "folder:root") target = null;
    else if (overId.startsWith("folder:")) target = overId.slice("folder:".length);
    else if (overId.startsWith("dropfolder:")) target = overId.slice("dropfolder:".length);
    else return;

    const activeId = String(dragActive.id);
    if (activeId.startsWith("movefolder:")) {
      const folderId = activeId.slice("movefolder:".length);
      c.moveFolder(folderId, target).catch((err) => {
        if (err instanceof Error && err.message === "cycle") toast.error(t("toastMoveFolderCycle"));
        else toast.error(t("toastMoveError"));
      });
    } else {
      handleMove(activeId, target);
    }
  };

  const ctxFor = (d: ContentDisplay): ItemCtx => ({
    folders: c.folders,
    onMove: (folderId) => handleMove(d.id, folderId),
    onFavorite: () => handleFavorite(d),
    onTrash: () => handleTrash(d.id),
    onDuplicate: () => handleDuplicate(d.id),
    onCopyLink: () => handleCopyLink(d),
    onManageAccess: () => setManageAccessTarget({ contentId: d.id, title: d.title }),
  });

  // ---- item grid / list ----
  const itemsBlock = (items: ContentDisplay[]) =>
    viewMode === "grid" ? (
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map((d) => <div key={d.id}>{renderCard(d, ctxFor(d))}</div>)}
      </div>
    ) : (
      <div className="ap-card" style={{ padding: 0, overflow: "hidden" }}>
        {items.map((d) => <div key={d.id}>{renderRow(d, ctxFor(d))}</div>)}
      </div>
    );

  // Paginates any item list the same way the main library view already does
  // (PAGE_SIZE=12) — REQ-PERF-003/TBL-009: favorites/public used to render
  // every match unbounded, the only lists in this shell that weren't capped.
  const paginatedBlock = (items: ContentDisplay[]) => {
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    const clampedPage = Math.min(page, totalPages);
    const paginated = items.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);
    return (
      <>
        {itemsBlock(paginated)}
        <Pagination page={clampedPage} totalPages={totalPages} onPageChange={setPage} className="mt-8" />
      </>
    );
  };

  const emptyBox = (title: string, body: string, cs: ReactNode) => (
    <ExplorerEmptyState
      icon={cs}
      title={title}
      body={body}
      action={searching ? (
        <button
          className="ap-btn ap-btn--ghost ap-btn--sm ap-btn--pill"
          onClick={() => { setSearch(""); setCategory("Tous"); }}
        >
          {t("explorerClearSearch")}
        </button>
      ) : undefined}
    />
  );

  // ---- content by view ----
  let content: ReactNode;
  if (c.loading) {
    content = <ContentSkeleton viewMode={viewMode} />;
  } else if (view === "trash") {
    content = (
      <TrashView
        items={trashed}
        viewMode={viewMode}
        onRestore={handleRestore}
        onPermanentDelete={(item) => { setPermDeleteTarget(item); setDeleteDialogOpen(true); }}
      />
    );
  } else if (view === "favorites") {
    content = favorites.length
      ? paginatedBlock(favorites)
      : emptyBox(t("explorerNoFavoritesTitle"), tVars("explorerNoFavoritesBody", { item: oneLabel }), <MaterialSymbol name="star" size={28} />);
  } else if (view === "templates") {
    content = templates.length
      ? paginatedBlock(templates)
      : emptyBox(t("explorerNoTemplatesTitle"), tVars("explorerNoTemplatesBody", { item: oneLabel }), <MaterialSymbol name="dashboard_customize" size={28} />);
  } else if (view === "public") {
    content = publicDisplay.length
      ? paginatedBlock(publicDisplay)
      : emptyBox(tVars("explorerNoPublicTitle", { item: oneLabel }), t("explorerNoPublicBody"), <MaterialSymbol name="public" size={28} />);
  } else {
    // library
    const showFolders = !searching && childFolders.length > 0;

    let body: ReactNode;
    if (libraryItems.length === 0 && !showFolders) {
      if (searching) {
        body = emptyBox(tVars("explorerNoResultsTitle", { query: search || category }), t("explorerNoResultsBody"), <MaterialSymbol name="search" size={28} />);
      } else if (inFolder) {
        body = emptyBox(t("explorerEmptyFolderTitle"), tVars("explorerEmptyFolderBody", { item: oneLabel }), <MaterialSymbol name="folder" size={28} />);
      } else {
        body = emptyBox(tVars("explorerFirstItemTitle", { item: oneLabel }), t("explorerFirstItemBody"), <MaterialSymbol name="auto_awesome" size={28} />);
      }
    } else {
      body = (
        <>
          {showFolders && (
            <>
              <div style={SECTION_TITLE}>{t("explorerFolders")}<span style={{ flex: 1, height: 2, background: "var(--ap-line)", borderRadius: 2 }} /></div>
              <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))" }}>
                {childFolders.map((f) => (
                  <FolderDropCard key={f.id} folder={f} count={folderCounts[f.id] ?? 0} onOpen={() => goFolder(f.id)} />
                ))}
              </div>
              <div style={SECTION_TITLE}>{rootLabel} — {libraryItems.length}<span style={{ flex: 1, height: 2, background: "var(--ap-line)", borderRadius: 2 }} /></div>
            </>
          )}
          {paginatedBlock(libraryItems)}
        </>
      );
    }
    content = body;
  }

  const showToolbar = view !== "trash";

  return (
    <AppLayout subtitle={headerTitle}>
      <div className="product-page product-page--explorer">
        {/* Page head */}
        <PageHeader
          title={headerTitle}
          description={headerSubtitle}
          eyebrow="Bibliothèque"
          action={
            <div className="flex items-center gap-2 flex-wrap">
            {headerExtras}
            <button className={`ap-btn ap-btn--sm ap-btn--pill ${accentBtn}`} onClick={cta.onClick}>
              <MaterialSymbol name="add" size={17} /> {cta.label}
            </button>
            </div>
          }
        />

        {statsRow}

        {c.error && (
          <div style={{ borderRadius: "var(--ap-r-md)", border: "2px solid var(--ap-danger)", background: "var(--ap-paper-2)", padding: "16px", marginBottom: "16px", color: "var(--ap-danger)", fontWeight: 700 }}>
            {c.error}
          </div>
        )}

        <DndContext onDragEnd={handleDragEnd}>
          <div className="grid gap-6" style={{ gridTemplateColumns: "minmax(0,1fr)", alignItems: "start" }}>
            <div className="flex flex-col md:flex-row gap-6 items-start">
              {/* ===== Unified sidebar ===== */}
              <aside className="md:w-64 md:flex-shrink-0 w-full">
                <div
                  className="ap-card product-explorer-nav"
                  style={{
                    padding: 12,
                    position: "sticky",
                    top: 84,
                    maxHeight: "calc(100vh - 84px - 24px)",
                    overflowY: "auto",
                  }}
                >
                  <div style={SIDE_LABEL}>{t("explorerShortcuts")}</div>
                  <ShortcutRow
                    icon={<MaterialSymbol name="star" size={18} />}
                    label={t("favorites")}
                    count={filterFavorites(display).length}
                    active={view === "favorites"}
                    onClick={() => goShortcut("favorites")}
                  />
                  <ShortcutRow
                    icon={<MaterialSymbol name="dashboard_customize" size={18} />}
                    label={t("explorerTemplates")}
                    count={filterTemplates(display).length}
                    active={view === "templates"}
                    onClick={() => goShortcut("templates")}
                  />
                  <ShortcutRow
                    icon={<MaterialSymbol name="public" size={18} />}
                    label={publicLabelFor(type)}
                    count={c.publicItems.length}
                    active={view === "public"}
                    onClick={() => goShortcut("public")}
                  />
                  <ShortcutRow
                    icon={<MaterialSymbol name="delete" size={18} />}
                    label={t("explorerTrash")}
                    count={trashed.length}
                    active={view === "trash"}
                    onClick={() => goShortcut("trash")}
                  />

                  <div style={{ borderTop: "var(--ap-border-w) solid var(--ap-line)", margin: "10px 0 8px" }} />
                  <div style={SIDE_LABEL}>{t("explorerLibrary")}</div>
                  <FolderExplorer
                    tree={c.tree}
                    currentFolderId={c.currentFolderId}
                    storageKey={`explorer-expanded-${type}`}
                    counts={folderCounts}
                    rootLabel={rootLabel}
                    rootCount={active.length}
                    rootActive={view === "all" && c.currentFolderId === null}
                    onNavigate={goFolder}
                    onCreate={(pid, name) => c.createFolder(pid, name)}
                    onRename={c.renameFolder}
                    onDelete={c.deleteFolder}
                    onMoveFolder={c.moveFolder}
                  />
                </div>
              </aside>

              {/* ===== Content ===== */}
              <main className="flex-1 min-w-0 w-full">
                {/* Breadcrumb */}
                <div className="mb-4">
                  <Breadcrumb onHome={() => { window.location.href = "/"; }} items={breadcrumbItems} />
                </div>

                {showToolbar && (
                  <div className="product-explorer-toolbar flex flex-col sm:flex-row gap-3 mb-5">
                    <div className="relative flex-1">
                      <MaterialSymbol name="search" size={19} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ap-muted)" }} />
                      <input
                        placeholder={t("explorerSearchPlaceholder")}
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        style={{
                          width: "100%", padding: "10px 14px 10px 38px",
                          fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: 14,
                          color: "var(--ap-ink)", background: "var(--ap-card)",
                          border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-sm)",
                          outline: "none", boxSizing: "border-box",
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--ap-brand)"; e.currentTarget.style.boxShadow = "0 0 0 4px var(--ap-brand-soft)"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "var(--ap-line)"; e.currentTarget.style.boxShadow = "none"; }}
                      />
                    </div>
                    <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
                      <SelectTrigger className="w-[180px]" style={triggerStyle}>
                        <SelectValue placeholder={t("explorerCategoryPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent style={selectContentStyle}>
                        {derivedCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat === "Tous" ? t("explorerAllCategories") : cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {extraToolbar}
                    <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
                      <SelectTrigger className="w-[150px]" style={triggerStyle}>
                        <SelectValue placeholder={t("explorerSortPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent style={selectContentStyle}>
                        <SelectItem value="newest">{t("explorerSortNewest")}</SelectItem>
                        <SelectItem value="oldest">{t("explorerSortOldest")}</SelectItem>
                        <SelectItem value="az">{t("explorerSortAZ")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="product-view-toggle flex gap-1 flex-shrink-0">
                      <button data-active={viewMode === "grid" || undefined} onClick={() => setViewMode("grid")} style={toggleBtnStyle(viewMode === "grid")} title={t("explorerGridView")}><MaterialSymbol name="grid_view" size={19} /></button>
                      <button data-active={viewMode === "list" || undefined} onClick={() => setViewMode("list")} style={toggleBtnStyle(viewMode === "list")} title={t("explorerListView")}><MaterialSymbol name="view_list" size={19} /></button>
                    </div>
                  </div>
                )}

                {/* Visually hidden — restores the h1 -> h2 -> h3 (card title)
                    chain for screen readers; the h1 above and card h3s were
                    adjacent with no h2 between them. */}
                <h2 className="sr-only">{t("explorerResultsHeading")}</h2>
                {content}
              </main>
            </div>
          </div>
        </DndContext>
      </div>

      <DeleteQuizDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handlePermDeleteConfirm}
        title={permDeleteTarget?.title || ""}
        type={deleteTypeOf(type)}
      />

      <ShareContentModal
        contentId={manageAccessTarget?.contentId ?? null}
        contentTitle={manageAccessTarget?.title ?? ""}
        onClose={() => setManageAccessTarget(null)}
      />
    </AppLayout>
  );
}
