import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCurrentUser } from "@/lib/auth";
import {
  getCourseById,
  getCourseProgress,
  markLessonComplete,
  unmarkLessonComplete,
  type Lesson,
  type Module,
} from "@/lib/courseStorage";
import { getQuizById } from "@/lib/quizStorage";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { toast } from "sonner";

/* ─── Type system ──────────────────────────────────────────────── */
const TYPE_LABEL: Record<string, string> = {
  text: "Leçon", video: "Vidéo", quiz: "Quiz", flashcard: "Flashcards", document: "Document",
};

// Background color for the small square icon chip
const TYPE_IC_BG: Record<string, string> = {
  text:      "#2f7bff",
  video:     "var(--ap-brand)",
  quiz:      "var(--ap-quiz)",
  flashcard: "var(--ap-flash)",
  document:  "var(--ap-pres)",
};

// Kicker pill: [text color, bg, border]
const TYPE_KICKER: Record<string, [string, string, string]> = {
  text:      ["#1d55c0", "#eef4ff", "rgba(47,123,255,.4)"],
  video:     ["var(--ap-brand-deep)", "var(--ap-brand-soft)", "rgba(112,72,255,.4)"],
  quiz:      ["var(--ap-quiz-deep)", "var(--ap-quiz-soft)", "rgba(255,90,77,.4)"],
  flashcard: ["var(--ap-flash-deep)", "var(--ap-flash-soft)", "rgba(255,176,32,.5)"],
  document:  ["var(--ap-pres-deep)", "var(--ap-pres-soft)", "rgba(21,192,138,.4)"],
};

// Big icon background for launch cards
const TYPE_LAUNCH_BG: Record<string, string> = {
  quiz:      "var(--ap-quiz-soft)",
  flashcard: "var(--ap-flash-soft)",
  document:  "var(--ap-pres-soft)",
};

// Emoji for launch cards
const TYPE_LAUNCH_EM: Record<string, string> = {
  quiz:      "🎯",
  flashcard: "🃏",
  document:  "🧪",
};

/* ─── SVG icons (type chips) ───────────────────────────────────── */
const TypeIcon = ({ type }: { type: string }) => {
  const s = { width: 12, height: 12, fill: "#fff" as const };
  if (type === "text")      return <svg viewBox="0 0 24 24" style={s}><path d="M4 4h16v3H4zM4 10h16v3H4zM4 16h10v3H4z"/></svg>;
  if (type === "video")     return <svg viewBox="0 0 24 24" style={s}><path d="M6 4l14 8-14 8z"/></svg>;
  if (type === "quiz")      return <svg viewBox="0 0 24 24" style={s}><path d="M12 3 22 21H2z"/></svg>;
  if (type === "flashcard") return <svg viewBox="0 0 24 24" style={s}><rect x="3" y="5" width="13" height="15" rx="2"/><rect x="9" y="3" width="12" height="15" rx="2"/></svg>;
  return <svg viewBox="0 0 24 24" style={s}><path d="M9 2h6v4l4 12a2 2 0 0 1-2 3H7a2 2 0 0 1-2-3L9 6z"/></svg>;
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

/* ═══════════════════════════════════════════════════════════════ */
const CourseViewer = () => {
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId: string }>();
  const user = getCurrentUser();

  const [course, setCourse] = useState<ReturnType<typeof getCourseById>>(null);
  const [progress, setProgress] = useState<ReturnType<typeof getCourseProgress>>(null);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set());
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const [doneBtnPop, setDoneBtnPop] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);
  const confettiFiredRef = useRef(false);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    if (!courseId) { navigate("/my-courses"); return; }
    const c = getCourseById(courseId);
    if (!c) { toast.error("Cours introuvable"); navigate("/my-courses"); return; }
    setCourse(c);
    setProgress(getCourseProgress(courseId, user.id));
    if (c.modules.length > 0 && c.modules[0].lessons.length > 0) {
      setCurrentLessonId(c.modules[0].lessons[0].id);
    }
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
  const linkedFlashcard = lesson?.type === "flashcard" && lesson.linkedItemId ? getQuizById(lesson.linkedItemId) : null;

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
      backgroundImage: "radial-gradient(var(--ap-line-2) 1px, transparent 1px)",
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
      `}</style>

      {/* ── Topbar ──────────────────────────────────────────── */}
      <div style={{
        height: 62, flexShrink: 0, zIndex: 20,
        background: "var(--ap-card)", borderBottom: "2px solid var(--ap-line)",
        display: "flex", alignItems: "center", gap: 14, padding: "0 18px",
      }}>
        <button
          className="cv-back"
          aria-label="Retour à mes cours"
          onClick={() => navigate("/my-courses")}
          style={{
            display: "grid", placeItems: "center", width: 36, height: 36,
            borderRadius: "var(--ap-r-sm)", border: "2px solid var(--ap-line)",
            background: "var(--ap-card)", cursor: "pointer",
            boxShadow: "0 3px 0 var(--ap-line)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ap-ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 6l-6 6 6 6"/>
          </svg>
        </button>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ap-muted)" }}>Cours</div>
          <div style={{ fontSize: 15.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{course.title}</div>
        </div>

        <div style={{ flex: 1 }} />

        <Ring pct={progressPct} done={allDone} count={completedCount} total={totalLessons} />
      </div>

      {/* ── Body ────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "320px 1fr" }}>

        {/* Sidebar */}
        <nav className="cv-plan" style={{
          borderRight: "2px solid var(--ap-line)", background: "var(--ap-card)",
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
                    background: "var(--ap-paper)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)",
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
        <div ref={mainRef} className="cv-content" style={{ overflowY: "auto", minHeight: 0 }}>

          {/* Completion banner */}
          <div
            className={`cv-finish${allDone ? " show" : ""}`}
            style={{
              margin: "0 32px 24px", maxWidth: 720, marginLeft: "auto", marginRight: "auto",
              background: "linear-gradient(135deg, var(--ap-flash-soft), #fff)",
              border: "2px solid color-mix(in srgb, var(--ap-flash) 55%, transparent)",
              borderRadius: "var(--ap-r-lg)", boxShadow: "0 5px 0 color-mix(in srgb, var(--ap-flash) 45%, transparent)",
              padding: "20px 24px", alignItems: "center", gap: 16,
            }}
          >
            <span style={{ fontSize: 38 }} aria-hidden="true">🏆</span>
            <div>
              <h3 style={{ fontFamily: "var(--ap-font-display)", fontWeight: 600, fontSize: 19 }}>Cours terminé, bravo !</h3>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ap-muted)" }}>
                {totalLessons} leçon{totalLessons > 1 ? "s" : ""} · {course.modules.length} module{course.modules.length > 1 ? "s" : ""} · tout validé.
              </p>
            </div>
            <div style={{ flex: 1 }} />
            <button
              className="cv-btn"
              style={{
                display: "inline-flex", alignItems: "center", gap: 9,
                fontFamily: "var(--ap-font-body)", fontWeight: 800, fontSize: 14.5,
                padding: "12px 22px", borderRadius: 999, border: "none", cursor: "pointer",
                color: "var(--ap-ink)", background: "var(--ap-flash)", boxShadow: "0 4px 0 var(--ap-flash-deep)",
              }}
            >
              📜 Obtenir mon attestation
            </button>
          </div>

          {/* Lesson content */}
          {!lesson ? (
            <div style={{ textAlign: "center", marginTop: 80, color: "var(--ap-muted)" }}>
              Sélectionnez une leçon dans le panneau gauche.
            </div>
          ) : (
            <div style={{ maxWidth: 720, margin: "0 auto", padding: "34px 32px 60px" }}>

              {/* Lesson header */}
              <header style={{ marginBottom: 22 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  fontSize: 11.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase",
                  padding: "5px 12px", borderRadius: 999, border: `2px solid ${kicker[2]}`,
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
                    border: "2px solid var(--ap-line)", boxShadow: "0 5px 0 var(--ap-line)",
                  }}>
                    <p style={{ color: "rgba(255,255,255,.5)", fontSize: 14, fontWeight: 700 }}>Aucune vidéo configurée.</p>
                  </div>
                ) : lesson.videoType === "youtube" && extractYouTubeId(lesson.videoUrl) ? (
                  <div style={{ aspectRatio: "16/9", borderRadius: "var(--ap-r-lg)", overflow: "hidden", border: "2px solid var(--ap-line)", boxShadow: "0 5px 0 var(--ap-line)" }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${extractYouTubeId(lesson.videoUrl)}`}
                      style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      title={lesson.title}
                    />
                  </div>
                ) : (
                  <div style={{ borderRadius: "var(--ap-r-lg)", overflow: "hidden", border: "2px solid var(--ap-line)", boxShadow: "0 5px 0 var(--ap-line)" }}>
                    <video src={lesson.videoUrl} controls style={{ width: "100%", maxHeight: "70vh", display: "block", background: "#000" }} />
                  </div>
                )
              )}

              {/* ── Quiz launch card ── */}
              {lesson.type === "quiz" && (
                <div style={{
                  background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-lg)",
                  boxShadow: "0 5px 0 var(--ap-line)", padding: 24,
                  display: "flex", alignItems: "center", gap: 20,
                }}>
                  <span style={{
                    flexShrink: 0, width: 64, height: 64, borderRadius: 18,
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
                        padding: "12px 22px", borderRadius: 999, border: "none", cursor: "pointer",
                        color: "#fff", background: "var(--ap-brand)", boxShadow: "0 4px 0 var(--ap-brand-deep)",
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
                  background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-lg)",
                  boxShadow: "0 5px 0 var(--ap-line)", padding: 24,
                  display: "flex", alignItems: "center", gap: 20,
                }}>
                  <span style={{
                    flexShrink: 0, width: 64, height: 64, borderRadius: 18,
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
                        padding: "12px 22px", borderRadius: 999, border: "none", cursor: "pointer",
                        color: "#fff", background: "var(--ap-brand)", boxShadow: "0 4px 0 var(--ap-brand-deep)",
                      }}
                    >
                      Réviser
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                    </button>
                  )}
                </div>
              )}

              {/* ── Document ── */}
              {lesson.type === "document" && (
                !lesson.content ? (
                  <div style={{
                    background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-lg)",
                    boxShadow: "0 5px 0 var(--ap-line)", padding: 24,
                    display: "flex", alignItems: "center", gap: 20,
                  }}>
                    <span style={{ flexShrink: 0, width: 64, height: 64, borderRadius: 18, display: "grid", placeItems: "center", fontSize: 30, background: TYPE_LAUNCH_BG.document }}>🧪</span>
                    <p style={{ color: "var(--ap-muted)", fontWeight: 700, fontSize: 14 }}>Aucun document importé.</p>
                  </div>
                ) : lesson.documentMimeType === "text/markdown" ? (
                  <div
                    className="cv-prose"
                    style={{ background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-lg)", boxShadow: "0 5px 0 var(--ap-line)", padding: "28px 32px" }}
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMarkdown(lesson.content)) }}
                  />
                ) : lesson.documentMimeType === "application/pdf" ? (
                  <div style={{ borderRadius: "var(--ap-r-lg)", overflow: "hidden", border: "2px solid var(--ap-line)", boxShadow: "0 5px 0 var(--ap-line)" }}>
                    {pdfObjectUrl
                      ? <iframe src={pdfObjectUrl} title={lesson.documentName ?? "Document"} style={{ width: "100%", height: "75vh", border: "none", display: "block" }} />
                      : <p style={{ padding: 24, color: "var(--ap-muted)", fontSize: 13, textAlign: "center" }}>Chargement…</p>
                    }
                  </div>
                ) : (
                  <div style={{
                    background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-lg)",
                    boxShadow: "0 5px 0 var(--ap-line)", padding: 24,
                    display: "flex", alignItems: "center", gap: 20,
                  }}>
                    <span style={{ flexShrink: 0, width: 64, height: 64, borderRadius: 18, display: "grid", placeItems: "center", fontSize: 30, background: TYPE_LAUNCH_BG.document }}>🧪</span>
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
                        padding: "12px 22px", borderRadius: 999, border: "none", cursor: "pointer",
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

              {/* ── Lesson footer ── */}
              <div style={{
                marginTop: 34, paddingTop: 22, borderTop: "2px solid var(--ap-line)",
                display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
              }}>
                <button
                  className={`cv-done-btn cv-btn${doneBtnPop ? " pop" : ""}`}
                  onClick={toggleComplete}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 9,
                    fontFamily: "var(--ap-font-body)", fontWeight: 800, fontSize: 14.5,
                    padding: "12px 22px", borderRadius: 999, border: "none", cursor: "pointer",
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
                      padding: "12px 22px", borderRadius: 999, cursor: "pointer",
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
                      padding: "12px 22px", borderRadius: 999, border: "none", cursor: "pointer",
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
    </div>
  );
};

export default CourseViewer;
