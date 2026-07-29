import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDraggable } from "@dnd-kit/core";
import { toast } from "sonner";
import { BookOpen, GraduationCap, GripVertical, Link2, Pencil, Sparkles, Star, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ContentExplorer } from "@/components/content/ContentExplorer";
import type { ItemCtx } from "@/components/content/GenericItem";
import { CourseContextMenu } from "@/components/CourseContextMenu";
import { CourseGeneratorModal } from "@/components/CourseGeneratorModal";
import { getCurrentUser } from "@/lib/auth";
import { getCourseProgress, type Course } from "@/lib/courseStorage";
import type { ContentDisplay } from "@/lib/content/contentView";
import { ContentCardHeader, ContentRowThumbnail } from "@/components/content/ContentCardHeader";
import { t } from "@/lib/i18n";

const CATEGORIES = ["Tous", "Informatique", "Langues", "Sciences", "Histoire", "Arts", "Business", "Santé", "Autre"];

const gripStyle: React.CSSProperties = {
  cursor: "grab", color: "var(--ap-muted)", display: "flex", alignItems: "center",
  touchAction: "none", flexShrink: 0, background: "none", border: "none", padding: 2,
};

/** Drag handle overlaid on the header block (top-left) so the title row keeps the full card width. */
const gripOverlayStyle: React.CSSProperties = {
  position: "absolute", top: 8, left: 8, display: "flex", alignItems: "center", justifyContent: "center",
  background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", color: "var(--ap-muted)",
  cursor: "grab", touchAction: "none", padding: 4, borderRadius: 6, zIndex: 1,
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
      className="ap-card ap-card--hover flex h-full cursor-pointer flex-col overflow-hidden p-0"
      style={{ opacity: isDragging ? 0.4 : 1, padding: 0 }}
      onClick={() => navigate(`/course/${course.id}`)}
    >
      <ContentCardHeader image={course.coverImage} alt={course.title} icon={GraduationCap} accent="var(--ap-pres)">
        <button type="button" {...attributes} {...listeners} style={gripOverlayStyle} className="ap-grip" onClick={(e) => e.stopPropagation()} aria-label={`Déplacer ${course.title}`}>
          <GripVertical style={{ width: 14, height: 14 }} />
        </button>
      </ContentCardHeader>
      <div className="flex flex-1 flex-col" style={{ padding: "var(--density-card-pad, 14px 16px 12px)" }}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="ap-h3 line-clamp-2" style={{ fontSize: "15px" }}>{course.title}</h3>
            {course.description && <p className="ap-muted mt-0.5 text-sm line-clamp-2">{course.description}</p>}
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
            <div style={{ height: 4, background: "var(--ap-line)", borderRadius: "var(--ap-r-sm)" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: "var(--ap-pres)", borderRadius: "var(--ap-r-sm)", transition: "width 0.3s" }} />
            </div>
          </div>
        )}

        <div className="mt-auto flex items-center gap-2 pt-3" style={{ borderTop: "var(--ap-border-w) solid var(--ap-line)" }} onClick={(e) => e.stopPropagation()}>
          <CourseContextMenu
            course={course}
            onEdit={() => navigate(`/course-builder?courseId=${course.id}`)}
            onDuplicate={ctx.onDuplicate}
            onToggleFavorite={ctx.onFavorite}
            onShare={() => shareCourse(course)}
            onManageAccess={ctx.onManageAccess}
            onTrash={ctx.onTrash}
          />
          <button
            className="ap-btn ap-btn--sm ap-btn--pill ap-btn--pres"
            style={{ flex: 1, gap: "6px", display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={(e) => { e.stopPropagation(); navigate(`/course/${course.id}`); }}
          >
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
      className="ap-row group flex items-center gap-4 cursor-pointer px-4 py-3 transition-colors"
      style={{ borderBottom: "var(--ap-border-w) solid var(--ap-line)", opacity: isDragging ? 0.4 : 1 }}
      onClick={() => navigate(`/course/${course.id}`)}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ap-paper-2)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <button type="button" {...attributes} {...listeners} style={gripStyle} className="ap-grip" onClick={(e) => e.stopPropagation()} aria-label={`Déplacer ${course.title}`}>
        <GripVertical className="h-4 w-4" />
      </button>
      <ContentRowThumbnail image={course.coverImage} alt={course.title} icon={GraduationCap} accent="var(--ap-pres)" />
      <div className="flex-1 min-w-0">
        <p className="ap-h3 truncate" style={{ fontSize: "14px", marginBottom: "2px" }}>{course.title}</p>
        {course.description && <p className="ap-muted truncate" style={{ fontSize: "12px" }}>{course.description}</p>}
        {total > 0 && progress && (
          <div style={{ height: 3, background: "var(--ap-line)", borderRadius: "var(--ap-r-sm)", marginTop: 4, width: 120 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "var(--ap-pres)", borderRadius: "var(--ap-r-sm)" }} />
          </div>
        )}
      </div>
      <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
        <span className="ap-pill" style={{ fontSize: "11px", padding: "2px 8px" }}>{total} leçon{total !== 1 ? "s" : ""}</span>
        {total > 0 && <span className="ap-pill" style={{ fontSize: "11px", padding: "2px 8px" }}>{pct}%</span>}
      </div>
      <div className="ap-hover-actions flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <button className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn" title="Modifier" aria-label={`Modifier ${course.title}`} onClick={() => navigate(`/course-builder?courseId=${course.id}`)}>
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn" title="Copier le lien" aria-label={`Copier le lien de ${course.title}`} onClick={ctx.onCopyLink}>
          <Link2 className="h-3.5 w-3.5" />
        </button>
        <button className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn" style={{ color: "var(--ap-quiz)" }} title="Mettre à la corbeille" aria-label={`Mettre ${course.title} à la corbeille`} onClick={ctx.onTrash}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <CourseContextMenu
          course={course}
          onEdit={() => navigate(`/course-builder?courseId=${course.id}`)}
          onDuplicate={ctx.onDuplicate}
          onToggleFavorite={ctx.onFavorite}
          onShare={() => shareCourse(course)}
          onManageAccess={ctx.onManageAccess}
          onTrash={ctx.onTrash}
        />
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
        headerTitle={t("myCourses")}
        headerSubtitle={t("myCoursesSubtitle")}
        rootLabel={t("explorerRootCourse")}
        oneLabel={t("explorerOneCourse")}
        categories={CATEGORIES}
        cta={{ label: t("createCourseCta"), onClick: () => navigate("/course-builder") }}
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
