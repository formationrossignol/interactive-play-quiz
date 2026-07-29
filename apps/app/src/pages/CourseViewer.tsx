import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Award,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  CirclePlay,
  Clock3,
  Download,
  FileText,
  Layers3,
  MonitorSmartphone,
  PackageOpen,
  PlaySquare,
  RefreshCw,
  ScrollText,
  Sparkles,
  Star,
  Trophy,
  Upload,
  Video,
} from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import {
  getCourseById,
  getCourseProgress,
  getCourseRatingSummary,
  getCourseReviews,
  getSubmission,
  getUserCourseReview,
  markLessonComplete,
  submitCourseReview,
  submitLessonFile,
  unmarkLessonComplete,
  type CourseReview,
  type CourseSubmission,
  type Lesson,
  type Module,
} from "@/lib/courseStorage";
import { getContentBySourceAnyOwner } from "@/lib/content/contentRepo";
import { getQuizById } from "@/lib/quizStorage";
import { assertSafeImportFile } from "@/lib/fileValidation";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { toast } from "sonner";
import { CourseCertificateDialog } from "@/components/CourseCertificateDialog";
import { ScormPlayer } from "@/components/ScormPlayer";
import { H5pPlayer } from "@/components/h5p/H5pPlayer";
import type { H5pTrackingRecord } from "@/lib/h5pTracking";
import defaultCourseOverviewImage from "@/assets/course-overview-default.jpg";

/* ─── Type system ──────────────────────────────────────────────── */
const TYPE_LABEL: Record<string, string> = {
  text: "Leçon", video: "Vidéo", quiz: "Quiz", poll: "Sondage", flashcard: "Flashcards",
  document: "Document", iframe: "Iframe", "file-upload": "Dépôt de fichier", scorm: "SCORM", h5p: "Activité H5P",
};

// Background color for the small square icon chip
const TYPE_IC_BG: Record<string, string> = {
  text:      "#2f7bff",
  video:     "var(--ap-brand)",
  quiz:      "var(--ap-quiz)",
  poll:      "var(--ap-poll)",
  flashcard: "var(--ap-flash)",
  document:  "var(--ap-pres)",
  iframe:    "var(--ap-pres)",
  "file-upload": "var(--ap-brand)",
  scorm:     "var(--ap-pres)",
  h5p:       "var(--ap-brand)",
};

// Kicker pill: [text color, bg, border]
const TYPE_KICKER: Record<string, [string, string, string]> = {
  text:      ["#1d55c0", "#eef4ff", "rgba(47,123,255,.4)"],
  video:     ["var(--ap-brand-deep)", "var(--ap-brand-soft)", "rgba(112,72,255,.4)"],
  quiz:      ["var(--ap-quiz-deep)", "var(--ap-quiz-soft)", "rgba(255,90,77,.4)"],
  poll:      ["var(--ap-poll-deep)", "var(--ap-poll-soft)", "rgba(47,123,255,.4)"],
  flashcard: ["var(--ap-flash-deep)", "var(--ap-flash-soft)", "rgba(255,176,32,.5)"],
  document:  ["var(--ap-pres-deep)", "var(--ap-pres-soft)", "rgba(21,192,138,.4)"],
  iframe:    ["var(--ap-pres-deep)", "var(--ap-pres-soft)", "rgba(21,192,138,.4)"],
  "file-upload": ["var(--ap-brand-deep)", "var(--ap-brand-soft)", "rgba(112,72,255,.4)"],
  scorm:     ["var(--ap-pres-deep)", "var(--ap-pres-soft)", "rgba(21,192,138,.4)"],
  h5p:       ["var(--ap-brand-deep)", "var(--ap-brand-soft)", "rgba(112,72,255,.4)"],
};

// Big icon background for launch cards
const TYPE_LAUNCH_BG: Record<string, string> = {
  quiz:      "var(--ap-quiz-soft)",
  poll:      "var(--ap-poll-soft)",
  flashcard: "var(--ap-flash-soft)",
  document:  "var(--ap-pres-soft)",
  scorm:     "var(--ap-pres-soft)",
};

/* ─── Lucide icons (type chips) ────────────────────────────────── */
const TypeIcon = ({ type }: { type: string }) => {
  const props = { width: 13, height: 13, color: "#fff", strokeWidth: 2.4 } as const;
  if (type === "text") return <FileText {...props} />;
  if (type === "video") return <Video {...props} />;
  if (type === "quiz") return <BookOpen {...props} />;
  if (type === "poll") return <BarChart3 {...props} />;
  if (type === "flashcard") return <Layers3 {...props} />;
  if (type === "file-upload") return <Upload {...props} />;
  if (type === "iframe") return <MonitorSmartphone {...props} />;
  if (type === "scorm") return <PackageOpen {...props} />;
  if (type === "h5p") return <PackageOpen {...props} />;
  return <Download {...props} />;
};

/* ─── Confetti ─────────────────────────────────────────────────── */
function launchConfetti() {
  const C = ["#ffb020","#ff5a4d","#7048ff","#2f7bff","#15c08a"];
  for (let i = 0; i < 36; i++) {
    const p = document.createElement("span");
    p.style.cssText = `position:fixed;width:9px;height:9px;border-radius:2px;pointer-events:none;z-index:9999;background:${C[i%5]};left:${Math.random()*innerWidth}px;top:-12px`;
    document.body.appendChild(p);
    p.animate([
      { transform: "translateY(0) rotate(0)", opacity: 1 },
      { transform: `translateY(${innerHeight*.75}px) rotate(${Math.random()*640-320}deg)`, opacity: 0 },
    ], { duration: 1200 + Math.random()*700, easing: "cubic-bezier(.2,.7,.3,1)" }).onfinish = () => p.remove();
  }
}

/* ─── YouTube helper ───────────────────────────────────────────── */
const extractYouTubeId = (url: string): string | null => {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
};

/* ─── Markdown renderer ────────────────────────────────────────── */
function renderMarkdown(md: string): string {
  return md
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>")
    .replace(/^(?!<[h1-6|ul|li|p])(.+)$/gm, "<p>$1</p>");
}

/* ─── Ring progress ────────────────────────────────────────────── */
const CIRC = 113.1;
const Ring = ({ pct, done, count, total }: { pct: number; done: boolean; count: number; total: number }) => (
  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
    <div style={{ position:"relative", width:44, height:44 }}>
      <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform:"rotate(-90deg)" }}>
        <circle cx="22" cy="22" r="18" fill="none" strokeWidth="5" strokeLinecap="round" stroke="var(--ap-paper-2)" />
        <circle
          cx="22" cy="22" r="18" fill="none" strokeWidth="5" strokeLinecap="round"
          stroke={done ? "var(--ap-flash)" : "var(--ap-brand)"}
          strokeDasharray={CIRC}
          strokeDashoffset={(CIRC * (1 - pct / 100)).toFixed(1)}
          style={{ transition:"stroke-dashoffset .8s cubic-bezier(.2,.7,.3,1), stroke .4s" }}
        />
      </svg>
      <div style={{ position:"absolute", inset:0, display:"grid", placeItems:"center", fontFamily:"var(--ap-font-display)", fontWeight:600, fontSize:12, fontVariantNumeric:"tabular-nums" }}>
        {pct}%
      </div>
    </div>
    <div style={{ fontSize:12, fontWeight:800, color:"var(--ap-muted)", lineHeight:1.3 }}>
      <div style={{ fontFamily:"var(--ap-font-mono)", fontSize:11.5, color:"var(--ap-ink)" }}>{count}/{total}</div>
      <div>leçons<br/>terminées</div>
    </div>
  </div>
);

/* ─── Course overview (Udemy/Coursera/edX-style landing) ──────────── */
type CourseData = NonNullable<ReturnType<typeof getCourseById>>;

interface CourseOverviewScreenProps {
  course: CourseData;
  totalLessons: number;
  completedCount: number;
  progressPct: number;
  allDone: boolean;
  allLessons: Array<{ lesson: Lesson; module: Module }>;
  completedIds: string[];
  ratingSummary: { average: number; count: number };
  reviews: CourseReview[];
  myReview: CourseReview | null;
  reviewRatingDraft: number;
  reviewCommentDraft: string;
  onSetReviewRatingDraft: (n: number) => void;
  onSetReviewCommentDraft: (s: string) => void;
  onSubmitReview: () => void;
  onStart: () => void;
}

const totalMinutes = (lessons: Array<{ lesson: Lesson }>) =>
  lessons.reduce((s, x) => s + (x.lesson.estimatedMinutes ?? 0), 0);

const formatCourseDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} h${rest ? ` ${rest} min` : ""}`;
};

const formatCourseDate = (value: string) => new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
}).format(new Date(value));

function CourseOverviewScreen({
  course, totalLessons, completedCount, progressPct, allDone, allLessons, completedIds,
  ratingSummary, reviews, myReview, reviewRatingDraft, reviewCommentDraft,
  onSetReviewRatingDraft, onSetReviewCommentDraft, onSubmitReview, onStart,
}: CourseOverviewScreenProps) {
  const started = completedCount > 0;
  const minutes = totalMinutes(allLessons);
  const ctaLabel = allDone ? "Revoir le cours" : started ? "Continuer le cours" : "Commencer le cours";
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    () => new Set(course.modules[0] ? [course.modules[0].id] : []),
  );
  const videoLessons = allLessons.filter(({ lesson }) => lesson.type === "video");
  const downloadableLessons = allLessons.filter(({ lesson }) => lesson.type === "document");
  const practiceLessons = allLessons.filter(({ lesson }) =>
    ["quiz", "poll", "file-upload", "h5p"].includes(lesson.type),
  );
  const textLessons = allLessons.filter(({ lesson }) => lesson.type === "text");
  const videoMinutes = totalMinutes(videoLessons);
  const allModulesExpanded = course.modules.length > 0
    && course.modules.every((module) => expandedModules.has(module.id));
  const courseFeatures = [
    {
      icon: CirclePlay,
      label: videoLessons.length > 0
        ? videoMinutes > 0
          ? `${formatCourseDuration(videoMinutes)} de vidéo à la demande`
          : `${videoLessons.length} vidéo${videoLessons.length !== 1 ? "s" : ""} à la demande`
        : `${totalLessons} session${totalLessons !== 1 ? "s" : ""} à la demande`,
    },
    ...(downloadableLessons.length > 0 ? [{
      icon: Download,
      label: `${downloadableLessons.length} ressource${downloadableLessons.length !== 1 ? "s" : ""} téléchargeable${downloadableLessons.length !== 1 ? "s" : ""}`,
    }] : []),
    ...(practiceLessons.length > 0 ? [{
      icon: BookOpen,
      label: `${practiceLessons.length} exercice${practiceLessons.length !== 1 ? "s" : ""} pratique${practiceLessons.length !== 1 ? "s" : ""}`,
    }] : []),
    { icon: MonitorSmartphone, label: "Accès sur mobile et ordinateur" },
    ...(textLessons.length > 0 ? [{
      icon: FileText,
      label: `${textLessons.length} article${textLessons.length !== 1 ? "s" : ""}`,
    }] : []),
    { icon: Award, label: "Certificat de fin de formation" },
  ];

  const toggleOverviewModule = (moduleId: string) => {
    setExpandedModules((current) => {
      const next = new Set(current);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const toggleAllModules = () => {
    setExpandedModules(
      allModulesExpanded ? new Set() : new Set(course.modules.map((module) => module.id)),
    );
  };

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
      {/* Hero */}
      <div style={{ position: "relative", height: 300, flexShrink: 0, overflow: "hidden" }}>
        <img
          src={course.coverImage || defaultCourseOverviewImage}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(10,8,30,.82), rgba(10,8,30,.15) 60%)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 40px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {course.category && (
                <span style={{
                  display: "inline-block", fontSize: 11.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase",
                  padding: "5px 12px", borderRadius: "var(--ap-r-sm)", background: "rgba(255,255,255,.15)", color: "#fff",
                }}>
                  {course.category}
                </span>
              )}
              {course.generatedByAI && (
                <span
                  title="Ce cours a été généré par IA à partir d'un document."
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 800,
                    padding: "5px 12px", borderRadius: "var(--ap-r-sm)", background: "rgba(255,255,255,.15)", color: "#fff",
                  }}
                >
                  <Sparkles style={{ width: 12, height: 12 }} />
                  Généré par IA
                </span>
              )}
            </div>
            <h1 style={{ fontFamily: "var(--ap-font-display)", fontWeight: 600, fontSize: "clamp(24px, 3.2vw, 34px)", color: "#fff", lineHeight: 1.15, marginBottom: 10 }}>
              {course.title}
            </h1>
            {course.description && (
              <p style={{ fontSize: 15, color: "rgba(255,255,255,.85)", maxWidth: 640, marginBottom: 12 }}>{course.description}</p>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.9)" }}>
              {ratingSummary.count > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Star style={{ width: 14, height: 14, color: "#f4970a" }} fill="#f4970a" /> {ratingSummary.average} ({ratingSummary.count} avis)
                </span>
              )}
              <span>{course.modules.length} module{course.modules.length > 1 ? "s" : ""}</span>
              <span>{totalLessons} leçon{totalLessons > 1 ? "s" : ""}</span>
              {minutes > 0 && <span>{minutes} min</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 11, fontSize: 12, fontWeight: 650, color: "rgba(255,255,255,.78)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <CalendarDays style={{ width: 13, height: 13 }} />
                Créé le {formatCourseDate(course.createdAt)}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <RefreshCw style={{ width: 13, height: 13 }} />
                Mis à jour le {formatCourseDate(course.updatedAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Body: 2-column layout */}
      <div className="cv-body-layout" style={{ display: "flex", gap: 40, maxWidth: 1100, margin: "0 auto", padding: "32px 40px 60px", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          {course.overview && (
            <div className="cv-prose" style={{ marginBottom: 32 }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(course.overview) }} />
          )}

          {course.objectives && course.objectives.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontFamily: "var(--ap-font-display)", fontWeight: 600, fontSize: 18, marginBottom: 12 }}>Ce que vous allez apprendre</h3>
              <ul className="cv-objective-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {course.objectives.map((obj, i) => (
                  <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14.5, lineHeight: 1.5 }}>
                    <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: "50%", background: "var(--ap-brand-soft)", color: "var(--ap-brand)", display: "grid", placeItems: "center", marginTop: 1 }}>
                      <Check style={{ width: 12, height: 12, strokeWidth: 3 }} />
                    </span>
                    {obj}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Course features */}
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontFamily: "var(--ap-font-display)", fontWeight: 600, fontSize: 22, marginBottom: 18 }}>Ce cours comprend :</h3>
            <div className="cv-feature-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 36, rowGap: 14 }}>
              {courseFeatures.map(({ icon: Icon, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <Icon style={{ width: 19, height: 19, flexShrink: 0, color: "var(--ap-ink)" }} strokeWidth={1.9} />
                  <span style={{ fontSize: 14.5, lineHeight: 1.4 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Course content */}
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontFamily: "var(--ap-font-display)", fontWeight: 600, fontSize: 22, marginBottom: 18 }}>Contenu du cours</h3>
            <div className="cv-course-meta" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 12 }}>
              <span style={{ fontSize: 13.5, color: "var(--ap-muted)" }}>
                {course.modules.length} section{course.modules.length !== 1 ? "s" : ""} · {totalLessons} session{totalLessons !== 1 ? "s" : ""} · {formatCourseDuration(minutes)} de durée totale
              </span>
              <button
                type="button"
                onClick={toggleAllModules}
                style={{
                  border: "none", background: "transparent", color: "var(--ap-brand)",
                  fontFamily: "var(--ap-font-body)", fontSize: 13, fontWeight: 800,
                  cursor: "pointer", whiteSpace: "nowrap", padding: 0,
                }}
              >
                {allModulesExpanded ? "Réduire toutes les sections" : "Développer toutes les sections"}
              </button>
            </div>
            <div style={{ border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-lg)", overflow: "hidden" }}>
              {course.modules.map((mod, mi) => (
                <div key={mod.id} style={{ borderBottom: mi < course.modules.length - 1 ? "var(--ap-border-w) solid var(--ap-line)" : "none" }}>
                  <button
                    type="button"
                    onClick={() => toggleOverviewModule(mod.id)}
                    aria-expanded={expandedModules.has(mod.id)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 12,
                      padding: "15px 16px", background: "var(--ap-paper-2)",
                      border: "none", cursor: "pointer", color: "var(--ap-ink)",
                      fontFamily: "var(--ap-font-body)", textAlign: "left",
                    }}
                  >
                    {expandedModules.has(mod.id)
                      ? <ChevronUp style={{ width: 17, height: 17, flexShrink: 0 }} />
                      : <ChevronDown style={{ width: 17, height: 17, flexShrink: 0 }} />}
                    <span style={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: 14 }}>{mod.title}</span>
                    <span style={{ flexShrink: 0, color: "var(--ap-muted)", fontSize: 12.5 }}>
                      {mod.lessons.length} session{mod.lessons.length !== 1 ? "s" : ""} · {formatCourseDuration(totalMinutes(mod.lessons.map((lesson) => ({ lesson }))))}
                    </span>
                  </button>
                  {expandedModules.has(mod.id) && mod.lessons.map((l) => (
                    <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px 11px 45px", borderTop: "var(--ap-border-w) solid var(--ap-line)", background: "var(--ap-card)" }}>
                      <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 7, display: "grid", placeItems: "center", background: TYPE_IC_BG[l.type] ?? "var(--ap-muted)" }}>
                        <TypeIcon type={l.type} />
                      </span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</span>
                      {completedIds.includes(l.id) && <Check style={{ width: 15, height: 15, color: "var(--ap-pres-deep)", strokeWidth: 3 }} />}
                      {l.estimatedMinutes && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0, fontFamily: "var(--ap-font-mono)", fontSize: 11, fontWeight: 700, color: "var(--ap-muted)" }}>
                          <Clock3 style={{ width: 12, height: 12 }} />
                          {l.estimatedMinutes} min
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Ratings & reviews */}
          <div style={{ paddingTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <h3 style={{ fontFamily: "var(--ap-font-display)", fontWeight: 600, fontSize: 18 }}>Avis</h3>
              {ratingSummary.count > 0 && (
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ap-muted)" }}>
                  ★ {ratingSummary.average} · {ratingSummary.count} avis
                </span>
              )}
            </div>

            <div style={{ background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-lg)", padding: 20, marginBottom: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{myReview ? "Modifier mon avis" : "Noter ce cours"}</p>
              <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => onSetReviewRatingDraft(n)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}
                    aria-label={`${n} étoiles`}
                  >
                    <Star style={{ width: 22, height: 22, color: n <= reviewRatingDraft ? "#f4970a" : "var(--ap-line-2)" }} fill={n <= reviewRatingDraft ? "#f4970a" : "none"} />
                  </button>
                ))}
              </div>
              <textarea
                value={reviewCommentDraft}
                onChange={(e) => onSetReviewCommentDraft(e.target.value)}
                placeholder="Votre avis (optionnel)..."
                rows={3}
                style={{ width: "100%", padding: "10px 14px", fontFamily: "var(--ap-font-body)", fontSize: 14, color: "var(--ap-ink)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-sm)", resize: "vertical", marginBottom: 12, boxSizing: "border-box" }}
              />
              <button
                onClick={onSubmitReview}
                className="cv-btn"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  fontFamily: "var(--ap-font-body)", fontWeight: 800, fontSize: 13.5,
                  padding: "10px 18px", borderRadius: "var(--ap-r-sm)", border: "none", cursor: "pointer",
                  color: "#fff", background: "var(--ap-brand)", boxShadow: "0 4px 0 var(--ap-brand-deep)",
                }}
              >
                {myReview ? "Mettre à jour mon avis" : "Publier mon avis"}
              </button>
            </div>

            {reviews.filter((r) => r.comment).length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {reviews.filter((r) => r.comment).map((r) => (
                  <div key={r.id} style={{ paddingBottom: 14, borderBottom: "var(--ap-border-w) solid var(--ap-line)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5 }}>{r.userName}</span>
                      <span style={{ display: "flex", gap: 1 }}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} style={{ width: 13, height: 13, color: n <= r.rating ? "#f4970a" : "var(--ap-line-2)" }} fill={n <= r.rating ? "#f4970a" : "none"} />
                        ))}
                      </span>
                    </div>
                    <p style={{ fontSize: 14, color: "var(--ap-ink)" }}>{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sticky CTA sidebar */}
        <div style={{ flex: "0 0 300px", position: "sticky", top: 24 }}>
          <div style={{ background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-lg)", boxShadow: "0 5px 0 var(--ap-line)", padding: 24 }}>
            {started && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12.5, fontWeight: 700, color: "var(--ap-muted)" }}>
                  <span>{progressPct}% terminé</span>
                  <span>{completedCount}/{totalLessons}</span>
                </div>
                <div style={{ height: 6, background: "var(--ap-line)", borderRadius: "var(--ap-r-sm)" }}>
                  <div style={{ height: "100%", width: `${progressPct}%`, background: allDone ? "var(--ap-flash)" : "var(--ap-brand)", borderRadius: "var(--ap-r-sm)", transition: "width .3s" }} />
                </div>
              </div>
            )}
            <button
              className="cv-btn"
              onClick={onStart}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                fontFamily: "var(--ap-font-body)", fontWeight: 800, fontSize: 15,
                padding: "14px 20px", borderRadius: "var(--ap-r-sm)", border: "none", cursor: "pointer",
                color: "#fff", background: "var(--ap-brand)", boxShadow: "0 4px 0 var(--ap-brand-deep)",
              }}
            >
              {ctaLabel}
              <PlaySquare style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
const CourseViewer = () => {
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const learningPathId = searchParams.get("pathId");
  const user = getCurrentUser();

  const [course, setCourse] = useState<ReturnType<typeof getCourseById>>(null);
  const [progress, setProgress] = useState<ReturnType<typeof getCourseProgress>>(null);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set());
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const [doneBtnPop, setDoneBtnPop] = useState(false);
  const [certificateOpen, setCertificateOpen] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);
  const confettiFiredRef = useRef(false);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    if (!courseId) { navigate("/my-courses"); return; }

    const local = getCourseById(courseId);
    if (local && (local.userId === user.id || local.isPublic)) {
      setCourse(local);
      setProgress(getCourseProgress(courseId, user.id));
      // No auto-select: land on the course overview first (like Udemy/Coursera/edX),
      // "Commencer"/"Continuer" is what takes the learner into a lesson.
      return;
    }

    // Not in this browser's localStorage — the viewer isn't the owner (shared,
    // public, or cross-device access). Fall back to the Supabase mirror; RLS
    // decides whether this viewer is actually allowed to see it.
    let cancelled = false;
    getContentBySourceAnyOwner('course', courseId)
      .then((row) => {
        if (cancelled) return;
        if (!row) { toast.error("Cours introuvable"); navigate("/my-courses"); return; }
        setCourse(row.data as unknown as CourseData);
        setProgress(getCourseProgress(courseId, user.id));
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("Cours introuvable");
        navigate("/my-courses");
      });
    return () => { cancelled = true; };
  }, [courseId]);

  const allLessons = useMemo<Array<{ lesson: Lesson; module: Module }>>(() => {
    if (!course) return [];
    return course.modules.flatMap((m) => m.lessons.map((l) => ({ lesson: l, module: m })));
  }, [course]);

  // Scroll to top on lesson change
  useEffect(() => { mainRef.current?.scrollTo({ top: 0, behavior: "instant" }); }, [currentLessonId]);

  // Auto-expand module containing current lesson
  useEffect(() => {
    if (!currentLessonId || !course) return;
    const owner = course.modules.find((m) => m.lessons.some((l) => l.id === currentLessonId));
    if (owner) setCollapsedModules((prev) => { if (!prev.has(owner.id)) return prev; const n = new Set(prev); n.delete(owner.id); return n; });
  }, [currentLessonId, course]);

  // PDF blob URL
  useEffect(() => {
    const l = allLessons.find((x) => x.lesson.id === currentLessonId)?.lesson;
    if (!l || l.type !== "document" || l.documentMimeType !== "application/pdf" || !l.content) { setPdfObjectUrl(null); return; }
    const base64 = l.content.split(",")[1];
    if (!base64) { setPdfObjectUrl(null); return; }
    const bytes = atob(base64);
    const buf = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
    const blob = new Blob([buf], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    setPdfObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [currentLessonId, allLessons]);

  const completedIds = progress?.completedLessonIds ?? [];
  /** First not-yet-completed lesson, or the very first lesson if none are done. Used by the overview's start/resume CTA. */
  const nextUpLesson = () => allLessons.find((x) => !completedIds.includes(x.lesson.id)) ?? allLessons[0];
  const totalLessons = allLessons.length;
  const completedCount = allLessons.filter((x) => completedIds.includes(x.lesson.id)).length;
  const progressPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
  const allDone = totalLessons > 0 && completedCount === totalLessons;

  // Confetti on course completion
  useEffect(() => {
    if (allDone && !confettiFiredRef.current) {
      confettiFiredRef.current = true;
      launchConfetti();
    }
  }, [allDone]);

  const currentIdx = allLessons.findIndex((x) => x.lesson.id === currentLessonId);
  const currentEntry = allLessons[currentIdx];
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;
  const isCompleted = currentLessonId ? completedIds.includes(currentLessonId) : false;

  const lesson = currentEntry?.lesson;
  const lessonModule = currentEntry?.module;
  const linkedQuiz = lesson?.type === "quiz" && lesson.linkedItemId ? getQuizById(lesson.linkedItemId) : null;
  const linkedPoll = lesson?.type === "poll" && lesson.linkedItemId ? getQuizById(lesson.linkedItemId) : null;
  const linkedFlashcard = lesson?.type === "flashcard" && lesson.linkedItemId ? getQuizById(lesson.linkedItemId) : null;

  const [submission, setSubmission] = useState<CourseSubmission | null>(null);
  useEffect(() => {
    if (!user || !course || !currentLessonId) { setSubmission(null); return; }
    setSubmission(getSubmission(course.id, currentLessonId, user.id));
  }, [user, course, currentLessonId]);

  const handleLessonFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !course || !currentLessonId) return;
    try {
      assertSafeImportFile(file, 8 * 1024 * 1024);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fichier invalide");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSubmission(submitLessonFile(course.id, currentLessonId, file.name, reader.result as string));
      toast.success("Fichier déposé");
    };
    reader.readAsDataURL(file);
  };

  // ── Ratings & reviews (shown on the course landing state, when no lesson is selected) ──
  const [reviews, setReviews] = useState<CourseReview[]>([]);
  const [myReview, setMyReview] = useState<CourseReview | null>(null);
  const [reviewRatingDraft, setReviewRatingDraft] = useState(0);
  const [reviewCommentDraft, setReviewCommentDraft] = useState("");
  useEffect(() => {
    if (!course) return;
    setReviews(getCourseReviews(course.id));
    const mine = user ? getUserCourseReview(course.id, user.id) : null;
    setMyReview(mine);
    setReviewRatingDraft(mine?.rating ?? 0);
    setReviewCommentDraft(mine?.comment ?? "");
  }, [course, user]);
  const ratingSummary = course ? getCourseRatingSummary(course.id) : { average: 0, count: 0 };

  const handleSubmitReview = () => {
    if (!course || reviewRatingDraft === 0) { toast.error("Choisissez une note"); return; }
    const review = submitCourseReview(course.id, reviewRatingDraft, reviewCommentDraft);
    setMyReview(review);
    setReviews(getCourseReviews(course.id));
    toast.success("Avis enregistré, merci !");
  };

  const toggleComplete = () => {
    if (!user || !course || !currentLessonId) return;
    const wasCompleted = isCompleted;
    if (wasCompleted) unmarkLessonComplete(course.id, currentLessonId, user.id);
    else markLessonComplete(course.id, currentLessonId, user.id);
    setProgress(getCourseProgress(course.id, user.id));
    // Pop animation
    setDoneBtnPop(true);
    setTimeout(() => setDoneBtnPop(false), 450);
    // Auto-advance after marking done
    if (!wasCompleted && nextLesson) {
      setTimeout(() => setCurrentLessonId(nextLesson.lesson.id), 750);
    }
  };

  const handleH5pTrackingChange = (record: H5pTrackingRecord) => {
    if (!user || !course || !currentLessonId) return;
    if (!["passed", "completed"].includes(record.status)) return;
    if (progress?.completedLessonIds.includes(currentLessonId)) return;
    markLessonComplete(course.id, currentLessonId, user.id);
    setProgress(getCourseProgress(course.id, user.id));
  };

  const toggleModule = (id: string) => {
    setCollapsedModules((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  if (!user || !course) return null;

  const kicker = TYPE_KICKER[lesson?.type ?? "text"] ?? TYPE_KICKER.text;

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div style={{
      height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column",
      fontFamily: "var(--ap-font-body)", color: "var(--ap-ink)",
      background: "var(--ap-paper)",
      backgroundImage: "var(--ap-texture)",
      backgroundSize: "26px 26px",
      WebkitFontSmoothing: "antialiased",
    }}>
      <style>{`
        @keyframes cv-pop { 45% { transform: scale(1.25); } }
        @keyframes cv-rise { from { opacity:0; transform:translateY(14px); } }
        @keyframes cv-check-pop { 45% { transform:scale(1.25); } }
        .cv-mod-num.pop { animation: cv-pop .45s cubic-bezier(.2,.7,.3,1.3); }
        .cv-lsn-check.pop { animation: cv-check-pop .45s cubic-bezier(.2,.7,.3,1.3); }
        .cv-done-btn.pop { animation: cv-pop .45s cubic-bezier(.2,.7,.3,1.3); }
        .cv-finish { display:none; }
        .cv-finish.show { display:flex; animation: cv-rise .5s cubic-bezier(.2,.7,.3,1.3); }
        .cv-lsn { transition: background .15s, border-color .15s; }
        .cv-lsn:hover { background: var(--ap-paper) !important; }
        .cv-mod-head { transition: border-color .15s, background .15s; }
        .cv-mod-head:hover { border-color: var(--ap-line-2) !important; }
        .cv-back { transition: transform .15s cubic-bezier(.2,.7,.3,1.3), box-shadow .15s cubic-bezier(.2,.7,.3,1.3); }
        .cv-back:hover { transform: translateY(-1px); box-shadow: 0 4px 0 var(--ap-line-2) !important; }
        .cv-back:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--ap-line) !important; }
        .cv-btn { transition: transform .15s cubic-bezier(.2,.7,.3,1.3), box-shadow .15s cubic-bezier(.2,.7,.3,1.3), filter .15s; }
        .cv-btn:hover { transform: translateY(-2px); filter: brightness(1.05); }
        .cv-btn:active { transform: translateY(3px); }
        .cv-play { transition: transform .15s cubic-bezier(.2,.7,.3,1.3); }
        .cv-play:hover { transform: scale(1.07); }
        .cv-play:active { transform: scale(.96) translateY(3px); }
        .cv-prose { font-size:16.5px; line-height:1.7; color: var(--ap-ink); }
        .cv-prose p { margin-bottom:16px; max-width:68ch; }
        .cv-prose h2 { font-family:var(--ap-font-display); font-weight:600; font-size:20px; margin:28px 0 10px; }
        .cv-prose h3 { font-family:var(--ap-font-display); font-weight:600; font-size:17px; margin:22px 0 8px; }
        .cv-prose strong { font-weight:800; }
        .cv-prose em { font-style:italic; }
        .cv-prose ul { margin-bottom:16px; padding-left:20px; }
        .cv-prose li { margin-bottom:6px; }
        .cv-prose code { font-family:var(--ap-font-mono); font-size:.82em; font-weight:700; background:var(--ap-paper-2); border:1px solid var(--ap-line); border-radius:6px; padding:1px 6px; }
        .cv-prose .keypoint { border-left:4px solid var(--ap-brand); background:var(--ap-brand-soft); border-radius:0 14px 14px 0; padding:13px 16px; margin:18px 0; font-weight:700; font-size:15px; color:var(--ap-brand-deep); max-width:68ch; }
        .cv-plan::-webkit-scrollbar { width:8px; }
        .cv-plan::-webkit-scrollbar-thumb { background:var(--ap-line-2); border-radius:4px; }
        .cv-content::-webkit-scrollbar { width:10px; }
        .cv-content::-webkit-scrollbar-thumb { background:var(--ap-line-2); border-radius:5px; }
        @media (max-width: 860px) {
          .cv-body-layout { flex-direction:column; padding:24px 20px 48px !important; }
          .cv-body-layout > div { width:100%; }
          .cv-feature-grid, .cv-objective-grid { grid-template-columns:1fr !important; }
          .cv-course-meta { align-items:flex-start !important; flex-direction:column; }
        }
      `}</style>

      {/* ── Topbar ──────────────────────────────────────────── */}
      <div style={{
        height: 62, flexShrink: 0, zIndex: 20,
        background: "var(--ap-card)", borderBottom: "var(--ap-border-w) solid var(--ap-line)",
        display: "flex", alignItems: "center", gap: 14, padding: "0 18px",
      }}>
        <Breadcrumb
          onHome={() => { window.location.href = "/"; }}
          items={[
            learningPathId
              ? { label: "Parcours", onClick: () => navigate(`/learning-path/${learningPathId}`) }
              : { label: "Mes cours", onClick: () => navigate("/my-courses") },
            { label: course.title },
          ]}
        />

        <div style={{ flex: 1 }} />

        {currentLessonId && (
          <button
            className="ap-btn ap-btn--ghost ap-btn--sm"
            onClick={() => setCurrentLessonId(null)}
          >
            Aperçu du cours
          </button>
        )}
        <Ring pct={progressPct} done={allDone} count={completedCount} total={totalLessons} />
      </div>

      {/* ── Body ────────────────────────────────────────────── */}
      {!currentLessonId ? (
        <CourseOverviewScreen
          course={course}
          totalLessons={totalLessons}
          completedCount={completedCount}
          progressPct={progressPct}
          allDone={allDone}
          allLessons={allLessons}
          completedIds={completedIds}
          ratingSummary={ratingSummary}
          reviews={reviews}
          myReview={myReview}
          reviewRatingDraft={reviewRatingDraft}
          reviewCommentDraft={reviewCommentDraft}
          onSetReviewRatingDraft={setReviewRatingDraft}
          onSetReviewCommentDraft={setReviewCommentDraft}
          onSubmitReview={handleSubmitReview}
          onStart={() => setCurrentLessonId(nextUpLesson()?.lesson.id ?? null)}
        />
      ) : (
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "320px 1fr" }}>

        {/* Sidebar */}
        <nav className="cv-plan" style={{
          borderRight: "var(--ap-border-w) solid var(--ap-line)", background: "var(--ap-card)",
          overflowY: "auto", padding: "14px 12px 24px",
        }}>
          {course.modules.map((mod, mi) => {
            const dCount = mod.lessons.filter((l) => completedIds.includes(l.id)).length;
            const modComplete = dCount === mod.lessons.length;
            const collapsed = collapsedModules.has(mod.id);
            return (
              <div key={mod.id} style={{ marginBottom: 10 }}>
                <button
                  className="cv-mod-head"
                  onClick={() => toggleModule(mod.id)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                    background: "var(--ap-paper)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-md)",
                    padding: "10px 12px", cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  <span
                    className="cv-mod-num"
                    style={{
                      flexShrink: 0, width: 26, height: 26, borderRadius: 8,
                      display: "grid", placeItems: "center",
                      fontFamily: "var(--ap-font-display)", fontWeight: 600, fontSize: 13,
                      background: modComplete ? "var(--ap-pres-deep)" : "var(--ap-paper-2)",
                      color: modComplete ? "#fff" : "var(--ap-muted)",
                      transition: "background .3s, color .3s",
                    }}
                  >
                    {modComplete ? "✓" : mi + 1}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ display: "block", fontSize: 13.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mod.title}</b>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ap-muted)" }}>{dCount}/{mod.lessons.length} leçons</span>
                  </span>
                  <span style={{ flexShrink: 0, transform: collapsed ? "rotate(-90deg)" : undefined, transition: "transform .25s cubic-bezier(.2,.7,.3,1)" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ap-muted)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 10l5 5 5-5"/>
                    </svg>
                  </span>
                </button>

                {!collapsed && (
                  <div style={{ paddingLeft: 10, paddingTop: 6, paddingBottom: 2 }}>
                    {mod.lessons.map((l) => {
                      const done = completedIds.includes(l.id);
                      const active = l.id === currentLessonId;
                      return (
                        <button
                          key={l.id}
                          className="cv-lsn"
                          onClick={() => setCurrentLessonId(l.id)}
                          style={{
                            width: "100%", display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                            background: active ? "var(--ap-brand-soft)" : "transparent",
                            border: `2px solid ${active ? "color-mix(in srgb, var(--ap-brand) 35%, transparent)" : "transparent"}`,
                            borderRadius: "var(--ap-r-sm)",
                            padding: "8px 9px", marginBottom: 3, cursor: "pointer", fontFamily: "inherit",
                          }}
                        >
                          {/* Check circle */}
                          <span
                            className="cv-lsn-check"
                            style={{
                              flexShrink: 0, width: 22, height: 22, borderRadius: "50%",
                              border: `2px solid ${done ? "var(--ap-pres-deep)" : "var(--ap-line-2)"}`,
                              display: "grid", placeItems: "center",
                              background: done ? "var(--ap-pres-deep)" : "transparent",
                              transition: "background .25s, border-color .25s",
                            }}
                          >
                            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke={done ? "#fff" : "transparent"} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 12.5 10 17.5 19 7"/>
                            </svg>
                          </span>
                          {/* Type icon */}
                          <span style={{
                            flexShrink: 0, width: 24, height: 24, borderRadius: 7,
                            display: "grid", placeItems: "center",
                            background: TYPE_IC_BG[l.type] ?? "var(--ap-muted)",
                          }}>
                            <TypeIcon type={l.type} />
                          </span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: done ? "var(--ap-muted)" : "var(--ap-ink)" }}>
                            {l.title}
                          </span>
                          {l.estimatedMinutes && (
                            <span style={{ flexShrink: 0, fontFamily: "var(--ap-font-mono)", fontSize: 10.5, fontWeight: 700, color: "var(--ap-muted)", fontVariantNumeric: "tabular-nums" }}>
                              {l.estimatedMinutes} min
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Content */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div ref={mainRef} className="cv-content" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>

          {/* Completion banner */}
          <div
            className={`cv-finish${allDone ? " show" : ""}`}
            style={{
              margin: "0 32px 24px", maxWidth: 720, marginLeft: "auto", marginRight: "auto",
              background: "var(--ap-card)",
              border: "var(--ap-border-w) solid var(--ap-line)",
              borderLeft: "5px solid var(--ap-brand)",
              borderRadius: "var(--ap-r-lg)", boxShadow: "var(--ap-shadow-soft)",
              padding: "20px 24px", alignItems: "center", gap: 16, flexWrap: "wrap",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 44,
                height: 44,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                borderRadius: "var(--ap-r-md)",
                background: "var(--ap-brand-soft)",
                color: "var(--ap-brand)",
              }}
            >
              <Trophy size={23} />
            </span>
            <div>
              <h3 style={{ fontFamily: "var(--ap-font-display)", fontWeight: 600, fontSize: 19 }}>Cours terminé, bravo !</h3>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ap-muted)" }}>
                {totalLessons} leçon{totalLessons > 1 ? "s" : ""} · {course.modules.length} module{course.modules.length > 1 ? "s" : ""} · tout validé.
              </p>
            </div>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              className="ap-btn ap-btn--sm"
              onClick={() => setCertificateOpen(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 9,
                fontFamily: "var(--ap-font-body)", fontWeight: 800, fontSize: 14.5,
                padding: "12px 18px", cursor: "pointer",
              }}
            >
              <ScrollText size={17} />
              Obtenir mon attestation
            </button>
          </div>

          {/* Lesson content */}
          {lesson && (
            <div style={{ maxWidth: 720, margin: "0 auto", padding: "34px 32px 60px" }}>

              {/* Lesson header */}
              <header style={{ marginBottom: 22 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  fontSize: 11.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase",
                  padding: "5px 12px", borderRadius: "var(--ap-r-sm)", border: `2px solid ${kicker[2]}`,
                  color: kicker[0], background: kicker[1],
                }}>
                  {TYPE_LABEL[lesson.type] ?? lesson.type}
                  {lesson.estimatedMinutes ? ` · ${lesson.estimatedMinutes} min` : ""}
                </span>
                <h1 style={{
                  fontFamily: "var(--ap-font-display)", fontWeight: 600,
                  fontSize: "clamp(24px, 3vw, 32px)", marginTop: 12, lineHeight: 1.15,
                }}>
                  {lesson.title}
                </h1>
              </header>

              {/* ── Text ── */}
              {lesson.type === "text" && (
                lesson.content ? (
                  <div className="cv-prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(lesson.content) }} />
                ) : (
                  <p style={{ color: "var(--ap-muted)", fontStyle: "italic", fontSize: 14 }}>Aucun contenu rédigé.</p>
                )
              )}

              {/* ── Video ── */}
              {lesson.type === "video" && (
                !lesson.videoUrl ? (
                  <div style={{
                    aspectRatio: "16/9", borderRadius: "var(--ap-r-lg)",
                    background: "linear-gradient(135deg, #2d2150, var(--ap-ink))",
                    display: "grid", placeItems: "center",
                    border: "var(--ap-border-w) solid var(--ap-line)", boxShadow: "0 5px 0 var(--ap-line)",
                  }}>
                    <p style={{ color: "rgba(255,255,255,.5)", fontSize: 14, fontWeight: 700 }}>Aucune vidéo configurée.</p>
                  </div>
                ) : lesson.videoType === "youtube" && extractYouTubeId(lesson.videoUrl) ? (
                  <div style={{ aspectRatio: "16/9", borderRadius: "var(--ap-r-lg)", overflow: "hidden", border: "var(--ap-border-w) solid var(--ap-line)", boxShadow: "0 5px 0 var(--ap-line)" }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${extractYouTubeId(lesson.videoUrl)}`}
                      style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      title={lesson.title}
                    />
                  </div>
                ) : (
                  <div style={{ borderRadius: "var(--ap-r-lg)", overflow: "hidden", border: "var(--ap-border-w) solid var(--ap-line)", boxShadow: "0 5px 0 var(--ap-line)" }}>
                    <video src={lesson.videoUrl} controls style={{ width: "100%", maxHeight: "70vh", display: "block", background: "#000" }} />
                  </div>
                )
              )}

              {/* ── Quiz launch card ── */}
              {lesson.type === "quiz" && (
                <div style={{
                  background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-lg)",
                  boxShadow: "0 5px 0 var(--ap-line)", padding: 24,
                  display: "flex", alignItems: "center", gap: 20,
                }}>
                  <span style={{
                    flexShrink: 0, width: 64, height: 64, borderRadius: "var(--ap-r-md)",
                    display: "grid", placeItems: "center", fontSize: 30,
                    background: TYPE_LAUNCH_BG.quiz,
                  }} aria-hidden="true">🎯</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontFamily: "var(--ap-font-display)", fontWeight: 600, fontSize: 18 }}>
                      {linkedQuiz ? linkedQuiz.title : lesson.title}
                    </h3>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ap-muted)", marginTop: 3 }}>
                      {linkedQuiz ? `${linkedQuiz.questions?.length ?? 0} questions` : "Quiz non lié"}
                    </p>
                  </div>
                  {linkedQuiz && (
                    <button
                      className="cv-btn"
                      onClick={() => navigate(`/quiz/${linkedQuiz.id}`)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 9,
                        fontFamily: "var(--ap-font-body)", fontWeight: 800, fontSize: 14.5,
                        padding: "12px 22px", borderRadius: "var(--ap-r-sm)", border: "none", cursor: "pointer",
                        color: "#fff", background: "var(--ap-brand)", boxShadow: "0 4px 0 var(--ap-brand-deep)",
                      }}
                    >
                      Lancer
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                    </button>
                  )}
                </div>
              )}

              {/* ── Poll launch card ── */}
              {lesson.type === "poll" && (
                <div style={{
                  background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-lg)",
                  boxShadow: "0 5px 0 var(--ap-line)", padding: 24,
                  display: "flex", alignItems: "center", gap: 20,
                }}>
                  <span style={{
                    flexShrink: 0, width: 64, height: 64, borderRadius: "var(--ap-r-md)",
                    display: "grid", placeItems: "center", fontSize: 30,
                    background: TYPE_LAUNCH_BG.poll,
                  }} aria-hidden="true">📊</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontFamily: "var(--ap-font-display)", fontWeight: 600, fontSize: 18 }}>
                      {linkedPoll ? linkedPoll.title : lesson.title}
                    </h3>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ap-muted)", marginTop: 3 }}>
                      {linkedPoll ? `${linkedPoll.questions?.length ?? 0} questions` : "Sondage non lié"}
                    </p>
                  </div>
                  {linkedPoll && (
                    <button
                      className="cv-btn"
                      onClick={() => navigate(`/quiz/${linkedPoll.id}`)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 9,
                        fontFamily: "var(--ap-font-body)", fontWeight: 800, fontSize: 14.5,
                        padding: "12px 22px", borderRadius: "var(--ap-r-sm)", border: "none", cursor: "pointer",
                        color: "#fff", background: "var(--ap-poll)", boxShadow: "0 4px 0 var(--ap-poll-deep)",
                      }}
                    >
                      Lancer
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                    </button>
                  )}
                </div>
              )}

              {/* ── Flashcard launch card ── */}
              {lesson.type === "flashcard" && (
                <div style={{
                  background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-lg)",
                  boxShadow: "0 5px 0 var(--ap-line)", padding: 24,
                  display: "flex", alignItems: "center", gap: 20,
                }}>
                  <span style={{
                    flexShrink: 0, width: 64, height: 64, borderRadius: "var(--ap-r-md)",
                    display: "grid", placeItems: "center", fontSize: 30,
                    background: TYPE_LAUNCH_BG.flashcard,
                  }} aria-hidden="true">🃏</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontFamily: "var(--ap-font-display)", fontWeight: 600, fontSize: 18 }}>
                      {linkedFlashcard ? linkedFlashcard.title : lesson.title}
                    </h3>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ap-muted)", marginTop: 3 }}>
                      {linkedFlashcard ? `${linkedFlashcard.questions?.length ?? 0} cartes` : "Set non lié"}
                    </p>
                  </div>
                  {linkedFlashcard && (
                    <button
                      className="cv-btn"
                      onClick={() => navigate(`/builder?type=flashcard&quizId=${linkedFlashcard.id}`)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 9,
                        fontFamily: "var(--ap-font-body)", fontWeight: 800, fontSize: 14.5,
                        padding: "12px 22px", borderRadius: "var(--ap-r-sm)", border: "none", cursor: "pointer",
                        color: "#fff", background: "var(--ap-brand)", boxShadow: "0 4px 0 var(--ap-brand-deep)",
                      }}
                    >
                      Réviser
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                    </button>
                  )}
                </div>
              )}

              {/* ── H5P interactive activity ── */}
              {lesson.type === "h5p" && (
                lesson.h5pPackageId && lesson.h5pOwnerId ? (
                  <H5pPlayer
                    key={`${lesson.id}-${lesson.h5pPackageId}`}
                    ownerId={lesson.h5pOwnerId}
                    packageId={lesson.h5pPackageId}
                    lessonId={lesson.id}
                    courseId={course.id}
                    user={user}
                    onTrackingChange={handleH5pTrackingChange}
                  />
                ) : (
                  <div style={{
                    background: "var(--ap-card)",
                    border: "var(--ap-border-w) solid var(--ap-line)",
                    borderRadius: "var(--ap-r-lg)",
                    boxShadow: "0 5px 0 var(--ap-line)",
                    padding: 24,
                    display: "flex",
                    alignItems: "center",
                    gap: 20,
                  }}>
                    <span style={{
                      flexShrink: 0,
                      width: 64,
                      height: 64,
                      borderRadius: "var(--ap-r-md)",
                      display: "grid",
                      placeItems: "center",
                      background: "var(--ap-brand-soft)",
                    }}>
                      <PackageOpen size={30} color="var(--ap-brand)" />
                    </span>
                    <p style={{ color: "var(--ap-muted)", fontWeight: 700, fontSize: 14 }}>
                      Aucun paquet H5P n’est associé à cette leçon.
                    </p>
                  </div>
                )
              )}

              {/* ── Document ── */}
              {lesson.type === "document" && (
                !lesson.content ? (
                  <div style={{
                    background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-lg)",
                    boxShadow: "0 5px 0 var(--ap-line)", padding: 24,
                    display: "flex", alignItems: "center", gap: 20,
                  }}>
                    <span style={{ flexShrink: 0, width: 64, height: 64, borderRadius: "var(--ap-r-md)", display: "grid", placeItems: "center", fontSize: 30, background: TYPE_LAUNCH_BG.document }}>🧪</span>
                    <p style={{ color: "var(--ap-muted)", fontWeight: 700, fontSize: 14 }}>Aucun document importé.</p>
                  </div>
                ) : lesson.documentMimeType === "text/markdown" ? (
                  <div
                    className="cv-prose"
                    style={{ background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-lg)", boxShadow: "0 5px 0 var(--ap-line)", padding: "28px 32px" }}
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMarkdown(lesson.content)) }}
                  />
                ) : lesson.documentMimeType === "application/pdf" ? (
                  <div style={{ borderRadius: "var(--ap-r-lg)", overflow: "hidden", border: "var(--ap-border-w) solid var(--ap-line)", boxShadow: "0 5px 0 var(--ap-line)" }}>
                    {pdfObjectUrl
                      ? <iframe src={pdfObjectUrl} title={lesson.documentName ?? "Document"} style={{ width: "100%", height: "75vh", border: "none", display: "block" }} />
                      : <div style={{ padding: 18 }} role="status" aria-label="Chargement du document"><Skeleton className="h-[70vh] w-full rounded-xl" /></div>
                    }
                  </div>
                ) : (
                  <div style={{
                    background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-lg)",
                    boxShadow: "0 5px 0 var(--ap-line)", padding: 24,
                    display: "flex", alignItems: "center", gap: 20,
                  }}>
                    <span style={{ flexShrink: 0, width: 64, height: 64, borderRadius: "var(--ap-r-md)", display: "grid", placeItems: "center", fontSize: 30, background: TYPE_LAUNCH_BG.document }}>🧪</span>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontFamily: "var(--ap-font-display)", fontWeight: 600, fontSize: 18 }}>{lesson.documentName}</h3>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ap-muted)", marginTop: 3 }}>Aperçu non disponible, téléchargez.</p>
                    </div>
                    <a
                      href={lesson.content} download={lesson.documentName}
                      className="cv-btn"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 9,
                        fontFamily: "var(--ap-font-body)", fontWeight: 800, fontSize: 14.5,
                        padding: "12px 22px", borderRadius: "var(--ap-r-sm)", border: "none", cursor: "pointer",
                        color: "var(--ap-ink)", background: "var(--ap-card)", textDecoration: "none",
                        boxShadow: "0 4px 0 var(--ap-line), inset 0 0 0 2px var(--ap-line)",
                      }}
                    >
                      Télécharger
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5M4 19h16"/></svg>
                    </a>
                  </div>
                )
              )}

              {/* ── Iframe ── */}
              {lesson.type === "iframe" && (
                !lesson.iframeUrl ? (
                  <div style={{
                    background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-lg)",
                    boxShadow: "0 5px 0 var(--ap-line)", padding: 24,
                    display: "flex", alignItems: "center", gap: 20,
                  }}>
                    <span style={{ flexShrink: 0, width: 64, height: 64, borderRadius: "var(--ap-r-md)", display: "grid", placeItems: "center", fontSize: 30, background: TYPE_LAUNCH_BG.document }}>🌐</span>
                    <p style={{ color: "var(--ap-muted)", fontWeight: 700, fontSize: 14 }}>Aucune page intégrée configurée.</p>
                  </div>
                ) : (
                  <div style={{ borderRadius: "var(--ap-r-lg)", overflow: "hidden", border: "var(--ap-border-w) solid var(--ap-line)", boxShadow: "0 5px 0 var(--ap-line)" }}>
                    <iframe
                      src={lesson.iframeUrl}
                      title={lesson.title}
                      style={{ width: "100%", height: "70vh", border: "none", display: "block" }}
                    />
                  </div>
                )
              )}

              {/* ── SCORM ── */}
              {lesson.type === "scorm" && (
                !lesson.scormPackageId || !course || !user ? (
                  <div style={{
                    background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-lg)",
                    boxShadow: "0 5px 0 var(--ap-line)", padding: 24,
                    display: "flex", alignItems: "center", gap: 20,
                  }}>
                    <span style={{ flexShrink: 0, width: 64, height: 64, borderRadius: "var(--ap-r-md)", display: "grid", placeItems: "center", fontSize: 30, background: TYPE_LAUNCH_BG.scorm }}>📦</span>
                    <p style={{ color: "var(--ap-muted)", fontWeight: 700, fontSize: 14 }}>Aucun package SCORM importé.</p>
                  </div>
                ) : (
                  <div style={{ borderRadius: "var(--ap-r-lg)", overflow: "hidden", border: "var(--ap-border-w) solid var(--ap-line)", boxShadow: "0 5px 0 var(--ap-line)" }}>
                    <ScormPlayer
                      userId={user.id}
                      packageOwnerId={course.userId}
                      localCourseId={course.id}
                      lessonId={lesson.id}
                      scormVersion={lesson.scormVersion ?? "1.2"}
                      packageId={lesson.scormPackageId}
                      launchPath={lesson.scormLaunchPath ?? ""}
                      initialState={{}}
                    />
                  </div>
                )
              )}

              {/* ── File upload ── */}
              {lesson.type === "file-upload" && (
                <div>
                  {lesson.content && (
                    <div className="cv-prose" style={{ marginBottom: 20 }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(lesson.content) }} />
                  )}
                  <div style={{
                    background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-lg)",
                    boxShadow: "0 5px 0 var(--ap-line)", padding: 24,
                  }}>
                    {submission ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <span style={{ flexShrink: 0, width: 48, height: 48, borderRadius: "var(--ap-r-md)", display: "grid", placeItems: "center", fontSize: 22, background: TYPE_LAUNCH_BG.document }}>✅</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: 14.5 }}>{submission.fileName}</p>
                          <p style={{ fontSize: 12.5, color: "var(--ap-muted)", fontWeight: 700, marginTop: 2 }}>
                            Déposé le {new Date(submission.submittedAt).toLocaleString("fr")}
                          </p>
                        </div>
                        <label className="cv-btn" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--ap-font-body)", fontWeight: 800, fontSize: 13.5, padding: "10px 16px", borderRadius: "var(--ap-r-sm)", cursor: "pointer", color: "var(--ap-ink)", background: "var(--ap-card)", boxShadow: "0 4px 0 var(--ap-line), inset 0 0 0 2px var(--ap-line)" }}>
                          Remplacer
                          <input type="file" style={{ display: "none" }} onChange={handleLessonFileUpload} />
                        </label>
                      </div>
                    ) : (
                      <label style={{
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        gap: 8, padding: 32, border: "var(--ap-border-w) dashed var(--ap-line-2)", borderRadius: "var(--ap-r-sm)",
                        cursor: "pointer", background: "var(--ap-paper-2)",
                      }}>
                        <span style={{ fontSize: 28 }} aria-hidden="true">📤</span>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ap-muted)" }}>Déposer un fichier</span>
                        <span style={{ fontSize: 11.5, color: "var(--ap-muted)" }}>Max 8 Mo</span>
                        <input type="file" style={{ display: "none" }} onChange={handleLessonFileUpload} />
                      </label>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* ── Lesson footer banner — pinned to the bottom, doesn't scroll away ── */}
        {lesson && (
          <div style={{
            flexShrink: 0, borderTop: "var(--ap-border-w) solid var(--ap-line)",
            background: "var(--ap-card)", padding: "18px 32px",
          }}>
            <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <button
                className={`cv-done-btn cv-btn${doneBtnPop ? " pop" : ""}`}
                onClick={toggleComplete}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 9,
                  fontFamily: "var(--ap-font-body)", fontWeight: 800, fontSize: 14.5,
                  padding: "12px 22px", borderRadius: "var(--ap-r-sm)", border: "none", cursor: "pointer",
                  color: isCompleted ? "var(--ap-pres-deep)" : "#fff",
                  background: isCompleted ? "var(--ap-card)" : "var(--ap-pres-deep)",
                  boxShadow: isCompleted
                    ? "0 4px 0 var(--ap-line), inset 0 0 0 2px color-mix(in srgb, var(--ap-pres) 45%, transparent)"
                    : "0 4px 0 #076346",
                  transition: "background .25s, color .25s, box-shadow .25s",
                }}
              >
                {isCompleted ? "✓ Leçon terminée" : "Marquer comme terminée"}
              </button>

              <div style={{ flex: 1 }} />

              {prevLesson && (
                <button
                  className="cv-btn"
                  onClick={() => setCurrentLessonId(prevLesson.lesson.id)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 9,
                    fontFamily: "var(--ap-font-body)", fontWeight: 800, fontSize: 14.5,
                    padding: "12px 22px", borderRadius: "var(--ap-r-sm)", cursor: "pointer",
                    color: "var(--ap-ink)", background: "var(--ap-card)", border: "none",
                    boxShadow: "0 4px 0 var(--ap-line), inset 0 0 0 2px var(--ap-line)",
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>
                  Précédente
                </button>
              )}

              {nextLesson && (
                <button
                  className="cv-btn"
                  onClick={() => { if (!isCompleted) toggleComplete(); else setCurrentLessonId(nextLesson.lesson.id); }}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 9,
                    fontFamily: "var(--ap-font-body)", fontWeight: 800, fontSize: 14.5,
                    padding: "12px 22px", borderRadius: "var(--ap-r-sm)", border: "none", cursor: "pointer",
                    color: "#fff", background: "var(--ap-brand)", boxShadow: "0 4px 0 var(--ap-brand-deep)",
                  }}
                >
                  Suivante
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </button>
              )}
            </div>
          </div>
        )}
        </div>
      </div>
      )}
      <CourseCertificateDialog
        open={certificateOpen}
        onOpenChange={setCertificateOpen}
        course={course}
        learnerName={user.username || user.email}
        learnerId={user.id}
        totalLessons={totalLessons}
      />
    </div>
  );
};

export default CourseViewer;
