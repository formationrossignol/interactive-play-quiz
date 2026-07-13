import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { CourseGeneratorModal } from "@/components/CourseGeneratorModal";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pagination } from "@/components/Pagination";
import { getCurrentUser } from "@/lib/auth";
import { getCourseProgress, type Course } from "@/lib/courseStorage";
import { CourseContextMenu } from "@/components/CourseContextMenu";
import { DeleteQuizDialog } from "@/components/DeleteQuizDialog";
import { toast } from "sonner";
import { DndContext, useDraggable, type DragEndEvent } from "@dnd-kit/core";
import { useContentCollection } from "@/hooks/useContentCollection";
import { FolderExplorer } from "@/components/FolderExplorer";
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
import type { ContentRow, FolderRow } from "@/lib/content/types";
import {
  BookOpen,
  ChevronRight,
  Clock,
  GraduationCap,
  GripVertical,
  LayoutGrid,
  List,
  Plus,
  RotateCcw,
  Star,
  Trash2,
} from "lucide-react";

const VIEW_KEY = "view-mode-courses";
const PAGE_SIZE = 12;
const CATEGORIES = ["Tous", "Informatique", "Langues", "Sciences", "Histoire", "Arts", "Business", "Santé", "Autre"];

const triggerStyle = {
  fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: "14px",
  border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-sm)",
  background: "var(--ap-card)", color: "var(--ap-ink)", height: "42px",
};

const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: "8px",
  background: active ? "var(--ap-brand-soft)" : "transparent",
  color: active ? "var(--ap-brand)" : "var(--ap-muted)",
  border: `2px solid ${active ? "var(--ap-brand)" : "var(--ap-line)"}`,
  borderRadius: "var(--ap-r-sm)", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
});

const gripStyle: React.CSSProperties = {
  cursor: "grab", color: "var(--ap-muted)", display: "flex", alignItems: "center",
  touchAction: "none", flexShrink: 0,
};

const totalLessons = (course: Course) => course.modules.reduce((s, m) => s + m.lessons.length, 0);
const daysRemaining = (deletedAt: string) =>
  Math.max(0, 30 - Math.floor((Date.now() - new Date(deletedAt).getTime()) / (1000 * 60 * 60 * 24)));

interface CardActions {
  row: ContentRow;
  userId: string | undefined;
  navigate: ReturnType<typeof useNavigate>;
  showActions: boolean;
  onEdit: (course: Course) => void;
  onToggleFavorite: (row: ContentRow) => void;
  onShare: (course: Course) => void;
  onTrash: (id: string) => void;
}

function CourseCard({ row, userId, navigate, showActions, onEdit, onToggleFavorite, onShare, onTrash }: CardActions) {
  const course = row.data as unknown as Course;
  const progress = userId ? getCourseProgress(course.id, userId) : null;
  const total = totalLessons(course);
  const completed = progress?.completedLessonIds.length ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const { attributes, listeners, setNodeRef } = useDraggable({ id: row.id });

  return (
    <div ref={setNodeRef} className="ap-card ap-card--hover flex h-full cursor-pointer flex-col overflow-hidden" onClick={() => navigate(`/course/${course.id}`)}>
      {course.coverImage && (
        <div className="relative h-36 w-full overflow-hidden -mx-6 -mt-6 mb-4" style={{ width: "calc(100% + 48px)" }}>
          <img src={course.coverImage} alt={course.title} className="h-full w-full object-cover" />
        </div>
      )}
      <div className="flex flex-1 flex-col">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {showActions && (
              <span {...attributes} {...listeners} style={gripStyle} onClick={(e) => e.stopPropagation()}>
                <GripVertical className="h-4 w-4" />
              </span>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="ap-h3 line-clamp-2" style={{ fontSize: "15px" }}>{course.title}</h3>
              {course.description && <p className="ap-muted mt-0.5 text-sm line-clamp-2">{course.description}</p>}
            </div>
          </div>
          {showActions && (
            <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(row); }} className="text-amber-400 hover:text-amber-500 transition-colors p-1 flex-shrink-0">
              <Star className={`h-4 w-4 ${course.isFavorite ? "fill-amber-400" : ""}`} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <Badge variant="outline" className={`rounded-full text-xs ${course.isPublic ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500"}`}>
            {course.isPublic ? "Public" : "Privé"}
          </Badge>
          {course.category && course.category !== "Autre" && (
            <span className="ap-pill" style={{ fontSize: "11px", padding: "3px 9px" }}>{course.category}</span>
          )}
          <span className="ap-pill" style={{ fontSize: "11px", padding: "3px 9px" }}>{course.modules.length} module{course.modules.length !== 1 ? "s" : ""}</span>
          <span className="ap-pill" style={{ fontSize: "11px", padding: "3px 9px" }}>{total} leçon{total !== 1 ? "s" : ""}</span>
        </div>

        {total > 0 && progress && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs" style={{ color: "var(--ap-muted)" }}>{pct}% terminé</span>
              <span className="text-xs" style={{ color: "var(--ap-muted)" }}>{completed}/{total}</span>
            </div>
            <div style={{ height: 4, background: "var(--ap-line)", borderRadius: 999 }}>
              <div style={{ height: "100%", width: `${pct}%`, background: "var(--ap-brand)", borderRadius: 999, transition: "width 0.3s" }} />
            </div>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-3" style={{ borderTop: "2px solid var(--ap-line)" }} onClick={(e) => e.stopPropagation()}>
          {showActions ? (
            <CourseContextMenu
              course={course}
              onEdit={() => onEdit(course)}
              onDuplicate={() => toast.info("Duplication bientôt disponible")}
              onToggleFavorite={() => onToggleFavorite(row)}
              onShare={() => onShare(course)}
              onTrash={() => onTrash(row.id)}
            />
          ) : <span />}
          <button className="ap-btn ap-btn--sm ap-btn--pill" style={{ background: "var(--ap-brand)", color: "#fff", border: "none", gap: "6px", display: "flex", alignItems: "center" }} onClick={(e) => { e.stopPropagation(); navigate(`/course/${course.id}`); }}>
            <BookOpen className="h-3.5 w-3.5" />
            {progress && completed > 0 ? "Continuer" : "Commencer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CourseRow({ row, userId, navigate, showActions, onEdit, onToggleFavorite, onShare, onTrash }: CardActions) {
  const course = row.data as unknown as Course;
  const progress = userId ? getCourseProgress(course.id, userId) : null;
  const total = totalLessons(course);
  const completed = progress?.completedLessonIds.length ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const { attributes, listeners, setNodeRef } = useDraggable({ id: row.id });

  return (
    <div ref={setNodeRef} className="flex items-center gap-4 cursor-pointer px-4 py-3 transition-colors" style={{ borderBottom: "2px solid var(--ap-line)" }} onClick={() => navigate(`/course/${course.id}`)}>
      {showActions && (
        <span {...attributes} {...listeners} style={gripStyle} onClick={(e) => e.stopPropagation()}>
          <GripVertical className="h-4 w-4" />
        </span>
      )}
      <GraduationCap className="h-8 w-8 flex-shrink-0" style={{ color: "var(--ap-brand)" }} />
      <div className="flex-1 min-w-0">
        <p className="ap-h3 truncate" style={{ fontSize: "14px", marginBottom: "2px" }}>{course.title}</p>
        {course.description && <p className="ap-muted truncate" style={{ fontSize: "12px" }}>{course.description}</p>}
        {total > 0 && progress && (
          <div style={{ height: 3, background: "var(--ap-line)", borderRadius: 999, marginTop: 4, width: 120 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "var(--ap-brand)", borderRadius: 999 }} />
          </div>
        )}
      </div>
      <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
        <span className="ap-pill" style={{ fontSize: "11px", padding: "2px 8px" }}>{total} leçon{total !== 1 ? "s" : ""}</span>
        {total > 0 && <span className="ap-pill" style={{ fontSize: "11px", padding: "2px 8px" }}>{pct}%</span>}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        {showActions && (
          <CourseContextMenu
            course={course}
            onEdit={() => onEdit(course)}
            onDuplicate={() => toast.info("Duplication bientôt disponible")}
            onToggleFavorite={() => onToggleFavorite(row)}
            onShare={() => onShare(course)}
            onTrash={() => onTrash(row.id)}
          />
        )}
        <button className="ap-btn ap-btn--sm ap-btn--pill" style={{ background: "var(--ap-brand)", color: "#fff", border: "none", fontSize: "12px", padding: "4px 12px", display: "flex", alignItems: "center", gap: "4px" }} onClick={(e) => { e.stopPropagation(); navigate(`/course/${course.id}`); }}>
          <BookOpen className="h-3 w-3" />
          {progress && completed > 0 ? "Continuer" : "Commencer"}
        </button>
      </div>
    </div>
  );
}

const MyCourses = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const c = useContentCollection("course");

  const [activeTab, setActiveTab] = useState("my");
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => (localStorage.getItem(VIEW_KEY) as "grid" | "list") ?? "grid");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Tous");
  const [sort, setSort] = useState<SortOption>("newest");
  const [page, setPage] = useState(1);
  const [permDeleteTarget, setPermDeleteTarget] = useState<ContentDisplay | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);

  const setView = (mode: "grid" | "list") => { setViewMode(mode); localStorage.setItem(VIEW_KEY, mode); };

  const display = useMemo(() => c.items.map(toDisplay), [c.items]);
  const active = useMemo(() => filterActive(display), [display]);
  const trashed = useMemo(() => filterTrashed(display), [display]);
  const favorites = useMemo(() => applySearchSort(filterFavorites(display), { search, category, sort }), [display, search, category, sort]);
  const publicDisplay = useMemo(() => applySearchSort(c.publicItems.map(toDisplay), { search, category, sort }), [c.publicItems, search, category, sort]);
  const visible = useMemo(() => applySearchSort(filterByFolder(active, c.currentFolderId), { search, category, sort }), [active, c.currentFolderId, search, category, sort]);

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of active) if (item.folderId) counts[item.folderId] = (counts[item.folderId] ?? 0) + 1;
    return counts;
  }, [active]);

  const breadcrumb = useMemo(() => {
    const path: FolderRow[] = [];
    let id = c.currentFolderId;
    const byId = new Map(c.folders.map((f) => [f.id, f]));
    while (id) { const f = byId.get(id); if (!f) break; path.unshift(f); id = f.parent_id; }
    return path;
  }, [c.currentFolderId, c.folders]);

  const rowById = useMemo(() => new Map(c.items.map((r) => [r.id, r])), [c.items]);
  const byId = (d: ContentDisplay) => rowById.get(d.id)!;

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const paginated = visible.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const handleEdit = (course: Course) => navigate(`/course-builder?courseId=${course.id}`);
  const handleShare = (course: Course) => {
    navigator.clipboard.writeText(`${window.location.origin}/course/${course.id}`).then(
      () => toast.success("Lien copié !"),
      () => toast.error("Impossible de copier le lien"),
    );
  };
  const handleToggleFavorite = (row: ContentRow) => { c.toggleFavorite(row.id); };
  const handleTrash = (id: string) => { c.trashItem(id).then(() => toast.success("Mis à la corbeille")); };
  const handleRestore = (id: string) => { c.restoreItem(id).then(() => toast.success("Restauré")); };
  const handlePermDeleteConfirm = () => {
    if (permDeleteTarget) c.removeItem(permDeleteTarget.id).then(() => toast.success("Supprimé définitivement"));
    setDeleteDialogOpen(false);
    setPermDeleteTarget(null);
  };

  const cardActions = (row: ContentRow, showActions: boolean): CardActions => ({
    row, userId: user?.id, navigate, showActions,
    onEdit: handleEdit, onToggleFavorite: handleToggleFavorite, onShare: handleShare, onTrash: handleTrash,
  });

  const handleDragEnd = (e: DragEndEvent) => {
    const over = e.over ? String(e.over.id) : null;
    if (!over || !over.startsWith("folder:")) return;
    const target = over === "folder:root" ? null : over.slice("folder:".length);
    const active = String(e.active.id);
    if (active.startsWith("movefolder:")) c.moveFolder(active.slice("movefolder:".length), target).catch(() => toast.error("Déplacement impossible (cycle)"));
    else c.moveContent(active, target);
  };

  if (!user) { navigate("/auth"); return null; }

  const renderFlatGrid = (items: ContentDisplay[], showActions: boolean, empty: string) =>
    items.length === 0 ? (
      <p className="py-10 text-center text-sm text-slate-400">{empty}</p>
    ) : viewMode === "grid" ? (
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map((d) => <CourseCard key={d.id} {...cardActions(byId(d), showActions)} />)}
      </div>
    ) : (
      <div className="ap-card" style={{ padding: 0, overflow: "hidden" }}>
        {items.map((d) => <CourseRow key={d.id} {...cardActions(byId(d), showActions)} />)}
      </div>
    );

  const toolbar = (
    <div className="flex flex-col sm:flex-row gap-3 mb-5">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--ap-muted)" }} />
        <input
          placeholder="Rechercher..." value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ width: "100%", padding: "10px 14px 10px 38px", fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: "14px", color: "var(--ap-ink)", background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-sm)", outline: "none", boxSizing: "border-box" }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--ap-brand)"; e.currentTarget.style.boxShadow = "0 0 0 4px var(--ap-brand-soft)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--ap-line)"; e.currentTarget.style.boxShadow = "none"; }}
        />
      </div>
      <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
        <SelectTrigger className="w-[160px]" style={triggerStyle}><SelectValue placeholder="Catégorie" /></SelectTrigger>
        <SelectContent style={{ background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
          {CATEGORIES.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={sort} onValueChange={(v) => { setSort(v as SortOption); setPage(1); }}>
        <SelectTrigger className="w-[150px]" style={triggerStyle}><SelectValue placeholder="Trier" /></SelectTrigger>
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
      <Header subtitle="Mes cours" />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="ap-h2" style={{ fontSize: "26px" }}>Mes cours</h1>
            <p className="ap-muted" style={{ fontSize: "14px" }}>Créez et gérez vos cours interactifs</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="ap-btn ap-btn--sm ap-btn--pill" style={{ background: "var(--ap-flash)", color: "var(--ap-ink)", border: "none", boxShadow: "0 4px 0 var(--ap-flash-deep)", gap: "6px", display: "flex", alignItems: "center", fontWeight: 800 }} onClick={() => setGeneratorOpen(true)}>
              ✨ Générer depuis un fichier
            </button>
            <button className="ap-btn ap-btn--sm ap-btn--pill" style={{ background: "var(--ap-brand)", color: "#fff", border: "none", gap: "6px", display: "flex", alignItems: "center" }} onClick={() => navigate("/course-builder")}>
              <Plus className="h-4 w-4" /> Nouveau cours
            </button>
          </div>
        </div>

        {c.error && (
          <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: "var(--ap-r-sm)", background: "#fff3f0", color: "#ff5a4d", fontWeight: 700, fontSize: 13 }}>{c.error}</div>
        )}

        <DndContext onDragEnd={handleDragEnd}>
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPage(1); }} className="space-y-4">
            <TabsList>
              <TabsTrigger value="my">{`Mes cours (${active.length})`}</TabsTrigger>
              <TabsTrigger value="favorites">{`Favoris (${favorites.length})`}</TabsTrigger>
              <TabsTrigger value="public">{`Publics (${publicDisplay.length})`}</TabsTrigger>
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
                      storageKey="explorer-expanded-course"
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
                  <div className="flex items-center gap-1 flex-wrap mb-4" style={{ fontSize: "14px" }}>
                    <button className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "2px 6px", fontWeight: 700 }} onClick={() => { c.setCurrentFolderId(null); setPage(1); }}>Tous</button>
                    {breadcrumb.map((f) => (
                      <span key={f.id} className="flex items-center gap-1">
                        <ChevronRight className="h-4 w-4" style={{ color: "var(--ap-muted)" }} />
                        <button className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "2px 6px", fontWeight: 700, color: f.id === c.currentFolderId ? "var(--ap-brand)" : "var(--ap-ink)" }} onClick={() => { c.setCurrentFolderId(f.id); setPage(1); }}>{f.name}</button>
                      </span>
                    ))}
                  </div>
                  {toolbar}
                  {c.loading ? (
                    <p className="py-10 text-center text-sm text-slate-400">Chargement…</p>
                  ) : paginated.length === 0 ? (
                    <div style={{ borderRadius: "var(--ap-r-lg)", border: "2px dashed var(--ap-line-2)", background: "var(--ap-paper-2)", padding: "48px 24px", textAlign: "center" }}>
                      <GraduationCap className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--ap-muted)" }} />
                      <p className="ap-muted" style={{ fontSize: "14px", marginBottom: "16px" }}>
                        {search || category !== "Tous" ? "Aucun résultat pour cette recherche." : c.currentFolderId ? "Aucun cours dans ce dossier." : "Aucun cours créé."}
                      </p>
                      {!search && category === "Tous" && !c.currentFolderId && (
                        <button className="ap-btn ap-btn--sm ap-btn--pill" style={{ background: "var(--ap-brand)", color: "#fff", border: "none" }} onClick={() => navigate("/course-builder")}>Créer mon premier cours</button>
                      )}
                    </div>
                  ) : (
                    renderFlatGrid(paginated, true, "Aucun résultat.")
                  )}
                  <Pagination page={clampedPage} totalPages={totalPages} onPageChange={setPage} className="mt-8" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="favorites">{renderFlatGrid(favorites, true, "Aucun cours en favoris.")}</TabsContent>
            <TabsContent value="public">{renderFlatGrid(publicDisplay, false, "Aucun cours public.")}</TabsContent>

            <TabsContent value="trash">
              {trashed.length === 0 ? (
                <div style={{ borderRadius: "var(--ap-r-lg)", border: "2px dashed var(--ap-line-2)", background: "var(--ap-paper-2)", padding: "48px 24px", textAlign: "center" }}>
                  <Trash2 className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--ap-muted)" }} />
                  <p className="ap-muted" style={{ fontSize: "14px" }}>La corbeille est vide.</p>
                </div>
              ) : (
                <>
                  <p className="ap-muted mb-5" style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Clock className="h-3.5 w-3.5 flex-shrink-0" /> Suppression automatique après 30 jours.
                  </p>
                  <div className={viewMode === "grid" ? "grid gap-5 md:grid-cols-2 lg:grid-cols-3" : "ap-card"} style={viewMode === "grid" ? undefined : { padding: 0, overflow: "hidden" }}>
                    {trashed.map((d) => {
                      const days = d.deletedAt ? daysRemaining(d.deletedAt) : 0;
                      return (
                        <div key={d.id} className={viewMode === "grid" ? "ap-card flex flex-col" : "flex items-center gap-4 px-4 py-3"} style={viewMode === "grid" ? { opacity: 0.8 } : { borderBottom: "2px solid var(--ap-line)", opacity: 0.85 }}>
                          <div className="flex-1 min-w-0 mb-2">
                            <p className="ap-h3 truncate" style={{ fontSize: "14px" }}>{d.title}</p>
                          </div>
                          <span className="text-xs font-semibold flex-shrink-0" style={{ color: days <= 3 ? "var(--ap-quiz)" : "var(--ap-muted)" }}>
                            {days === 0 ? "Expire aujourd'hui" : `${days}j restants`}
                          </span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => handleRestore(d.id)} className="ap-btn ap-btn--ghost ap-btn--sm" style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "12px" }}>
                              <RotateCcw className="h-3.5 w-3.5" /> Restaurer
                            </button>
                            <button onClick={() => { setPermDeleteTarget(d); setDeleteDialogOpen(true); }} className="ap-btn ap-btn--ghost ap-btn--sm" style={{ color: "var(--ap-quiz)", padding: "5px 7px" }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
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

      <CourseGeneratorModal open={generatorOpen} onClose={() => { setGeneratorOpen(false); c.reload(); }} />
    </div>
  );
};

export default MyCourses;
