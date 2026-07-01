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
  GraduationCap,
  Layers,
  Plus,
  Save,
  Trash2,
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

const label = (text: string) => (
  <label className="ap-muted" style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>
    {text}
  </label>
);

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
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set());
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
    setExpandedLesson(`${moduleId}-${id}`);
  };

  const removeLesson = (moduleId: string, lessonId: string) => {
    setModules((prev) =>
      prev.map((m) =>
        m.id === moduleId ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) } : m,
      ),
    );
    if (expandedLesson === `${moduleId}-${lessonId}`) setExpandedLesson(null);
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
    return <GraduationCap className="h-3.5 w-3.5" />;
  };

  const lessonTypeLabel = (type: Lesson["type"]) => {
    if (type === "quiz") return "Quiz";
    if (type === "flashcard") return "Flashcards";
    return "Texte";
  };

  if (!user) return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--ap-paper)" }}>
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

      <div className="mx-auto max-w-3xl px-6 py-10">
        {/* Course metadata */}
        <div className="ap-card mb-8">
          <h2 className="ap-h3 mb-5" style={{ fontSize: "16px" }}>Informations du cours</h2>
          <div className="flex flex-col gap-4">
            <div>
              {label("Titre")}
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
              {label("Description")}
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
                {label("Catégorie")}
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

        {/* Modules */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="ap-h3" style={{ fontSize: "16px" }}>
            Modules <span className="ap-muted" style={{ fontWeight: 500, fontSize: "13px" }}>({modules.length})</span>
          </h2>
          <button
            className="ap-btn ap-btn--ghost ap-btn--sm"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
            onClick={addModule}
          >
            <Plus className="h-4 w-4" /> Ajouter un module
          </button>
        </div>

        {modules.length === 0 && (
          <div style={{ borderRadius: "var(--ap-r-lg)", border: "2px dashed var(--ap-line-2)", background: "var(--ap-paper-2)", padding: "36px 24px", textAlign: "center", marginBottom: "24px" }}>
            <p className="ap-muted" style={{ fontSize: "14px" }}>Aucun module. Ajoutez votre premier module pour structurer le cours.</p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {modules.map((mod, mIdx) => {
            const collapsed = collapsedModules.has(mod.id);
            return (
              <div key={mod.id} className="ap-card" style={{ padding: 0, overflow: "hidden" }}>
                {/* Module header */}
                <div
                  className="flex items-center gap-3 px-5 py-4 cursor-pointer"
                  style={{ background: "var(--ap-paper-2)", borderBottom: collapsed ? "none" : "2px solid var(--ap-line)" }}
                  onClick={() => toggleModuleCollapse(mod.id)}
                >
                  {collapsed
                    ? <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: "var(--ap-muted)" }} />
                    : <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: "var(--ap-muted)" }} />
                  }
                  <input
                    value={mod.title}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateModule(mod.id, { title: e.target.value })}
                    style={{
                      flex: 1,
                      fontFamily: "var(--ap-font-display)",
                      fontWeight: 700,
                      fontSize: "14px",
                      color: "var(--ap-ink)",
                      background: "transparent",
                      border: "none",
                      outline: "none",
                    }}
                  />
                  <span className="ap-muted flex-shrink-0" style={{ fontSize: "12px" }}>
                    {mod.lessons.length} leçon{mod.lessons.length !== 1 ? "s" : ""}
                  </span>
                  <span className="ap-muted flex-shrink-0" style={{ fontSize: "12px" }}>M{mIdx + 1}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeModule(mod.id); }}
                    className="ap-btn ap-btn--ghost ap-btn--sm flex-shrink-0"
                    style={{ padding: "4px 6px", color: "var(--ap-quiz)" }}
                    title="Supprimer le module"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Lessons */}
                {!collapsed && (
                  <div className="px-5 py-3 flex flex-col gap-2">
                    {mod.lessons.map((lesson, lIdx) => {
                      const key = `${mod.id}-${lesson.id}`;
                      const isExpanded = expandedLesson === key;
                      return (
                        <div key={lesson.id} className="ap-card" style={{ padding: 0, overflow: "hidden", background: "var(--ap-paper-2)" }}>
                          {/* Lesson row */}
                          <div
                            className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                            onClick={() => setExpandedLesson(isExpanded ? null : key)}
                          >
                            <span style={{ color: "var(--ap-muted)", flexShrink: 0 }}>{lessonTypeIcon(lesson.type)}</span>
                            <span className="flex-1 min-w-0 truncate" style={{ fontWeight: 600, fontSize: "13px" }}>{lesson.title}</span>
                            <span className="ap-pill flex-shrink-0" style={{ fontSize: "10px", padding: "2px 7px" }}>{lessonTypeLabel(lesson.type)}</span>
                            {lesson.estimatedMinutes && (
                              <span className="ap-muted flex-shrink-0" style={{ fontSize: "11px" }}>{lesson.estimatedMinutes}min</span>
                            )}
                            <span className="ap-muted flex-shrink-0" style={{ fontSize: "11px" }}>{lIdx + 1}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeLesson(mod.id, lesson.id); }}
                              className="ap-btn ap-btn--ghost ap-btn--sm flex-shrink-0"
                              style={{ padding: "3px 5px", color: "var(--ap-quiz)" }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>

                          {/* Lesson editor */}
                          {isExpanded && (
                            <div className="px-4 pb-4 flex flex-col gap-3" style={{ borderTop: "2px solid var(--ap-line)" }}>
                              <div className="mt-3">
                                {label("Titre de la leçon")}
                                <input
                                  value={lesson.title}
                                  onChange={(e) => updateLesson(mod.id, lesson.id, { title: e.target.value })}
                                  style={inputStyle}
                                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--ap-brand)"; }}
                                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--ap-line)"; }}
                                />
                              </div>
                              <div className="flex gap-3 flex-wrap">
                                <div style={{ flex: "1 1 140px" }}>
                                  {label("Type")}
                                  <Select
                                    value={lesson.type}
                                    onValueChange={(v) => updateLesson(mod.id, lesson.id, { type: v as Lesson["type"], linkedItemId: undefined })}
                                  >
                                    <SelectTrigger style={{ ...selectStyle, height: "40px" }}><SelectValue /></SelectTrigger>
                                    <SelectContent style={{ background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
                                      <SelectItem value="text">Texte</SelectItem>
                                      <SelectItem value="quiz">Quiz</SelectItem>
                                      <SelectItem value="flashcard">Flashcards</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div style={{ flex: "0 1 100px" }}>
                                  {label("Durée (min)")}
                                  <input
                                    type="number"
                                    min={1}
                                    value={lesson.estimatedMinutes ?? ""}
                                    onChange={(e) => updateLesson(mod.id, lesson.id, { estimatedMinutes: parseInt(e.target.value) || undefined })}
                                    style={{ ...inputStyle, width: "100%" }}
                                    onFocus={(e) => { e.currentTarget.style.borderColor = "var(--ap-brand)"; }}
                                    onBlur={(e) => { e.currentTarget.style.borderColor = "var(--ap-line)"; }}
                                  />
                                </div>
                              </div>

                              {lesson.type === "text" && (
                                <div>
                                  {label("Contenu")}
                                  <textarea
                                    value={lesson.content}
                                    onChange={(e) => updateLesson(mod.id, lesson.id, { content: e.target.value })}
                                    placeholder="Rédigez le contenu de cette leçon..."
                                    rows={6}
                                    style={{ ...inputStyle, resize: "vertical" }}
                                    onFocus={(e) => { e.currentTarget.style.borderColor = "var(--ap-brand)"; }}
                                    onBlur={(e) => { e.currentTarget.style.borderColor = "var(--ap-line)"; }}
                                  />
                                </div>
                              )}

                              {lesson.type === "quiz" && (
                                <div>
                                  {label("Quiz lié")}
                                  <Select
                                    value={lesson.linkedItemId ?? ""}
                                    onValueChange={(v) => updateLesson(mod.id, lesson.id, { linkedItemId: v || undefined })}
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
                                  {label("Set de flashcards lié")}
                                  <Select
                                    value={lesson.linkedItemId ?? ""}
                                    onValueChange={(v) => updateLesson(mod.id, lesson.id, { linkedItemId: v || undefined })}
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

                              <div className="flex justify-end">
                                <button
                                  className="ap-btn ap-btn--ghost ap-btn--sm"
                                  style={{ fontSize: "12px", color: "var(--ap-brand)", fontWeight: 700 }}
                                  onClick={() => setExpandedLesson(null)}
                                >
                                  ✓ Fermer
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <button
                      className="ap-btn ap-btn--ghost ap-btn--sm"
                      style={{ display: "flex", alignItems: "center", gap: "6px", alignSelf: "flex-start", marginTop: "4px" }}
                      onClick={() => addLesson(mod.id)}
                    >
                      <Plus className="h-3.5 w-3.5" /> Ajouter une leçon
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {modules.length > 0 && (
          <div className="mt-4">
            <button
              className="ap-btn ap-btn--ghost ap-btn--sm"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
              onClick={addModule}
            >
              <Plus className="h-4 w-4" /> Ajouter un module
            </button>
          </div>
        )}

        <div className="mt-8 flex justify-end">
          <button
            className="ap-btn ap-btn--sm ap-btn--pill"
            style={{ background: "var(--ap-brand)", color: "#fff", border: "none", gap: "6px", display: "flex", alignItems: "center" }}
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Enregistrement..." : "Enregistrer le cours"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourseBuilder;
