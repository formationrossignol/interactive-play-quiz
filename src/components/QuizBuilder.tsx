import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Trash2, Upload, GripVertical, Settings,
  ChevronLeft, ChevronDown, Eye, ImageIcon, MoreHorizontal,
  Copy, Library, HelpCircle,
} from "lucide-react";
import { ImportFileModal } from "./ImportFileModal";
import { getCurrentUser } from "@/lib/auth";
import { saveQuiz, updateQuiz, getQuizById } from "@/lib/quizStorage";
import { getPollTemplate } from "@/lib/pollTemplates";
import { getQuizTemplate } from "@/lib/quizTemplates";
import { getFlashcardTemplate } from "@/lib/flashcardTemplates";
import { getSlideTemplate } from "@/lib/slideTemplates";
import { DEFAULT_THEME_ID, THEMES, type Theme } from "@/lib/themes";
import { hexToRgba } from "@/lib/color";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import type { QuizQuestionType, PollQuestionType } from "@/lib/questionTypes";
import type { PollTemplate } from "@/lib/pollTemplates";
import type { QuizTemplate } from "@/lib/quizTemplates";
import { PollTemplateSelectorEnhanced } from "./PollTemplateSelectorEnhanced";
import { QuizTemplateSelectorEnhanced } from "./QuizTemplateSelectorEnhanced";
import { FlashcardEditor } from "./FlashcardEditor";
import { FlashcardPreview } from "./FlashcardPreview";
import { SlideEditor } from "./SlideEditor";
import { SlidePreview } from "./SlidePreview";
import { cn } from "@/lib/utils";
import { createDefaultQuizQuestion } from "@/lib/questionDefaults";
import { getQuestionBankForUser, type QuestionBankItem, type QuestionDifficulty } from "@/lib/questionBank";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Design constants ──────────────────────────────────────────────────────
// Ordre position → couleur/forme aligné sur l'écran joueur réel
// (arcade-pop.css .ap-answer--N + PLAYER_ANSWER_SHAPES) :
// 1 triangle rouge, 2 cercle bleu, 3 carré vert, 4 losange jaune.
const ANSWER_CONFIGS = [
  { color: "var(--ap-quiz)",  shape: <path d="M12 3 22 21H2z" fill="white" /> },
  { color: "var(--ap-poll)",  shape: <circle cx="12" cy="12" r="9" fill="white" /> },
  { color: "var(--ap-pres)",  shape: <rect x="4" y="4" width="16" height="16" rx="2" fill="white" /> },
  { color: "var(--ap-flash)", shape: <path d="M12 2 22 12 12 22 2 12z" fill="white" /> },
] as const;

const QTYPE_META: Record<string, { label: string; dot: string }> = {
  "multiple-choice":  { label: "QCM",         dot: "var(--ap-quiz)"  },
  "single-choice":    { label: "Choix unique", dot: "var(--ap-quiz)"  },
  "true-false":       { label: "Vrai / Faux",  dot: "var(--ap-poll)" },
  "short-answer":     { label: "Réponse courte", dot: "var(--ap-flash)" },
  "ranking":          { label: "Classement",   dot: "var(--ap-pres)"  },
  "matching":         { label: "Association",  dot: "var(--ap-quiz)"  },
  "fill-blank":       { label: "Lacune",       dot: "var(--ap-poll)" },
  "slider":           { label: "Curseur",      dot: "var(--ap-flash)" },
  "likert-scale":     { label: "Likert",       dot: "var(--ap-poll)" },
  "frequency-scale":  { label: "Fréquence",    dot: "var(--ap-poll)" },
  "star-rating":      { label: "Étoiles",      dot: "var(--ap-flash)" },
  "open-text":        { label: "Texte ouvert", dot: "var(--ap-pres)"  },
  "nps-scale":        { label: "NPS",          dot: "var(--ap-brand)" },
  "flashcard":        { label: "Carte",        dot: "var(--ap-flash)" },
  "slide":            { label: "Slide",        dot: "var(--ap-pres)"  },
};

const POINTS_OPTIONS = [
  { label: "Standard", value: 1000 },
  { label: "Double",   value: 2000 },
  { label: "Sans pts", value: 0    },
];

const TIME_OPTIONS = [
  { label: "10 s", value: 10 },
  { label: "20 s", value: 20 },
  { label: "30 s", value: 30 },
  { label: "60 s", value: 60 },
];

const FONT_OPTIONS = [
  { value: "inter",        label: "Inter",           stack: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', tagline: "Moderne et très lisible" },
  { value: "poppins",      label: "Poppins",         stack: '"Poppins", "Inter", sans-serif',                                      tagline: "Arrondie et chaleureuse" },
  { value: "space-grotesk",label: "Space Grotesk",   stack: '"Space Grotesk", "Inter", sans-serif',                               tagline: "Typographie géométrique" },
  { value: "playfair",     label: "Playfair Display", stack: '"Playfair Display", "Times New Roman", serif',                      tagline: "Élégance éditoriale"     },
  { value: "merriweather", label: "Merriweather",    stack: '"Merriweather", "Georgia", serif',                                    tagline: "Classique et sérieuse"   },
];

// ─── Sub-components ────────────────────────────────────────────────────────

const SaveStateIndicator = ({ state }: { state: "saved" | "saving" }) => (
  <div
    style={{
      display: "flex", alignItems: "center", gap: 7,
      fontSize: 12.5, fontWeight: 700,
      padding: "5px 12px", borderRadius: 999,
      border: `2px solid ${state === "saved" ? "color-mix(in srgb, var(--ap-pres) 35%, transparent)" : "var(--ap-line)"}`,
      background: state === "saved" ? "var(--ap-pres-soft)" : "var(--ap-paper)",
      color: state === "saved" ? "var(--ap-pres-deep)" : "var(--ap-muted)",
      transition: "color .3s, border-color .3s",
      flexShrink: 0,
    }}
  >
    {state === "saving" ? (
      <span style={{ width: 11, height: 11, borderRadius: "50%", border: "2px solid var(--ap-line-2)", borderTopColor: "var(--ap-brand)", display: "inline-block", animation: "spin .7s linear infinite", flexShrink: 0 }} />
    ) : (
      <svg style={{ width: 14, height: 14 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12.5 10 18 20 6" />
      </svg>
    )}
    <span>{state === "saving" ? "Enregistrement…" : "Enregistré"}</span>
  </div>
);

const AnswerRow = ({
  index, value, isCorrect, onChange, onToggleCorrect, placeholder,
}: {
  index: number; value: string; isCorrect: boolean;
  onChange: (v: string) => void; onToggleCorrect: () => void; placeholder: string;
}) => {
  const cfg = ANSWER_CONFIGS[index];
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10,
        background: "white",
        border: "2px solid var(--ap-line)",
        borderRadius: "var(--ap-r-md)",
        padding: "8px 10px",
        boxShadow: "0 3px 0 var(--ap-line)",
        marginBottom: 10,
      }}
    >
      <span
        style={{
          flexShrink: 0, width: 34, height: 34, borderRadius: 9,
          display: "grid", placeItems: "center", background: cfg.color,
        }}
      >
        <svg viewBox="0 0 24 24" style={{ width: 14, height: 14 }}>{cfg.shape}</svg>
      </span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1, minWidth: 0, border: "none", background: "transparent", outline: "none",
          fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: 15,
          color: "var(--ap-ink)",
        }}
      />
      <button
        onClick={onToggleCorrect}
        aria-pressed={isCorrect}
        style={{
          flexShrink: 0, width: 32, height: 32, borderRadius: "50%", cursor: "pointer",
          border: `2px solid ${isCorrect ? "var(--ap-pres-deep)" : "var(--ap-line-2)"}`,
          background: isCorrect ? "var(--ap-pres-deep)" : "white",
          display: "grid", placeItems: "center",
          transition: "transform .18s var(--ap-spring), background .18s, border-color .18s",
        }}
      >
        <svg viewBox="0 0 24 24" style={{ width: 15, height: 15 }} fill="none"
          stroke={isCorrect ? "white" : "var(--ap-line-2)"}
          strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M4 12.5 10 18 20 6" />
        </svg>
      </button>
    </div>
  );
};

const PhonePreview = ({
  question, questionIndex, totalQuestions,
}: {
  question: any; questionIndex: number; totalQuestions: number;
}) => {
  if (!question) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--ap-muted)", fontSize: 13, fontWeight: 700, textAlign: "center" }}>
        Sélectionnez une question<br />pour voir l'aperçu joueur
      </div>
    );
  }

  const timeLimit = question.timeLimit || 20;
  const pts = question.points ?? 1000;
  const answers: string[] = question.answers || [];
  const qText = question.question || "";

  const isTF = question.type === "true-false";
  const displayAnswers = isTF ? ["Vrai", "Faux"] : answers;

  return (
    <div style={{
      width: 258, flexShrink: 0,
      background: "var(--ap-ink)", borderRadius: 34, padding: 9,
      boxShadow: "0 10px 0 #16102a, 0 30px 50px rgba(36,27,58,.28)",
    }}>
      <div style={{
        background: "var(--ap-paper)", borderRadius: 26, overflow: "hidden",
        display: "flex", flexDirection: "column", minHeight: 470,
      }}>
        {/* Notch */}
        <div style={{ width: 84, height: 20, background: "var(--ap-ink)", borderRadius: "0 0 13px 13px", margin: "0 auto", flexShrink: 0 }} />

        {/* HUD */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px 6px" }}>
          <span style={{
            fontFamily: "var(--ap-font-display)", fontWeight: 600, fontSize: 13,
            display: "inline-flex", alignItems: "center", gap: 5,
            background: "white", border: "2px solid var(--ap-line)", borderRadius: 999,
            padding: "4px 10px",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--ap-brand)", display: "inline-block" }} />
            {timeLimit} s
          </span>
          <span style={{
            fontSize: 11, fontWeight: 800, color: "var(--ap-flash-deep)",
            background: "var(--ap-flash-soft)",
            border: "2px solid color-mix(in srgb, var(--ap-flash) 45%, transparent)",
            padding: "4px 9px", borderRadius: 999,
          }}>
            Q{questionIndex + 1}/{totalQuestions || 1} · {pts} pts
          </span>
        </div>

        {/* Question */}
        <p style={{
          fontWeight: 800, fontSize: 14.5, lineHeight: 1.4,
          padding: "8px 16px 12px", minHeight: 62, color: "var(--ap-ink)",
        }}>
          {qText || <span style={{ color: "var(--ap-muted)" }}>Posez votre question…</span>}
        </p>

        {/* Answers */}
        <div style={{ display: "grid", gap: 8, padding: "0 12px 14px", marginTop: "auto" }}>
          {displayAnswers.slice(0, 4).map((ans: string, i: number) => {
            if (i >= 3 && !ans && !isTF) return null;
            const cfg = ANSWER_CONFIGS[i];
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 9,
                background: "white", border: "2px solid var(--ap-line)",
                borderRadius: 13, padding: "10px 11px",
                fontWeight: 700, fontSize: 12.5,
                boxShadow: "0 3px 0 var(--ap-line)", color: "var(--ap-ink)",
              }}>
                <span style={{
                  flexShrink: 0, width: 24, height: 24, borderRadius: 7,
                  background: cfg.color, display: "grid", placeItems: "center",
                }}>
                  <svg viewBox="0 0 24 24" style={{ width: 10, height: 10 }}>{cfg.shape}</svg>
                </span>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: ans ? "var(--ap-ink)" : "var(--ap-muted)" }}>
                  {ans || `Réponse ${i + 1}`}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{
          textAlign: "center", fontFamily: "var(--ap-font-display)", fontWeight: 600,
          fontSize: 10.5, color: "var(--ap-muted)", paddingBottom: 10, letterSpacing: ".04em",
        }}>
          ⚡ Ludiq
        </div>
      </div>
    </div>
  );
};

const RailItem = ({
  question, index, isActive, onSelect, onDelete, onDuplicate,
}: {
  question: any; index: number; isActive: boolean;
  onSelect: (i: number) => void; onDelete: (i: number) => void; onDuplicate: (i: number) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: question.id });
  const meta = QTYPE_META[question.type] || { label: question.type, dot: "var(--ap-muted)" };
  const displayText =
    question.type === "slide"      ? (question.title?.trim() || "Diapositive vide")
    : question.type === "flashcard" ? (question.recto?.trim() || "Flashcard vide")
    : (question.question?.trim() || "Sans titre");

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="group">
      <div
        onClick={() => onSelect(index)}
        style={{
          position: "relative", textAlign: "left", width: "100%",
          background: isActive ? "var(--ap-brand-soft)" : "white",
          border: `2px solid ${isActive ? "var(--ap-brand)" : "var(--ap-line)"}`,
          borderRadius: "var(--ap-r-md)",
          padding: "11px 12px 11px 14px",
          cursor: "pointer",
          boxShadow: isActive
            ? "0 3px 0 color-mix(in srgb, var(--ap-brand) 45%, transparent)"
            : "0 3px 0 var(--ap-line)",
          display: "flex", gap: 11, alignItems: "flex-start",
          transition: "transform .15s var(--ap-spring), box-shadow .15s var(--ap-spring)",
        }}
      >
        {/* Number badge */}
        <span style={{
          flexShrink: 0, width: 26, height: 26, borderRadius: 8,
          background: isActive ? "var(--ap-brand)" : "var(--ap-paper-2)",
          color: isActive ? "white" : "var(--ap-muted)",
          fontFamily: "var(--ap-font-display)", fontWeight: 600, fontSize: 15,
          display: "grid", placeItems: "center",
        }}>
          {index + 1}
        </span>

        {/* Body */}
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{
            display: "flex", alignItems: "center", gap: 5,
            fontSize: 10.5, fontWeight: 800, letterSpacing: ".07em",
            textTransform: "uppercase", color: "var(--ap-muted)",
          }}>
            <i style={{ width: 7, height: 7, borderRadius: 2, background: meta.dot, display: "inline-block", flexShrink: 0 }} />
            {meta.label}
          </span>
          <span style={{
            display: "-webkit-box" as any,
            WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any,
            overflow: "hidden", fontSize: 13, fontWeight: 700,
            lineHeight: 1.35, marginTop: 3, color: "var(--ap-ink)",
          }}>
            {displayText}
          </span>
        </span>

        {/* Actions (hover) */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onDuplicate(index)}
            title="Dupliquer"
            style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", color: "var(--ap-muted)", borderRadius: 6 }}
          >
            <Copy style={{ width: 12, height: 12 }} />
          </button>
          <button
            onClick={() => onDelete(index)}
            title="Supprimer"
            style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", color: "var(--ap-muted)", borderRadius: 6 }}
          >
            <Trash2 style={{ width: 12, height: 12 }} />
          </button>
        </div>

        {/* Drag grip */}
        <button
          {...attributes} {...listeners}
          onClick={e => e.stopPropagation()}
          style={{
            flexShrink: 0, background: "none", border: "none",
            color: "var(--ap-line-2)", cursor: "grab", paddingTop: 2,
            fontSize: 14, lineHeight: 1,
          }}
        >
          ⋮⋮
        </button>
      </div>
    </div>
  );
};

// ─── Theme sub-components (preserved) ─────────────────────────────────────
const ThemePaletteChips = ({ theme }: { theme: Theme }) => (
  <span className="flex items-center gap-1.5">
    {theme.palette.map((color, i) => (
      <span key={i} className="h-3 w-3 rounded-full border border-black/10 shadow-sm" style={{ backgroundColor: color }} />
    ))}
  </span>
);

const ThemePreviewPanel = ({ theme }: { theme?: Theme }) => {
  if (!theme) return (
    <div className="flex h-36 items-center justify-center rounded-2xl bg-muted/20 text-sm text-muted-foreground">
      Sélectionnez un thème
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="relative h-36 w-full overflow-hidden rounded-2xl border border-border/70">
        <img src={theme.imageUrl} alt={theme.imageDescription} className="h-full w-full object-cover" loading="lazy" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${hexToRgba(theme.palette[0], 0.55)}, ${hexToRgba(theme.palette[theme.palette.length - 1], 0.65)})` }} />
        <div className="absolute inset-0 flex flex-col justify-end gap-1 p-4 text-white drop-shadow-md">
          <span className="text-base font-semibold tracking-wide">{theme.name}</span>
          <span className="text-xs font-medium text-white/85">{theme.imageDescription}</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <ThemePaletteChips theme={theme} />
        <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">Palette</span>
      </div>
    </div>
  );
};

const ThemeSelectionDropdown = ({ value, onChange }: { value: string; onChange: (id: string) => void }) => {
  const selected = THEMES.find(t => t.id === value);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-auto min-h-12 items-center rounded-xl border border-border/60 bg-background px-3 py-3 text-left">
        <SelectValue aria-hidden className="sr-only" />
        <div className="flex flex-1 items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{selected?.name ?? "Sélectionner"}</p>
            <p className="text-xs text-muted-foreground line-clamp-1">{selected?.imageDescription ?? ""}</p>
          </div>
          {selected && <div className="flex shrink-0 items-center gap-1 rounded-full border border-border/40 bg-muted/30 px-3 py-1"><ThemePaletteChips theme={selected} /></div>}
        </div>
      </SelectTrigger>
      <SelectContent className="bg-popover z-50 max-h-[320px]">
        {THEMES.map(th => (
          <SelectItem key={th.id} value={th.id} className="py-2">
            <div className="flex items-center gap-3">
              <div className="h-12 w-20 shrink-0 overflow-hidden rounded-xl border border-border/60">
                <img src={th.imageUrl} alt={th.imageDescription} className="h-full w-full object-cover" loading="lazy" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{th.name}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{th.imageDescription}</p>
                <div className="mt-2"><ThemePaletteChips theme={th} /></div>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

// ─── Main component ────────────────────────────────────────────────────────
export const QuizBuilder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const sp = new URLSearchParams(location.search);
  const quizType = (sp.get("type") || "quiz") as "quiz" | "poll" | "flashcard" | "slide";
  const templateId = sp.get("templateId");
  const quizId = sp.get("quizId");
  const user = getCurrentUser();

  const isPoll = quizType === "poll";
  const isFlashcard = quizType === "flashcard";
  const isSlide = quizType === "slide";

  // ── State ────────────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<any[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [speedBonus, setSpeedBonus] = useState(true);
  const [transitionTime, setTransitionTime] = useState(5);
  const [category, setCategory] = useState("Autre");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [headerImage, setHeaderImage] = useState("");
  const [theme, setTheme] = useState<string>(DEFAULT_THEME_ID);
  const [previewFont, setPreviewFont] = useState(FONT_OPTIONS[0].value);
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(templateId);
  const [questionBankItems, setQuestionBankItems] = useState<QuestionBankItem[]>([]);
  const [questionBankDialogOpen, setQuestionBankDialogOpen] = useState(false);
  const [importFileOpen, setImportFileOpen] = useState(false);
  const [shouldBlockNavigation, setShouldBlockNavigation] = useState(true);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const firstRender = useRef(true);

  const activeTheme = THEMES.find(t => t.id === theme) ?? THEMES[0];
  const activeFont = FONT_OPTIONS.find(f => f.value === previewFont) ?? FONT_OPTIONS[0];
  const selectedQ = selectedIdx !== null ? questions[selectedIdx] : null;

  // ── Auto-save indicator ──────────────────────────────────────────────────
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    setSaveState("saving");
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveState("saved"), 900);
  }, [questions, title]);

  // ── Auth guard ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setShouldBlockNavigation(false); navigate("/auth"); }
  }, [user, navigate]);

  // ── beforeunload ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!shouldBlockNavigation) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = t("confirmLeaveBuilder"); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [shouldBlockNavigation]);

  // ── Load existing quiz ───────────────────────────────────────────────────
  useEffect(() => {
    if (!quizId) return;
    const eq = getQuizById(quizId);
    if (!eq) return;
    setTitle(eq.title);
    setDescription(eq.description);
    setCategory(eq.category);
    setIsPublic(eq.isPublic);
    setSpeedBonus(eq.speedBonus);
    setTransitionTime(eq.transitionTime);
    setTags(eq.tags || []);
    setHeaderImage(eq.headerImage || "");
    setTheme(THEMES.some(t => t.id === eq.theme) ? eq.theme : DEFAULT_THEME_ID);
    setPreviewFont(FONT_OPTIONS.some(f => f.value === eq.font) ? eq.font : FONT_OPTIONS[0].value);
    const qs = eq.questions.map((q, i) => ({ id: q.id || String(Date.now()) + i, ...q, image: q.image || "" }));
    setQuestions(qs);
    setSelectedIdx(qs.length > 0 ? 0 : null);
    setActiveTemplateId(null);
    toast.success("Quiz chargé pour édition");
  }, [quizId]);

  // ── Load template ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!templateId || quizId) return;
    if (isSlide) {
      const tpl = getSlideTemplate(templateId);
      if (!tpl) return;
      setTitle(tpl.name); setDescription(tpl.description); setCategory("Présentation");
      const slides = tpl.slides.map((s: any, i: number) => ({ id: `${tpl.id}-${Date.now()}-${i}`, ...s }));
      setQuestions(slides); setSelectedIdx(slides.length > 0 ? 0 : null);
      setActiveTemplateId(tpl.id); toast.success("Modèle de présentation chargé");
    } else if (isPoll) {
      const tpl = getPollTemplate(templateId);
      if (tpl) applyTemplate(tpl);
    } else if (isFlashcard) {
      const tpl = getFlashcardTemplate(templateId);
      if (!tpl) return;
      setTitle(tpl.name); setDescription(tpl.description); setCategory(tpl.category);
      const cards = tpl.cards.map((c: any, i: number) => ({ id: `${tpl.id}-${Date.now()}-${i}`, ...c, type: "flashcard" }));
      setQuestions(cards); setSelectedIdx(cards.length > 0 ? 0 : null);
      setActiveTemplateId(tpl.id); toast.success("Modèle de flashcards chargé");
    } else {
      const tpl = getQuizTemplate(templateId);
      if (tpl) applyTemplate(tpl);
    }
  }, [templateId, isPoll, isFlashcard, isSlide, quizId]);

  // ── Question bank ────────────────────────────────────────────────────────
  useEffect(() => {
    if (user) setQuestionBankItems(getQuestionBankForUser(user.id));
  }, [user]);
  useEffect(() => {
    if (questionBankDialogOpen && user) setQuestionBankItems(getQuestionBankForUser(user.id));
  }, [questionBankDialogOpen]);

  // ── DnD sensors ──────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Helpers ──────────────────────────────────────────────────────────────
  function getDefaultQuestion(type?: QuizQuestionType | PollQuestionType): any {
    if (isSlide) return { type: "slide", title: "", content: "", image: "" };
    if (isFlashcard) return { type: "flashcard", recto: "", verso: "", rectoImage: "", versoImage: "" };
    if (isPoll) {
      const pt = type || "single-choice";
      const base = { type: pt, question: "", image: "" };
      switch (pt) {
        case "single-choice": case "multiple-choice": return { ...base, answers: ["", "", "", ""], allowMultiple: pt === "multiple-choice" };
        case "likert-scale":    return { ...base, scale: ["Tout à fait d'accord", "D'accord", "Neutre", "Pas d'accord", "Pas du tout d'accord"] };
        case "frequency-scale": return { ...base, scale: ["Jamais", "Rarement", "Parfois", "Souvent", "Toujours"] };
        case "star-rating":     return { ...base, maxStars: 5 };
        case "ranking":         return { ...base, items: ["", "", "", ""] };
        case "open-text":       return { ...base, maxLength: 500 };
        case "nps-scale":       return { ...base, minLabel: "Pas du tout probable", maxLabel: "Extrêmement probable" };
        default:                return { ...base, answers: ["", "", "", ""] };
      }
    }
    return createDefaultQuizQuestion((type as QuizQuestionType) || "multiple-choice");
  }

  const getAvailableTypes = (): (QuizQuestionType | PollQuestionType)[] =>
    isPoll
      ? ["single-choice", "multiple-choice", "likert-scale", "frequency-scale", "star-rating", "ranking", "open-text", "nps-scale"]
      : ["multiple-choice", "true-false", "short-answer", "ranking", "matching", "fill-blank", "slider"];

  const confirmLeave = () => !shouldBlockNavigation || window.confirm(t("confirmLeaveBuilder"));

  const handleNavigateAway = (path: string) => {
    if (!confirmLeave()) return;
    setShouldBlockNavigation(false);
    navigate(path);
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const applyTemplate = (tpl: PollTemplate | QuizTemplate) => {
    setTitle(tpl.name); setDescription(tpl.description); setCategory(tpl.category);
    const qs = tpl.questions.map((q, i) => ({ id: `${tpl.id}-${Date.now()}-${i}-${Math.random().toString(36).slice(2,8)}`, ...q, image: q.image || "" }));
    setQuestions(qs as any[]); setSelectedIdx(qs.length > 0 ? 0 : null);
    setTags([]); setTemplateDialogOpen(false); setActiveTemplateId(tpl.id);
    toast.success(t("templateLoaded"));
  };

  const updateQuestion = (idx: number, updates: Partial<any>) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...updates } : q));
  };

  const handleAddQuestion = (type?: QuizQuestionType | PollQuestionType) => {
    const newQ = { id: Date.now().toString(), ...getDefaultQuestion(type), image: "" };
    setQuestions(prev => { const updated = [...prev, newQ]; setSelectedIdx(updated.length - 1); return updated; });
  };

  const handleDeleteQuestion = (idx: number) => {
    setQuestions(prev => {
      const updated = prev.filter((_, i) => i !== idx);
      setSelectedIdx(prev2 => {
        if (prev2 === null) return null;
        if (prev2 === idx) return updated.length > 0 ? Math.min(idx, updated.length - 1) : null;
        if (prev2 > idx) return prev2 - 1;
        return prev2;
      });
      return updated;
    });
  };

  const handleDuplicateQuestion = (idx: number) => {
    setQuestions(prev => {
      const dup = { ...prev[idx], id: Date.now().toString() };
      const updated = [...prev];
      updated.splice(idx + 1, 0, dup);
      setSelectedIdx(idx + 1);
      return updated;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = questions.findIndex(q => q.id === active.id);
    const newIdx = questions.findIndex(q => q.id === over.id);
    const reordered = arrayMove(questions, oldIdx, newIdx);
    setQuestions(reordered);
    if (selectedIdx !== null) {
      const selId = questions[selectedIdx]?.id;
      if (selId) setSelectedIdx(reordered.findIndex(q => q.id === selId));
    }
  };

  const handleSaveQuiz = () => {
    if (!title.trim()) { toast.error(t("titleRequired")); return; }
    if (questions.length === 0) { toast.error(t("oneQuestionRequired")); return; }
    try {
      const data = {
        title, description, questions,
        isPublic: isPoll ? false : isPublic,
        isFavorite: false, tags,
        speedBonus: isPoll ? false : speedBonus,
        transitionTime, category, type: quizType,
        headerImage, theme, font: previewFont,
      };
      quizId ? updateQuiz(quizId, data) : saveQuiz(data);
      toast.success(quizId ? (isPoll ? "Sondage mis à jour" : "Quiz mis à jour") : (isPoll ? t("pollSaved") : t("quizSaved")));
      setShouldBlockNavigation(false);
      navigate(isFlashcard ? "/my-flashcards" : isPoll ? "/my-polls" : isSlide ? "/my-courses" : "/my-quizzes");
    } catch { toast.error("Erreur lors de l'enregistrement"); }
  };

  const handlePreviewQuiz = () => {
    if (questions.length === 0) { toast.error("Ajoutez au moins une question pour prévisualiser"); return; }
    const tmp = { id: "preview-" + Date.now(), title: title || "Mon Quiz", description, questions, type: quizType, headerImage, theme, font: previewFont };
    localStorage.setItem(`quiz-${tmp.id}`, JSON.stringify(tmp));
    setShouldBlockNavigation(false);
    navigate(`/preview/${tmp.id}`);
  };

  const handleImportFromFile = (draft: import("@/lib/importParsers").ImportDraft) => {
    const mapped = draft.questions.map((q: any, i: number) => ({ ...q, id: q.id || `imported-${Date.now()}-${i}` }));
    if (draft.title) setTitle(draft.title);
    if (draft.description) setDescription(draft.description);
    setQuestions(mapped);
    setSelectedIdx(mapped.length > 0 ? 0 : null);
  };

  const handleImportFromQuestionBank = (item: QuestionBankItem) => {
    const newQ = { ...item.question, id: `${item.id}-${Date.now()}` };
    setQuestions(prev => { const updated = [...prev, newQ]; setSelectedIdx(updated.length - 1); return updated; });
    setQuestionBankDialogOpen(false);
    toast.success(t("questionImported"));
  };

  // ── Center editor ─────────────────────────────────────────────────────────
  const renderCenterEditor = () => {
    if (selectedIdx === null || !questions[selectedIdx]) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16 }}>
          <p style={{ color: "var(--ap-muted)", fontSize: 15, fontWeight: 700, textAlign: "center" }}>
            {isFlashcard ? "Sélectionnez une carte ou créez-en une" : isSlide ? "Sélectionnez une diapositive" : "Sélectionnez une question ou créez-en une"}
          </p>
          <button className="ap-btn ap-btn--pill ap-btn--sm" onClick={() => handleAddQuestion()}>
            <Plus style={{ width: 14, height: 14 }} />
            {isFlashcard ? "Nouvelle carte" : isSlide ? "Nouvelle diapositive" : "Nouvelle question"}
          </button>
        </div>
      );
    }

    const q = questions[selectedIdx];
    const upd = (u: Partial<any>) => updateQuestion(selectedIdx, u);

    if (isSlide) return <div style={{ maxWidth: 660, margin: "0 auto" }}><SlideEditor slide={q} onChange={upd} /></div>;
    if (isFlashcard) return <div style={{ maxWidth: 660, margin: "0 auto" }}><FlashcardEditor flashcard={q} onChange={upd} /></div>;

    const meta = QTYPE_META[q.type] || { label: q.type, dot: "var(--ap-muted)" };
    const isMC = q.type === "multiple-choice" || q.type === "single-choice";
    const isTF = q.type === "true-false";

    return (
      <div style={{ maxWidth: 660, margin: "0 auto" }}>

        {/* Type chip */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                fontSize: 12.5, fontWeight: 800, padding: "7px 14px",
                borderRadius: 999, cursor: "pointer", marginBottom: 18,
                color: meta.dot === "var(--ap-quiz)" ? "var(--ap-quiz-deep)" : meta.dot === "var(--ap-poll)" ? "var(--ap-poll-deep)" : "var(--ap-pres-deep)",
                background: meta.dot === "var(--ap-quiz)" ? "var(--ap-quiz-soft)" : meta.dot === "var(--ap-poll)" ? "var(--ap-poll-soft)" : "var(--ap-pres-soft)",
                border: `2px solid color-mix(in srgb, ${meta.dot} 40%, transparent)`,
                transition: "transform .15s var(--ap-spring)",
              }}
            >
              <i style={{ width: 8, height: 8, borderRadius: 2, background: meta.dot, display: "inline-block" }} />
              {meta.label}
              <ChevronDown style={{ width: 12, height: 12, opacity: 0.6 }} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            style={{ background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-lg)", boxShadow: "var(--ap-shadow-card)" }}
            className="z-50 p-1.5"
          >
            {getAvailableTypes().map(type => {
              const m = QTYPE_META[type] || { label: type, dot: "var(--ap-muted)" };
              return (
                <DropdownMenuItem
                  key={type}
                  className="gap-2 rounded-xl text-sm cursor-pointer"
                  onSelect={() => {
                    const defaults = getDefaultQuestion(type as any);
                    upd({ ...defaults, id: q.id, question: q.question, image: q.image });
                  }}
                >
                  <i style={{ width: 7, height: 7, borderRadius: 2, background: m.dot, display: "inline-block", flexShrink: 0 }} />
                  {m.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Question textarea */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ap-muted)", marginBottom: 9 }}>
            <span>Question</span>
            <span style={{ fontSize: 11.5, letterSpacing: 0, textTransform: "none", fontWeight: 700 }}>
              S'affiche en grand pour les joueurs
            </span>
          </div>
          <textarea
            value={q.question || ""}
            onChange={e => { upd({ question: e.target.value }); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
            placeholder="Posez votre question…"
            rows={2}
            style={{
              width: "100%", resize: "none", overflow: "hidden",
              fontFamily: "var(--ap-font-body)", fontWeight: 800, fontSize: 22,
              lineHeight: 1.35, color: "var(--ap-ink)",
              background: "white", border: "2px solid var(--ap-line)",
              borderRadius: "var(--ap-r-lg)", padding: "18px 20px",
              boxShadow: "0 4px 0 var(--ap-line)", outline: "none",
              transition: "border-color .15s, box-shadow .15s",
            }}
            onFocus={e => { e.target.style.borderColor = "var(--ap-brand)"; e.target.style.boxShadow = "0 4px 0 color-mix(in srgb, var(--ap-brand) 40%, transparent)"; }}
            onBlur={e => { e.target.style.borderColor = "var(--ap-line)"; e.target.style.boxShadow = "0 4px 0 var(--ap-line)"; }}
          />
        </div>

        {/* Media */}
        {q.image ? (
          <div style={{ position: "relative", marginBottom: 18, borderRadius: "var(--ap-r-md)", overflow: "hidden" }}>
            <img src={q.image} alt="" style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }} />
            <button
              onClick={() => upd({ image: "" })}
              style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,.6)", color: "white", border: "none", borderRadius: 8, padding: "4px 8px", cursor: "pointer" }}
            >
              <Trash2 style={{ width: 14, height: 14 }} />
            </button>
          </div>
        ) : (
          <label style={{ display: "block", marginBottom: 18, cursor: "pointer" }}>
            <div
              style={{
                border: "2px dashed var(--ap-line-2)", borderRadius: "var(--ap-r-md)",
                padding: "13px 16px", display: "flex", alignItems: "center", gap: 10,
                color: "var(--ap-muted)", fontSize: 13, fontWeight: 700,
                transition: "border-color .15s, background .15s, color .15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--ap-brand)"; (e.currentTarget as HTMLElement).style.color = "var(--ap-brand-deep)"; (e.currentTarget as HTMLElement).style.background = "var(--ap-brand-soft)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--ap-line-2)"; (e.currentTarget as HTMLElement).style.color = "var(--ap-muted)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <ImageIcon style={{ width: 17, height: 17, flexShrink: 0 }} />
              Ajouter une image ou un schéma (glissez-déposez ou cliquez)
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const r = new FileReader();
              r.onloadend = () => upd({ image: r.result as string });
              r.readAsDataURL(file);
              e.target.value = "";
            }} />
          </label>
        )}

        {/* Answers — MC */}
        {isMC && (
          <div style={{ marginTop: 30 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ap-muted)", marginBottom: 9 }}>
              <span>Réponses</span>
              <span style={{ fontSize: 11.5, letterSpacing: 0, textTransform: "none", fontWeight: 700 }}>Cochez la bonne réponse</span>
            </div>
            {(q.answers || ["", "", "", ""]).map((ans: string, i: number) => (
              <AnswerRow
                key={i}
                index={i}
                value={ans}
                isCorrect={q.correctAnswer === i}
                onChange={v => { const a = [...(q.answers || ["","","",""])]; a[i] = v; upd({ answers: a }); }}
                onToggleCorrect={() => upd({ correctAnswer: q.correctAnswer === i ? -1 : i })}
                placeholder={i === 3 ? "Réponse 4 (facultative)" : `Réponse ${i + 1}`}
              />
            ))}
          </div>
        )}

        {/* Answers — True/False */}
        {isTF && (
          <div style={{ marginTop: 30 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ap-muted)", marginBottom: 9 }}>
              Bonne réponse
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              {(["true", "false"] as const).map((val, i) => {
                const isSelected = q.correctAnswer === val;
                const accent = val === "true" ? "var(--ap-pres)" : "var(--ap-quiz)";
                const accentDeep = val === "true" ? "var(--ap-pres-deep)" : "var(--ap-quiz-deep)";
                const accentSoft = val === "true" ? "var(--ap-pres-soft)" : "var(--ap-quiz-soft)";
                return (
                  <button
                    key={val}
                    onClick={() => upd({ correctAnswer: val })}
                    style={{
                      flex: 1, padding: "14px", borderRadius: "var(--ap-r-md)",
                      border: `2px solid ${isSelected ? accent : "var(--ap-line)"}`,
                      background: isSelected ? accentSoft : "white",
                      color: isSelected ? accentDeep : "var(--ap-muted)",
                      fontWeight: 800, fontSize: 16, cursor: "pointer",
                      transition: "all .15s",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      boxShadow: "0 3px 0 var(--ap-line)", fontFamily: "inherit",
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{val === "true" ? "✓" : "✗"}</span>
                    {val === "true" ? "Vrai" : "Faux"}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Fallback type-specific fields */}
        {!isMC && !isTF && renderFallbackFields(q, upd)}

        {/* Points + Time segments */}
        {!isPoll && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 30 }}>
            {/* Points */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ap-muted)", marginBottom: 9 }}>Points</div>
              <div style={{ display: "flex", background: "white", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)", padding: 4, gap: 4, boxShadow: "0 3px 0 var(--ap-line)" }}>
                {POINTS_OPTIONS.map(opt => {
                  const isOn = (q.points ?? 1000) === opt.value || (opt.value === 1000 && (q.points ?? 1000) !== 0 && (q.points ?? 1000) !== 2000);
                  return (
                    <button key={opt.value} onClick={() => upd({ points: opt.value })}
                      style={{
                        flex: 1, border: "none", borderRadius: 9, padding: "9px 6px",
                        background: isOn ? "var(--ap-ink)" : "transparent",
                        color: isOn ? "white" : "var(--ap-muted)",
                        fontWeight: 800, fontSize: 12.5, cursor: "pointer",
                        transition: "background .15s, color .15s", fontFamily: "inherit",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Time */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ap-muted)", marginBottom: 9 }}>Temps de réponse</div>
              <div style={{ display: "flex", background: "white", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)", padding: 4, gap: 4, boxShadow: "0 3px 0 var(--ap-line)" }}>
                {TIME_OPTIONS.map(opt => {
                  const isOn = (q.timeLimit ?? 20) === opt.value;
                  return (
                    <button key={opt.value} onClick={() => upd({ timeLimit: opt.value })}
                      style={{
                        flex: 1, border: "none", borderRadius: 9, padding: "9px 6px",
                        background: isOn ? "var(--ap-brand)" : "transparent",
                        color: isOn ? "white" : "var(--ap-muted)",
                        fontWeight: 700, fontSize: 12.5, cursor: "pointer",
                        transition: "background .15s, color .15s",
                        fontFamily: "var(--ap-font-mono)",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFallbackFields = (q: any, upd: (u: any) => void) => {
    switch (q.type) {
      case "short-answer":
      case "fill-blank":
        return null;
      case "ranking":
        return (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ap-muted)", marginBottom: 9 }}>Éléments à classer</div>
            {(q.items || ["", "", "", ""]).map((item: string, i: number) => (
              <Input key={i} value={item} placeholder={`Élément ${i + 1}`} className="mt-2"
                onChange={e => { const items = [...(q.items || ["","","",""])]; items[i] = e.target.value; upd({ items }); }}
              />
            ))}
          </div>
        );
      case "slider":
        return (
          <div style={{ marginTop: 24 }} className="space-y-3">
            <div><Label>Valeur min</Label><Input type="number" value={q.min ?? 0} className="mt-2" onChange={e => upd({ min: parseInt(e.target.value) })} /></div>
            <div><Label>Valeur max</Label><Input type="number" value={q.max ?? 100} className="mt-2" onChange={e => upd({ max: parseInt(e.target.value) })} /></div>
            <div><Label>Bonne réponse</Label><Input type="number" value={q.correctAnswer ?? 50} className="mt-2" onChange={e => upd({ correctAnswer: parseInt(e.target.value) })} /></div>
          </div>
        );
      case "likert-scale":
      case "frequency-scale":
        return (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ap-muted)", marginBottom: 9 }}>Échelle</div>
            {(q.scale || []).map((item: string, i: number) => (
              <Input key={i} value={item} className="mt-2"
                onChange={e => { const scale = [...(q.scale || [])]; scale[i] = e.target.value; upd({ scale }); }}
              />
            ))}
          </div>
        );
      case "star-rating":
        return <div style={{ marginTop: 24 }}><Label>Nombre d'étoiles max</Label><Input type="number" min={1} max={10} value={q.maxStars ?? 5} className="mt-2" onChange={e => upd({ maxStars: parseInt(e.target.value) })} /></div>;
      case "nps-scale":
        return (
          <div style={{ marginTop: 24 }} className="space-y-3">
            <div><Label>Label gauche (0)</Label><Input value={q.minLabel ?? ""} className="mt-2" onChange={e => upd({ minLabel: e.target.value })} /></div>
            <div><Label>Label droite (10)</Label><Input value={q.maxLabel ?? ""} className="mt-2" onChange={e => upd({ maxLabel: e.target.value })} /></div>
          </div>
        );
      case "open-text":
        return <div style={{ marginTop: 24 }}><Label>Longueur max</Label><Input type="number" value={q.maxLength ?? 500} className="mt-2" onChange={e => upd({ maxLength: parseInt(e.target.value) })} /></div>;
      default:
        return null;
    }
  };

  // ── Right panel ───────────────────────────────────────────────────────────
  const renderRightPanel = () => {
    const liveDotStyle: React.CSSProperties = {
      width: 8, height: 8, borderRadius: "50%",
      background: "var(--ap-quiz)", flexShrink: 0,
      animation: "ap-dot-pulse 1.8s infinite",
    };
    const labelStyle: React.CSSProperties = {
      alignSelf: "stretch", display: "flex", alignItems: "center", gap: 10,
      fontSize: 11.5, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase",
      color: "var(--ap-muted)", marginBottom: 16,
    };

    if (isFlashcard && selectedQ) {
      return (
        <>
          <div style={labelStyle}><span style={{ ...liveDotStyle, background: "var(--ap-flash)" }} />Vue carte (miroir)<span style={{ flex: 1, height: 2, background: "var(--ap-line-2)", opacity: 0.5, borderRadius: 2 }} /></div>
          <FlashcardPreview flashcard={selectedQ} theme={activeTheme} />
        </>
      );
    }

    if (isSlide && selectedQ) {
      return (
        <>
          <div style={labelStyle}><span style={{ ...liveDotStyle, background: "var(--ap-pres)" }} />Vue slide (miroir)<span style={{ flex: 1, height: 2, background: "var(--ap-line-2)", opacity: 0.5, borderRadius: 2 }} /></div>
          <SlidePreview slide={selectedQ} />
        </>
      );
    }

    return (
      <>
        <div style={labelStyle}>
          <span style={liveDotStyle} />
          Vue joueur (miroir en direct)
          <span style={{ flex: 1, height: 2, background: "var(--ap-line-2)", opacity: 0.5, borderRadius: 2 }} />
        </div>
        <PhonePreview
          question={selectedQ}
          questionIndex={selectedIdx ?? 0}
          totalQuestions={questions.length}
        />
        {selectedQ && (
          <p style={{ marginTop: 16, fontSize: 12, fontWeight: 700, color: "var(--ap-muted)", textAlign: "center", lineHeight: 1.5 }}>
            Tout ce que vous tapez apparaît ici<br />
            <strong style={{ color: "var(--ap-ink)" }}>instantanément</strong>
          </p>
        )}
      </>
    );
  };

  const backPath = isFlashcard ? "/my-flashcards" : isSlide ? "/my-courses" : isPoll ? "/my-polls" : "/my-quizzes";
  const backLabel = isFlashcard ? "Mes Flashcards" : isSlide ? "Mes Cours" : isPoll ? "Mes Sondages" : "Mes Quiz";
  const difficultyTranslationKeyMap: Record<string, string> = { easy: "difficultyEasy", medium: "difficultyMedium", hard: "difficultyHard" };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--ap-paper)" }}>

      {/* ── Topbar ── */}
      <div style={{
        height: 62, flexShrink: 0, background: "white",
        borderBottom: "2px solid var(--ap-line)",
        display: "flex", alignItems: "center", gap: 16, padding: "0 18px",
        position: "relative", zIndex: 20,
      }}>
        {/* Back */}
        <button
          onClick={() => handleNavigateAway(backPath)}
          aria-label={`Retour : ${backLabel}`}
          style={{
            display: "grid", placeItems: "center", width: 36, height: 36,
            borderRadius: "var(--ap-r-sm)", border: "2px solid var(--ap-line)",
            background: "white", cursor: "pointer", boxShadow: "0 3px 0 var(--ap-line)",
            transition: "transform .15s var(--ap-spring), box-shadow .15s var(--ap-spring)",
            flexShrink: 0,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 0 var(--ap-line-2)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "0 3px 0 var(--ap-line)"; }}
        >
          <ChevronLeft style={{ width: 16, height: 16, color: "var(--ap-ink)" }} />
        </button>

        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ap-muted)", whiteSpace: "nowrap" }}>{backLabel}</span>
          <span style={{ color: "var(--ap-line-2)", fontWeight: 800 }}>/</span>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={isPoll ? "Mon Sondage" : isFlashcard ? "Mes Flashcards" : isSlide ? "Ma Présentation" : "Mon Quiz"}
            style={{
              fontFamily: "var(--ap-font-body)", fontWeight: 800, fontSize: 15.5, color: "var(--ap-ink)",
              border: "2px solid transparent", borderRadius: "var(--ap-r-sm)", background: "transparent",
              padding: "5px 9px", width: 280, outline: "none",
              transition: "border-color .15s, background .15s",
            }}
            onFocus={e => { e.target.style.borderColor = "var(--ap-brand)"; e.target.style.background = "white"; }}
            onBlur={e => { e.target.style.borderColor = "transparent"; e.target.style.background = "transparent"; }}
          />
        </div>

        <SaveStateIndicator state={saveState} />

        <div style={{ flex: 1 }} />

        {/* Settings */}
        <button
          onClick={() => setSettingsOpen(true)}
          title="Paramètres"
          style={{
            display: "grid", placeItems: "center", width: 36, height: 36,
            borderRadius: "var(--ap-r-sm)", border: "2px solid var(--ap-line)",
            background: "white", cursor: "pointer", boxShadow: "0 3px 0 var(--ap-line)",
            flexShrink: 0,
          }}
        >
          <Settings style={{ width: 15, height: 15, color: "var(--ap-muted)" }} />
        </button>

        {/* Preview */}
        <button
          onClick={handlePreviewQuiz}
          disabled={questions.length === 0}
          className="ap-btn ap-btn--ghost"
          style={{ padding: "10px 18px", borderRadius: 999, fontSize: 14 }}
        >
          <Eye style={{ width: 15, height: 15 }} />
          Aperçu
        </button>

        {/* Save / Publish */}
        <button
          onClick={handleSaveQuiz}
          className="ap-btn ap-btn--pill"
          style={{ padding: "10px 18px", fontSize: 14 }}
        >
          {quizId ? "Mettre à jour" : "Publier"}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </div>

      {/* ── Workspace ── */}
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "270px 1fr 330px" }}>

        {/* Left Rail */}
        <aside style={{ borderRight: "2px solid var(--ap-line)", background: "white", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "16px 16px 10px", display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ap-muted)", margin: 0 }}>
              {isFlashcard ? "Cartes" : isSlide ? "Diapositives" : "Questions"}
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: "var(--ap-font-mono)", fontSize: 12, fontWeight: 700, color: "var(--ap-muted)" }}>
                {questions.length}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ap-muted)", padding: "2px 4px", borderRadius: 6, display: "grid", placeItems: "center" }} title="Plus d'options">
                    <MoreHorizontal style={{ width: 15, height: 15 }} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="z-50 p-1.5" style={{ background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-lg)", boxShadow: "var(--ap-shadow-card)" }}>
                  <DropdownMenuItem className="gap-2 rounded-xl text-sm cursor-pointer" onSelect={() => setImportFileOpen(true)}>
                    <Upload style={{ width: 13, height: 13 }} /> Importer depuis un fichier
                  </DropdownMenuItem>
                  {!isPoll && !isFlashcard && user && (
                    <DropdownMenuItem className="gap-2 rounded-xl text-sm cursor-pointer" onSelect={() => setQuestionBankDialogOpen(true)}>
                      <Library style={{ width: 13, height: 13 }} /> Banque de questions
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator style={{ background: "var(--ap-line)" }} />
                  <DropdownMenuItem className="gap-2 rounded-xl text-sm cursor-pointer" onSelect={() => setTemplateDialogOpen(true)}>
                    Changer de modèle
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "4px 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
                {questions.map((q, i) => (
                  <RailItem
                    key={q.id}
                    question={q}
                    index={i}
                    isActive={selectedIdx === i}
                    onSelect={setSelectedIdx}
                    onDelete={handleDeleteQuestion}
                    onDuplicate={handleDuplicateQuestion}
                  />
                ))}
              </SortableContext>
            </DndContext>
            {questions.length === 0 && (
              <p style={{ textAlign: "center", padding: "32px 0", color: "var(--ap-muted)", fontSize: 13, fontWeight: 700 }}>
                Cliquez sur «+» pour commencer
              </p>
            )}
          </div>

          {/* Add button */}
          <button
            onClick={() => handleAddQuestion()}
            style={{
              margin: "0 12px 14px",
              padding: 11,
              border: "2px dashed var(--ap-line-2)",
              borderRadius: "var(--ap-r-md)",
              background: "transparent",
              fontFamily: "inherit",
              fontWeight: 800,
              fontSize: 13.5,
              color: "var(--ap-muted)",
              cursor: "pointer",
              transition: "color .15s, border-color .15s, background .15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--ap-brand-deep)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--ap-brand)"; (e.currentTarget as HTMLElement).style.background = "var(--ap-brand-soft)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--ap-muted)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--ap-line-2)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            + {isFlashcard ? "Ajouter une carte" : isSlide ? "Ajouter une diapositive" : "Ajouter une question"}
          </button>
        </aside>

        {/* Center Editor */}
        <main style={{ overflowY: "auto", padding: "26px 30px 60px", minHeight: 0 }}>
          {renderCenterEditor()}
        </main>

        {/* Right Preview */}
        <aside style={{
          borderLeft: "2px solid var(--ap-line)",
          background: "var(--ap-paper-2)",
          backgroundImage: "radial-gradient(var(--ap-line-2) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "20px 20px 24px",
          minHeight: 0,
          overflowY: "auto",
        }}>
          {renderRightPanel()}
        </aside>
      </div>

      {/* ── Settings dialog ── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Paramètres</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Catégorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {[["Culture Générale", t("generalCulture")], ["Science", t("science")], ["Histoire", t("history")], ["Géographie", t("geography")], ["Sport", t("sports")], ["Divertissement", t("entertainment")], ["Technologie", t("technology")], ["Arts", t("arts")], ["Autre", t("other")]].map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea placeholder={t("descriptionPlaceholder")} value={description} onChange={e => setDescription(e.target.value)} className="mt-2" />
            </div>
            <div>
              <Label>{t("headerImage")}</Label>
              {headerImage && (
                <div className="relative w-full h-32 rounded-lg overflow-hidden mt-2 mb-2">
                  <img src={headerImage} alt="Header" className="w-full h-full object-cover" />
                  <Button variant="ghost" size="sm" className="absolute top-2 right-2 bg-black/50 hover:bg-black/70" onClick={() => setHeaderImage("")}>
                    <Trash2 className="w-4 h-4 text-white" />
                  </Button>
                </div>
              )}
              <label htmlFor="header-image">
                <Button variant="outline" size="sm" asChild className="w-full mt-2">
                  <span><Upload className="w-4 h-4 mr-2" />{headerImage ? t("changeImage") : t("addImage")}</span>
                </Button>
              </label>
              <input id="header-image" type="file" accept="image/*" className="hidden" onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const r = new FileReader();
                r.onloadend = () => setHeaderImage(r.result as string);
                r.readAsDataURL(file);
              }} />
            </div>
            <div>
              <Label>{t("tags")}</Label>
              <div className="flex gap-2 mt-2">
                <Input placeholder={t("addTag")} value={newTag} onChange={e => setNewTag(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (newTag.trim() && !tags.includes(newTag.trim())) { setTags([...tags, newTag.trim()]); setNewTag(""); } } }}
                />
                <Button variant="outline" onClick={() => { if (newTag.trim() && !tags.includes(newTag.trim())) { setTags([...tags, newTag.trim()]); setNewTag(""); } }}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map(tag => <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => setTags(tags.filter(t => t !== tag))}>{tag} ×</Badge>)}
              </div>
            </div>
            {!isPoll && (
              <>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Label className="cursor-pointer">{t("public")}</Label>
                    <TooltipProvider><Tooltip><TooltipTrigger asChild><button className="text-muted-foreground hover:text-foreground"><HelpCircle className="w-4 h-4" /></button></TooltipTrigger><TooltipContent><p className="max-w-xs">{t("publicTooltip")}</p></TooltipContent></Tooltip></TooltipProvider>
                  </div>
                  <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Label className="cursor-pointer">{t("speedBonus")}</Label>
                    <TooltipProvider><Tooltip><TooltipTrigger asChild><button className="text-muted-foreground hover:text-foreground"><HelpCircle className="w-4 h-4" /></button></TooltipTrigger><TooltipContent><p className="max-w-xs">{t("speedBonusTooltip")}</p></TooltipContent></Tooltip></TooltipProvider>
                  </div>
                  <Switch checked={speedBonus} onCheckedChange={setSpeedBonus} />
                </div>
                <div>
                  <Label>{t("transitionTime")}</Label>
                  <Input type="number" min="3" max="10" value={transitionTime} onChange={e => setTransitionTime(parseInt(e.target.value) || 5)} className="mt-2" />
                </div>
              </>
            )}
            <div>
              <Label>Thème visuel</Label>
              <div className="mt-3 space-y-3">
                <ThemeSelectionDropdown value={theme} onChange={setTheme} />
                <div className="rounded-2xl border border-border/60 bg-muted/30 p-4"><ThemePreviewPanel theme={activeTheme} /></div>
              </div>
            </div>
            <div>
              <Label>Police d'écriture</Label>
              <Select value={previewFont} onValueChange={setPreviewFont}>
                <SelectTrigger className="mt-2" style={{ fontFamily: activeFont.stack }}><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {FONT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="py-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold" style={{ fontFamily: opt.stack }}>{opt.label}</span>
                        <span className="text-xs text-muted-foreground" style={{ fontFamily: opt.stack }}>{opt.tagline}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Question bank dialog ── */}
      <Dialog open={questionBankDialogOpen} onOpenChange={setQuestionBankDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t("importFromQuestionBank")}</DialogTitle>
            <DialogDescription>{t("questionBankImportDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {questionBankItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-6 text-center">
                <p className="text-sm text-muted-foreground">{t("questionBankEmpty")}</p>
                <Button className="mt-4" variant="outline" onClick={() => { setShouldBlockNavigation(false); navigate("/question-bank"); }}>
                  {t("manageQuestionBank")}
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {questionBankItems.map(item => (
                  <Card key={item.id} className="flex h-full flex-col border-border/60 bg-card">
                    <CardHeader>
                      <CardTitle className="text-lg">{item.title}</CardTitle>
                      {item.topic && <CardDescription>{item.topic}</CardDescription>}
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col gap-4">
                      <p className="text-sm line-clamp-3">{item.question.question?.trim() || t("noQuestionText")}</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="rounded-full">{item.question.type}</Badge>
                        {item.difficulty && <Badge variant="outline" className="rounded-full">{t((difficultyTranslationKeyMap[item.difficulty] || item.difficulty) as any)}</Badge>}
                      </div>
                      <div className="mt-auto flex justify-end">
                        <Button onClick={() => handleImportFromQuestionBank(item)}>{t("importQuestion")}</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Template dialog ── */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>{t("changeTemplate")}</DialogTitle></DialogHeader>
          {isPoll ? (
            <PollTemplateSelectorEnhanced selectedTemplateId={activeTemplateId} onSelectTemplate={applyTemplate} />
          ) : (
            <QuizTemplateSelectorEnhanced selectedTemplateId={activeTemplateId} onSelectTemplate={applyTemplate} />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Import file modal ── */}
      <ImportFileModal open={importFileOpen} onClose={() => setImportFileOpen(false)} quizType={quizType} onImport={handleImportFromFile} />
    </div>
  );
};
