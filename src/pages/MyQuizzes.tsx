import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pagination } from "@/components/Pagination";
import { TrashView } from "@/components/TrashView";
import { DeleteQuizDialog } from "@/components/DeleteQuizDialog";
import { FolderExplorer } from "@/components/FolderExplorer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { FolderRow } from "@/lib/content/types";
import type { SavedQuiz } from "@/lib/quizStorage";
import { DndContext, useDraggable, type DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import {
  BarChart2,
  ChevronRight,
  FolderInput,
  FolderOpen,
  GripVertical,
  LayoutGrid,
  List,
  MoreHorizontal,
  Play,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { t } from "@/lib/i18n";
import { readSessionHistory } from "@/lib/sessionState";

const VIEW_KEY = "view-mode-quizzes";
const PAGE_SIZE = 12;

const triggerStyle = {
  fontFamily: "var(--ap-font-body)",
  fontWeight: 700,
  fontSize: "14px",
  border: "2px solid var(--ap-line)",
  borderRadius: "var(--ap-r-sm)",
  background: "var(--ap-card)",
  color: "var(--ap-ink)",
  height: "42px",
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

const gripStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "none",
  color: "var(--ap-muted)",
  cursor: "grab",
  touchAction: "none",
  padding: "2px",
  borderRadius: "4px",
  flexShrink: 0,
};

/** ⋯ menu: Move-to-folder submenu, Favorite toggle, Trash. */
const ItemMenu = ({
  d,
  folders,
  onMove,
  onFavorite,
  onTrash,
}: {
  d: ContentDisplay;
  folders: FolderRow[];
  onMove: (folderId: string | null) => void;
  onFavorite: () => void;
  onTrash: () => void;
}) => {
  const menuStyle = {
    minWidth: 188,
    border: "2px solid var(--ap-line)",
    background: "var(--ap-card)",
    borderRadius: "var(--ap-r-md)",
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "5px 7px" }} title="Actions">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" style={menuStyle} onClick={(e) => e.stopPropagation()}>
        {folders.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2 cursor-pointer text-sm">
              <FolderInput className="h-3.5 w-3.5" /> Déplacer vers
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent style={menuStyle}>
              {d.folderId && (
                <DropdownMenuItem onSelect={() => onMove(null)} className="flex items-center gap-2 cursor-pointer text-sm">
                  <FolderOpen className="h-3.5 w-3.5" /> Racine
                </DropdownMenuItem>
              )}
              {folders.map((f) => (
                <DropdownMenuItem
                  key={f.id}
                  onSelect={() => onMove(f.id)}
                  className="flex items-center gap-2 cursor-pointer text-sm"
                  disabled={d.folderId === f.id}
                >
                  {f.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        <DropdownMenuItem onSelect={onFavorite} className="flex items-center gap-2 cursor-pointer text-sm">
          <Star className="h-3.5 w-3.5" style={d.isFavorite ? { fill: "#fbbf24", color: "#fbbf24" } : {}} />
          {d.isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={onTrash}
          className="flex items-center gap-2 cursor-pointer text-sm"
          style={{ color: "var(--ap-quiz)" }}
        >
          <Trash2 className="h-3.5 w-3.5" /> Mettre à la corbeille
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

interface CardProps {
  d: ContentDisplay;
  folders: FolderRow[];
  navigate: ReturnType<typeof useNavigate>;
  onPlay: () => void;
  onMove: (folderId: string | null) => void;
  onFavorite: () => void;
  onTrash: () => void;
}

const questionCount = (d: ContentDisplay) => (d.data.questions as unknown[] | undefined)?.length ?? 0;
const headerImage = (d: ContentDisplay) => d.data.headerImage as string | undefined;
const quizId = (d: ContentDisplay) => String((d.data.id as string | undefined) ?? "");

const QuizCard = ({ d, folders, navigate, onPlay, onMove, onFavorite, onTrash }: CardProps) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: d.id });
  const img = headerImage(d);
  const qc = questionCount(d);
  const qid = quizId(d);
  const hasHistory = qid ? readSessionHistory(qid).length > 0 : false;

  return (
    <div
      ref={setNodeRef}
      className="ap-card ap-card--hover flex h-full cursor-pointer flex-col overflow-hidden"
      style={{ opacity: isDragging ? 0.4 : 1 }}
      onClick={() => navigate(`/builder?type=quiz&quizId=${qid}`)}
    >
      {img && (
        <div className="relative h-40 w-full overflow-hidden">
          <img src={img} alt={d.title} className="h-full w-full object-cover" />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-1.5 flex-1 min-w-0">
            <button
              type="button"
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              style={gripStyle}
              title="Déplacer"
              aria-label={`Déplacer ${d.title}`}
            >
              <GripVertical style={{ width: 14, height: 14 }} />
            </button>
            <div className="flex-1 min-w-0">
              <h3 className="ap-h3" style={{ fontSize: "15px" }}>{d.title}</h3>
              <p className="ap-muted mt-0.5 text-sm line-clamp-2">{d.description}</p>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onFavorite(); }}
            className="text-amber-400 hover:text-amber-500 transition-colors cursor-pointer p-1"
          >
            <Star className={`h-4 w-4 ${d.isFavorite ? "fill-amber-400" : ""}`} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {d.category && (
            <Badge variant="outline" className="rounded-full text-xs border-slate-200 text-slate-500">
              {d.category}
            </Badge>
          )}
          <span className="ap-pill" style={{ fontSize: "11px", padding: "3px 9px" }}>
            {qc} {qc > 1 ? t("questions") : t("question")}
          </span>
          {d.tags?.map((tag) => (
            <span key={tag} className="ap-pill" style={{ fontSize: "11px", padding: "3px 9px" }}>#{tag}</span>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3" style={{ borderTop: "2px solid var(--ap-line)" }}>
          <ItemMenu d={d} folders={folders} onMove={onMove} onFavorite={onFavorite} onTrash={onTrash} />
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
            {hasHistory && (
              <button
                onClick={() => navigate(`/quiz-results/${qid}`)}
                className="ap-btn ap-btn--ghost ap-btn--sm"
                style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: "4px" }}
              >
                <BarChart2 style={{ width: 13, height: 13 }} /> Résultats
              </button>
            )}
            <button
              onClick={() => navigate(`/exam-builder?quizId=${qid}`)}
              className="ap-btn ap-btn--ghost ap-btn--sm"
              style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: "4px" }}
              title="Créer un examen"
            >
              📝 Examen
            </button>
            <Button size="sm" onClick={onPlay} className="ap-btn ap-btn--sm ap-btn--pill ap-btn--quiz gap-1.5 px-4">
              <Play className="h-3.5 w-3.5" />{t("playQuiz")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const QuizRow = ({ d, folders, navigate, onPlay, onMove, onFavorite, onTrash }: CardProps) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: d.id });
  const img = headerImage(d);
  const qc = questionCount(d);
  const qid = quizId(d);
  const hasHistory = qid ? readSessionHistory(qid).length > 0 : false;

  return (
    <div
      ref={setNodeRef}
      className="flex items-center gap-4 cursor-pointer px-4 py-3 transition-colors"
      style={{ borderBottom: "2px solid var(--ap-line)", opacity: isDragging ? 0.4 : 1 }}
      onClick={() => navigate(`/builder?type=quiz&quizId=${qid}`)}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ap-paper-2)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        style={gripStyle}
        title="Déplacer"
        aria-label={`Déplacer ${d.title}`}
      >
        <GripVertical style={{ width: 14, height: 14 }} />
      </button>
      {img && <img src={img} alt={d.title} className="w-12 h-12 rounded object-cover flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="ap-h3 truncate" style={{ fontSize: "14px", marginBottom: "2px" }}>{d.title}</p>
        {d.description && <p className="ap-muted truncate" style={{ fontSize: "12px" }}>{d.description}</p>}
      </div>
      <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
        {d.category && (
          <Badge variant="outline" className="rounded-full text-xs border-slate-200 text-slate-500">
            {d.category}
          </Badge>
        )}
        <span className="ap-pill" style={{ fontSize: "11px", padding: "2px 8px" }}>
          {qc} {qc > 1 ? t("questions") : t("question")}
        </span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <ItemMenu d={d} folders={folders} onMove={onMove} onFavorite={onFavorite} onTrash={onTrash} />
        {hasHistory && (
          <button
            onClick={() => navigate(`/quiz-results/${qid}`)}
            className="ap-btn ap-btn--ghost ap-btn--sm"
            style={{ padding: "5px 8px", display: "flex", alignItems: "center", gap: "3px", fontSize: "12px" }}
          >
            <BarChart2 style={{ width: 13, height: 13 }} />
            <span className="hidden sm:inline">Résultats</span>
          </button>
        )}
        <button
          onClick={() => navigate(`/exam-builder?quizId=${qid}`)}
          className="ap-btn ap-btn--ghost ap-btn--sm"
          style={{ padding: "5px 8px", display: "flex", alignItems: "center", gap: "3px", fontSize: "12px" }}
          title="Créer un examen"
        >
          📝 <span className="hidden sm:inline">Examen</span>
        </button>
        <Button size="sm" onClick={onPlay} className="ap-btn ap-btn--sm ap-btn--pill ap-btn--quiz gap-1 px-3" style={{ fontSize: "12px" }}>
          <Play className="h-3 w-3" />{t("playQuiz")}
        </Button>
      </div>
    </div>
  );
};

const MyQuizzes = () => {
  const navigate = useNavigate();
  const c = useContentCollection("quiz");

  const [activeTab, setActiveTab] = useState("my");
  const [viewMode, setViewMode] = useState<"grid" | "list">(
    () => (localStorage.getItem(VIEW_KEY) as "grid" | "list") ?? "grid",
  );
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Tous");
  const [sort, setSort] = useState<SortOption>("newest");
  const [page, setPage] = useState(1);
  const [permDeleteTarget, setPermDeleteTarget] = useState<ContentDisplay | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const setView = (mode: "grid" | "list") => {
    setViewMode(mode);
    localStorage.setItem(VIEW_KEY, mode);
  };

  const display = useMemo(() => c.items.map(toDisplay), [c.items]);
  const active = useMemo(() => filterActive(display), [display]);
  const trashed = useMemo(() => filterTrashed(display), [display]);
  const favorites = useMemo(
    () => applySearchSort(filterFavorites(display), { search, category, sort }),
    [display, search, category, sort],
  );
  const publicDisplay = useMemo(
    () => applySearchSort(c.publicItems.map(toDisplay), { search, category, sort }),
    [c.publicItems, search, category, sort],
  );

  // Direct active-item count per folderId (badge on the explorer).
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of active) {
      if (item.folderId) counts[item.folderId] = (counts[item.folderId] ?? 0) + 1;
    }
    return counts;
  }, [active]);

  const categories = useMemo(() => {
    const cats = new Set(active.map((i) => i.category).filter(Boolean));
    return ["Tous", ...Array.from(cats).sort()];
  }, [active]);

  const visible = useMemo(
    () => applySearchSort(filterByFolder(active, c.currentFolderId), { search, category, sort }),
    [active, c.currentFolderId, search, category, sort],
  );

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const paginated = visible.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  // Breadcrumb path from currentFolderId up the parent chain.
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

  const handlePlay = (d: ContentDisplay) => {
    const quiz = d.data as unknown as SavedQuiz;
    const id = quizId(d);
    if (!id) { toast.error("Quiz introuvable"); return; }
    localStorage.setItem(`quiz-${id}`, JSON.stringify(quiz));
    navigate(`/quiz/${id}`);
  };

  const handleMove = (rowId: string, folderId: string | null) => {
    c.moveContent(rowId, folderId)
      .then(() => toast.success("Déplacé"))
      .catch(() => toast.error("Erreur lors du déplacement"));
  };

  const handleFavorite = (d: ContentDisplay) => {
    c.toggleFavorite(d.id)
      .then(() => toast.success(d.isFavorite ? t("removedFromFavorites") : t("addedToFavorites")))
      .catch(() => toast.error("Erreur"));
  };

  const handleTrash = (rowId: string) => {
    c.trashItem(rowId)
      .then(() => toast.success("Mis à la corbeille"))
      .catch(() => toast.error("Erreur"));
  };

  const handleRestore = (rowId: string) => {
    c.restoreItem(rowId)
      .then(() => toast.success("Restauré"))
      .catch(() => toast.error("Erreur"));
  };

  const handlePermDeleteConfirm = () => {
    if (permDeleteTarget) {
      c.removeItem(permDeleteTarget.id)
        .then(() => toast.success("Supprimé définitivement"))
        .catch(() => toast.error("Erreur"));
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

  const cardProps = (d: ContentDisplay): CardProps => ({
    d,
    folders: c.folders,
    navigate,
    onPlay: () => handlePlay(d),
    onMove: (folderId) => handleMove(d.id, folderId),
    onFavorite: () => handleFavorite(d),
    onTrash: () => handleTrash(d.id),
  });

  const toolbar = (
    <div className="flex flex-col sm:flex-row gap-3 mb-5">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--ap-muted)" }} />
        <input
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{
            width: "100%", padding: "10px 14px 10px 38px",
            fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: "14px",
            color: "var(--ap-ink)", background: "var(--ap-card)",
            border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-sm)",
            outline: "none", boxSizing: "border-box" as const,
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--ap-brand)"; e.currentTarget.style.boxShadow = "0 0 0 4px var(--ap-brand-soft)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--ap-line)"; e.currentTarget.style.boxShadow = "none"; }}
        />
      </div>
      <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
        <SelectTrigger className="w-[160px]" style={triggerStyle}>
          <SelectValue placeholder="Catégorie" />
        </SelectTrigger>
        <SelectContent style={{ background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
          {categories.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
        <SelectTrigger className="w-[150px]" style={triggerStyle}>
          <SelectValue placeholder="Trier" />
        </SelectTrigger>
        <SelectContent style={{ background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
          <SelectItem value="newest">Plus récent</SelectItem>
          <SelectItem value="oldest">Plus ancien</SelectItem>
          <SelectItem value="az">A → Z</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex gap-1 flex-shrink-0">
        <button onClick={() => setView("grid")} style={toggleBtnStyle(viewMode === "grid")} title="Vue grille"><LayoutGrid className="w-4 h-4" /></button>
        <button onClick={() => setView("list")} style={toggleBtnStyle(viewMode === "list")} title="Vue liste"><List className="w-4 h-4" /></button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <Header subtitle={t("myQuizzes")} />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="ap-h2" style={{ fontSize: "26px" }}>{t("myQuizzes")}</h1>
            <p className="ap-muted" style={{ fontSize: "14px" }}>{t("myQuizzesSubtitle")}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => navigate("/my-exams")}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 999, border: "2px solid var(--ap-line)", background: "var(--ap-paper-2)", fontFamily: "var(--ap-font-body)", fontWeight: 800, fontSize: 13, color: "var(--ap-ink)", cursor: "pointer" }}
            >
              📝 Examens
            </button>
            <button className="ap-btn ap-btn--sm ap-btn--pill ap-btn--quiz" onClick={() => navigate("/builder-start?type=quiz")}>{t("createQuizCta")}</button>
          </div>
        </div>

        {c.error && (
          <div style={{ borderRadius: "var(--ap-r-md)", border: "2px solid var(--ap-quiz)", background: "var(--ap-paper-2)", padding: "16px", marginBottom: "16px", color: "var(--ap-quiz)", fontWeight: 700 }}>
            {c.error}
          </div>
        )}

        <DndContext onDragEnd={handleDragEnd}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="my">{`${t("myQuizzesTab")} (${active.length})`}</TabsTrigger>
              <TabsTrigger value="favorites">{`Favoris (${favorites.length})`}</TabsTrigger>
              <TabsTrigger value="public">{`Quiz publics (${publicDisplay.length})`}</TabsTrigger>
              <TabsTrigger value="trash" className="flex items-center gap-1.5">
                <Trash2 className="h-3.5 w-3.5" />
                {`Corbeille${trashed.length > 0 ? ` (${trashed.length})` : ""}`}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="my">
              <div className="flex flex-col md:flex-row gap-6">
                <aside className="md:w-64 md:flex-shrink-0">
                  <div className="ap-card" style={{ padding: "12px" }}>
                    <FolderExplorer
                      tree={c.tree}
                      currentFolderId={c.currentFolderId}
                      storageKey="explorer-expanded-quiz"
                      counts={folderCounts}
                      onNavigate={(id) => { c.setCurrentFolderId(id); setPage(1); }}
                      onCreate={(pid, name) => c.createFolder(pid, name)}
                      onRename={c.renameFolder}
                      onDelete={c.deleteFolder}
                      onMoveFolder={c.moveFolder}
                    />
                  </div>
                </aside>

                <div className="flex-1 min-w-0">
                  {/* Breadcrumb */}
                  <div className="flex items-center gap-1 flex-wrap mb-4" style={{ fontSize: "14px" }}>
                    <button
                      className="ap-btn ap-btn--ghost ap-btn--sm"
                      style={{ padding: "2px 6px", fontWeight: 700 }}
                      onClick={() => { c.setCurrentFolderId(null); setPage(1); }}
                    >
                      Tous
                    </button>
                    {breadcrumb.map((f) => (
                      <span key={f.id} className="flex items-center gap-1">
                        <ChevronRight className="h-4 w-4" style={{ color: "var(--ap-muted)" }} />
                        <button
                          className="ap-btn ap-btn--ghost ap-btn--sm"
                          style={{ padding: "2px 6px", fontWeight: 700, color: f.id === c.currentFolderId ? "var(--ap-brand)" : "var(--ap-ink)" }}
                          onClick={() => { c.setCurrentFolderId(f.id); setPage(1); }}
                        >
                          {f.name}
                        </button>
                      </span>
                    ))}
                  </div>

                  {toolbar}

                  {c.loading ? (
                    <p className="py-10 text-center text-sm text-slate-400">Chargement…</p>
                  ) : paginated.length === 0 ? (
                    <div style={{ borderRadius: "var(--ap-r-lg)", border: "2px dashed var(--ap-line-2)", background: "var(--ap-paper-2)", padding: "48px 24px", textAlign: "center" }}>
                      <p className="ap-muted" style={{ fontSize: "14px", marginBottom: "16px" }}>
                        {search || category !== "Tous"
                          ? "Aucun résultat pour cette recherche."
                          : c.currentFolderId
                          ? "Aucun quiz dans ce dossier."
                          : t("noQuizzesSaved")}
                      </p>
                      {!search && category === "Tous" && !c.currentFolderId && (
                        <button className="ap-btn ap-btn--sm ap-btn--pill" onClick={() => navigate("/builder-start?type=quiz")}>{t("createQuizCta")}</button>
                      )}
                    </div>
                  ) : viewMode === "grid" ? (
                    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                      {paginated.map((d) => <QuizCard key={d.id} {...cardProps(d)} />)}
                    </div>
                  ) : (
                    <div className="ap-card" style={{ padding: 0, overflow: "hidden" }}>
                      {paginated.map((d) => <QuizRow key={d.id} {...cardProps(d)} />)}
                    </div>
                  )}

                  <Pagination page={clampedPage} totalPages={totalPages} onPageChange={setPage} className="mt-8" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="favorites">
              {favorites.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">Aucun favori.</p>
              ) : viewMode === "grid" ? (
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {favorites.map((d) => <QuizCard key={d.id} {...cardProps(d)} />)}
                </div>
              ) : (
                <div className="ap-card" style={{ padding: 0, overflow: "hidden" }}>
                  {favorites.map((d) => <QuizRow key={d.id} {...cardProps(d)} />)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="public">
              {publicDisplay.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">Aucun quiz public.</p>
              ) : viewMode === "grid" ? (
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {publicDisplay.map((d) => <QuizCard key={d.id} {...cardProps(d)} />)}
                </div>
              ) : (
                <div className="ap-card" style={{ padding: 0, overflow: "hidden" }}>
                  {publicDisplay.map((d) => <QuizRow key={d.id} {...cardProps(d)} />)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="trash">
              <TrashView
                items={trashed as unknown as SavedQuiz[]}
                viewMode={viewMode}
                onRestore={handleRestore}
                onPermanentDelete={(item) => { setPermDeleteTarget(item as unknown as ContentDisplay); setDeleteDialogOpen(true); }}
              />
            </TabsContent>
          </Tabs>
        </DndContext>
      </div>

      <DeleteQuizDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handlePermDeleteConfirm}
        title={permDeleteTarget?.title || ""}
        type="quiz"
      />
    </div>
  );
};

export default MyQuizzes;
