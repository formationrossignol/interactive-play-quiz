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
import { Link, useNavigate } from "react-router-dom";
import { DndContext, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import {
  ChevronRight,
  Folder as FolderIcon,
  Globe,
  Home,
  LayoutGrid,
  List,
  Search,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PlanLimitError } from "@/lib/plans";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination } from "@/components/Pagination";
import { TrashView } from "@/components/TrashView";
import { DeleteQuizDialog } from "@/components/DeleteQuizDialog";
import { FolderExplorer } from "@/components/FolderExplorer";
import { useContentCollection } from "@/hooks/useContentCollection";
import {
  applySearchSort,
  filterActive,
  filterByFolder,
  filterFavorites,
  filterTrashed,
  toDisplay,
  type ContentDisplay,
  type SortOption,
} from "@/lib/content/contentView";
import type { ContentType, FolderRow } from "@/lib/content/types";
import type { ItemCtx } from "./GenericItem";

const PAGE_SIZE = 12;

type ShortcutView = "all" | "favorites" | "public" | "trash";

interface TypeTab {
  type: ContentType;
  label: string;
  route: string;
  dot: string; // css var
}

const TYPE_TABS: TypeTab[] = [
  { type: "quiz", label: "Quiz", route: "/my-quizzes", dot: "--ap-quiz" },
  { type: "poll", label: "Sondages", route: "/my-polls", dot: "--ap-poll" },
  { type: "flashcard", label: "Flashcards", route: "/my-flashcards", dot: "--ap-flash" },
  { type: "slide", label: "Slides", route: "/my-slides", dot: "--ap-pres" },
  { type: "course", label: "Cours", route: "/my-courses", dot: "--ap-pres" },
];

const deleteTypeOf = (t: ContentType): "quiz" | "poll" | "flashcard" | "slide" =>
  t === "poll" ? "poll" : t === "flashcard" ? "flashcard" : t === "slide" ? "slide" : "quiz";

const PUBLIC_LABELS: Record<ContentType, string> = {
  quiz: "Quiz publics",
  poll: "Sondages publics",
  flashcard: "Paquets publics",
  slide: "Présentations publiques",
  course: "Cours publics",
  exam: "Examens publics",
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
            borderRadius: 999,
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
          borderRadius: 13,
          background: "var(--ap-brand-soft)",
          color: "var(--ap-brand)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <FolderIcon style={{ width: 22, height: 22 }} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <b className="ap-h3" style={{ fontSize: 15, display: "block" }}>{folder.name}</b>
        <small className="ap-muted" style={{ fontWeight: 700, fontSize: 12 }}>
          {count} élément{count !== 1 ? "s" : ""}
        </small>
      </div>
      <ChevronRight style={{ width: 16, height: 16, color: "var(--ap-line-2)" }} />
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

  const [view, setView] = useState<ShortcutView>("all");
  const [viewMode, setViewModeState] = useState<"grid" | "list">(
    () => (localStorage.getItem(`view-mode-${type}`) as "grid" | "list") ?? "grid",
  );
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Tous");
  const [sort, setSort] = useState<SortOption>("newest");
  const [page, setPage] = useState(1);
  const [permDeleteTarget, setPermDeleteTarget] = useState<ContentDisplay | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const setViewMode = (mode: "grid" | "list") => {
    setViewModeState(mode);
    localStorage.setItem(`view-mode-${type}`, mode);
  };

  const opts = useMemo(() => ({ search, category, sort }), [search, category, sort]);

  const display = useMemo(() => c.items.map(toDisplay), [c.items]);
  const active = useMemo(
    () => filterActive(display).filter((d) => (extraFilter ? extraFilter(d) : true)),
    [display, extraFilter],
  );
  const trashed = useMemo(() => filterTrashed(display), [display]);
  const favorites = useMemo(() => applySearchSort(filterFavorites(display), opts), [display, opts]);
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

  const handleMove = (rowId: string, folderId: string | null) =>
    c.moveContent(rowId, folderId).then(() => toast.success("Déplacé")).catch(() => toast.error("Erreur lors du déplacement"));

  const handleFavorite = (d: ContentDisplay) =>
    c.toggleFavorite(d.id)
      .then(() => toast.success(d.isFavorite ? "Retiré des favoris" : "Ajouté aux favoris"))
      .catch(() => toast.error("Erreur"));

  const handleTrash = (rowId: string) =>
    c.trashItem(rowId).then(() => toast.success("Mis à la corbeille")).catch(() => toast.error("Erreur"));

  const handleDuplicate = (rowId: string) =>
    c.duplicateItem(rowId).then(() => toast.success("Dupliqué")).catch((e) => {
      if (e instanceof PlanLimitError) {
        toast.error(e.message, { action: { label: "Passer Pro", onClick: () => { window.location.href = "/pricing"; } } });
      } else {
        toast.error("Erreur lors de la duplication");
      }
    });

  const handleRestore = (rowId: string) =>
    c.restoreItem(rowId).then(() => toast.success("Restauré")).catch(() => toast.error("Erreur"));

  const handlePermDeleteConfirm = () => {
    if (permDeleteTarget) {
      c.removeItem(permDeleteTarget.id).then(() => toast.success("Supprimé définitivement")).catch(() => toast.error("Erreur"));
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
        if (err instanceof Error && err.message === "cycle") toast.error("Déplacement impossible (cycle)");
        else toast.error("Erreur lors du déplacement");
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

  const emptyBox = (title: string, body: string, cs: ReactNode) => (
    <div style={{ borderRadius: "var(--ap-r-lg)", border: "var(--ap-border-w) dashed var(--ap-line-2)", background: "var(--ap-paper-2)", padding: "48px 24px", textAlign: "center" }}>
      <div style={{ width: 64, height: 64, margin: "0 auto 16px", borderRadius: 20, background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ap-brand)" }}>
        {cs}
      </div>
      <h3 className="ap-h3" style={{ fontSize: 19, marginBottom: 6 }}>{title}</h3>
      <p className="ap-muted" style={{ fontSize: 14, margin: "0 0 20px" }}>{body}</p>
      {view === "all" && !searching && (
        <button className={`ap-btn ap-btn--sm ap-btn--pill ${accentBtn}`} onClick={cta.onClick}>{cta.label}</button>
      )}
      {searching && (
        <button
          className="ap-btn ap-btn--ghost ap-btn--sm ap-btn--pill"
          onClick={() => { setSearch(""); setCategory("Tous"); }}
        >
          Effacer la recherche
        </button>
      )}
    </div>
  );

  // ---- content by view ----
  let content: ReactNode;
  if (c.loading) {
    content = <p className="py-10 text-center text-sm text-muted-foreground">Chargement…</p>;
  } else if (view === "trash") {
    content = (
      <TrashView
        items={trashed as unknown as Parameters<typeof TrashView>[0]["items"]}
        viewMode={viewMode}
        onRestore={handleRestore}
        onPermanentDelete={(item) => { setPermDeleteTarget(item as unknown as ContentDisplay); setDeleteDialogOpen(true); }}
      />
    );
  } else if (view === "favorites") {
    content = favorites.length
      ? itemsBlock(favorites)
      : emptyBox("Aucun favori", `Marquez un ${oneLabel} d'une étoile pour le retrouver ici.`, <Star style={{ width: 26, height: 26 }} />);
  } else if (view === "public") {
    content = publicDisplay.length
      ? itemsBlock(publicDisplay)
      : emptyBox(`Aucun ${oneLabel} public`, "Rendez un de vos contenus public pour qu'il apparaisse ici.", <Globe style={{ width: 26, height: 26 }} />);
  } else {
    // library
    const showFolders = !searching && childFolders.length > 0;
    const totalPages = Math.max(1, Math.ceil(libraryItems.length / PAGE_SIZE));
    const clampedPage = Math.min(page, totalPages);
    const paginated = libraryItems.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

    let body: ReactNode;
    if (libraryItems.length === 0 && !showFolders) {
      if (searching) {
        body = emptyBox(`Aucun résultat pour « ${search || category} »`, "Vérifiez l'orthographe ou élargissez le filtre de catégorie.", <Search style={{ width: 26, height: 26 }} />);
      } else if (inFolder) {
        body = emptyBox("Ce dossier est vide", `Glissez-déposez des ${oneLabel}s ici depuis « Tous », ou créez-en un directement.`, <FolderIcon style={{ width: 26, height: 26 }} />);
      } else {
        body = emptyBox(`Créez votre premier ${oneLabel}`, "Partez d'un modèle, importez un fichier, ou générez-le par IA depuis vos supports.", <Sparkles style={{ width: 26, height: 26 }} />);
      }
    } else {
      body = (
        <>
          {showFolders && (
            <>
              <div style={SECTION_TITLE}>Dossiers<span style={{ flex: 1, height: 2, background: "var(--ap-line)", borderRadius: 2 }} /></div>
              <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))" }}>
                {childFolders.map((f) => (
                  <FolderDropCard key={f.id} folder={f} count={folderCounts[f.id] ?? 0} onOpen={() => goFolder(f.id)} />
                ))}
              </div>
              <div style={SECTION_TITLE}>{rootLabel} — {libraryItems.length}<span style={{ flex: 1, height: 2, background: "var(--ap-line)", borderRadius: 2 }} /></div>
            </>
          )}
          {itemsBlock(paginated)}
          <Pagination page={clampedPage} totalPages={totalPages} onPageChange={setPage} className="mt-8" />
        </>
      );
    }
    content = body;
  }

  const showToolbar = view !== "trash";

  return (
    <AppLayout subtitle={headerTitle}>
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Page head */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="ap-h2" style={{ fontSize: "26px" }}>{headerTitle}</h1>
            <p className="ap-muted" style={{ fontSize: "14px" }}>{headerSubtitle}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {headerExtras}
            <button className={`ap-btn ap-btn--sm ap-btn--pill ${accentBtn}`} onClick={cta.onClick}>{cta.label}</button>
          </div>
        </div>

        {/* Type tabs — proof of the shared explorer, anchored to the content rule */}
        <nav
          aria-label="Type de contenu"
          style={{ display: "flex", gap: 6, alignItems: "flex-end", margin: "2px 0 24px", borderBottom: "3px solid var(--ap-line)", overflowX: "auto" }}
        >
          {TYPE_TABS.map((tab) => {
            const on = tab.type === type;
            return (
              <Link
                key={tab.type}
                to={tab.route}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  border: `2px solid ${on ? `var(${tab.dot})` : "var(--ap-line)"}`,
                  borderBottom: "none",
                  background: on ? `var(${tab.dot})` : "var(--ap-paper-2)",
                  color: on ? "#fff" : "var(--ap-muted)",
                  borderRadius: "15px 15px 0 0",
                  padding: on ? "10px 19px 15px" : "10px 19px 13px",
                  marginBottom: "-3px",
                  fontFamily: "var(--ap-font-display)",
                  fontWeight: 600,
                  fontSize: 14,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: on ? "#fff" : `var(${tab.dot})` }} />
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {c.error && (
          <div style={{ borderRadius: "var(--ap-r-md)", border: "2px solid var(--ap-quiz)", background: "var(--ap-paper-2)", padding: "16px", marginBottom: "16px", color: "var(--ap-quiz)", fontWeight: 700 }}>
            {c.error}
          </div>
        )}

        <DndContext onDragEnd={handleDragEnd}>
          <div className="grid gap-6" style={{ gridTemplateColumns: "minmax(0,1fr)", alignItems: "start" }}>
            <div className="flex flex-col md:flex-row gap-6 items-start">
              {/* ===== Unified sidebar ===== */}
              <aside className="md:w-64 md:flex-shrink-0 w-full">
                <div className="ap-card" style={{ padding: 12, position: "sticky", top: 84 }}>
                  <div style={SIDE_LABEL}>Raccourcis</div>
                  <ShortcutRow
                    icon={<Star style={{ width: 16, height: 16 }} />}
                    label="Favoris"
                    count={filterFavorites(display).length}
                    active={view === "favorites"}
                    onClick={() => goShortcut("favorites")}
                  />
                  <ShortcutRow
                    icon={<Globe style={{ width: 16, height: 16 }} />}
                    label={PUBLIC_LABELS[type]}
                    count={c.publicItems.length}
                    active={view === "public"}
                    onClick={() => goShortcut("public")}
                  />
                  <ShortcutRow
                    icon={<Trash2 style={{ width: 16, height: 16 }} />}
                    label="Corbeille"
                    count={trashed.length}
                    active={view === "trash"}
                    onClick={() => goShortcut("trash")}
                  />

                  <div style={{ borderTop: "var(--ap-border-w) solid var(--ap-line)", margin: "10px 0 8px" }} />
                  <div style={SIDE_LABEL}>Bibliothèque</div>
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
                {view === "all" ? (
                  <div className="flex items-center gap-1 flex-wrap mb-4" style={{ fontSize: 14, minHeight: 28 }}>
                    <button
                      onClick={() => { window.location.href = "/"; }}
                      aria-label="Accueil"
                      style={{
                        display: "grid", placeItems: "center", width: 28, height: 28,
                        borderRadius: "50%", border: "var(--ap-border-w) solid var(--ap-line)",
                        background: "var(--ap-card)", cursor: "pointer", flexShrink: 0, marginRight: 2,
                      }}
                    >
                      <Home style={{ width: 13, height: 13, color: "var(--ap-ink)" }} />
                    </button>
                    <ChevronRight className="h-4 w-4" style={{ color: "var(--ap-muted)" }} />
                    <button
                      className="ap-btn ap-btn--ghost ap-btn--sm"
                      style={{ padding: "2px 8px", fontWeight: 700 }}
                      onClick={() => goFolder(null)}
                    >
                      {rootLabel}
                    </button>
                    {breadcrumb.map((f) => (
                      <span key={f.id} className="flex items-center gap-1">
                        <ChevronRight className="h-4 w-4" style={{ color: "var(--ap-muted)" }} />
                        <button
                          className="ap-btn ap-btn--ghost ap-btn--sm"
                          style={{ padding: "2px 8px", fontWeight: 700, color: f.id === c.currentFolderId ? "var(--ap-brand)" : "var(--ap-ink)" }}
                          onClick={() => goFolder(f.id)}
                        >
                          {f.name}
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 flex-wrap mb-4" style={{ fontSize: 14, minHeight: 28 }}>
                    <button
                      onClick={() => { window.location.href = "/"; }}
                      aria-label="Accueil"
                      style={{
                        display: "grid", placeItems: "center", width: 28, height: 28,
                        borderRadius: "50%", border: "var(--ap-border-w) solid var(--ap-line)",
                        background: "var(--ap-card)", cursor: "pointer", flexShrink: 0, marginRight: 2,
                      }}
                    >
                      <Home style={{ width: 13, height: 13, color: "var(--ap-ink)" }} />
                    </button>
                    <ChevronRight className="h-4 w-4" style={{ color: "var(--ap-muted)" }} />
                    <span className="ap-h3" style={{ fontSize: 15 }}>
                      {view === "favorites" ? "Favoris" : view === "public" ? "Contenus publics" : "Corbeille"}
                    </span>
                  </div>
                )}

                {showToolbar && (
                  <div className="flex flex-col sm:flex-row gap-3 mb-5">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--ap-muted)" }} />
                      <input
                        placeholder="Rechercher…"
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
                        <SelectValue placeholder="Catégorie" />
                      </SelectTrigger>
                      <SelectContent style={selectContentStyle}>
                        {derivedCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat === "Tous" ? "Toutes catégories" : cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {extraToolbar}
                    <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
                      <SelectTrigger className="w-[150px]" style={triggerStyle}>
                        <SelectValue placeholder="Trier" />
                      </SelectTrigger>
                      <SelectContent style={selectContentStyle}>
                        <SelectItem value="newest">Plus récent</SelectItem>
                        <SelectItem value="oldest">Plus ancien</SelectItem>
                        <SelectItem value="az">A → Z</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => setViewMode("grid")} style={toggleBtnStyle(viewMode === "grid")} title="Vue grille"><LayoutGrid className="w-4 h-4" /></button>
                      <button onClick={() => setViewMode("list")} style={toggleBtnStyle(viewMode === "list")} title="Vue liste"><List className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}

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
    </AppLayout>
  );
}
