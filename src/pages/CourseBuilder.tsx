import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCurrentUser } from "@/lib/auth";
import {
  createCourse,
  getCourseById,
  genId,
  updateCourse,
  type Course,
  type Lesson,
  type Module,
} from "@/lib/courseStorage";
import { getUserQuizzes, getUserFlashcardSets } from "@/lib/quizStorage";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  GraduationCap,
  Layers,
  Plus,
  Save,
  Trash2,
  Info,
  Upload,
  X,
} from "lucide-react";

const CATEGORIES = ["Autre", "Informatique", "Langues", "Sciences", "Histoire", "Arts", "Business", "Santé"];

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  fontFamily: "var(--ap-font-body)",
  fontWeight: 600,
  fontSize: "14px",
  color: "var(--ap-ink)",
  background: "var(--ap-card)",
  border: "2px solid var(--ap-line)",
  borderRadius: "var(--ap-r-sm)",
  outline: "none",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  fontFamily: "var(--ap-font-body)",
  fontWeight: 700,
  fontSize: "14px",
  border: "2px solid var(--ap-line)",
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
  const [category, setCategory] = useState("Autre");
  const [isPublic, setIsPublic] = useState(false);
  const [modules, setModules] = useState<Module[]>([]);
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<SelectedItem>({ type: "info" });
  const [saving, setSaving] = useState(false);

  const userQuizzes = user ? getUserQuizzes(user.id).filter((q) => q.type === "quiz") : [];
  const userFlashcards = user ? getUserFlashcardSets(user.id) : [];

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    if (courseId) {
      const course = getCourseById(courseId);
      if (course && course.userId === user.id) {
        setTitle(course.title);
        setDescription(course.description);
        setCategory(course.category || "Autre");
        setIsPublic(course.isPublic);
        setModules(course.modules);
      } else {
        toast.error("Cours introuvable");
        navigate("/my-courses");
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
        category,
        isPublic,
        isFavorite: false,
        modules,
        tags: [],
      };
      if (courseId) {
        updateCourse(courseId, data);
        toast.success("Cours enregistré");
      } else {
        createCourse(data);
        toast.success("Cours créé !");
        navigate("/my-courses");
      }
    } finally {
      setSaving(false);
    }
  };

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
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const lessonTypeIcon = (type: Lesson["type"]) => {
    if (type === "quiz") return <BookOpen className="h-3.5 w-3.5" />;
    if (type === "flashcard") return <Layers className="h-3.5 w-3.5" />;
    if (type === "document") return <FileText className="h-3.5 w-3.5" />;
    return <GraduationCap className="h-3.5 w-3.5" />;
  };

  const lessonTypeLabel = (type: Lesson["type"]) => {
    if (type === "quiz") return "Quiz";
    if (type === "flashcard") return "Flashcards";
    if (type === "document") return "Document";
    return "Texte";
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    moduleId: string,
    lessonId: string,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const MAX = 4 * 1024 * 1024; // 4MB
    if (file.size > MAX) {
      toast.error("Fichier trop volumineux (max 4 Mo)");
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

  const selectedLesson = selected.type === "lesson"
    ? modules.find((m) => m.id === selected.moduleId)?.lessons.find((l) => l.id === selected.lessonId)
    : null;

  const firstModuleId = modules[0]?.id ?? null;

  if (!user) return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--ap-paper)", display: "flex", flexDirection: "column" }}>
      <Header
        subtitle={courseId ? "Modifier le cours" : "Nouveau cours"}
        toolbar={
          <div className="flex items-center gap-2">
            <button
              className="ap-btn ap-btn--ghost ap-btn--sm"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
              onClick={() => navigate("/my-courses")}
            >
              <ArrowLeft className="h-4 w-4" /> Mes cours
            </button>
            <button
              className="ap-btn ap-btn--sm ap-btn--pill"
              style={{ background: "var(--ap-brand)", color: "#fff", border: "none", gap: "6px", display: "flex", alignItems: "center" }}
              onClick={handleSave}
              disabled={saving}
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        }
        toolbarPlacement="main"
      />

      <div style={{ display: "flex", flex: 1, height: "calc(100vh - 64px)", overflow: "hidden" }}>
        {/* ── LEFT SIDEBAR ── */}
        <aside style={{
          width: 272,
          flexShrink: 0,
          borderRight: "2px solid var(--ap-line)",
          background: "var(--ap-paper-2)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Sidebar top actions */}
          <div style={{ padding: "12px 12px 8px", display: "flex", gap: "8px", borderBottom: "2px solid var(--ap-line)" }}>
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
              className="ap-btn ap-btn--sm"
              style={{ flex: 1, border: "2px solid var(--ap-line)", background: "var(--ap-card)", gap: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", borderRadius: "var(--ap-r-pill)", fontWeight: 700 }}
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
                  <div className="flex gap-4 flex-wrap">
                    <div style={{ flex: "1 1 160px" }}>
                      {fieldLabel("Catégorie")}
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger style={selectStyle}><SelectValue /></SelectTrigger>
                        <SelectContent style={{ background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
                          {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div style={{ flex: "0 0 auto", paddingTop: 24, display: "flex", alignItems: "center" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", userSelect: "none" }}>
                        <div
                          onClick={() => setIsPublic((v) => !v)}
                          style={{
                            width: 40, height: 22, borderRadius: 999,
                            background: isPublic ? "var(--ap-brand)" : "var(--ap-line)",
                            position: "relative", transition: "background 0.2s", cursor: "pointer",
                          }}
                        >
                          <div style={{
                            position: "absolute", top: 3, left: isPublic ? 20 : 2,
                            width: 16, height: 16, borderRadius: "50%",
                            background: "#fff", transition: "left 0.2s",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                          }} />
                        </div>
                        <span className="ap-muted" style={{ fontSize: "13px", fontWeight: 600 }}>Public</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {modules.length === 0 && (
                <div style={{ marginTop: "32px", borderRadius: "var(--ap-r-lg)", border: "2px dashed var(--ap-line-2)", background: "var(--ap-paper-2)", padding: "36px 24px", textAlign: "center" }}>
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
              <div style={{ maxWidth: 640 }}>
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
                        <SelectContent style={{ background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
                          <SelectItem value="text">Texte</SelectItem>
                          <SelectItem value="quiz">Quiz</SelectItem>
                          <SelectItem value="flashcard">Flashcards</SelectItem>
                          <SelectItem value="document">Document</SelectItem>
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
                      <textarea
                        value={lesson.content}
                        onChange={(e) => updateLesson(moduleId, lessonId, { content: e.target.value })}
                        placeholder="Rédigez le contenu de cette leçon..."
                        rows={10}
                        style={{ ...inputStyle, resize: "vertical" }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--ap-brand)"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "var(--ap-line)"; }}
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
                        <SelectContent style={{ background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
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
                        <SelectContent style={{ background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
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

                  {lesson.type === "document" && (
                    <div>
                      {fieldLabel("Document importé")}
                      {lesson.documentName ? (
                        <div style={{
                          display: "flex", alignItems: "center", gap: "10px",
                          padding: "10px 14px",
                          background: "var(--ap-paper-2)",
                          border: "2px solid var(--ap-line)",
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
                        border: "2px dashed var(--ap-line-2)",
                        borderRadius: "var(--ap-r-sm)",
                        cursor: "pointer",
                        background: "var(--ap-paper-2)",
                      }}>
                        <Upload className="h-5 w-5" style={{ color: "var(--ap-muted)" }} />
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ap-muted)" }}>
                          {lesson.documentName ? "Remplacer le fichier" : "Importer un fichier"}
                        </span>
                        <span style={{ fontSize: "11px", color: "var(--ap-muted)" }}>PDF, Word (.docx), Markdown — max 4 Mo</span>
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
                            border: "2px solid var(--ap-line)",
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
