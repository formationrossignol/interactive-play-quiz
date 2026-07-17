import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDraggable } from "@dnd-kit/core";
import { toast } from "sonner";
import { BookOpen, GraduationCap, GripVertical, Sparkles, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ContentExplorer } from "@/components/content/ContentExplorer";
import type { ItemCtx } from "@/components/content/GenericItem";
import { CourseContextMenu } from "@/components/CourseContextMenu";
import { CourseGeneratorModal } from "@/components/CourseGeneratorModal";
import { getCurrentUser } from "@/lib/auth";
import { getCourseProgress, type Course } from "@/lib/courseStorage";
import type { ContentDisplay } from "@/lib/content/contentView";

const CATEGORIES = ["Tous", "Informatique", "Langues", "Sciences", "Histoire", "Arts", "Business", "Santé", "Autre"];

const gripStyle: React.CSSProperties = {
  cursor: "grab", color: "var(--ap-muted)", display: "flex", alignItems: "center",
  touchAction: "none", flexShrink: 0, background: "none", border: "none", padding: 2,
};

const totalLessons = (course: Course) => course.modules.reduce((s, m) => s + m.lessons.length, 0);

interface CourseItemProps {
  d: ContentDisplay;
  ctx: ItemCtx;
  navigate: ReturnType<typeof useNavigate>;
  userId: string | undefined;
}

function CourseCard({ d, ctx, navigate, userId }: CourseItemProps) {
  const course = d.data as unknown as Course;
  const progress = userId ? getCourseProgress(course.id, userId) : null;
  const total = totalLessons(course);
  const completed = progress?.completedLessonIds.length ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: d.id });

  return (
    <div
      ref={setNodeRef}
      className="ap-card ap-card--hover flex h-full cursor-pointer flex-col overflow-hidden"
      style={{ opacity: isDragging ? 0.4 : 1 }}
      onClick={() => navigate(`/course/${course.id}`)}
    >
      {course.coverImage && (
        <div className="relative h-36 w-full overflow-hidden">
          <img src={course.coverImage} alt={course.title} className="h-full w-full object-cover" />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <button type="button" {...attributes} {...listeners} style={gripStyle} className="ap-grip" onClick={(e) => e.stopPropagation()} aria-label={`Déplacer ${course.title}`}>
              <GripVertical className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <h3 className="ap-h3 line-clamp-2" style={{ fontSize: "15px" }}>{course.title}</h3>
              {course.description && <p className="ap-muted mt-0.5 text-sm line-clamp-2">{course.description}</p>}
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); ctx.onFavorite(); }} className="text-amber-400 hover:text-amber-500 transition-colors p-1 flex-shrink-0">
            <Star className={`h-4 w-4 ${d.isFavorite ? "fill-amber-400" : ""}`} />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <Badge variant="outline" className={`rounded-full text-xs ${course.isPublic ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
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
              <div style={{ height: "100%", width: `${pct}%`, background: "var(--ap-pres)", borderRadius: 999, transition: "width 0.3s" }} />
            </div>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-3" style={{ borderTop: "2px solid var(--ap-line)" }} onClick={(e) => e.stopPropagation()}>
          <CourseContextMenu
            course={course}
            onEdit={() => navigate(`/course-builder?courseId=${course.id}`)}
            onDuplicate={() => toast.info("Duplication bientôt disponible")}
            onToggleFavorite={ctx.onFavorite}
            onShare={() => shareCourse(course)}
            onTrash={ctx.onTrash}
          />
          <button className="ap-btn ap-btn--sm ap-btn--pill ap-btn--pres" style={{ gap: "6px", display: "flex", alignItems: "center" }} onClick={(e) => { e.stopPropagation(); navigate(`/course/${course.id}`); }}>
            <BookOpen className="h-3.5 w-3.5" />
            {progress && completed > 0 ? "Continuer" : "Commencer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CourseRow({ d, ctx, navigate, userId }: CourseItemProps) {
  const course = d.data as unknown as Course;
  const progress = userId ? getCourseProgress(course.id, userId) : null;
  const total = totalLessons(course);
  const completed = progress?.completedLessonIds.length ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: d.id });

  return (
    <div
      ref={setNodeRef}
      className="ap-row flex items-center gap-4 cursor-pointer px-4 py-3 transition-colors"
      style={{ borderBottom: "2px solid var(--ap-line)", opacity: isDragging ? 0.4 : 1 }}
      onClick={() => navigate(`/course/${course.id}`)}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ap-paper-2)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <button type="button" {...attributes} {...listeners} style={gripStyle} className="ap-grip" onClick={(e) => e.stopPropagation()} aria-label={`Déplacer ${course.title}`}>
        <GripVertical className="h-4 w-4" />
      </button>
      <GraduationCap className="h-8 w-8 flex-shrink-0" style={{ color: "var(--ap-pres)" }} />
      <div className="flex-1 min-w-0">
        <p className="ap-h3 truncate" style={{ fontSize: "14px", marginBottom: "2px" }}>{course.title}</p>
        {course.description && <p className="ap-muted truncate" style={{ fontSize: "12px" }}>{course.description}</p>}
        {total > 0 && progress && (
          <div style={{ height: 3, background: "var(--ap-line)", borderRadius: 999, marginTop: 4, width: 120 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "var(--ap-pres)", borderRadius: 999 }} />
          </div>
        )}
      </div>
      <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
        <span className="ap-pill" style={{ fontSize: "11px", padding: "2px 8px" }}>{total} leçon{total !== 1 ? "s" : ""}</span>
        {total > 0 && <span className="ap-pill" style={{ fontSize: "11px", padding: "2px 8px" }}>{pct}%</span>}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <CourseContextMenu
          course={course}
          onEdit={() => navigate(`/course-builder?courseId=${course.id}`)}
          onDuplicate={() => toast.info("Duplication bientôt disponible")}
          onToggleFavorite={ctx.onFavorite}
          onShare={() => shareCourse(course)}
          onTrash={ctx.onTrash}
        />
        <button className="ap-btn ap-btn--sm ap-btn--pill ap-btn--pres" style={{ fontSize: "12px", padding: "4px 12px", display: "flex", alignItems: "center", gap: "4px" }} onClick={(e) => { e.stopPropagation(); navigate(`/course/${course.id}`); }}>
          <BookOpen className="h-3 w-3" />
          {progress && completed > 0 ? "Continuer" : "Commencer"}
        </button>
      </div>
    </div>
  );
}

function shareCourse(course: Course) {
  navigator.clipboard.writeText(`${window.location.origin}/course/${course.id}`).then(
    () => toast.success("Lien copié !"),
    () => toast.error("Impossible de copier le lien"),
  );
}

const MyCourses = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const reloadRef = useRef<(() => void) | null>(null);

  return (
    <>
      <ContentExplorer
        type="course"
        reloadRef={reloadRef}
        accentBtn="ap-btn--pres"
        headerTitle="Mes cours"
        headerSubtitle="Construisez et suivez vos supports interactifs"
        rootLabel="Tous les cours"
        oneLabel="cours"
        categories={CATEGORIES}
        cta={{ label: "Créer un cours", onClick: () => navigate("/course-builder") }}
        headerExtras={
          <button
            onClick={() => setGeneratorOpen(true)}
            className="ap-btn ap-btn--sm ap-btn--pill"
            style={{ background: "var(--ap-flash)", color: "var(--ap-ink)", border: "none", boxShadow: "0 4px 0 var(--ap-flash-deep)", gap: 6, display: "flex", alignItems: "center", fontWeight: 800 }}
          >
            <Sparkles className="h-4 w-4" /> Générer par IA
          </button>
        }
        renderCard={(d, ctx) => <CourseCard d={d} ctx={ctx} navigate={navigate} userId={user?.id} />}
        renderRow={(d, ctx) => <CourseRow d={d} ctx={ctx} navigate={navigate} userId={user?.id} />}
      />
      <CourseGeneratorModal open={generatorOpen} onClose={() => { setGeneratorOpen(false); reloadRef.current?.(); }} />
    </>
  );
};

export default MyCourses;
