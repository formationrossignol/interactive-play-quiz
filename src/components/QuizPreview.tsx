import { useMemo } from "react";
import { Trophy, Edit2, Users, PencilLine, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_THEME_ID, THEMES } from "@/lib/themes";
import { hexToRgba, darkestColor, relativeLuminance } from "@/lib/color";
import { HOST_ANSWER_STYLES, MILLIONAIRE_ANSWER_STYLES, resolveFontFamily } from "@/lib/answerVisuals";
import { MultiStepProgress } from "./MultiStepProgress";
import { t } from "@/lib/i18n";

interface QuizPreviewProps {
  title: string;
  description: string;
  category: string;
  headerImage?: string;
  questions: any[];
  isPoll: boolean;
  theme?: string;
  fontFamily?: string;
  onEditQuestion?: (index: number) => void;
}

interface QuizPreviewLiveProps extends QuizPreviewProps {
  selectedQuestionIndex?: number | null;
}

/**
 * Réplique fidèle de l'écran « question » du présentateur (QuizSession).
 * Même fond de thème, même barre supérieure, même timer, mêmes tuiles
 * de réponses — ce que vous voyez ici est ce que verra la salle.
 */
export const QuizPreview = ({
  title,
  questions,
  isPoll,
  theme = DEFAULT_THEME_ID,
  selectedQuestionIndex,
  fontFamily,
  onEditQuestion,
}: QuizPreviewLiveProps) => {
  const selectedTheme = THEMES.find((themeOption) => themeOption.id === theme) ?? THEMES[0];
  const isMillionnaire = selectedTheme?.id === 'qui-veut-gagner';

  // Mêmes calques que ThemedBackground dans QuizSession
  const backgroundStyle = selectedTheme
    ? {
        backgroundImage: selectedTheme.background,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }
    : { background: "linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(15, 23, 42, 0.88))" };

  const overlayColor = useMemo(() => {
    if (!selectedTheme?.palette?.length) return "rgba(15, 23, 42, 0.72)";
    const base = darkestColor(selectedTheme.palette);
    if (!base || relativeLuminance(base) > 0.45) return "rgba(15, 23, 42, 0.72)";
    return hexToRgba(base, 0.7);
  }, [selectedTheme]);

  const accentOverlay = useMemo(() => {
    const firstPalette = selectedTheme?.palette?.[0];
    return firstPalette ? hexToRgba(firstPalette, 0.28) : "rgba(15, 23, 42, 0.45)";
  }, [selectedTheme]);

  const resolvedFont = resolveFontFamily(fontFamily);

  const questionIndex =
    selectedQuestionIndex !== null && selectedQuestionIndex !== undefined ? selectedQuestionIndex : 0;
  const questionToShow = questions[questionIndex] ?? questions[0];

  const ANSWER_STYLES = isMillionnaire ? MILLIONAIRE_ANSWER_STYLES : HOST_ANSWER_STYLES;

  const QuestionTitle = ({ text }: { text: string }) =>
    isMillionnaire ? (
      <div style={{ background: 'rgba(6,10,35,0.9)', border: '1.5px solid rgba(200,160,0,0.6)', borderRadius: 40, padding: '14px 28px', maxWidth: 720, width: '100%', boxShadow: '0 0 28px rgba(200,160,0,0.18), inset 0 1px 0 rgba(200,160,0,0.12)' }}>
        <h1 className="text-center text-white leading-snug m-0" style={{ fontFamily: 'var(--ap-font-display)', fontSize: 'clamp(1.1rem,2.4vw,1.9rem)', fontWeight: 700 }}>
          {text}
        </h1>
      </div>
    ) : (
      <h1
        className="text-center text-white drop-shadow-2xl max-w-4xl leading-snug m-0"
        style={{ fontFamily: 'var(--ap-font-display)', fontSize: 'clamp(1.2rem, 2.8vw, 2.1rem)', fontWeight: 700, textShadow: '0 2px 16px rgba(0,0,0,0.4)' }}
      >
        {text}
      </h1>
    );

  // Réplique statique du CircularTimer (plein au départ de la question)
  const TimerRing = ({ seconds }: { seconds: number }) => {
    const radius = 34;
    const circumference = 2 * Math.PI * radius;
    return (
      <div className="relative inline-flex items-center justify-center">
        <svg className="-rotate-90" width="88" height="88">
          <circle cx="44" cy="44" r={radius} stroke="rgba(255,255,255,0.15)" strokeWidth="7" fill="rgba(0,0,0,0.15)" />
          <circle cx="44" cy="44" r={radius} stroke="#15c08a" strokeWidth="7" fill="none" strokeDasharray={circumference} strokeDashoffset={0} strokeLinecap="round" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold" style={{ fontFamily: 'var(--ap-font-display)', color: '#15c08a', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
          {seconds}
        </span>
      </div>
    );
  };

  const renderAnswerZone = () => {
    if (!questionToShow) return null;

    if (['multiple-choice', 'single-choice'].includes(questionToShow.type) && questionToShow.answers) {
      return (
        <div className="grid grid-cols-2 gap-3 w-full">
          {(questionToShow.answers as string[]).map((answer, index) => (
            isMillionnaire ? (
              <div
                key={index}
                className="flex items-center gap-3 px-3 py-3 text-white font-bold text-sm select-none"
                style={{ background: ANSWER_STYLES[index % 4].bg, border: '1.5px solid rgba(200,160,0,0.6)', borderRadius: 40, boxShadow: `0 0 20px ${ANSWER_STYLES[index % 4].shadow}, inset 0 1px 0 rgba(200,160,0,0.1)`, minHeight: 56, fontFamily: 'var(--ap-font-body)' }}
              >
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(200,160,0,0.15)', border: '1.5px solid rgba(200,160,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#FFD700', fontWeight: 900, fontSize: '0.9rem', fontFamily: 'var(--ap-font-display)' }}>
                  {ANSWER_STYLES[index % 4].shape}
                </div>
                <span className="leading-tight flex-1 text-center">{answer?.trim() || `${t("answer")} ${index + 1}`}</span>
              </div>
            ) : (
              <div
                key={index}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-white font-bold text-base select-none"
                style={{ background: HOST_ANSWER_STYLES[index % 4].bg, boxShadow: `0 6px 24px ${HOST_ANSWER_STYLES[index % 4].shadow}`, minHeight: 58, fontFamily: 'var(--ap-font-body)' }}
              >
                <span className="text-xl opacity-90 flex-shrink-0">{HOST_ANSWER_STYLES[index % 4].shape}</span>
                <span className="leading-tight">{answer?.trim() || `${t("answer")} ${index + 1}`}</span>
              </div>
            )
          ))}
        </div>
      );
    }

    if (questionToShow.type === 'true-false') {
      return (
        <div className="grid grid-cols-2 gap-3 w-full">
          {isMillionnaire ? (
            <>
              <div className="flex items-center justify-center gap-3 px-3 py-3 text-white font-bold text-lg select-none" style={{ background: 'rgba(8,12,40,0.88)', border: '1.5px solid rgba(200,160,0,0.6)', borderRadius: 40, boxShadow: '0 0 20px rgba(200,160,0,0.2)', minHeight: 56, fontFamily: 'var(--ap-font-display)' }}>
                <span style={{ color: '#FFD700', fontSize: '1.3rem' }}>○</span> {questionToShow.answers?.[0] ?? 'Vrai'}
              </div>
              <div className="flex items-center justify-center gap-3 px-3 py-3 text-white font-bold text-lg select-none" style={{ background: 'rgba(8,12,40,0.88)', border: '1.5px solid rgba(200,160,0,0.6)', borderRadius: 40, boxShadow: '0 0 20px rgba(200,160,0,0.2)', minHeight: 56, fontFamily: 'var(--ap-font-display)' }}>
                <span style={{ color: '#FFD700', fontSize: '1.3rem' }}>✕</span> {questionToShow.answers?.[1] ?? 'Faux'}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center gap-3 rounded-2xl px-4 py-4 text-white font-bold text-lg select-none" style={{ background: '#27AE60', boxShadow: '0 6px 24px rgba(39,174,96,0.5)', fontFamily: 'var(--ap-font-display)' }}>
                <span className="text-2xl">✓</span> {questionToShow.answers?.[0] ?? 'Vrai'}
              </div>
              <div className="flex items-center justify-center gap-3 rounded-2xl px-4 py-4 text-white font-bold text-lg select-none" style={{ background: '#E74C3C', boxShadow: '0 6px 24px rgba(231,76,60,0.5)', fontFamily: 'var(--ap-font-display)' }}>
                <span className="text-2xl">✗</span> {questionToShow.answers?.[1] ?? 'Faux'}
              </div>
            </>
          )}
        </div>
      );
    }

    if (['short-answer', 'open-text', 'fill-blank'].includes(questionToShow.type)) {
      return (
        <div
          className="w-full rounded-2xl border-2 border-dashed border-white/30 bg-white/10 p-4 text-center text-white text-base font-bold backdrop-blur select-none"
          style={{ fontFamily: 'var(--ap-font-display)' }}
        >
          <PencilLine style={{ width:16, height:16, display:"inline", verticalAlign:"-3px", marginRight:8 }} /> Les joueurs tapent leur réponse
        </div>
      );
    }

    if (questionToShow.type === 'ranking' && questionToShow.items) {
      return (
        <div className="w-full space-y-2">
          {(questionToShow.items as any[]).slice(0, 5).map((item: any, index: number) => (
            <div key={item?.id ?? index} className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-white font-bold text-sm" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
              <span className="w-6 text-center text-white/60">{index + 1}</span>
              <span className="flex-1 truncate">{(typeof item === 'string' ? item : item?.text)?.trim() || `${t("answer")} ${index + 1}`}</span>
            </div>
          ))}
          <p className="text-center text-white/60 text-xs font-bold pt-1" style={{ fontFamily: 'var(--ap-font-body)' }}>
            <Shuffle style={{ width:13, height:13, display:"inline", verticalAlign:"-2px", marginRight:6 }} /> Les joueurs remettent les éléments dans l'ordre
          </p>
        </div>
      );
    }

    if (questionToShow.type === 'matching') {
      return (
        <div className="w-full grid grid-cols-2 gap-2">
          <div className="space-y-2">
            {(questionToShow.leftColumn ?? []).slice(0, 4).map((item: any, index: number) => (
              <div key={item?.id ?? index} className="rounded-xl px-3 py-2.5 text-white font-bold text-sm truncate" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
                {item?.text?.trim() || `${t("answer")} ${index + 1}`}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {(questionToShow.rightColumn ?? []).slice(0, 4).map((item: any, index: number) => (
              <div key={item?.id ?? index} className="rounded-xl px-3 py-2.5 text-white font-bold text-sm truncate" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
                {item?.text?.trim() || `${t("answer")} ${index + 1}`}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (questionToShow.type === 'slider') {
      return (
        <div className="w-full max-w-md mx-auto space-y-2">
          <div className="h-2 w-full rounded-full bg-white/20">
            <div className="h-2 w-1/2 rounded-full bg-white/70" />
          </div>
          <div className="flex justify-between text-white/70 text-sm font-bold">
            <span>{questionToShow.minLabel ?? questionToShow.min ?? 0}</span>
            <span>{questionToShow.maxLabel ?? questionToShow.max ?? 100}</span>
          </div>
        </div>
      );
    }

    if (['likert-scale', 'frequency-scale'].includes(questionToShow.type)) {
      return (
        <div className="w-full max-w-md mx-auto space-y-2">
          {(questionToShow.scale ?? []).slice(0, 5).map((option: string, index: number) => (
            <div key={index} className="rounded-xl px-4 py-2.5 text-center text-white font-bold text-sm" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
              {option}
            </div>
          ))}
        </div>
      );
    }

    if (questionToShow.type === 'star-rating') {
      return (
        <div className="flex justify-center gap-2 text-3xl">
          {Array.from({ length: questionToShow.maxStars || 5 }).map((_, index) => (
            <span key={index}>⭐</span>
          ))}
        </div>
      );
    }

    if (questionToShow.type === 'nps-scale') {
      return (
        <div className="w-full space-y-3">
          <div className="flex justify-between text-white/70 text-xs font-bold">
            <span>{questionToShow.minLabel || 'Pas du tout probable'}</span>
            <span>{questionToShow.maxLabel || 'Très probable'}</span>
          </div>
          <div className="grid grid-cols-11 gap-1.5 text-center text-sm font-bold text-white">
            {Array.from({ length: 11 }).map((_, index) => (
              <div key={index} className="rounded-lg py-2" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
                {index}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  if (!questionToShow) {
    return (
      <div className="relative flex h-full flex-col overflow-hidden" style={backgroundStyle}>
        {!isMillionnaire && <div className="absolute inset-0" style={{ background: accentOverlay }} aria-hidden />}
        {!isMillionnaire && <div className="absolute inset-0" style={{ background: overlayColor, mixBlendMode: "multiply" }} aria-hidden />}
        <div className="relative z-10 flex h-full items-center justify-center px-6 text-center text-sm text-white/80">
          {t("noQuestionsYet")}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden" style={backgroundStyle}>
      {/* Calques de lisibilité — identiques à la session réelle */}
      {!isMillionnaire && <div className="absolute inset-0" style={{ background: accentOverlay }} aria-hidden />}
      {!isMillionnaire && <div className="absolute inset-0" style={{ background: overlayColor, mixBlendMode: "multiply" }} aria-hidden />}
      {isMillionnaire && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 35%,rgba(200,160,0,0.18) 0%,transparent 70%)' }} />
      )}

      <div className="relative z-10 flex h-full flex-col text-white" style={resolvedFont ? { fontFamily: resolvedFont } : undefined}>
        {/* ── Barre supérieure (répliquée de QuizSession) ── */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-black/50 backdrop-blur-sm border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-bold text-white/70 flex-shrink-0" style={{ fontFamily: 'var(--ap-font-display)' }}>
              Q {questionIndex + 1}/{questions.length}
            </span>
            <MultiStepProgress totalSteps={Math.min(questions.length, 20)} currentStep={questionIndex} className="w-24 h-2" />
            <span className="truncate text-xs font-bold text-white/40" style={{ fontFamily: 'var(--ap-font-body)' }}>
              {title?.trim() || t("untitled")}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <Users className="w-4 h-4" />
              <span>0<span className="text-white/50">/0</span></span>
            </div>
            {onEditQuestion !== undefined && selectedQuestionIndex !== null && selectedQuestionIndex !== undefined && (
              <Button
                variant="secondary"
                size="sm"
                className="h-7 bg-white/10 text-white hover:bg-white/20 border border-white/15"
                onClick={() => onEditQuestion(selectedQuestionIndex)}
              >
                <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                Éditer
              </Button>
            )}
          </div>
        </div>

        {/* ── Zone question (centre) ── */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 gap-4 overflow-auto min-h-0">
          {!isPoll && (
            <div className="flex items-center gap-4">
              <TimerRing seconds={questionToShow.timeLimit ?? 20} />
              <div className="flex items-center gap-2 rounded-2xl border border-white/20 bg-black/30 px-4 py-2 backdrop-blur">
                <Trophy className="w-4 h-4 text-yellow-300" />
                <span className="text-lg font-bold text-yellow-200" style={{ fontFamily: 'var(--ap-font-display)' }}>
                  {questionToShow.points ?? 0} pts
                </span>
              </div>
            </div>
          )}

          {questionToShow.image && (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-xl max-h-36 w-full max-w-2xl">
              <img src={questionToShow.image} alt={questionToShow.question || t("question")} className="h-full w-full object-cover" />
            </div>
          )}

          <QuestionTitle text={questionToShow.question?.trim() || questionToShow.text?.trim() || t("noQuestionText")} />
        </div>

        {/* ── Zone réponses (bas, comme en session) ── */}
        <div className="px-4 pb-4 flex-shrink-0">
          {renderAnswerZone()}
        </div>
      </div>
    </div>
  );
};
