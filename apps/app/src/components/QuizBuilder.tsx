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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Trash2, Upload, GripVertical,
  ChevronRight, ChevronDown, Eye, ImageIcon, MoreHorizontal,
  ArrowRight, Copy, Library, HelpCircle, Home, type LucideIcon,
  ListChecks, CircleDot, ToggleLeft, TextCursorInput, ArrowUpDown,
  Link2, TextSelect, SlidersHorizontal, Rows3, ChartNoAxesColumn,
  Star, MessageSquareText, Gauge, Layers3, Presentation, BarChart2,
} from "lucide-react";
import { ImportFileModal } from "./ImportFileModal";
import { getCurrentUser } from "@/lib/auth";
import { useSaveShortcut } from "@/hooks/useSaveShortcut";
import { getPlan, isQuestionTypeLocked } from "@/lib/plans";
import { showError } from "@/lib/errorTaxonomy";
import { saveQuiz, updateQuiz, getQuizById, saveQuizAsTemplate, setQuizPlayCache, type SavedQuiz } from "@/lib/quizStorage";
import { readSessionHistory } from "@/lib/sessionState";
import {
  getContent,
  getContentBySource,
  getContentBySourceAnyOwner,
  updateCollaborativeContent,
  upsertContentBySource,
} from "@/lib/content/contentRepo";
import type { ContentRow, ContentType } from "@/lib/content/types";
import { getPollTemplate } from "@/lib/pollTemplates";
import { getQuizTemplate } from "@/lib/quizTemplates";
import { getFlashcardTemplate } from "@/lib/flashcardTemplates";
import { DEFAULT_THEME_ID, THEMES, type Theme } from "@/lib/themes";
import { AMBIANCE_OPTIONS, DEFAULT_AMBIANCE } from "@/lib/audioManifest";
import { hexToRgba } from "@/lib/color";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { getQuestionTypeDescription, type QuizQuestionType, type PollQuestionType, type EditableQuestion } from "@/lib/questionTypes";
import type { PollTemplate } from "@/lib/pollTemplates";
import type { QuizTemplate } from "@/lib/quizTemplates";
import { PollTemplateSelectorEnhanced } from "./PollTemplateSelectorEnhanced";
import { QuizTemplateSelectorEnhanced } from "./QuizTemplateSelectorEnhanced";
import { FlashcardEditor } from "./FlashcardEditor";
import { FlashcardPreview } from "./FlashcardPreview";
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
import { BrandMonogram } from "ui/BrandMonogram";
import { CollaboratorsButton } from "@/components/CollaboratorsButton";
import { QuestionLayoutPicker } from "@/components/QuestionLayoutPicker";
import { getQuestionLayout } from "@/lib/contentLayouts";
import { QuestionTypeExample } from "@/components/QuestionTypeExample";
import { MultiStepProgress } from "@/components/MultiStepProgress";
import { PLAYER_ANSWER_SHAPES } from "@/lib/answerVisuals";
import { MaterialSymbol } from "@/components/MaterialSymbol";

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

const QTYPE_META: Record<string, { label: string; dot: string; icon: LucideIcon }> = {
  "multiple-choice":  { label: "QCM",            dot: "var(--ap-quiz)",  icon: ListChecks },
  "single-choice":    { label: "Choix unique",   dot: "var(--ap-quiz)",  icon: CircleDot },
  "true-false":       { label: "Vrai / Faux",    dot: "var(--ap-poll)",  icon: ToggleLeft },
  "short-answer":     { label: "Réponse courte", dot: "var(--ap-flash)", icon: TextCursorInput },
  "ranking":          { label: "Classement",     dot: "var(--ap-pres)",  icon: ArrowUpDown },
  "matching":         { label: "Association",    dot: "var(--ap-quiz)",  icon: Link2 },
  "fill-blank":       { label: "Lacune",         dot: "var(--ap-poll)",  icon: TextSelect },
  "slider":           { label: "Curseur",        dot: "var(--ap-flash)", icon: SlidersHorizontal },
  "likert-scale":     { label: "Likert",         dot: "var(--ap-poll)",  icon: Rows3 },
  "frequency-scale":  { label: "Fréquence",      dot: "var(--ap-poll)",  icon: ChartNoAxesColumn },
  "star-rating":      { label: "Étoiles",        dot: "var(--ap-flash)", icon: Star },
  "open-text":        { label: "Texte ouvert",   dot: "var(--ap-pres)",  icon: MessageSquareText },
  "nps-scale":        { label: "NPS",            dot: "var(--ap-brand)", icon: Gauge },
  "flashcard":        { label: "Carte",          dot: "var(--ap-flash)", icon: Layers3 },
  "slide":            { label: "Slide",          dot: "var(--ap-pres)",  icon: Presentation },
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

// Reflects whether there are edits since the quiz was last actually persisted
// (via handleSaveQuiz) — it never claims "saved" for changes that only exist
// in component state, unlike the old timer-driven version of this component.
const SaveStateIndicator = ({ state }: { state: "saved" | "unsaved" }) => (
  <div
    style={{
      display: "flex", alignItems: "center", gap: 7,
      fontSize: 12.5, fontWeight: 700,
      padding: "5px 12px", borderRadius: "var(--ap-r-sm)",
      border: `2px solid ${state === "saved" ? "color-mix(in srgb, var(--ap-pres) 35%, transparent)" : "var(--ap-line)"}`,
      background: state === "saved" ? "var(--ap-pres-soft)" : "var(--ap-paper)",
      color: state === "saved" ? "var(--ap-pres-deep)" : "var(--ap-muted)",
      transition: "color .3s, border-color .3s",
      flexShrink: 0,
    }}
  >
    {state === "unsaved" ? (
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ap-brand)", display: "inline-block", flexShrink: 0 }} />
    ) : (
      <svg style={{ width: 14, height: 14 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12.5 10 18 20 6" />
      </svg>
    )}
    <span>{state === "unsaved" ? "Modifications non enregistrées" : "Enregistré"}</span>
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
        background: "var(--ap-card)",
        border: "var(--ap-border-w) solid var(--ap-line)",
        borderRadius: "var(--ap-r-md)",
        padding: "8px 10px",
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
  question: EditableQuestion; questionIndex: number; totalQuestions: number;
}) => {
  if (!question) {
    // Keeps the phone bezel/notch even with nothing to show — losing the
    // frame here reads as a broken preview rather than an empty one.
    return (
      <div style={{
        width: 258, flexShrink: 0,
        background: "var(--ap-ink)", borderRadius: "var(--ap-r-md)", padding: 9,
        boxShadow: "0 10px 0 #16102a, 0 30px 50px rgba(36,27,58,.28)",
      }}>
        <div style={{
          background: "var(--ap-brand)", borderRadius: "var(--ap-r-md)", overflow: "hidden",
          display: "flex", flexDirection: "column", minHeight: 470,
        }}>
          <div style={{ width: 84, height: 20, background: "var(--ap-ink)", borderRadius: "0 0 var(--ap-r-xl) var(--ap-r-xl)", margin: "0 auto", flexShrink: 0 }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, padding: 20, color: "rgba(255,255,255,.7)", fontSize: 13, fontWeight: 700, textAlign: "center" }}>
            Sélectionnez une question<br />pour voir l'aperçu joueur
          </div>
        </div>
      </div>
    );
  }

  const timeLimit = question.timeLimit || 20;
  const pts = question.points ?? 1000;
  const answers: string[] = question.answers || [];
  const qText = question.question || "";
  const layout = getQuestionLayout(question.layout ?? (question.image ? "media-top" : "standard"));
  const hasMedia = Boolean(question.image);

  const isChoice = ["multiple-choice", "single-choice"].includes(question.type);
  const isTF = question.type === "true-false";
  const displayAnswers = isTF
    ? ["Vrai", "Faux"]
    : question.type === "ranking"
      ? (question.items?.length ? question.items : ["Priorité 1", "Priorité 2", "Priorité 3"])
      : question.type === "likert-scale" || question.type === "frequency-scale"
        ? (question.scale?.length ? question.scale : ["Jamais", "Parfois", "Toujours"])
        : question.type === "matching"
          ? (question.leftColumn?.map((item) => item.text || "Élément à associer") ?? ["Concept A", "Concept B"])
          : question.type === "star-rating"
            ? ["★  ★  ★  ★  ★"]
            : question.type === "nps-scale"
              ? ["0  1  2  3  4  5  6  7  8  9  10"]
              : question.type === "slider"
                ? [`${question.min ?? 0}   ━━━━━●━━━━   ${question.max ?? 100}`]
                : question.type === "open-text"
                  ? ["Écrivez librement votre réponse…"]
                  : question.type === "short-answer" || question.type === "fill-blank"
                    ? ["Saisissez votre réponse…"]
                    : answers;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: 258, flexShrink: 0 }}>
      <div style={{
        width: 258,
        background: "var(--ap-ink)", borderRadius: "var(--ap-r-md)", padding: 9,
        boxShadow: "0 10px 0 #16102a, 0 30px 50px rgba(36,27,58,.28)",
      }}>
        {/* Réplique de l'écran joueur réel (PlayerView, état 'question') :
            fond marque, pastille Question X/Y, barre de progression, carte
            flottante avec barre de temps linéaire et tuiles ap-answer--solid
            — mêmes classes/tokens que arcade-pop.css, pas une réinvention. */}
        <div style={{
          background: "var(--ap-brand)", borderRadius: "var(--ap-r-md)", overflow: "hidden",
          display: "flex", flexDirection: "column", minHeight: 470,
        }}>
          {/* Notch */}
          <div style={{ width: 84, height: 20, background: "var(--ap-ink)", borderRadius: "0 0 var(--ap-r-xl) var(--ap-r-xl)", margin: "0 auto", flexShrink: 0 }} />

          <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, padding: "12px 12px 14px" }}>
            {/* Header : pastille Question X/Y, identique à PlayerView */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10, flexShrink: 0 }}>
              <span style={{
                fontFamily: "var(--ap-font-display)", fontWeight: 700, fontSize: 11,
                color: "#fff", background: "rgba(255,255,255,.15)", border: "2px solid rgba(255,255,255,.2)",
                borderRadius: "var(--ap-r-pill)", padding: "4px 12px",
              }}>
                Question {questionIndex + 1}/{totalQuestions || 1}
              </span>
            </div>

            <div style={{ marginBottom: 10, flexShrink: 0 }}>
              <MultiStepProgress totalSteps={Math.min(totalQuestions || 1, 15)} currentStep={questionIndex} className="h-2" />
            </div>

            {/* Carte flottante blanche — identique à .ap-card.ap-card--floaty en session */}
            <div className="ap-card ap-card--floaty" style={{ padding: 12, flexShrink: 0 }}>
              {/* Barre de temps linéaire (statique — pas de décompte simulé dans l'éditeur) */}
              <div style={{ height: 6, background: "var(--ap-paper-2)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-md)", overflow: "hidden", marginBottom: 10 }}>
                <div style={{ height: "100%", width: "100%", background: "var(--ap-brand)" }} />
              </div>

              {/* Question + media layout */}
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: layout.mediaPosition === "left"
                    ? "row"
                    : layout.mediaPosition === "right"
                      ? "row-reverse"
                      : "column",
                  minHeight: layout.mediaPosition === "background" && hasMedia ? 150 : 56,
                  marginBottom: 10,
                  overflow: "hidden",
                  borderRadius: "var(--ap-r-md)",
                  background: layout.mediaPosition === "background" && hasMedia ? "var(--ap-ink)" : "transparent",
                }}
              >
                {hasMedia && layout.mediaPosition !== "none" && (
                  <img
                    src={question.image}
                    alt=""
                    style={{
                      position: layout.mediaPosition === "background" ? "absolute" : "relative",
                      inset: layout.mediaPosition === "background" ? 0 : undefined,
                      width: layout.mediaPosition === "left" || layout.mediaPosition === "right" ? "42%" : "100%",
                      height: layout.mediaPosition === "top" ? 90 : layout.mediaPosition === "background" ? "100%" : 96,
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                )}
                {/* Media-legibility scrim — same value as QuizSession.tsx/PollSession.tsx's
                    identical-intent gradient; previously drifted brand-tinted rgb + a
                    different start-opacity in each of the three. */}
                {layout.mediaPosition === "background" && hasMedia && (
                  <span aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.1), rgba(0,0,0,.82))" }} />
                )}
                <p style={{
                  position: "relative",
                  zIndex: 1,
                  flex: 1,
                  display: "flex",
                  alignItems: layout.mediaPosition === "background" ? "flex-end" : "center",
                  justifyContent: "center",
                  textAlign: "center",
                  fontFamily: "var(--ap-font-display)",
                  fontWeight: 600,
                  fontSize: layout.mediaPosition === "background" ? 15 : 13,
                  lineHeight: 1.4,
                  padding: "2px 4px",
                  minWidth: 0,
                  color: layout.mediaPosition === "background" && hasMedia ? "white" : "var(--ap-ink)",
                  textShadow: layout.mediaPosition === "background" && hasMedia ? "0 2px 8px rgba(0,0,0,.45)" : undefined,
                }}>
                  {qText || <span style={{ color: "var(--ap-muted)" }}>Posez votre question…</span>}
                </p>
              </div>

              {/* Réponses — mêmes classes/tokens que PlayerView (ap-answer--solid, PLAYER_ANSWER_SHAPES) */}
              {isChoice || isTF ? (
                <div className="ap-answers" style={{ gap: 8 }}>
                  {(isTF ? [question.answers?.[0] ?? "Vrai", question.answers?.[1] ?? "Faux"] : answers).slice(0, 4).map((ans, i) => {
                    if (!isTF && i >= 3 && !ans) return null;
                    return (
                      <div
                        key={i}
                        className={`ap-answer ap-answer--solid ap-answer--${(i % 4) + 1}`}
                        style={{ padding: "9px 10px", fontSize: 11.5, cursor: "default" }}
                      >
                        <span className="ap-answer__shape" style={{ width: 22, height: 22, fontWeight: 800 }}>
                          {isTF ? (i === 0 ? "V" : "F") : PLAYER_ANSWER_SHAPES[i % 4]}
                        </span>
                        <span className="ap-answer__text">{ans || `Réponse ${i + 1}`}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {displayAnswers.slice(0, 4).map((ans: string, i: number) => (
                    <div key={i} style={{
                      background: "var(--ap-paper)", border: "var(--ap-border-w) solid var(--ap-line)",
                      borderRadius: "var(--ap-r-md)", padding: "8px 10px",
                      fontWeight: 700, fontSize: 11.5, color: "var(--ap-ink)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {ans}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Temps limite / points configurés — info éditeur, hors de l'écran mimé
          (l'écran joueur réel ne les affiche pas pendant la question). */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: 11.5, color: "var(--ap-muted)",
      }}>
        <span style={{ display: "inline-flex", verticalAlign: "-2px" }}>
          <BrandMonogram size={11} color="var(--ap-brand)" />
        </span>
        {timeLimit}s · {pts} pts
      </div>
    </div>
  );
};

const RailItem = ({
  question, index, isActive, onSelect, onDelete, onDuplicate,
}: {
  question: EditableQuestion; index: number; isActive: boolean;
  onSelect: (i: number) => void; onDelete: (i: number) => void; onDuplicate: (i: number) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: question.id });
  const meta = QTYPE_META[question.type] || { label: question.type, dot: "var(--ap-muted)", icon: HelpCircle };
  const MetaIcon = meta.icon;
  const displayText =
    question.type === "slide"      ? (question.title?.trim() || "Diapositive vide")
    : question.type === "flashcard" ? (question.recto?.trim() || "Flashcard vide")
    : (question.question?.trim() || "Sans titre");
  // A fresh MC/True-False question no longer ships with a silently
  // pre-checked correct answer (see questionDefaults.ts) — flag it here
  // until the host has actually picked one, so it can't slip into "Publier"
  // unnoticed.
  const needsAnswerReview =
    (question.type === "multiple-choice" && (question.correctAnswer === undefined || question.correctAnswer === -1))
    || (question.type === "true-false" && question.correctAnswer === undefined);

  return (
    <div ref={setNodeRef} data-question-index={index} style={{ transform: CSS.Transform.toString(transform), transition }} className="group">
      <div
        onClick={() => onSelect(index)}
        style={{
          position: "relative", textAlign: "left", width: "100%",
          background: isActive ? "var(--ap-brand-soft)" : "var(--ap-card)",
          border: `1px solid ${isActive ? "color-mix(in srgb, var(--ap-brand) 55%, var(--ap-line))" : "var(--ap-line)"}`,
          borderRadius: "var(--ap-r-md)",
          padding: "11px 12px 11px 14px",
          cursor: "pointer",
          display: "flex", gap: 11, alignItems: "flex-start",
          transition: "border-color .15s ease, background .15s ease",
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
            fontSize: 11, fontWeight: 800, letterSpacing: ".07em",
            textTransform: "uppercase", color: "var(--ap-muted)",
          }}>
            <MetaIcon style={{ width: 13, height: 13, color: meta.dot, flexShrink: 0 }} aria-hidden="true" />
            {meta.label}
            {needsAnswerReview && (
              <span
                title="Bonne réponse non choisie"
                aria-label="Bonne réponse non choisie"
                style={{
                  width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                  background: "var(--ap-danger)", marginLeft: 1,
                }}
              />
            )}
          </span>
          <span style={{
            display: "-webkit-box" as React.CSSProperties["display"],
            WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as React.CSSProperties["WebkitBoxOrient"],
            overflow: "hidden", fontSize: 13, fontWeight: 700,
            lineHeight: 1.35, marginTop: 3, color: "var(--ap-ink)",
          }}>
            {displayText}
          </span>
        </span>

        {/* Actions — hover-revealed for a clean row, but focus-within keeps
            them reachable without a pointer; hit area bumped from ~16x8px
            (too small under any touch-target guideline) to ~28x28px. */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onDuplicate(index)}
            title="Dupliquer"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 8, minWidth: 28, minHeight: 28, display: "grid", placeItems: "center", color: "var(--ap-muted)", borderRadius: 6 }}
          >
            <Copy style={{ width: 12, height: 12 }} />
          </button>
          <button
            onClick={() => onDelete(index)}
            title="Supprimer"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 8, minWidth: 28, minHeight: 28, display: "grid", placeItems: "center", color: "var(--ap-muted)", borderRadius: 6 }}
          >
            <Trash2 style={{ width: 12, height: 12 }} />
          </button>
        </div>

        {/* Drag grip — glyph itself stays small, hit area grows to ~32x28px. */}
        <button
          {...attributes} {...listeners}
          onClick={e => e.stopPropagation()}
          style={{
            flexShrink: 0, background: "none", border: "none",
            color: "var(--ap-line-2)", cursor: "grab",
            padding: "10px 8px", minWidth: 32, minHeight: 28,
            display: "grid", placeItems: "center",
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
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Palette</span>
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
  const plan = getPlan(user);

  const isPoll = quizType === "poll";
  const isFlashcard = quizType === "flashcard";
  const hasHistory = !isFlashcard && !!quizId && readSessionHistory(quizId).length > 0;

  // ── State ────────────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [speedBonus, setSpeedBonus] = useState(true);
  const [transitionTime, setTransitionTime] = useState(5);
  const [readingTime, setReadingTime] = useState(3);
  const [category, setCategory] = useState("Autre");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [newSkill, setNewSkill] = useState("");
  const [headerImage, setHeaderImage] = useState("");
  const [theme, setTheme] = useState<string>(DEFAULT_THEME_ID);
  const [ambianceId, setAmbianceId] = useState<string>(isPoll ? "none" : DEFAULT_AMBIANCE);
  const [liveReactionsEnabled, setLiveReactionsEnabled] = useState(true);
  const [endChatEnabled, setEndChatEnabled] = useState(true);
  const [previewFont, setPreviewFont] = useState(FONT_OPTIONS[0].value);
  const [saveState, setSaveState] = useState<"saved" | "unsaved">("saved");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(templateId);
  const [questionBankItems, setQuestionBankItems] = useState<QuestionBankItem[]>([]);
  const [questionBankDialogOpen, setQuestionBankDialogOpen] = useState(false);
  const [importFileOpen, setImportFileOpen] = useState(false);
  const [shouldBlockNavigation, setShouldBlockNavigation] = useState(true);
  const [pendingNavigatePath, setPendingNavigatePath] = useState<string | null>(null);
  const [titleTouched, setTitleTouched] = useState(false);
  const [hoveredQuestionType, setHoveredQuestionType] = useState<QuizQuestionType | PollQuestionType | null>(null);
  const [contentRow, setContentRow] = useState<ContentRow | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const firstRender = useRef(true);
  const questionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const railScrollRef = useRef<HTMLDivElement>(null);
  // Set synchronously by applyLoadedQuiz before it calls any setState — lets
  // the dirty-tracking effect below tell "reloaded what's already saved"
  // apart from a real user edit, so a post-Publier reload (handleSaveQuiz
  // navigates to ?quizId=X, which re-triggers the load effect) can't flip
  // saveState back to "unsaved" for data that was just persisted.
  const isLoadingQuizRef = useRef(false);

  // Keeps the selected/newly-added question visible in a long rail — without
  // this, adding question 30 leaves the scroll position at question 1 with
  // no visible cue where the new item landed.
  useEffect(() => {
    if (selectedIdx === null) return;
    railScrollRef.current
      ?.querySelector(`[data-question-index="${selectedIdx}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  const titleError = titleTouched && !title.trim() ? t("titleRequired") : undefined;
  const activeTheme = THEMES.find(t => t.id === theme) ?? THEMES[0];
  const activeFont = FONT_OPTIONS.find(f => f.value === previewFont) ?? FONT_OPTIONS[0];
  const selectedQ = selectedIdx !== null ? questions[selectedIdx] : null;

  // Auto-grow the question textarea to fit its content — needed both on typing
  // (handled inline by the textarea's onChange) and when the loaded/selected
  // question already has long text, which the onChange path never sees.
  useEffect(() => {
    const el = questionTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [selectedQ?.id, selectedQ?.question]);

  // ── Dirty tracking ────────────────────────────────────────────────────────
  // No autosave exists — this only flags that there are edits since the last
  // real persist (handleSaveQuiz). Never claim "saved" without one.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (isLoadingQuizRef.current) { isLoadingQuizRef.current = false; return; }
    setSaveState("unsaved");
  }, [questions, title, liveReactionsEnabled, endChatEnabled]);

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
  const applyLoadedQuiz = (eq: SavedQuiz) => {
    isLoadingQuizRef.current = true;
    setTitle(eq.title);
    setDescription(eq.description);
    setCategory(eq.category);
    setIsPublic(eq.isPublic);
    setSpeedBonus(eq.speedBonus);
    setTransitionTime(eq.transitionTime);
    setReadingTime(eq.readingTime ?? 3);
    setTags(eq.tags || []);
    setHeaderImage(eq.headerImage || "");
    setTheme(THEMES.some(t => t.id === eq.theme) ? eq.theme : DEFAULT_THEME_ID);
    setAmbianceId(eq.ambianceId ?? (isPoll ? "none" : DEFAULT_AMBIANCE));
    setLiveReactionsEnabled(eq.liveReactionsEnabled ?? true);
    setEndChatEnabled(eq.endChatEnabled ?? true);
    setPreviewFont(FONT_OPTIONS.some(f => f.value === eq.font) ? eq.font : FONT_OPTIONS[0].value);
    const qs = eq.questions.map((q, i) => ({ id: q.id || String(Date.now()) + i, ...q, image: q.image || "" }));
    setQuestions(qs);
    setSelectedIdx(qs.length > 0 ? 0 : null);
    setActiveTemplateId(null);
  };

  useEffect(() => {
    if (!quizId) return;
    const eq = getQuizById(quizId);
    if (eq) {
      applyLoadedQuiz(eq);
      toast.success("Quiz chargé pour édition");
      if (user) {
        void getContentBySource(user.id, eq.type as ContentType, eq.id)
          .then(setContentRow)
          .catch(() => setContentRow(null));
      }
      return;
    }

    // No legacy entry for this id: this happens for a `content` row that was
    // never mirrored back into local storage (e.g. a duplicate made before
    // the mirror-aware duplicate fix, or any orphaned mirror row). Recover
    // it from the content table — adopt its data into local storage under a
    // fresh id, then swap the URL to that id so this and future saves
    // resolve normally.
    let cancelled = false;
    (async () => {
      try {
        const row = await getContent(quizId)
          ?? await getContentBySourceAnyOwner(quizType as ContentType, quizId);
        if (cancelled || !row?.data) return;
        const recovered = row.data as unknown as SavedQuiz;
        if (cancelled) return;
        setContentRow(row);
        applyLoadedQuiz(recovered);
        toast.success(row.user_id === user?.id ? "Création récupérée depuis le cloud" : "Création collaborative chargée");
      } catch (e) {
        if (cancelled) return;
        showError(e, "QuizBuilder.recoverFromCloud");
      }
    })();
    return () => { cancelled = true; };
  }, [quizId, quizType, user?.id]);

  // ── Load template ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!templateId || quizId) return;
    if (isPoll) {
      const tpl = getPollTemplate(templateId);
      if (tpl) applyTemplate(tpl);
    } else if (isFlashcard) {
      const tpl = getFlashcardTemplate(templateId);
      if (!tpl) return;
      setTitle(tpl.name); setDescription(tpl.description); setCategory(tpl.category);
      const cards = tpl.cards.map((c, i) => ({ id: `${tpl.id}-${Date.now()}-${i}`, ...c, type: "flashcard" }));
      setQuestions(cards); setSelectedIdx(cards.length > 0 ? 0 : null);
      setActiveTemplateId(tpl.id); toast.success("Modèle de flashcards chargé");
    } else {
      const tpl = getQuizTemplate(templateId);
      if (tpl) applyTemplate(tpl);
    }
  }, [templateId, isPoll, isFlashcard, quizId]);

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
  function getDefaultQuestion(type?: QuizQuestionType | PollQuestionType) {
    if (isFlashcard) return { type: "flashcard", recto: "", verso: "", rectoImage: "", versoImage: "" };
    if (isPoll) {
      const pt = type || "single-choice";
      const base = { type: pt, question: "", image: "", layout: "standard" as const };
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

  const handleNavigateAway = (path: string) => {
    if (shouldBlockNavigation) { setPendingNavigatePath(path); return; }
    navigate(path);
  };

  const confirmPendingNavigate = () => {
    if (!pendingNavigatePath) return;
    setShouldBlockNavigation(false);
    navigate(pendingNavigatePath);
    setPendingNavigatePath(null);
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const applyTemplate = (tpl: PollTemplate | QuizTemplate) => {
    setTitle(tpl.name); setDescription(tpl.description); setCategory(tpl.category);
    const qs = tpl.questions.map((q, i) => ({ id: `${tpl.id}-${Date.now()}-${i}-${Math.random().toString(36).slice(2,8)}`, ...q, image: q.image || "" }));
    setQuestions(qs as EditableQuestion[]); setSelectedIdx(qs.length > 0 ? 0 : null);
    setTags([]); setTemplateDialogOpen(false); setActiveTemplateId(tpl.id);
    toast.success(t("templateLoaded"));
  };

  const updateQuestion = (idx: number, updates: Partial<EditableQuestion>) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...updates } : q));
  };

  const handleAddQuestion = (type?: QuizQuestionType | PollQuestionType) => {
    const newQ = { id: Date.now().toString(), ...getDefaultQuestion(type), image: "", layout: "standard" as const };
    setQuestions(prev => { const updated = [...prev, newQ]; setSelectedIdx(updated.length - 1); return updated; });
  };

  // Deletion is instant (no confirm dialog — this is the common, fast path
  // when cleaning up a draft) but always reversible: an undo toast restores
  // both the question and the prior selection.
  const handleDeleteQuestion = (idx: number) => {
    const removed = questions[idx];
    const priorSelectedIdx = selectedIdx;
    if (!removed) return;
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
    toast("Question supprimée", {
      action: {
        label: "Annuler",
        onClick: () => {
          setQuestions(prev => {
            const restored = [...prev];
            restored.splice(idx, 0, removed);
            return restored;
          });
          setSelectedIdx(priorSelectedIdx);
        },
      },
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

  const handleSaveQuiz = async () => {
    if (!title.trim()) {
      setTitleTouched(true);
      toast.error(t("titleRequired"));
      titleInputRef.current?.focus();
      return;
    }
    if (questions.length === 0) { toast.error(t("oneQuestionRequired")); return; }
    try {
      const data = {
        title, description, questions,
        isPublic: isPoll ? false : isPublic,
        isFavorite: false, tags,
        speedBonus: isPoll ? false : speedBonus,
        transitionTime, readingTime, category, type: quizType,
        headerImage, theme, font: previewFont, ambianceId,
        liveReactionsEnabled, endChatEnabled,
      };
      let saved: SavedQuiz | null;
      if (contentRow && user && contentRow.user_id !== user.id) {
        const current = contentRow.data as unknown as SavedQuiz;
        saved = {
          ...current,
          ...data,
          id: current.id ?? quizId ?? contentRow.id,
          userId: contentRow.user_id,
          createdAt: current.createdAt ?? new Date().toISOString(),
        };
        const updatedRow = await updateCollaborativeContent(
          contentRow.id,
          saved as unknown as Record<string, unknown>,
        );
        setContentRow(updatedRow);
      } else {
        saved = quizId ? updateQuiz(quizId, data) : saveQuiz(data);
      }
      // Mirror into the Supabase `content` table so the item appears in the
      // content-backed lists (My Quizzes/Polls/Flashcards/Slides read from
      // there, not from the legacy `saved_quizzes` localStorage store).
      // Non-blocking: a local save already succeeded, so a network hiccup
      // must not break the flow.
      if (saved && user && (!contentRow || contentRow.user_id === user.id)) {
        try {
          await upsertContentBySource(user.id, saved.type as ContentType, saved.id, saved as unknown as Record<string, unknown>, !!saved.isPublic);
          const row = await getContentBySource(user.id, saved.type as ContentType, saved.id);
          if (row) setContentRow(row);
        } catch (e) { console.error("[QuizBuilder] content mirror failed", e); }
      }
      toast.success(quizId ? (isPoll ? "Sondage mis à jour" : "Quiz mis à jour") : (isPoll ? t("pollSaved") : t("quizSaved")));
      setSaveState("saved");
      if (!quizId && saved) {
        setShouldBlockNavigation(false);
        navigate(`/builder?type=${saved.type}&quizId=${saved.id}`, { replace: true });
        setTimeout(() => setShouldBlockNavigation(true), 0);
      }
    } catch (e) {
      showError(e, "QuizBuilder.save", "Erreur lors de l'enregistrement");
    }
  };
  useSaveShortcut(handleSaveQuiz);

  const handleSaveAsTemplate = async () => {
    if (!quizId || !user) { toast.error("Enregistrez d'abord ce contenu avant d'en faire un modèle."); return; }
    try {
      const template = saveQuizAsTemplate(quizId);
      if (!template) { toast.error("Impossible de créer le modèle."); return; }
      await upsertContentBySource(user.id, template.type as ContentType, template.id, template as unknown as Record<string, unknown>, false);
      toast.success("Modèle enregistré — retrouvez-le dans « Mes modèles ».");
    } catch (e) {
      showError(e, "QuizBuilder.saveAsTemplate", "Erreur lors de la création du modèle");
    }
  };

  const handlePreviewQuiz = () => {
    if (questions.length === 0) { toast.error("Ajoutez au moins une question pour prévisualiser"); return; }
    const tmp = {
      id: "preview-" + Date.now(),
      title: title || "Mon Quiz",
      description,
      questions,
      type: quizType,
      headerImage,
      theme,
      font: previewFont,
      liveReactionsEnabled,
      endChatEnabled,
    };
    setQuizPlayCache(`quiz-${tmp.id}`, tmp);
    setShouldBlockNavigation(false);
    navigate(`/preview/${tmp.id}`);
  };

  const handleImportFromFile = (draft: import("@/lib/importParsers").ImportDraft) => {
    const mapped = draft.questions.map((q, i) => ({ ...q, id: q.id || `imported-${Date.now()}-${i}` }));
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
            {isFlashcard ? "Sélectionnez une carte ou créez-en une" : "Sélectionnez une question ou créez-en une"}
          </p>
          <button className="ap-btn ap-btn--pill ap-btn--sm" onClick={() => handleAddQuestion()}>
            <Plus style={{ width: 14, height: 14 }} />
            {isFlashcard ? "Nouvelle carte" : "Nouvelle question"}
          </button>
        </div>
      );
    }

    const q = questions[selectedIdx];
    const upd = (u: Partial<EditableQuestion>) => updateQuestion(selectedIdx, u);

    if (isFlashcard) return <div style={{ maxWidth: 660, margin: "0 auto" }}><FlashcardEditor flashcard={q as unknown as React.ComponentProps<typeof FlashcardEditor>["flashcard"]} onChange={upd as unknown as React.ComponentProps<typeof FlashcardEditor>["onChange"]} /></div>;

    const meta = QTYPE_META[q.type] || { label: q.type, dot: "var(--ap-muted)", icon: HelpCircle };
    const SelectedTypeIcon = meta.icon;
    const isMC = q.type === "multiple-choice" || q.type === "single-choice";
    const isTF = q.type === "true-false";

    return (
      <div style={{ maxWidth: 660, margin: "0 auto" }}>

        {/* Type chip */}
        <DropdownMenu onOpenChange={(open) => { if (!open) setHoveredQuestionType(null); }}>
          <DropdownMenuTrigger asChild>
            <button
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                fontSize: 12.5, fontWeight: 800, padding: "7px 14px",
                // 8px when a layout picker follows right below (same "meta"
                // cluster); 32px when it doesn't (flashcards skip the
                // picker) so the jump straight to Question content still
                // reads as the deliberate xl break, not an accident.
                borderRadius: "var(--ap-r-sm)", cursor: "pointer", marginBottom: isFlashcard ? 32 : 8,
                color: meta.dot === "var(--ap-quiz)" ? "var(--ap-quiz-deep)" : meta.dot === "var(--ap-poll)" ? "var(--ap-poll-deep)" : "var(--ap-pres-deep)",
                background: meta.dot === "var(--ap-quiz)" ? "var(--ap-quiz-soft)" : meta.dot === "var(--ap-poll)" ? "var(--ap-poll-soft)" : "var(--ap-pres-soft)",
                border: `2px solid color-mix(in srgb, ${meta.dot} 40%, transparent)`,
                transition: "transform .15s var(--ap-spring)",
              }}
            >
              <SelectedTypeIcon style={{ width: 15, height: 15, color: meta.dot }} aria-hidden="true" />
              {meta.label}
              <ChevronDown style={{ width: 12, height: 12, opacity: 0.6 }} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            style={{ minWidth: 360, background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-lg)", boxShadow: "var(--ap-shadow-card)" }}
            className="z-50 p-1.5"
          >
            {getAvailableTypes().map(type => {
              const m = QTYPE_META[type] || { label: type, dot: "var(--ap-muted)", icon: HelpCircle };
              const TypeIcon = m.icon;
              const locked = !isPoll && isQuestionTypeLocked(type, plan);
              return (
                <DropdownMenuItem
                  key={type}
                  className="gap-3 rounded-xl text-sm cursor-pointer py-2.5"
                  onPointerEnter={() => setHoveredQuestionType(type)}
                  onFocus={() => setHoveredQuestionType(type)}
                  onSelect={() => {
                    if (locked) {
                      toast.error("Type de question réservé au plan Pro", {
                        action: { label: "Passer Pro", onClick: () => { window.location.href = "/pricing"; } },
                      });
                      return;
                    }
                    const defaults = getDefaultQuestion(type);
                    upd({ ...defaults, id: q.id, question: q.question, image: q.image });
                  }}
                  style={locked ? { opacity: 0.5 } : undefined}
                  aria-disabled={locked}
                >
                  <TypeIcon style={{ width: 18, height: 18, color: m.dot, flexShrink: 0 }} aria-hidden="true" />
                  <span style={{ minWidth: 0 }}>
                    <b style={{ display: "block", color: "var(--ap-ink)", lineHeight: 1.25 }}>{m.label}</b>
                    <small style={{ display: "block", marginTop: 2, color: "var(--ap-muted)", fontSize: 11.5, lineHeight: 1.3 }}>
                      {getQuestionTypeDescription(type)}
                    </small>
                  </span>
                  {locked && (
                    <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 800, color: "var(--ap-brand)", background: "var(--ap-brand-soft)", padding: "2px 6px", borderRadius: "var(--ap-r-sm)" }}>
                      Pro
                    </span>
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {hoveredQuestionType && <QuestionTypeExample type={hoveredQuestionType} />}

        {!hoveredQuestionType && (
        <>
        {!isFlashcard && (
          // 32px (xl) — deliberately the biggest gap in this column: the
          // real break between "what kind of question" (chip+layout, above)
          // and the content itself (Question text, below).
          <div style={{ marginBottom: 32 }}>
            <QuestionLayoutPicker
              value={q.layout}
              onChange={(layout) => upd({ layout })}
            />
          </div>
        )}

        {/* Question textarea */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ap-muted)", marginBottom: 8 }}>
            <span>Question</span>
            <span style={{ fontSize: 11.5, letterSpacing: 0, textTransform: "none", fontWeight: 700 }}>
              S'affiche en grand pour les joueurs
            </span>
          </div>
          <textarea
            ref={questionTextareaRef}
            value={q.question || ""}
            onChange={e => { upd({ question: e.target.value }); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
            placeholder="Posez votre question…"
            rows={2}
            style={{
              width: "100%", resize: "none", overflow: "hidden",
              fontFamily: "var(--ap-font-body)", fontWeight: 800, fontSize: 22,
              lineHeight: 1.35, color: "var(--ap-ink)",
              background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)",
              borderRadius: "var(--ap-r-lg)", padding: "18px 20px",
              boxShadow: "var(--ap-shadow-soft)", outline: "none",
              transition: "border-color .15s, box-shadow .15s",
            }}
            onFocus={e => { e.target.style.borderColor = "var(--ap-brand)"; e.target.style.boxShadow = "0 4px 0 color-mix(in srgb, var(--ap-brand) 40%, transparent)"; }}
            onBlur={e => { e.target.style.borderColor = "var(--ap-line)"; e.target.style.boxShadow = "var(--ap-shadow-soft)"; }}
          />
        </div>

        {/* Media */}
        {q.image ? (
          <div style={{ position: "relative", marginBottom: 20, borderRadius: "var(--ap-r-md)", overflow: "hidden" }}>
            <img src={q.image} alt="" style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }} />
            <button
              onClick={() => upd({ image: "" })}
              style={{ position: "absolute", top: 8, right: 8, background: "color-mix(in srgb, var(--ap-ink) 78%, transparent)", color: "white", border: "none", borderRadius: 8, padding: "4px 8px", cursor: "pointer" }}
            >
              <Trash2 style={{ width: 14, height: 14 }} />
            </button>
          </div>
        ) : (
          <label style={{ display: "block", marginBottom: 20, cursor: "pointer" }}>
            <div
              style={{
                border: "var(--ap-border-w) dashed var(--ap-line-2)", borderRadius: "var(--ap-r-md)",
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
              r.onloadend = () => upd({
                image: r.result as string,
                layout: !q.layout || q.layout === "standard" ? "media-top" : q.layout,
              });
              r.readAsDataURL(file);
              e.target.value = "";
            }} />
          </label>
        )}

        {/* Photo de fond plein écran — écran présentateur uniquement, remplace
            le fond du thème pour cette question (distinct de l'image de la
            carte question ci-dessus). */}
        {!isFlashcard && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ap-muted)", marginBottom: 8 }}>
              <span>Photo de fond</span>
              <span style={{ fontSize: 11.5, letterSpacing: 0, textTransform: "none", fontWeight: 700 }}>
                Remplace le thème pour cette question, écran présentateur
              </span>
            </div>
            {q.backgroundImage ? (
              <div style={{ position: "relative", borderRadius: "var(--ap-r-md)", overflow: "hidden" }}>
                <img src={q.backgroundImage} alt="" style={{ width: "100%", maxHeight: 140, objectFit: "cover", display: "block" }} />
                <button
                  onClick={() => upd({ backgroundImage: "" })}
                  style={{ position: "absolute", top: 8, right: 8, background: "color-mix(in srgb, var(--ap-ink) 78%, transparent)", color: "white", border: "none", borderRadius: 8, padding: "4px 8px", cursor: "pointer" }}
                >
                  <Trash2 style={{ width: 14, height: 14 }} />
                </button>
              </div>
            ) : (
              <label style={{ display: "block", cursor: "pointer" }}>
                <div
                  style={{
                    border: "var(--ap-border-w) dashed var(--ap-line-2)", borderRadius: "var(--ap-r-md)",
                    padding: "13px 16px", display: "flex", alignItems: "center", gap: 10,
                    color: "var(--ap-muted)", fontSize: 13, fontWeight: 700,
                    transition: "border-color .15s, background .15s, color .15s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--ap-brand)"; (e.currentTarget as HTMLElement).style.color = "var(--ap-brand-deep)"; (e.currentTarget as HTMLElement).style.background = "var(--ap-brand-soft)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--ap-line-2)"; (e.currentTarget as HTMLElement).style.color = "var(--ap-muted)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <ImageIcon style={{ width: 17, height: 17, flexShrink: 0 }} />
                  Ajouter une photo de fond pour cette question
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const r = new FileReader();
                  r.onloadend = () => upd({ backgroundImage: r.result as string });
                  r.readAsDataURL(file);
                  e.target.value = "";
                }} />
              </label>
            )}
          </div>
        )}

        {/* Answers — MC */}
        {isMC && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ap-muted)", marginBottom: 8 }}>
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
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ap-muted)", marginBottom: 8 }}>
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
                      fontFamily: "inherit",
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 20 }}>
            {/* Points */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ap-muted)", marginBottom: 8 }}>Points</div>
              <div style={{ display: "flex", background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-md)", padding: 4, gap: 4 }}>
                {POINTS_OPTIONS.map(opt => {
                  const isOn = (q.points ?? 1000) === opt.value || (opt.value === 1000 && (q.points ?? 1000) !== 0 && (q.points ?? 1000) !== 2000);
                  return (
                    <button key={opt.value} onClick={() => upd({ points: opt.value })}
                      style={{
                        flex: 1, border: "none", borderRadius: "var(--ap-r-md)", padding: "9px 6px",
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
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ap-muted)", marginBottom: 8 }}>Temps de réponse</div>
              <div style={{ display: "flex", background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-md)", padding: 4, gap: 4 }}>
                {TIME_OPTIONS.map(opt => {
                  const isOn = (q.timeLimit ?? 20) === opt.value;
                  return (
                    <button key={opt.value} onClick={() => upd({ timeLimit: opt.value })}
                      style={{
                        flex: 1, border: "none", borderRadius: "var(--ap-r-md)", padding: "9px 6px",
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

        {/* Compétences — free-text skill tags, aggregated by ExamAdmin's
            "compétences les moins maîtrisées" panel once an exam runs. */}
        {!isPoll && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ap-muted)", marginBottom: 9 }}>Compétences</div>
            <div className="flex gap-2">
              <Input
                placeholder="Ajouter une compétence"
                value={newSkill}
                onChange={e => setNewSkill(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const v = newSkill.trim();
                    if (v && !(q.skills ?? []).includes(v)) { upd({ skills: [...(q.skills ?? []), v] }); setNewSkill(""); }
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={() => {
                  const v = newSkill.trim();
                  if (v && !(q.skills ?? []).includes(v)) { upd({ skills: [...(q.skills ?? []), v] }); setNewSkill(""); }
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {(q.skills ?? []).map(skill => (
                <Badge key={skill} variant="secondary" className="cursor-pointer" onClick={() => upd({ skills: (q.skills ?? []).filter(s => s !== skill) })}>
                  {skill} ×
                </Badge>
              ))}
            </div>
          </div>
        )}
        </>
        )}
      </div>
    );
  };

  const renderFallbackFields = (q: EditableQuestion, upd: (u: Partial<EditableQuestion>) => void) => {
    switch (q.type) {
      case "short-answer":
      case "fill-blank":
        return null;
      case "ranking":
        return (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ap-muted)", marginBottom: 8 }}>Éléments à classer</div>
            {(q.items || ["", "", "", ""]).map((item: string, i: number) => (
              <Input key={i} value={item} placeholder={`Élément ${i + 1}`} className="mt-2"
                onChange={e => { const items = [...(q.items || ["","","",""])]; items[i] = e.target.value; upd({ items }); }}
              />
            ))}
          </div>
        );
      case "slider":
        return (
          <div style={{ marginTop: 20 }} className="space-y-3">
            <div><Label>Valeur min</Label><Input type="number" value={q.min ?? 0} className="mt-2" onChange={e => upd({ min: parseInt(e.target.value) })} /></div>
            <div><Label>Valeur max</Label><Input type="number" value={q.max ?? 100} className="mt-2" onChange={e => upd({ max: parseInt(e.target.value) })} /></div>
            <div><Label>Bonne réponse</Label><Input type="number" value={(q.correctAnswer as number) ?? 50} className="mt-2" onChange={e => upd({ correctAnswer: parseInt(e.target.value) })} /></div>
          </div>
        );
      case "likert-scale":
      case "frequency-scale":
        return (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ap-muted)", marginBottom: 8 }}>Échelle</div>
            {(q.scale || []).map((item: string, i: number) => (
              <Input key={i} value={item} className="mt-2"
                onChange={e => { const scale = [...(q.scale || [])]; scale[i] = e.target.value; upd({ scale }); }}
              />
            ))}
          </div>
        );
      case "star-rating":
        return <div style={{ marginTop: 20 }}><Label>Nombre d'étoiles max</Label><Input type="number" min={1} max={10} value={q.maxStars ?? 5} className="mt-2" onChange={e => upd({ maxStars: parseInt(e.target.value) })} /></div>;
      case "nps-scale":
        return (
          <div style={{ marginTop: 20 }} className="space-y-3">
            <div><Label>Label gauche (0)</Label><Input value={q.minLabel ?? ""} className="mt-2" onChange={e => upd({ minLabel: e.target.value })} /></div>
            <div><Label>Label droite (10)</Label><Input value={q.maxLabel ?? ""} className="mt-2" onChange={e => upd({ maxLabel: e.target.value })} /></div>
          </div>
        );
      case "open-text":
        return <div style={{ marginTop: 20 }}><Label>Longueur max</Label><Input type="number" value={q.maxLength ?? 500} className="mt-2" onChange={e => upd({ maxLength: parseInt(e.target.value) })} /></div>;
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
          <FlashcardPreview flashcard={selectedQ as unknown as React.ComponentProps<typeof FlashcardPreview>["flashcard"]} theme={activeTheme} />
        </>
      );
    }

    const participantPreviewQuestion = hoveredQuestionType
      ? {
          ...getDefaultQuestion(hoveredQuestionType),
          id: "type-hover-preview",
          type: hoveredQuestionType,
          question: getQuestionTypeDescription(hoveredQuestionType),
          answers: ["Première option", "Deuxième option", "Troisième option", "Autre réponse"],
          items: ["Priorité principale", "Deuxième priorité", "Troisième priorité"],
          scale: hoveredQuestionType === "frequency-scale"
            ? ["Jamais", "Rarement", "Parfois", "Souvent", "Toujours"]
            : ["Pas du tout", "Plutôt non", "Neutre", "Plutôt oui", "Tout à fait"],
        } satisfies EditableQuestion
      : selectedQ;

    return (
      <>
        <div style={labelStyle}>
          <span style={liveDotStyle} />
          Vue joueur (miroir en direct)
          <span style={{ flex: 1, height: 2, background: "var(--ap-line-2)", opacity: 0.5, borderRadius: 2 }} />
        </div>
        <PhonePreview
          question={participantPreviewQuestion}
          questionIndex={selectedIdx ?? 0}
          totalQuestions={questions.length}
        />
        {participantPreviewQuestion && (
          <p style={{ marginTop: 16, fontSize: 12, fontWeight: 700, color: "var(--ap-muted)", textAlign: "center", lineHeight: 1.5 }}>
            Tout ce que vous tapez apparaît ici<br />
            <strong style={{ color: "var(--ap-ink)" }}>instantanément</strong>
          </p>
        )}
      </>
    );
  };

  const backPath = isFlashcard ? "/my-flashcards" : isPoll ? "/my-polls" : "/my-quizzes";
  const backLabel = isFlashcard ? "Mes Flashcards" : isPoll ? "Mes Sondages" : "Mes Quiz";
  const difficultyTranslationKeyMap: Record<string, string> = { easy: "difficultyEasy", medium: "difficultyMedium", hard: "difficultyHard" };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--ap-paper)" }}>

      {/* ── Topbar ── */}
      <div style={{
        height: 62, flexShrink: 0, background: "var(--ap-card)",
        borderBottom: "var(--ap-border-w) solid var(--ap-line)",
        display: "flex", alignItems: "center", gap: 16, padding: "0 18px",
        position: "relative", zIndex: 20,
      }}>
        {/* Breadcrumb: Accueil > Mes quiz/sondages/flashcards > titre (éditable) */}
        <nav aria-label="Fil d'ariane" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <button
            onClick={() => handleNavigateAway("/")}
            aria-label="Accueil"
            style={{
              display: "grid", placeItems: "center", width: 36, height: 36,
              borderRadius: "50%", border: "var(--ap-border-w) solid var(--ap-line)",
              background: "var(--ap-card)", cursor: "pointer", flexShrink: 0,
            }}
          >
            <Home style={{ width: 16, height: 16, color: "var(--ap-ink)" }} />
          </button>
          <ChevronRight style={{ width: 15, height: 15, color: "var(--ap-line-2)", flexShrink: 0 }} />
          <button
            onClick={() => handleNavigateAway(backPath)}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: 0,
              fontFamily: "var(--ap-font-body)", fontSize: 15, fontWeight: 700,
              color: "var(--ap-muted)", whiteSpace: "nowrap",
            }}
          >
            {backLabel}
          </button>
          <ChevronRight style={{ width: 15, height: 15, color: "var(--ap-line-2)", flexShrink: 0 }} />
          {/* minWidth:0 is load-bearing: without it, a flex child with no
              explicit width defaults to its content's min-content size — the
              input's fixed width below — so this slot could never shrink and
              would push into the SaveStateIndicator at reduced widths. */}
          <div style={{ position: "relative", minWidth: 0, flex: "0 1 280px" }}>
            <input
              ref={titleInputRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={isPoll ? "Mon Sondage" : isFlashcard ? "Mes Flashcards" : "Mon Quiz"}
              aria-invalid={!!titleError}
              aria-describedby={titleError ? "quiz-title-error" : undefined}
              style={{
                fontFamily: "var(--ap-font-body)", fontWeight: 800, fontSize: 15.5, color: "var(--ap-ink)",
                border: `2px solid ${titleError ? "var(--ap-danger)" : "transparent"}`, borderRadius: "var(--ap-r-sm)",
                background: titleError ? "var(--ap-danger-soft)" : "transparent",
                padding: "5px 9px", width: "100%", minWidth: 0, outline: "none",
                transition: "border-color .15s, background .15s",
              }}
              onFocus={e => { if (!titleError) { e.target.style.borderColor = "var(--ap-brand)"; e.target.style.background = "white"; } }}
              onBlur={e => { setTitleTouched(true); if (!titleError) { e.target.style.borderColor = "transparent"; e.target.style.background = "transparent"; } }}
            />
            {titleError && (
              <p
                id="quiz-title-error"
                role="alert"
                style={{
                  position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 30, whiteSpace: "nowrap",
                  margin: 0, fontSize: 12, fontWeight: 800, color: "var(--ap-danger-deep)",
                  background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-danger)",
                  borderRadius: "var(--ap-r-sm)", padding: "4px 9px", boxShadow: "var(--ap-shadow-soft)",
                }}
              >
                {titleError}
              </p>
            )}
          </div>
        </nav>

        <SaveStateIndicator state={saveState} />

        <div style={{ flex: 1 }} />

        <CollaboratorsButton
          contentId={contentRow?.id ?? null}
          contentTitle={title || (isPoll ? "Nouveau sondage" : isFlashcard ? "Nouvelles flashcards" : "Nouveau quiz")}
          canManage={contentRow?.user_id === user?.id}
        />

        {/* Settings */}
        <button
          onClick={() => setSettingsOpen(true)}
          title="Paramètres"
          style={{
            display: "grid", placeItems: "center", width: 36, height: 36,
            borderRadius: "var(--ap-r-sm)", border: "var(--ap-border-w) solid var(--ap-line)",
            background: "var(--ap-card)", cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <MaterialSymbol name="settings" size={18} style={{ color: "var(--ap-muted)" }} />
        </button>

        {/* Save as template */}
        <TooltipProvider delayDuration={180}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span style={{ display: "inline-flex", flexShrink: 0 }}>
                <button
                  onClick={() => void handleSaveAsTemplate()}
                  disabled={!quizId}
                  title="Enregistrer comme template"
                  style={{
                    display: "grid", placeItems: "center", width: 36, height: 36,
                    borderRadius: "var(--ap-r-sm)", border: "var(--ap-border-w) solid var(--ap-line)",
                    background: "var(--ap-card)", cursor: quizId ? "pointer" : "not-allowed",
                    flexShrink: 0, opacity: quizId ? 1 : 0.5,
                  }}
                >
                  <MaterialSymbol name="dashboard_customize" size={18} style={{ color: "var(--ap-muted)" }} />
                </button>
              </span>
            </TooltipTrigger>
            {!quizId && (
              <TooltipContent side="bottom" align="end">
                Enregistrez d’abord ce contenu pour pouvoir en faire un modèle.
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

        {/* Results */}
        {hasHistory && (
          <button
            onClick={() => navigate(isPoll ? `/poll-results/${quizId}` : `/quiz-results/${quizId}`)}
            className="ap-btn ap-btn--ghost"
            style={{ padding: "10px 18px", borderRadius: "var(--ap-r-sm)", fontSize: 14 }}
          >
            <BarChart2 style={{ width: 15, height: 15 }} />
            Résultats
          </button>
        )}

        {/* Preview */}
        <TooltipProvider delayDuration={180}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span style={{ display: "inline-flex", flexShrink: 0 }}>
                <button
                  onClick={handlePreviewQuiz}
                  disabled={questions.length === 0}
                  className="ap-btn ap-btn--ghost"
                  style={{ padding: "10px 18px", borderRadius: "var(--ap-r-sm)", fontSize: 14 }}
                >
                  <Eye style={{ width: 15, height: 15 }} />
                  Aperçu
                </button>
              </span>
            </TooltipTrigger>
            {questions.length === 0 && (
              <TooltipContent side="bottom" align="end">
                Ajoutez au moins une question pour ouvrir l’aperçu.
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

        {/* Save / Publish */}
        <button
          onClick={handleSaveQuiz}
          className="ap-btn ap-btn--pill"
          style={{ padding: "10px 18px", fontSize: 14 }}
        >
          {quizId ? "Mettre à jour" : "Publier"}
          <ArrowRight style={{ width: 15, height: 15 }} />
        </button>
      </div>

      {/* ── Workspace ── */}
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "270px 1fr 330px" }}>

        {/* Left Rail */}
        <aside style={{ borderRight: "var(--ap-border-w) solid var(--ap-line)", background: "var(--ap-card)", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "16px 16px 10px", display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ap-muted)", margin: 0 }}>
              {isFlashcard ? "Cartes" : "Questions"}
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
                <DropdownMenuContent className="z-50 p-1.5" style={{ background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-lg)", boxShadow: "var(--ap-shadow-card)" }}>
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

          <div ref={railScrollRef} style={{ flex: 1, overflowY: "auto", padding: "4px 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
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
              border: "var(--ap-border-w) dashed var(--ap-line-2)",
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
            + {isFlashcard ? "Ajouter une carte" : "Ajouter une question"}
          </button>
        </aside>

        {/* Center Editor */}
        <main style={{ overflowY: "auto", padding: "26px 30px 60px", minHeight: 0 }}>
          {renderCenterEditor()}
        </main>

        {/* Right Preview */}
        <aside style={{
          borderLeft: "var(--ap-border-w) solid var(--ap-line)",
          background: "var(--ap-paper-2)",
          backgroundImage: "var(--ap-texture)",
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
                <div className="relative w-full h-48 rounded-lg overflow-hidden mt-2 mb-2">
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
                  <Switch
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                    disabled={Boolean(contentRow && contentRow.user_id !== user?.id)}
                    title={contentRow && contentRow.user_id !== user?.id ? "Seul le propriétaire peut modifier la visibilité" : undefined}
                  />
                </div>
                {contentRow && contentRow.user_id !== user?.id && (
                  <p className="m-0 px-3 text-xs font-semibold text-muted-foreground">
                    Seul le propriétaire peut modifier la visibilité de cette ressource.
                  </p>
                )}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Label className="cursor-pointer">{t("speedBonus")}</Label>
                    <TooltipProvider><Tooltip><TooltipTrigger asChild><button className="text-muted-foreground hover:text-foreground"><HelpCircle className="w-4 h-4" /></button></TooltipTrigger><TooltipContent><p className="max-w-xs">{t("speedBonusTooltip")}</p></TooltipContent></Tooltip></TooltipProvider>
                  </div>
                  <Switch checked={speedBonus} onCheckedChange={setSpeedBonus} />
                </div>
                {!isFlashcard && (
                  <>
                    <div className="flex items-center justify-between gap-4 p-3 bg-muted/50 rounded-lg">
                      <div>
                        <Label className="cursor-pointer">Réactions live</Label>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Autoriser les participants à envoyer des réactions emoji pendant le lobby et à la fin.
                        </p>
                      </div>
                      <Switch checked={liveReactionsEnabled} onCheckedChange={setLiveReactionsEnabled} />
                    </div>
                    <div className="flex items-center justify-between gap-4 p-3 bg-muted/50 rounded-lg">
                      <div>
                        <Label className="cursor-pointer">Chat de fin de partie</Label>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Autoriser les participants à publier un commentaire sur l'écran final.
                        </p>
                      </div>
                      <Switch checked={endChatEnabled} onCheckedChange={setEndChatEnabled} />
                    </div>
                  </>
                )}
                <div>
                  <Label>{t("transitionTime")}</Label>
                  <Input type="number" min="3" max="10" value={transitionTime} onChange={e => setTransitionTime(parseInt(e.target.value) || 5)} className="mt-2" />
                </div>
                {!isFlashcard && (
                  <div>
                    <div className="flex items-center gap-2">
                      <Label>Temps de lecture</Label>
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><button className="text-muted-foreground hover:text-foreground"><HelpCircle className="w-4 h-4" /></button></TooltipTrigger><TooltipContent><p className="max-w-xs">Pause avant le lancement du chronomètre, pour laisser le temps de lire la question.</p></TooltipContent></Tooltip></TooltipProvider>
                    </div>
                    <Input type="number" min="0" max="15" value={readingTime} onChange={e => setReadingTime(parseInt(e.target.value) || 0)} className="mt-2" />
                  </div>
                )}
              </>
            )}
            <div>
              <Label>Thème visuel</Label>
              <div className="mt-3 space-y-3">
                <ThemeSelectionDropdown value={theme} onChange={setTheme} />
                <div className="rounded-2xl border border-border/60 bg-muted/30 p-4"><ThemePreviewPanel theme={activeTheme} /></div>
              </div>
            </div>
            {!isFlashcard && (
              <div>
                <Label>Ambiance musicale</Label>
                <div className="mt-3">
                  <select
                    value={ambianceId}
                    onChange={(e) => setAmbianceId(e.target.value)}
                    className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm font-semibold"
                  >
                    {AMBIANCE_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
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
                      <p className="text-sm line-clamp-3">{(item.question as EditableQuestion).question?.trim() || t("noQuestionText")}</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="rounded-full">{(item.question as EditableQuestion).type}</Badge>
                        {item.difficulty && <Badge variant="outline" className="rounded-full">{t((difficultyTranslationKeyMap[item.difficulty] || item.difficulty) as Parameters<typeof t>[0])}</Badge>}
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

      {/* ── Leave-without-saving confirmation ── */}
      <AlertDialog open={pendingNavigatePath !== null} onOpenChange={(open) => { if (!open) setPendingNavigatePath(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmLeaveBuilderTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmLeaveBuilder")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPendingNavigate} className="bg-destructive hover:bg-destructive/90">{t("leaveBuilder")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
