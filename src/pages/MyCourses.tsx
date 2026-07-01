import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pagination } from "@/components/Pagination";
import { getCurrentUser } from "@/lib/auth";
import {
  duplicateCourse,
  getFavoriteCourses,
  getPublicCourses,
  getTrashedCourses,
  getUserCourses,
  getCourseProgress,
  permanentlyDeleteCourse,
  purgeExpiredCourses,
  restoreCourse,
  toggleCourseFavorite,
  trashCourse,
  type Course,
} from "@/lib/courseStorage";
import { CourseContextMenu } from "@/components/CourseContextMenu";
import { DeleteQuizDialog } from "@/components/DeleteQuizDialog";
import { toast } from "sonner";
import {
  BookOpen,
  Clock,
  GraduationCap,
  LayoutGrid,
  List,
  Plus,
  RotateCcw,
  Search,
  Star,
  Trash2,
} from "lucide-react";

const VIEW_KEY = "view-mode-courses";

type SortOption = "newest" | "oldest" | "az";

const CATEGORIES = ["Tous", "Informatique", "Langues", "Sciences", "Histoire", "Arts", "Business", "Santé", "Autre"];

const triggerStyle = {
  fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: "14px",
  border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-sm)",
  background: "var(--ap-card)", color: "var(--ap-ink)", height: "42px",
};

const totalLessons = (course: Course) =>
  course.modules.reduce((s, m) => s + m.lessons.length, 0);

const daysRemaining = (deletedAt: string) =>
  Math.max(0, 30 - Math.floor((Date.now() - new Date(deletedAt).getTime()) / (1000 * 60 * 60 * 24)));

const MyCourses = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [myCourses, setMyCourses] = useState<Course[]>([]);
  const [favCourses, setFavCourses] = useState<Course[]>([]);
  const [pubCourses, setPubCourses] = useState<Course[]>([]);
  const [trashedCourses, setTrashedCourses] = useState<Course[]>([]);
  const [activeTab, setActiveTab] = useState("my");
  const [viewMode, setViewMode] = useState<"grid" | "list">(
    () => (localStorage.getItem(VIEW_KEY) as "grid" | "list") ?? "grid",
  );
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Tous");
  const [sort, setSort] = useState<SortOption>("newest");
  const [page, setPage] = useState(1);
  const [permDeleteTarget, setPermDeleteTarget] = useState<Course | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const setView = (mode: "grid" | "list") => {
    setViewMode(mode);
    localStorage.setItem(VIEW_KEY, mode);
  };

  const load = useCallback(() => {
    if (!user) return;
    purgeExpiredCourses(user.id);
    setMyCourses(getUserCourses(user.id));
    setFavCourses(getFavoriteCourses(user.id));
    setPubCourses(getPublicCourses());
    setTrashedCourses(getTrashedCourses(user.id));
  }, [user]);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    load();
  }, [user, navigate, load]);

  const handleTrash = (id: string) => {
    if (trashCourse(id)) { toast.success("Mis à la corbeille"); load(); }
  };

  const handleRestore = (id: string) => {
    if (restoreCourse(id)) { toast.success("Restauré"); load(); }
  };

  const handlePermDeleteClick = (c: Course) => { setPermDeleteTarget(c); setDeleteDialogOpen(true); };
  const handlePermDeleteConfirm = () => {
    if (permDeleteTarget && permanentlyDeleteCourse(permDeleteTarget.id)) {
      toast.success("Supprimé définitivement");
      load();
    }
    setDeleteDialogOpen(false);
    setPermDeleteTarget(null);
  };

  const handleToggleFavorite = (course: Course) => {
    const updated = toggleCourseFavorite(course.id);
    if (updated) {
      toast.success(updated.isFavorite ? "Ajouté aux favoris" : "Retiré des favoris");
      load();
    }
  };

  const handleDuplicate = (id: string) => {
    const copy = duplicateCourse(id);
    if (copy) { toast.success(`"${copy.title}" créé`); load(); }
  };

  const handleShare = (course: Course) => {
    const url = `${window.location.origin}/course/${course.id}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Lien copié !"),
      () => toast.error("Impossible de copier le lien"),
    );
  };

  const applyFilters = (items: Course[]) => {
    const q = search.toLowerCase();
    let result = items.filter((c) => {
      const matchSearch =
        !q || c.title.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q);
      const matchCat = category === "Tous" || c.category === category;
      return matchSearch && matchCat;
    });
    if (sort === "oldest") result = [...result].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    else if (sort === "az") result = [...result].sort((a, b) => a.title.localeCompare(b.title, "fr"));
    else result = [...result].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return result;
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

  const renderFilters = () => (
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
        <SelectTrigger className="w-[160px]" style={triggerStyle}><SelectValue placeholder="Catégorie" /></SelectTrigger>
        <SelectContent style={{ background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
          {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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

  const renderCourseCard = (course: Course, showActions = true) => {
    const progress = user ? getCourseProgress(course.id, user.id) : null;
    const total = totalLessons(course);
    const completed = progress?.completedLessonIds.length ?? 0;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
      <div
        key={course.id}
        className="ap-card ap-card--hover flex h-full cursor-pointer flex-col overflow-hidden"
        onClick={() => navigate(`/course/${course.id}`)}
      >
        {course.coverImage && (
          <div className="relative h-36 w-full overflow-hidden -mx-6 -mt-6 mb-4" style={{ width: "calc(100% + 48px)" }}>
            <img src={course.coverImage} alt={course.title} className="h-full w-full object-cover" />
          </div>
        )}
        <div className="flex flex-1 flex-col">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="ap-h3 line-clamp-2" style={{ fontSize: "15px" }}>{course.title}</h3>
              {course.description && (
                <p className="ap-muted mt-0.5 text-sm line-clamp-2">{course.description}</p>
              )}
            </div>
            {showActions && (
              <button
                onClick={(e) => { e.stopPropagation(); handleToggleFavorite(course); }}
                className="text-amber-400 hover:text-amber-500 transition-colors p-1 flex-shrink-0"
              >
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
            <span className="ap-pill" style={{ fontSize: "11px", padding: "3px 9px" }}>
              {course.modules.length} module{course.modules.length !== 1 ? "s" : ""}
            </span>
            <span className="ap-pill" style={{ fontSize: "11px", padding: "3px 9px" }}>
              {total} leçon{total !== 1 ? "s" : ""}
            </span>
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

          <div className="mt-auto flex items-center justify-between gap-2 pt-3" style={{ borderTop: "2px solid var(--ap-line)" }}>
            {showActions ? (
              <CourseContextMenu
                course={course}
                onEdit={() => navigate(`/course-builder?courseId=${course.id}`)}
                onDuplicate={() => handleDuplicate(course.id)}
                onToggleFavorite={() => handleToggleFavorite(course)}
                onShare={() => handleShare(course)}
                onTrash={() => handleTrash(course.id)}
              />
            ) : <span />}
            <button
              className="ap-btn ap-btn--sm ap-btn--pill"
              style={{ background: "var(--ap-brand)", color: "#fff", border: "none", gap: "6px", display: "flex", alignItems: "center" }}
              onClick={(e) => { e.stopPropagation(); navigate(`/course/${course.id}`); }}
            >
              <BookOpen className="h-3.5 w-3.5" />
              {progress && completed > 0 ? "Continuer" : "Commencer"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderCourseRow = (course: Course, showActions = true) => {
    const progress = user ? getCourseProgress(course.id, user.id) : null;
    const total = totalLessons(course);
    const completed = progress?.completedLessonIds.length ?? 0;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
      <div
        key={course.id}
        className="flex items-center gap-4 cursor-pointer px-4 py-3 transition-colors"
        style={{ borderBottom: "2px solid var(--ap-line)" }}
        onClick={() => navigate(`/course/${course.id}`)}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ap-paper-2)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <GraduationCap className="h-8 w-8 flex-shrink-0" style={{ color: "var(--ap-brand)" }} />
        <div className="flex-1 min-w-0">
          <p className="ap-h3 truncate" style={{ fontSize: "14px", marginBottom: "2px" }}>{course.title}</p>
          {course.description && (
            <p className="ap-muted truncate" style={{ fontSize: "12px" }}>{course.description}</p>
          )}
          {total > 0 && progress && (
            <div style={{ height: 3, background: "var(--ap-line)", borderRadius: 999, marginTop: 4, width: 120 }}>
              <div style={{ height: "100%", width: `${pct}%`, background: "var(--ap-brand)", borderRadius: 999 }} />
            </div>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
          <span className="ap-pill" style={{ fontSize: "11px", padding: "2px 8px" }}>
            {total} leçon{total !== 1 ? "s" : ""}
          </span>
          {total > 0 && (
            <span className="ap-pill" style={{ fontSize: "11px", padding: "2px 8px" }}>
              {pct}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {showActions && (
            <CourseContextMenu
              course={course}
              onEdit={() => navigate(`/course-builder?courseId=${course.id}`)}
              onDuplicate={() => handleDuplicate(course.id)}
              onToggleFavorite={() => handleToggleFavorite(course)}
              onShare={() => handleShare(course)}
              onTrash={() => handleTrash(course.id)}
            />
          )}
          <button
            className="ap-btn ap-btn--sm ap-btn--pill"
            style={{ background: "var(--ap-brand)", color: "#fff", border: "none", fontSize: "12px", padding: "4px 12px", display: "flex", alignItems: "center", gap: "4px" }}
            onClick={(e) => { e.stopPropagation(); navigate(`/course/${course.id}`); }}
          >
            <BookOpen className="h-3 w-3" />
            {progress && completed > 0 ? "Continuer" : "Commencer"}
          </button>
        </div>
      </div>
    );
  };

  const renderTabContent = (items: Course[], emptyMsg: string, ctaLabel?: string, showActions = true) => {
    const filtered = applyFilters(items);
    const PAGE_SIZE = 12;
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    if (items.length === 0) return (
      <div style={{ borderRadius: "var(--ap-r-lg)", border: "2px dashed var(--ap-line-2)", background: "var(--ap-paper-2)", padding: "48px 24px", textAlign: "center" }}>
        <GraduationCap className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--ap-muted)" }} />
        <p className="ap-muted" style={{ fontSize: "14px", marginBottom: ctaLabel ? "16px" : 0 }}>{emptyMsg}</p>
        {ctaLabel && (
          <button className="ap-btn ap-btn--sm ap-btn--pill" style={{ background: "var(--ap-brand)", color: "#fff", border: "none" }} onClick={() => navigate("/course-builder")}>
            {ctaLabel}
          </button>
        )}
      </div>
    );

    return (
      <>
        {renderFilters()}
        {paginated.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Aucun résultat pour cette recherche.</p>
        ) : viewMode === "grid" ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {paginated.map((c) => renderCourseCard(c, showActions))}
          </div>
        ) : (
          <div className="ap-card" style={{ padding: 0, overflow: "hidden" }}>
            {paginated.map((c) => renderCourseRow(c, showActions))}
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-8" />
      </>
    );
  };

  const renderTrash = () => {
    if (trashedCourses.length === 0) return (
      <div style={{ borderRadius: "var(--ap-r-lg)", border: "2px dashed var(--ap-line-2)", background: "var(--ap-paper-2)", padding: "48px 24px", textAlign: "center" }}>
        <Trash2 className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--ap-muted)" }} />
        <p className="ap-muted" style={{ fontSize: "14px" }}>La corbeille est vide.</p>
      </div>
    );

    return (
      <>
        <p className="ap-muted mb-5" style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
          <Clock className="h-3.5 w-3.5 flex-shrink-0" />
          Suppression automatique après 30 jours.
        </p>
        {viewMode === "grid" ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {trashedCourses.map((c) => {
              const days = daysRemaining(c.deletedAt!);
              return (
                <div key={c.id} className="ap-card flex flex-col" style={{ opacity: 0.8 }}>
                  <div className="flex-1 mb-3">
                    <h3 className="ap-h3 truncate" style={{ fontSize: "15px" }}>{c.title}</h3>
                    {c.description && <p className="ap-muted mt-1 text-sm line-clamp-2">{c.description}</p>}
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-3" style={{ borderTop: "2px solid var(--ap-line)" }}>
                    <span className="text-xs font-semibold" style={{ color: days <= 3 ? "var(--ap-quiz)" : "var(--ap-muted)" }}>
                      {days === 0 ? "Expire aujourd'hui" : `${days}j restants`}
                    </span>
                    <div className="flex gap-1 items-center">
                      <button onClick={() => handleRestore(c.id)} className="ap-btn ap-btn--ghost ap-btn--sm" style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
                        <RotateCcw className="h-3.5 w-3.5" /> Restaurer
                      </button>
                      <button onClick={() => handlePermDeleteClick(c)} className="ap-btn ap-btn--ghost ap-btn--sm" style={{ color: "var(--ap-quiz)", padding: "5px 7px" }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="ap-card" style={{ padding: 0, overflow: "hidden" }}>
            {trashedCourses.map((c) => {
              const days = daysRemaining(c.deletedAt!);
              return (
                <div key={c.id} className="flex items-center gap-4 px-4 py-3" style={{ borderBottom: "2px solid var(--ap-line)", opacity: 0.85 }}>
                  <div className="flex-1 min-w-0">
                    <p className="ap-h3 truncate" style={{ fontSize: "14px", marginBottom: "2px" }}>{c.title}</p>
                  </div>
                  <span className="text-xs font-semibold flex-shrink-0" style={{ color: days <= 3 ? "var(--ap-quiz)" : "var(--ap-muted)" }}>
                    {days === 0 ? "Expire aujourd'hui" : `${days}j restants`}
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => handleRestore(c.id)} className="ap-btn ap-btn--ghost ap-btn--sm" style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "12px" }}>
                      <RotateCcw className="h-3 w-3" /> Restaurer
                    </button>
                    <button onClick={() => handlePermDeleteClick(c)} className="ap-btn ap-btn--ghost ap-btn--sm" style={{ color: "var(--ap-quiz)", padding: "5px" }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  };

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <Header subtitle="Mes cours" />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="ap-h2" style={{ fontSize: "26px" }}>Mes cours</h1>
            <p className="ap-muted" style={{ fontSize: "14px" }}>Créez et gérez vos cours interactifs</p>
          </div>
          <button
            className="ap-btn ap-btn--sm ap-btn--pill"
            style={{ background: "var(--ap-brand)", color: "#fff", border: "none", gap: "6px", display: "flex", alignItems: "center" }}
            onClick={() => navigate("/course-builder")}
          >
            <Plus className="h-4 w-4" /> Nouveau cours
          </button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPage(1); }} className="space-y-4">
          <TabsList>
            <TabsTrigger value="my">{`Mes cours (${myCourses.length})`}</TabsTrigger>
            <TabsTrigger value="favorites">{`Favoris (${favCourses.length})`}</TabsTrigger>
            <TabsTrigger value="public">{`Publics (${pubCourses.length})`}</TabsTrigger>
            <TabsTrigger value="trash" className="flex items-center gap-1.5">
              <Trash2 className="h-3.5 w-3.5" />
              {`Corbeille${trashedCourses.length > 0 ? ` (${trashedCourses.length})` : ""}`}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="my">{renderTabContent(myCourses, "Aucun cours créé.", "Créer mon premier cours")}</TabsContent>
          <TabsContent value="favorites">{renderTabContent(favCourses, "Aucun cours en favoris.", undefined, true)}</TabsContent>
          <TabsContent value="public">{renderTabContent(pubCourses, "Aucun cours public.", undefined, false)}</TabsContent>
          <TabsContent value="trash">{renderTrash()}</TabsContent>
        </Tabs>
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

export default MyCourses;
