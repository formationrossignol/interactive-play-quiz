import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Breadcrumb } from "@/components/Breadcrumb";
import RichTextEditor from "@/components/RichTextEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getCurrentUser } from "@/lib/auth";
import {
  createCourse,
  getCourseById,
  getUserCourses,
  genId,
  updateCourse,
  type Course,
  type Lesson,
  type Module,
} from "@/lib/courseStorage";
import { getUserQuizzes, getUserFlashcardSets } from "@/lib/quizStorage";
import { assertSafeImportFile } from "@/lib/fileValidation";
import { CONTENT_CAPS, getPlan, PlanLimitError } from "@/lib/plans";
import { PlanLimitBlocker } from "@/components/PlanLimitBlocker";
import {
  getContent,
  getContentBySource,
  getContentBySourceAnyOwner,
  updateCollaborativeContent,
  upsertContentBySource,
} from "@/lib/content/contentRepo";
import type { ContentRow } from "@/lib/content/types";
import { toast } from "sonner";
import { useSaveShortcut } from "@/hooks/useSaveShortcut";
import {
  BarChart2,
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  Globe,
  GraduationCap,
  Layers,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Info,
  Upload,
  Video,
  X,
} from "lucide-react";
import { CollaboratorsButton } from "@/components/CollaboratorsButton";

const extractYouTubeId = (url: string): string | null => {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
};

const CATEGORIES = ["Autre", "Informatique", "Langues", "Sciences", "Histoire", "Arts", "Business", "Santé"];

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  fontFamily: "var(--ap-font-body)",
  fontWeight: 600,
  fontSize: "14px",
  color: "var(--ap-ink)",
  background: "var(--ap-card)",
  border: "var(--ap-border-w) solid var(--ap-line)",
  borderRadius: "var(--ap-r-sm)",
  outline: "none",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  fontFamily: "var(--ap-font-body)",
  fontWeight: 700,
  fontSize: "14px",
  border: "var(--ap-border-w) solid var(--ap-line)",
  borderRadius: "var(--ap-r-sm)",
  background: "var(--ap-card)",
  color: "var(--ap-ink)",
  height: "42px",
};

const fieldLabel = (text: string) => (
  <label className="ap-muted" style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>
    {text}
  </label>
);

type SelectedItem =
  | { type: "info" }
  | { type: "lesson"; moduleId: string; lessonId: string };

const CourseBuilder = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const courseId = params.get("courseId");
  const user = getCurrentUser();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [overview, setOverview] = useState("");
  const [objectives, setObjectives] = useState<string[]>([]);
  const [newObjective, setNewObjective] = useState("");
  const [category, setCategory] = useState("Autre");
  const [isPublic, setIsPublic] = useState(false);
  const [coverImage, setCoverImage] = useState("");
  const [modules, setModules] = useState<Module[]>([]);
  const [generatedByAI, setGeneratedByAI] = useState(false);
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<SelectedItem>({ type: "info" });
  const [saving, setSaving] = useState(false);
  const [contentRow, setContentRow] = useState<ContentRow | null>(null);

  const userQuizzes = user ? getUserQuizzes(user.id).filter((q) => q.type === "quiz") : [];
  const userPolls = user ? getUserQuizzes(user.id).filter((q) => q.type === "poll") : [];
  const userFlashcards = user ? getUserFlashcardSets(user.id) : [];

  const cap = CONTENT_CAPS[getPlan(user)].course;
  const usedCourses = user ? getUserCourses(user.id).length : 0;
  const atCap = !courseId && cap !== null && usedCourses >= cap;

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    if (courseId) {
      const course = getCourseById(courseId);
      if (course && course.userId === user.id) {
        setTitle(course.title);
        setDescription(course.description);
        setOverview(course.overview || "");
        setObjectives(course.objectives || []);
        setCategory(course.category || "Autre");
        setIsPublic(course.isPublic);
        setCoverImage(course.coverImage || "");
        setModules(course.modules);
        setGeneratedByAI(!!course.generatedByAI);
        void getContentBySource(user.id, "course", course.id)
          .then(setContentRow)
          .catch(() => setContentRow(null));
      } else {
        let cancelled = false;
        (async () => {
          try {
            const row = await getContentBySourceAnyOwner("course", courseId)
              ?? await getContent(courseId);
            if (cancelled || !row) return;
            const sharedCourse = row.data as unknown as Course;
            setContentRow(row);
            setTitle(sharedCourse.title);
            setDescription(sharedCourse.description);
            setOverview(sharedCourse.overview || "");
            setObjectives(sharedCourse.objectives || []);
            setCategory(sharedCourse.category || "Autre");
            setIsPublic(sharedCourse.isPublic);
            setCoverImage(sharedCourse.coverImage || "");
            setModules(sharedCourse.modules);
            setGeneratedByAI(!!sharedCourse.generatedByAI);
            toast.success("Cours collaboratif chargé");
          } catch {
            if (cancelled) return;
            toast.error("Cours introuvable");
            navigate("/my-courses");
          }
        })();
        return () => { cancelled = true; };
      }
    }
  }, [courseId, user, navigate]);

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Le titre est obligatoire"); return; }
    setSaving(true);
    try {
      const data: Omit<Course, "id" | "userId" | "createdAt" | "updatedAt"> = {
        title: title.trim(),
        description: description.trim(),
        overview: overview.trim() || undefined,
        objectives,
        category,
        isPublic,
        coverImage: coverImage || undefined,
        isFavorite: false,
        modules,
        tags: [],
        generatedByAI,
      };
      let saved: Course | null;
      if (contentRow && contentRow.user_id !== user.id) {
        const current = contentRow.data as unknown as Course;
        saved = {
          ...current,
          ...data,
          id: current.id ?? courseId ?? contentRow.id,
          userId: contentRow.user_id,
          createdAt: current.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const updatedRow = await updateCollaborativeContent(
          contentRow.id,
          saved as unknown as Record<string, unknown>,
        );
        setContentRow(updatedRow);
        toast.success("Cours collaboratif enregistré");
      } else if (courseId) {
        saved = updateCourse(courseId, data);
        toast.success("Cours enregistré");
      } else {
        saved = createCourse(data);
        toast.success("Cours créé !");
      }

      // Mirror into the Supabase `content` table so it's viewable by anyone
      // other than the owner's own browser (shared/public course viewing),
      // same pattern QuizBuilder.tsx/ExamBuilder.tsx already use for their types.
      if (saved && user && (!contentRow || contentRow.user_id === user.id)) {
        try {
          await upsertContentBySource(user.id, 'course', saved.id, saved as unknown as Record<string, unknown>, saved.isPublic);
          const row = await getContentBySource(user.id, "course", saved.id);
          if (row) setContentRow(row);
        } catch (e) { console.error('[CourseBuilder] content mirror failed', e); }
      }

      if (!courseId && saved) {
        navigate(`/course-builder?courseId=${saved.id}`, { replace: true });
      }
    } catch (e) {
      if (e instanceof PlanLimitError) {
        toast.error(e.message, { action: { label: 'Passer Pro', onClick: () => { window.location.href = '/pricing'; } } });
      } else {
        toast.error(e instanceof Error ? e.message : "Erreur lors de l'enregistrement");
      }
    } finally {
      setSaving(false);
    }
  };
  useSaveShortcut(handleSave, !saving);

  const addModule = () => {
    const id = genId();
    setModules((prev) => [...prev, { id, title: "Nouveau module", lessons: [] }]);
  };

  const removeModule = (id: string) => {
    if (selected.type === "lesson" && selected.moduleId === id) setSelected({ type: "info" });
    setModules((prev) => prev.filter((m) => m.id !== id));
  };

  const updateModule = (id: string, updates: Partial<Module>) => {
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  };

  const addLesson = (moduleId: string) => {
    const id = genId();
    const newLesson: Lesson = { id, title: "Nouvelle leçon", content: "", type: "text", estimatedMinutes: 5 };
    setModules((prev) =>
      prev.map((m) => (m.id === moduleId ? { ...m, lessons: [...m.lessons, newLesson] } : m)),
    );
    setCollapsedModules((prev) => { const next = new Set(prev); next.delete(moduleId); return next; });
    setSelected({ type: "lesson", moduleId, lessonId: id });
  };

  const removeLesson = (moduleId: string, lessonId: string) => {
    if (selected.type === "lesson" && selected.lessonId === lessonId) setSelected({ type: "info" });
    setModules((prev) =>
      prev.map((m) =>
        m.id === moduleId ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) } : m,
      ),
    );
  };

  const updateLesson = (moduleId: string, lessonId: string, updates: Partial<Lesson>) => {
    setModules((prev) =>
      prev.map((m) =>
        m.id === moduleId
          ? { ...m, lessons: m.lessons.map((l) => (l.id === lessonId ? { ...l, ...updates } : l)) }
          : m,
      ),
    );
  };

  const toggleModuleCollapse = (id: string) => {
    setCollapsedModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const lessonTypeIcon = (type: Lesson["type"]) => {
    if (type === "quiz") return <BookOpen className="h-3.5 w-3.5" />;
    if (type === "poll") return <BarChart2 className="h-3.5 w-3.5" />;
    if (type === "flashcard") return <Layers className="h-3.5 w-3.5" />;
    if (type === "document") return <FileText className="h-3.5 w-3.5" />;
    if (type === "video") return <Video className="h-3.5 w-3.5" />;
    if (type === "iframe") return <Globe className="h-3.5 w-3.5" />;
    if (type === "file-upload") return <Upload className="h-3.5 w-3.5" />;
    return <GraduationCap className="h-3.5 w-3.5" />;
  };

  const lessonTypeLabel = (type: Lesson["type"]) => {
    if (type === "quiz") return "Quiz";
    if (type === "poll") return "Sondage";
    if (type === "flashcard") return "Flashcards";
    if (type === "document") return "Document";
    if (type === "video") return "Vidéo";
    if (type === "iframe") return "Iframe";
    if (type === "file-upload") return "Dépôt de fichier";
    return "Texte";
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    moduleId: string,
    lessonId: string,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      assertSafeImportFile(file, 4 * 1024 * 1024);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fichier invalide");
      return;
    }
    const isMd = file.name.match(/\.(md|markdown)$/i);
    if (isMd) {
      const reader = new FileReader();
      reader.onload = () => {
        updateLesson(moduleId, lessonId, {
          content: reader.result as string,
          documentName: file.name,
          documentMimeType: "text/markdown",
        });
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        updateLesson(moduleId, lessonId, {
          content: reader.result as string,
          documentName: file.name,
          documentMimeType: file.type,
        });
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const handleCoverImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      assertSafeImportFile(file, 4 * 1024 * 1024);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fichier invalide");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCoverImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const selectedLesson = selected.type === "lesson"
    ? modules.find((m) => m.id === selected.moduleId)?.lessons.find((l) => l.id === selected.lessonId)
    : null;

  const firstModuleId = modules[0]?.id ?? null;

  if (!user) return null;

  if (atCap) {
    return (
      <AppLayout subtitle="Créateur de cours">
        <PlanLimitBlocker
          title="Limite du plan Starter atteinte"
          description={`Le plan Starter est limité à ${cap} cours. Passez au plan Pro pour en créer davantage.`}
        />
      </AppLayout>
    );
  }

  return (
    <div className="min-h-screen" style={{ display: "flex", flexDirection: "column" }}>
      {/* ── Topbar — matches the minimal QuizBuilder/PresentationEditor chrome (no public nav/account icons) ── */}
      <div style={{
        height: 62, flexShrink: 0, background: "var(--ap-card)",
        borderBottom: "var(--ap-border-w) solid var(--ap-line)",
        display: "flex", alignItems: "center", gap: 16, padding: "0 18px",
      }}>
        <Breadcrumb
          onHome={() => { window.location.href = "/"; }}
          items={[
            { label: "Mes cours", onClick: () => navigate("/my-courses") },
            { label: courseId ? "Modifier le cours" : "Nouveau cours" },
          ]}
        />

        {generatedByAI && (
          <span
            title="Ce cours a été généré par IA à partir d'un document, puis peut être modifié librement."
            style={{
              display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
              padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 800,
              color: "var(--ap-brand-deep)", background: "var(--ap-brand-soft)",
              border: "var(--ap-border-w) solid color-mix(in srgb, var(--ap-brand) 35%, transparent)",
            }}
          >
            <Sparkles className="h-3 w-3" />
            Généré par IA
          </span>
        )}

        <div style={{ flex: 1 }} />

        <CollaboratorsButton
          contentId={contentRow?.id ?? null}
          contentTitle={title || "Nouveau cours"}
          canManage={contentRow?.user_id === user.id}
        />

        <button
          className="ap-btn ap-btn--pill"
          style={{ padding: "10px 18px", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}
          onClick={handleSave}
          disabled={saving}
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>

      <div style={{ display: "flex", flex: 1, height: "calc(100vh - 62px)", overflow: "hidden" }}>
        {/* ── LEFT SIDEBAR ── */}
        <aside style={{
          width: 272,
          flexShrink: 0,
          borderRight: "var(--ap-border-w) solid var(--ap-line)",
          background: "var(--ap-paper-2)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Sidebar top actions */}
          <div style={{ padding: "12px 12px 8px", display: "flex", gap: "8px", borderBottom: "var(--ap-border-w) solid var(--ap-line)" }}>
            <button
              className="ap-btn ap-btn--sm ap-btn--pill"
              style={{ flex: 1, background: "var(--ap-brand)", color: "#fff", border: "none", gap: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px" }}
              onClick={() => {
                const targetId = selected.type === "lesson" ? selected.moduleId : firstModuleId;
                if (targetId) addLesson(targetId);
                else { addModule(); }
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Leçon
            </button>
            <button
              className="ap-btn ap-btn--ghost ap-btn--sm"
              style={{ flex: 1, gap: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", borderRadius: "var(--ap-r-pill)", fontWeight: 700 }}
              onClick={addModule}
            >
              <Plus className="h-3.5 w-3.5" /> Module
            </button>
          </div>

          {/* Info tab */}
          <button
            onClick={() => setSelected({ type: "info" })}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "10px 14px",
              background: selected.type === "info" ? "var(--ap-brand-soft, rgba(59,130,246,0.08))" : "transparent",
              borderLeft: selected.type === "info" ? "3px solid var(--ap-brand)" : "3px solid transparent",
              border: "none",
              cursor: "pointer",
              width: "100%",
              textAlign: "left",
              fontSize: "13px",
              fontWeight: 700,
              color: selected.type === "info" ? "var(--ap-brand)" : "var(--ap-ink)",
              fontFamily: "var(--ap-font-body)",
            }}
          >
            <Info className="h-3.5 w-3.5 flex-shrink-0" />
            Informations du cours
          </button>

          {/* Module list */}
          <div style={{ flex: 1, overflowY: "auto", paddingBottom: "16px" }}>
            {modules.length === 0 && (
              <div style={{ padding: "24px 16px", textAlign: "center" }}>
                <p className="ap-muted" style={{ fontSize: "12px" }}>Ajoutez un module pour commencer.</p>
              </div>
            )}
            {modules.map((mod, mIdx) => {
              const collapsed = collapsedModules.has(mod.id);
              return (
                <div key={mod.id}>
                  {/* Module row */}
                  <div
                    style={{
                      display: "flex", alignItems: "center", gap: "6px",
                      padding: "8px 10px 8px 14px",
                      borderBottom: "1px solid var(--ap-line)",
                      background: "var(--ap-paper-2)",
                    }}
                  >
                    <button
                      onClick={() => toggleModuleCollapse(mod.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "var(--ap-muted)", flexShrink: 0, display: "flex" }}
                    >
                      {collapsed
                        ? <ChevronRight className="h-3.5 w-3.5" />
                        : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                    <input
                      value={mod.title}
                      onChange={(e) => updateModule(mod.id, { title: e.target.value })}
                      style={{
                        flex: 1,
                        fontFamily: "var(--ap-font-display)",
                        fontWeight: 700,
                        fontSize: "12px",
                        color: "var(--ap-ink)",
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        minWidth: 0,
                      }}
                    />
                    <span className="ap-muted" style={{ fontSize: "10px", flexShrink: 0 }}>M{mIdx + 1}</span>
                    <button
                      onClick={() => addLesson(mod.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "var(--ap-brand)", flexShrink: 0, display: "flex" }}
                      title="Ajouter une leçon"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => removeModule(mod.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "var(--ap-quiz)", flexShrink: 0, display: "flex" }}
                      title="Supprimer le module"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Lessons */}
                  {!collapsed && mod.lessons.map((lesson, lIdx) => {
                    const isActive = selected.type === "lesson" && selected.lessonId === lesson.id;
                    return (
                      <div
                        key={lesson.id}
                        onClick={() => setSelected({ type: "lesson", moduleId: mod.id, lessonId: lesson.id })}
                        style={{
                          display: "flex", alignItems: "center", gap: "8px",
                          padding: "7px 10px 7px 30px",
                          cursor: "pointer",
                          background: isActive ? "var(--ap-brand-soft, rgba(59,130,246,0.08))" : "transparent",
                          borderLeft: isActive ? "3px solid var(--ap-brand)" : "3px solid transparent",
                          borderBottom: "1px solid var(--ap-line)",
                        }}
                      >
                        <span style={{ color: isActive ? "var(--ap-brand)" : "var(--ap-muted)", flexShrink: 0 }}>
                          {lessonTypeIcon(lesson.type)}
                        </span>
                        <span style={{
                          flex: 1, minWidth: 0,
                          fontSize: "12px", fontWeight: 600,
                          color: isActive ? "var(--ap-brand)" : "var(--ap-ink)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          fontFamily: "var(--ap-font-body)",
                        }}>
                          {lesson.title}
                        </span>
                        <span className="ap-muted" style={{ fontSize: "10px", flexShrink: 0 }}>{lIdx + 1}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeLesson(mod.id, lesson.id); }}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "var(--ap-quiz)", flexShrink: 0, display: "flex", opacity: 0.6 }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}

                  {!collapsed && mod.lessons.length === 0 && (
                    <div style={{ padding: "8px 30px", borderBottom: "1px solid var(--ap-line)" }}>
                      <p className="ap-muted" style={{ fontSize: "11px", fontStyle: "italic" }}>Aucune leçon</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* ── MAIN PANEL ── */}
        <main style={{ flex: 1, overflowY: "auto", padding: "32px 40px" }}>
          {/* Course info panel */}
          {selected.type === "info" && (
            <div style={{ maxWidth: 640 }}>
              <h2 className="ap-h3 mb-6" style={{ fontSize: "18px" }}>Informations du cours</h2>
              <div className="ap-card">
                <div className="flex flex-col gap-4">
                  <div>
                    {fieldLabel("Image d'en-tête")}
                    {coverImage ? (
                      <div className="relative h-36 w-full overflow-hidden" style={{ borderRadius: "var(--ap-r-sm)" }}>
                        <img src={coverImage} alt="Aperçu de l'image d'en-tête" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setCoverImage("")}
                          className="absolute top-2 right-2"
                          style={{ background: "rgba(0,0,0,0.55)", border: "none", borderRadius: "var(--ap-r-sm)", padding: 6, cursor: "pointer" }}
                          aria-label="Supprimer l'image d'en-tête"
                        >
                          <Trash2 className="h-4 w-4" style={{ color: "#fff" }} />
                        </button>
                      </div>
                    ) : (
                      <label
                        htmlFor="course-cover-image"
                        className="flex items-center justify-center gap-2 cursor-pointer"
                        style={{ height: 96, border: "var(--ap-border-w) dashed var(--ap-line-2)", borderRadius: "var(--ap-r-sm)", color: "var(--ap-muted)", fontSize: "13px", fontWeight: 600 }}
                      >
                        <Upload className="h-4 w-4" /> Ajouter une image d'en-tête
                      </label>
                    )}
                    <input id="course-cover-image" type="file" accept="image/*" className="hidden" onChange={handleCoverImageUpload} />
                  </div>
                  <div>
                    {fieldLabel("Titre")}
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Titre du cours..."
                      style={inputStyle}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--ap-brand)"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--ap-line)"; }}
                    />
                  </div>
                  <div>
                    {fieldLabel("Description")}
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Description courte du cours..."
                      rows={3}
                      style={{ ...inputStyle, resize: "vertical" }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--ap-brand)"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--ap-line)"; }}
                    />
                  </div>
                  <div>
                    {fieldLabel("Overview")}
                    <RichTextEditor value={overview} onChange={setOverview} />
                    <p className="ap-muted" style={{ fontSize: "12px", marginTop: "6px" }}>
                      Présentation détaillée affichée en haut du cours pour les apprenants.
                    </p>
                  </div>
                  <div>
                    {fieldLabel("Objectifs pédagogiques")}
                    <div className="flex gap-2">
                      <input
                        value={newObjective}
                        onChange={(e) => setNewObjective(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter" || !newObjective.trim()) return;
                          e.preventDefault();
                          setObjectives([...objectives, newObjective.trim()]);
                          setNewObjective("");
                        }}
                        placeholder="Ex : Comprendre les bases du cloud computing"
                        style={{ ...inputStyle, flex: 1 }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--ap-brand)"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "var(--ap-line)"; }}
                      />
                      <button
                        onClick={() => {
                          if (!newObjective.trim()) return;
                          setObjectives([...objectives, newObjective.trim()]);
                          setNewObjective("");
                        }}
                        className="ap-btn ap-btn--ghost ap-btn--sm"
                        style={{ flexShrink: 0 }}
                      >
                        <Plus className="h-3.5 w-3.5" /> Ajouter
                      </button>
                    </div>
                    {objectives.length > 0 && (
                      <ul style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                        {objectives.map((obj, i) => (
                          <li
                            key={i}
                            style={{
                              display: "flex", alignItems: "center", gap: "8px",
                              padding: "8px 12px", background: "var(--ap-paper-2)",
                              border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-sm)",
                              fontSize: "13px", fontWeight: 600,
                            }}
                          >
                            <span style={{ flex: 1 }}>{obj}</span>
                            <button
                              onClick={() => setObjectives(objectives.filter((_, j) => j !== i))}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ap-quiz)", display: "flex", padding: "2px" }}
                              aria-label="Supprimer cet objectif"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    <div style={{ flex: "1 1 160px" }}>
                      {fieldLabel("Catégorie")}
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger style={selectStyle}><SelectValue /></SelectTrigger>
                        <SelectContent style={{ background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
                          {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div style={{ flex: "0 0 auto", paddingTop: 24, display: "flex", alignItems: "center", gap: 10 }}>
                      <Switch
                        checked={isPublic}
                        onCheckedChange={setIsPublic}
                        disabled={Boolean(contentRow && contentRow.user_id !== user.id)}
                        aria-label="Rendre le cours public"
                        title={contentRow && contentRow.user_id !== user.id ? "Seul le propriétaire peut modifier la visibilité" : undefined}
                      />
                      <span className="ap-muted" style={{ fontSize: "13px", fontWeight: 600 }}>Public</span>
                    </div>
                    {contentRow && contentRow.user_id !== user.id && (
                      <p className="ap-muted" style={{ flexBasis: "100%", margin: "-6px 0 0", fontSize: 12, fontWeight: 700, textAlign: "right" }}>
                        Seul le propriétaire peut modifier la visibilité de cette ressource.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {modules.length === 0 && (
                <div style={{ marginTop: "32px", borderRadius: "var(--ap-r-lg)", border: "var(--ap-border-w) dashed var(--ap-line-2)", background: "var(--ap-paper-2)", padding: "36px 24px", textAlign: "center" }}>
                  <p className="ap-muted" style={{ fontSize: "14px", marginBottom: "12px" }}>Aucun module. Créez un module dans le panneau gauche pour structurer votre cours.</p>
                  <button
                    className="ap-btn ap-btn--sm ap-btn--pill"
                    style={{ background: "var(--ap-brand)", color: "#fff", border: "none", gap: "6px", display: "inline-flex", alignItems: "center" }}
                    onClick={addModule}
                  >
                    <Plus className="h-3.5 w-3.5" /> Ajouter un module
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Lesson editor panel */}
          {selected.type === "lesson" && selectedLesson && (() => {
            const { moduleId, lessonId } = selected;
            const lesson = selectedLesson;
            return (
              <div style={{ maxWidth: 860 }}>
                <h2 className="ap-h3 mb-6" style={{ fontSize: "18px" }}>Éditer la leçon</h2>
                <div className="ap-card flex flex-col gap-4">
                  <div>
                    {fieldLabel("Titre de la leçon")}
                    <input
                      value={lesson.title}
                      onChange={(e) => updateLesson(moduleId, lessonId, { title: e.target.value })}
                      style={inputStyle}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--ap-brand)"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--ap-line)"; }}
                    />
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <div style={{ flex: "1 1 140px" }}>
                      {fieldLabel("Type")}
                      <Select
                        value={lesson.type}
                        onValueChange={(v) => updateLesson(moduleId, lessonId, { type: v as Lesson["type"], linkedItemId: undefined })}
                      >
                        <SelectTrigger style={{ ...selectStyle, height: "40px" }}><SelectValue /></SelectTrigger>
                        <SelectContent style={{ background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
                          <SelectItem value="text">Texte</SelectItem>
                          <SelectItem value="quiz">Quiz</SelectItem>
                          <SelectItem value="poll">Sondage</SelectItem>
                          <SelectItem value="flashcard">Flashcards</SelectItem>
                          <SelectItem value="document">Document</SelectItem>
                          <SelectItem value="video">Vidéo</SelectItem>
                          <SelectItem value="iframe">Iframe</SelectItem>
                          <SelectItem value="file-upload">Dépôt de fichier</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div style={{ flex: "0 1 100px" }}>
                      {fieldLabel("Durée (min)")}
                      <input
                        type="number"
                        min={1}
                        value={lesson.estimatedMinutes ?? ""}
                        onChange={(e) => updateLesson(moduleId, lessonId, { estimatedMinutes: parseInt(e.target.value) || undefined })}
                        style={{ ...inputStyle, width: "100%" }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--ap-brand)"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "var(--ap-line)"; }}
                      />
                    </div>
                  </div>

                  {lesson.type === "text" && (
                    <div>
                      {fieldLabel("Contenu")}
                      <RichTextEditor
                        value={lesson.content}
                        onChange={(html) => updateLesson(moduleId, lessonId, { content: html })}
                      />
                    </div>
                  )}

                  {lesson.type === "quiz" && (
                    <div>
                      {fieldLabel("Quiz lié")}
                      <Select
                        value={lesson.linkedItemId ?? ""}
                        onValueChange={(v) => updateLesson(moduleId, lessonId, { linkedItemId: v || undefined })}
                      >
                        <SelectTrigger style={{ ...selectStyle, height: "40px", width: "100%" }}>
                          <SelectValue placeholder="Choisir un quiz..." />
                        </SelectTrigger>
                        <SelectContent style={{ background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
                          {userQuizzes.length === 0
                            ? <SelectItem value="" disabled>Aucun quiz disponible</SelectItem>
                            : userQuizzes.map((q) => (
                              <SelectItem key={q.id} value={q.id}>{q.title}</SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {lesson.type === "flashcard" && (
                    <div>
                      {fieldLabel("Set de flashcards lié")}
                      <Select
                        value={lesson.linkedItemId ?? ""}
                        onValueChange={(v) => updateLesson(moduleId, lessonId, { linkedItemId: v || undefined })}
                      >
                        <SelectTrigger style={{ ...selectStyle, height: "40px", width: "100%" }}>
                          <SelectValue placeholder="Choisir un set..." />
                        </SelectTrigger>
                        <SelectContent style={{ background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
                          {userFlashcards.length === 0
                            ? <SelectItem value="" disabled>Aucun set disponible</SelectItem>
                            : userFlashcards.map((f) => (
                              <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {lesson.type === "poll" && (
                    <div>
                      {fieldLabel("Sondage lié")}
                      <Select
                        value={lesson.linkedItemId ?? ""}
                        onValueChange={(v) => updateLesson(moduleId, lessonId, { linkedItemId: v || undefined })}
                      >
                        <SelectTrigger style={{ ...selectStyle, height: "40px", width: "100%" }}>
                          <SelectValue placeholder="Choisir un sondage..." />
                        </SelectTrigger>
                        <SelectContent style={{ background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
                          {userPolls.length === 0
                            ? <SelectItem value="" disabled>Aucun sondage disponible</SelectItem>
                            : userPolls.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {lesson.type === "video" && (
                    <div className="flex flex-col gap-3">
                      {fieldLabel("Source vidéo")}
                      <div style={{ display: "flex", gap: "8px" }}>
                        {(["youtube", "url"] as const).map((vt) => (
                          <button
                            key={vt}
                            onClick={() => updateLesson(moduleId, lessonId, { videoType: vt, videoUrl: "" })}
                            style={{
                              flex: 1,
                              padding: "8px",
                              border: `2px solid ${lesson.videoType === vt ? "var(--ap-brand)" : "var(--ap-line)"}`,
                              borderRadius: "var(--ap-r-sm)",
                              background: lesson.videoType === vt ? "rgba(59,130,246,0.08)" : "var(--ap-card)",
                              color: lesson.videoType === vt ? "var(--ap-brand)" : "var(--ap-ink)",
                              fontFamily: "var(--ap-font-body)",
                              fontWeight: 700,
                              fontSize: "13px",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "6px",
                            }}
                          >
                            {vt === "youtube" ? <><Video className="h-3.5 w-3.5" /> YouTube</> : <><Video className="h-3.5 w-3.5" /> URL externe</>}
                          </button>
                        ))}
                      </div>
                      {lesson.videoType && (
                        <input
                          value={lesson.videoUrl ?? ""}
                          onChange={(e) => updateLesson(moduleId, lessonId, { videoUrl: e.target.value })}
                          placeholder={lesson.videoType === "youtube" ? "https://youtube.com/watch?v=..." : "https://exemple.com/video.mp4"}
                          style={inputStyle}
                          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--ap-brand)"; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--ap-line)"; }}
                        />
                      )}
                      {lesson.videoType === "youtube" && lesson.videoUrl && extractYouTubeId(lesson.videoUrl) && (
                        <div style={{ borderRadius: "var(--ap-r-sm)", overflow: "hidden", aspectRatio: "16/9", marginTop: "4px" }}>
                          <iframe
                            src={`https://www.youtube.com/embed/${extractYouTubeId(lesson.videoUrl)}`}
                            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                            allowFullScreen
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            title={lesson.title}
                          />
                        </div>
                      )}
                      {lesson.videoType === "url" && lesson.videoUrl && (
                        <video
                          src={lesson.videoUrl}
                          controls
                          style={{ width: "100%", borderRadius: "var(--ap-r-sm)", marginTop: "4px", background: "#000" }}
                        />
                      )}
                    </div>
                  )}

                  {lesson.type === "document" && (
                    <div>
                      {fieldLabel("Document importé")}
                      {lesson.documentName ? (
                        <div style={{
                          display: "flex", alignItems: "center", gap: "10px",
                          padding: "10px 14px",
                          background: "var(--ap-paper-2)",
                          border: "var(--ap-border-w) solid var(--ap-line)",
                          borderRadius: "var(--ap-r-sm)",
                          marginBottom: "10px",
                        }}>
                          <FileText className="h-4 w-4 flex-shrink-0" style={{ color: "var(--ap-brand)" }} />
                          <span style={{ flex: 1, fontSize: "13px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {lesson.documentName}
                          </span>
                          <button
                            onClick={() => updateLesson(moduleId, lessonId, { content: "", documentName: undefined, documentMimeType: undefined })}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ap-quiz)", display: "flex", padding: "2px" }}
                            title="Supprimer"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : null}
                      <label style={{
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        gap: "8px", padding: "24px",
                        border: "var(--ap-border-w) dashed var(--ap-line-2)",
                        borderRadius: "var(--ap-r-sm)",
                        cursor: "pointer",
                        background: "var(--ap-paper-2)",
                      }}>
                        <Upload className="h-5 w-5" style={{ color: "var(--ap-muted)" }} />
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ap-muted)" }}>
                          {lesson.documentName ? "Remplacer le fichier" : "Importer un fichier"}
                        </span>
                        <span style={{ fontSize: "11px", color: "var(--ap-muted)" }}>PDF, Word (.docx), Markdown, max 4 Mo</span>
                        <input
                          type="file"
                          accept=".pdf,.docx,.doc,.md,.markdown"
                          style={{ display: "none" }}
                          onChange={(e) => handleFileUpload(e, moduleId, lessonId)}
                        />
                      </label>
                      {lesson.documentName && lesson.documentMimeType === "text/markdown" && lesson.content && (
                        <div style={{ marginTop: "12px" }}>
                          {fieldLabel("Aperçu Markdown")}
                          <div style={{
                            padding: "16px",
                            background: "var(--ap-paper-2)",
                            border: "var(--ap-border-w) solid var(--ap-line)",
                            borderRadius: "var(--ap-r-sm)",
                            fontFamily: "monospace",
                            fontSize: "12px",
                            whiteSpace: "pre-wrap",
                            maxHeight: "200px",
                            overflowY: "auto",
                            color: "var(--ap-muted)",
                          }}>
                            {lesson.content.slice(0, 800)}{lesson.content.length > 800 ? "\n…" : ""}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {lesson.type === "iframe" && (
                    <div className="flex flex-col gap-3">
                      {fieldLabel("URL à intégrer")}
                      <input
                        value={lesson.iframeUrl ?? ""}
                        onChange={(e) => updateLesson(moduleId, lessonId, { iframeUrl: e.target.value })}
                        placeholder="https://exemple.com/page-a-integrer"
                        style={inputStyle}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--ap-brand)"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "var(--ap-line)"; }}
                      />
                      {lesson.iframeUrl && (
                        <div style={{ borderRadius: "var(--ap-r-sm)", overflow: "hidden", aspectRatio: "16/9", border: "var(--ap-border-w) solid var(--ap-line)" }}>
                          <iframe
                            src={lesson.iframeUrl}
                            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                            title={lesson.title}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {lesson.type === "file-upload" && (
                    <div>
                      {fieldLabel("Instructions pour le dépôt")}
                      <RichTextEditor
                        value={lesson.content}
                        onChange={(html) => updateLesson(moduleId, lessonId, { content: html })}
                      />
                      <p className="ap-muted" style={{ fontSize: "12px", marginTop: "8px" }}>
                        Les apprenants pourront déposer un fichier depuis cette leçon dans le lecteur de cours.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Lesson selected but not found (deleted) */}
          {selected.type === "lesson" && !selectedLesson && (
            <div style={{ maxWidth: 640, padding: "48px 0", textAlign: "center" }}>
              <p className="ap-muted" style={{ fontSize: "14px" }}>Sélectionnez une leçon dans le panneau gauche.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default CourseBuilder;
