import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { getCurrentUser } from "@/lib/auth";
import {
  getCourseById,
  getCourseProgress,
  markLessonComplete,
  unmarkLessonComplete,
  type Course,
  type Lesson,
  type Module,
  type CourseProgress,
} from "@/lib/courseStorage";
import { getQuizById } from "@/lib/quizStorage";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  GraduationCap,
  Layers,
  RotateCcw,
} from "lucide-react";

const CourseViewer = () => {
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId: string }>();
  const user = getCurrentUser();

  const [course, setCourse] = useState<Course | null>(null);
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    if (!courseId) { navigate("/my-courses"); return; }
    const c = getCourseById(courseId);
    if (!c) { toast.error("Cours introuvable"); navigate("/my-courses"); return; }
    setCourse(c);
    const p = getCourseProgress(courseId, user.id);
    setProgress(p);
    // Auto-select first lesson
    if (c.modules.length > 0 && c.modules[0].lessons.length > 0) {
      setCurrentLessonId(c.modules[0].lessons[0].id);
    }
  }, [courseId, user, navigate]);

  const allLessons = useMemo<Array<{ lesson: Lesson; module: Module }>>(() => {
    if (!course) return [];
    return course.modules.flatMap((m) => m.lessons.map((l) => ({ lesson: l, module: m })));
  }, [course]);

  const completedIds = progress?.completedLessonIds ?? [];
  const totalLessons = allLessons.length;
  const completedCount = allLessons.filter((x) => completedIds.includes(x.lesson.id)).length;
  const progressPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  const currentEntry = allLessons.find((x) => x.lesson.id === currentLessonId);
  const currentIdx = allLessons.findIndex((x) => x.lesson.id === currentLessonId);
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;

  const isCompleted = currentLessonId ? completedIds.includes(currentLessonId) : false;

  const toggleComplete = () => {
    if (!user || !course || !currentLessonId) return;
    if (isCompleted) {
      unmarkLessonComplete(course.id, currentLessonId, user.id);
    } else {
      markLessonComplete(course.id, currentLessonId, user.id);
    }
    setProgress(getCourseProgress(course.id, user.id));
  };

  const toggleModule = (id: string) => {
    setCollapsedModules((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (!user || !course) return null;

  const lesson = currentEntry?.lesson;
  const lessonModule = currentEntry?.module;

  const linkedQuiz = lesson?.type === "quiz" && lesson.linkedItemId
    ? getQuizById(lesson.linkedItemId)
    : null;
  const linkedFlashcard = lesson?.type === "flashcard" && lesson.linkedItemId
    ? getQuizById(lesson.linkedItemId)
    : null;

  return (
    <div className="min-h-screen" style={{ background: "var(--ap-paper)" }}>
      <Header
        subtitle={course.title}
        toolbar={
          <button
            className="ap-btn ap-btn--ghost ap-btn--sm"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
            onClick={() => navigate("/my-courses")}
          >
            <ArrowLeft className="h-4 w-4" /> Mes cours
          </button>
        }
        toolbarPlacement="main"
      />

      {/* Progress bar */}
      <div style={{ height: 4, background: "var(--ap-line)", position: "sticky", top: 0, zIndex: 10 }}>
        <div
          style={{
            height: "100%",
            width: `${progressPct}%`,
            background: "var(--ap-brand)",
            transition: "width 0.4s ease",
          }}
        />
      </div>

      <div className="flex" style={{ height: "calc(100vh - 4px - 64px)", overflow: "hidden" }}>
        {/* Sidebar */}
        <aside
          style={{
            width: 280,
            flexShrink: 0,
            borderRight: "2px solid var(--ap-line)",
            overflowY: "auto",
            background: "var(--ap-paper-2)",
            padding: "20px 0",
          }}
        >
          {/* Progress summary */}
          <div className="px-5 mb-4">
            <p className="ap-muted" style={{ fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>
              {completedCount}/{totalLessons} leçons — {progressPct}%
            </p>
          </div>

          {course.modules.map((mod) => {
            const collapsed = collapsedModules.has(mod.id);
            const modCompleted = mod.lessons.every((l) => completedIds.includes(l.id));
            return (
              <div key={mod.id}>
                <button
                  onClick={() => toggleModule(mod.id)}
                  className="w-full flex items-center gap-2 px-5 py-3"
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "var(--ap-font-display)",
                    fontWeight: 700,
                    fontSize: "13px",
                    color: modCompleted ? "var(--ap-brand)" : "var(--ap-ink)",
                  }}
                >
                  {collapsed
                    ? <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
                    : <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
                  }
                  <span className="truncate">{mod.title}</span>
                </button>

                {!collapsed && mod.lessons.map((l) => {
                  const done = completedIds.includes(l.id);
                  const active = l.id === currentLessonId;
                  return (
                    <button
                      key={l.id}
                      onClick={() => setCurrentLessonId(l.id)}
                      className="w-full flex items-center gap-2 px-6 py-2.5"
                      style={{
                        background: active ? "var(--ap-brand-light, rgba(99,102,241,0.08))" : "transparent",
                        border: "none",
                        borderLeft: active ? "3px solid var(--ap-brand)" : "3px solid transparent",
                        cursor: "pointer",
                        textAlign: "left",
                        fontFamily: "var(--ap-font-body)",
                        fontWeight: active ? 700 : 500,
                        fontSize: "13px",
                        color: active ? "var(--ap-brand)" : done ? "var(--ap-muted)" : "var(--ap-ink)",
                      }}
                    >
                      {done
                        ? <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--ap-brand)" }} />
                        : <Circle className="h-3.5 w-3.5 flex-shrink-0 opacity-30" />
                      }
                      <span className="truncate">{l.title}</span>
                      {l.type === "quiz" && <BookOpen className="h-3 w-3 flex-shrink-0 opacity-40 ml-auto" />}
                      {l.type === "flashcard" && <Layers className="h-3 w-3 flex-shrink-0 opacity-40 ml-auto" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, overflowY: "auto", padding: "36px 48px" }}>
          {!lesson ? (
            <div style={{ textAlign: "center", marginTop: "80px" }}>
              <GraduationCap className="mx-auto mb-4 h-10 w-10 opacity-30" />
              <p className="ap-muted">Sélectionnez une leçon dans le panneau gauche.</p>
            </div>
          ) : (
            <>
              <div className="mb-2">
                <span className="ap-pill" style={{ fontSize: "11px" }}>{lessonModule?.title}</span>
                {lesson.estimatedMinutes && (
                  <span className="ap-muted ml-3" style={{ fontSize: "12px" }}>{lesson.estimatedMinutes} min</span>
                )}
              </div>

              <h1 className="ap-h2 mb-6" style={{ fontSize: "24px", lineHeight: 1.25 }}>{lesson.title}</h1>

              {/* Content area */}
              {lesson.type === "text" && (
                <div
                  className="ap-card"
                  style={{ whiteSpace: "pre-wrap", lineHeight: 1.75, fontSize: "15px", padding: "24px", minHeight: "200px" }}
                >
                  {lesson.content || <span className="ap-muted" style={{ fontStyle: "italic" }}>Aucun contenu.</span>}
                </div>
              )}

              {lesson.type === "quiz" && (
                <div className="ap-card" style={{ padding: "24px", textAlign: "center" }}>
                  <BookOpen className="mx-auto mb-4 h-8 w-8" style={{ color: "var(--ap-brand)" }} />
                  {linkedQuiz ? (
                    <>
                      <p className="ap-h3 mb-2">{linkedQuiz.title}</p>
                      <p className="ap-muted mb-5" style={{ fontSize: "14px" }}>
                        {linkedQuiz.questions?.length ?? 0} questions
                      </p>
                      <button
                        className="ap-btn ap-btn--sm ap-btn--pill"
                        style={{ background: "var(--ap-brand)", color: "#fff", border: "none" }}
                        onClick={() => navigate(`/quiz/${linkedQuiz.id}`)}
                      >
                        Commencer le quiz
                      </button>
                    </>
                  ) : (
                    <p className="ap-muted">Quiz non disponible.</p>
                  )}
                </div>
              )}

              {lesson.type === "flashcard" && (
                <div className="ap-card" style={{ padding: "24px", textAlign: "center" }}>
                  <Layers className="mx-auto mb-4 h-8 w-8" style={{ color: "var(--ap-brand)" }} />
                  {linkedFlashcard ? (
                    <>
                      <p className="ap-h3 mb-2">{linkedFlashcard.title}</p>
                      <p className="ap-muted mb-5" style={{ fontSize: "14px" }}>
                        {linkedFlashcard.questions?.length ?? 0} cartes
                      </p>
                      <button
                        className="ap-btn ap-btn--sm ap-btn--pill"
                        style={{ background: "var(--ap-brand)", color: "#fff", border: "none" }}
                        onClick={() => navigate(`/builder?type=flashcard&quizId=${linkedFlashcard.id}`)}
                      >
                        Étudier les flashcards
                      </button>
                    </>
                  ) : (
                    <p className="ap-muted">Set de flashcards non disponible.</p>
                  )}
                </div>
              )}

              {/* Complete toggle + nav */}
              <div className="mt-8 flex items-center justify-between flex-wrap gap-4">
                <button
                  className="ap-btn ap-btn--sm"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    border: isCompleted ? "2px solid var(--ap-brand)" : "2px solid var(--ap-line)",
                    color: isCompleted ? "var(--ap-brand)" : "var(--ap-ink)",
                    background: isCompleted ? "rgba(99,102,241,0.06)" : "var(--ap-card)",
                    borderRadius: "var(--ap-r-sm)",
                    fontWeight: 700,
                  }}
                  onClick={toggleComplete}
                >
                  {isCompleted ? (
                    <>
                      <RotateCcw className="h-3.5 w-3.5" /> Marquer comme non terminé
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Marquer comme terminé
                    </>
                  )}
                </button>

                <div className="flex items-center gap-3">
                  {prevLesson && (
                    <button
                      className="ap-btn ap-btn--ghost ap-btn--sm"
                      style={{ display: "flex", alignItems: "center", gap: "6px" }}
                      onClick={() => setCurrentLessonId(prevLesson.lesson.id)}
                    >
                      <ArrowLeft className="h-4 w-4" /> Précédent
                    </button>
                  )}
                  {nextLesson && (
                    <button
                      className="ap-btn ap-btn--sm ap-btn--pill"
                      style={{
                        background: "var(--ap-brand)",
                        color: "#fff",
                        border: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                      onClick={() => {
                        if (!isCompleted) toggleComplete();
                        setCurrentLessonId(nextLesson.lesson.id);
                      }}
                    >
                      Suivant <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                  {!nextLesson && !isCompleted && (
                    <button
                      className="ap-btn ap-btn--sm ap-btn--pill"
                      style={{ background: "var(--ap-brand)", color: "#fff", border: "none", display: "flex", alignItems: "center", gap: "6px" }}
                      onClick={() => { toggleComplete(); toast.success("Cours terminé ! 🎉"); }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Terminer le cours
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default CourseViewer;
