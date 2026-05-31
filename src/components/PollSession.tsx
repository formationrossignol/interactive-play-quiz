import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { MultiStepProgress } from "@/components/MultiStepProgress";
import type { SavedQuiz } from "@/lib/quizStorage";
import { cn } from "@/lib/utils";
import {
  ensureSessionState,
  ensureSessionInSupabase,
  readSessionState,
  patchSessionState,
  subscribeToSessionState,
  type SharedPlayer,
} from "@/lib/sessionState";
import { savePollSession, type PollQuestionResult, type PollResultSession } from "@/lib/pollResults";

interface PollSessionProps {
  poll: SavedQuiz;
}

type PollQuestion = {
  id?: string;
  type: string;
  question?: string;
  answers?: string[];
  allowMultiple?: boolean;
  scale?: string[];
  items?: string[];
  maxStars?: number;
  maxLength?: number;
  minLabel?: string;
  maxLabel?: string;
  image?: string;
};

export const PollSession = ({ poll }: PollSessionProps) => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [players, setPlayers] = useState<SharedPlayer[]>([]);
  const [sessionStarted, setSessionStarted] = useState(false);
  const sessionIdRef = useRef(`${poll.id}-${Date.now()}`);
  const startTimeRef = useRef(new Date().toISOString());
  // accumulated answer counts per question: Map<questionIndex, Map<answerKey, count>>
  const responsesRef = useRef<Map<number, Map<string, number>>>(new Map());
  // track which player+question combos we've already counted
  const seenRef = useRef<Set<string>>(new Set());

  const totalQuestions = poll.questions.length;
  const currentQuestion = useMemo(() => poll.questions[currentIndex] as PollQuestion, [poll.questions, currentIndex]);

  const collectAnswers = useCallback((sessionPlayers: SharedPlayer[]) => {
    sessionPlayers.forEach((player) => {
      if (
        typeof player.lastAnswerQuestionIndex !== "number" ||
        player.lastAnswer === undefined ||
        player.lastAnswer === null
      ) return;

      const qIdx = player.lastAnswerQuestionIndex;
      const key = `${player.id}:${qIdx}`;
      if (seenRef.current.has(key)) return;
      seenRef.current.add(key);

      if (!responsesRef.current.has(qIdx)) {
        responsesRef.current.set(qIdx, new Map());
      }
      const qMap = responsesRef.current.get(qIdx)!;
      const answerKey = String(player.lastAnswer);
      qMap.set(answerKey, (qMap.get(answerKey) ?? 0) + 1);
    });
  }, []);

  const buildResults = useCallback((): PollQuestionResult[] => {
    return poll.questions.map((q: PollQuestion, idx: number) => {
      const qMap = responsesRef.current.get(idx);
      const answers = q.answers?.filter((a) => a?.trim()) ?? [];
      const distribution = answers.map((_, i) => qMap?.get(String(i)) ?? 0);
      const totalResponses = distribution.reduce((s, n) => s + n, 0);
      return {
        questionIndex: idx,
        question: q.question ?? `Question ${idx + 1}`,
        type: q.type,
        answers,
        distribution,
        totalResponses,
      };
    });
  }, [poll.questions]);

  const saveResults = useCallback(() => {
    const session: PollResultSession = {
      sessionId: sessionIdRef.current,
      date: startTimeRef.current,
      totalParticipants: players.length,
      questions: buildResults(),
    };
    savePollSession(poll.id, poll.title, session);
  }, [players.length, buildResults, poll.id, poll.title]);

  useEffect(() => {
    ensureSessionState(poll.id);
    ensureSessionInSupabase(poll.id, { questions: poll.questions, title: poll.title });
    patchSessionState(poll.id, { gameState: "waiting" });

    const initial = readSessionState(poll.id);
    setPlayers(initial.players);
    collectAnswers(initial.players);

    const channel = subscribeToSessionState(poll.id, (state) => {
      setPlayers(state.players);
      collectAnswers(state.players);
    });

    return () => {
      channel.unsubscribe();
    };
  }, [poll.id, poll.title, poll.questions, collectAnswers]);

  // Auto-save results whenever we advance questions or on unmount
  useEffect(() => {
    if (sessionStarted) saveResults();
  }, [currentIndex, sessionStarted, saveResults]);

  useEffect(() => {
    return () => { saveResults(); };
  }, [saveResults]);

  if (totalQuestions === 0) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 text-slate-100">
        <div className="mx-auto max-w-4xl">
          <Card className="border border-slate-700/60 bg-slate-900/80 shadow-2xl">
            <CardContent className="space-y-4 p-8 text-center">
              <h1 className="text-3xl font-bold text-white drop-shadow-lg">{poll.title || "Sondage"}</h1>
              <p className="text-slate-300">
                Ce sondage ne contient aucune question. Ajoutez des questions dans l'éditeur avant de le lancer.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const hasPrevious = currentIndex > 0;
  const isLast = currentIndex === totalQuestions - 1;
  const filteredAnswers = (currentQuestion?.answers || []).filter((answer) => answer?.trim());

  const goNext = () => {
    if (!sessionStarted) setSessionStarted(true);
    patchSessionState(poll.id, { gameState: "question", currentQuestionIndex: currentIndex + 1 });
    setCurrentIndex((i) => Math.min(i + 1, totalQuestions - 1));
  };

  const goPrevious = () => {
    if (!sessionStarted) setSessionStarted(true);
    setCurrentIndex((i) => Math.max(i - 1, 0));
  };

  const handleStart = () => {
    setSessionStarted(true);
    patchSessionState(poll.id, { gameState: "question", currentQuestionIndex: 0 });
  };

  const handleViewResults = () => {
    saveResults();
    navigate(`/poll-results/${poll.id}`);
  };

  const renderChoiceAnswers = (multiple: boolean) => (
    <div className="space-y-3">
      {filteredAnswers.length === 0 ? (
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-6 text-center text-slate-300">
          Aucune option configurée pour cette question.
        </div>
      ) : (
        filteredAnswers.map((answer, index) => (
          <div
            key={`${answer}-${index}`}
            className="flex items-center gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/85 px-4 py-4 text-slate-100 shadow-lg"
          >
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full bg-primary/80 text-sm font-semibold text-white shadow-inner",
              multiple && "bg-emerald-500/80"
            )}>
              {String.fromCharCode(65 + index)}
            </div>
            <span className="flex-1 text-base font-medium">{answer}</span>
          </div>
        ))
      )}
    </div>
  );

  const renderScale = (scale: string[] | undefined) => (
    <div className="space-y-3">
      {scale?.map((item, index) => (
        <div key={`${item}-${index}`} className="rounded-2xl border border-slate-700/60 bg-slate-900/80 px-4 py-4 text-center text-slate-100 shadow-lg">
          {item}
        </div>
      )) || (
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-6 text-center text-slate-300">
          Aucune échelle définie pour cette question.
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    switch (currentQuestion?.type) {
      case "single-choice":
        return renderChoiceAnswers(false);
      case "multiple-choice":
        return renderChoiceAnswers(true);
      case "ranking":
        return (
          <div className="space-y-3">
            {(currentQuestion.items || []).filter((item) => item?.trim()).map((item, index) => (
              <div key={`${item}-${index}`} className="flex items-center gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/80 px-4 py-4 text-slate-100 shadow-lg">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/80 text-lg font-bold text-white shadow-inner">
                  {index + 1}
                </div>
                <span className="flex-1 text-base font-medium">{item}</span>
              </div>
            ))}
          </div>
        );
      case "likert-scale":
      case "frequency-scale":
        return renderScale(currentQuestion.scale);
      case "star-rating":
        return (
          <div className="flex justify-center gap-3 text-4xl text-yellow-400 drop-shadow">
            {Array.from({ length: currentQuestion.maxStars || 5 }).map((_, index) => (
              <span key={index}>★</span>
            ))}
          </div>
        );
      case "open-text":
        return (
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 px-5 py-6 text-slate-300">
            Réponse libre – les participants peuvent saisir jusqu'à {currentQuestion.maxLength || 500} caractères.
          </div>
        );
      case "nps-scale":
        return (
          <div className="space-y-4">
            <div className="flex justify-between text-sm text-slate-300">
              <span>{currentQuestion.minLabel || "0"}</span>
              <span>{currentQuestion.maxLabel || "10"}</span>
            </div>
            <div className="grid grid-cols-11 gap-2 text-center text-sm font-semibold text-slate-100">
              {Array.from({ length: 11 }).map((_, index) => (
                <div key={index} className="rounded-xl border border-slate-700/60 bg-slate-900/80 px-3 py-3 shadow">
                  {index}
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return (
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-6 text-center text-slate-300">
            Ce type de question n'est pas encore pris en charge dans la prévisualisation.
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="flex flex-col gap-4 text-center">
          <div className="flex items-center justify-between gap-4 text-sm text-slate-300">
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-slate-700/60 bg-slate-800/70 px-3 py-1 text-slate-200 text-xs font-medium">
                Sondage en direct
              </span>
              {players.length > 0 && (
                <span className="text-xs text-slate-400">{players.length} participant{players.length > 1 ? "s" : ""}</span>
              )}
            </div>
            <span>Question {currentIndex + 1} / {totalQuestions}</span>
          </div>
          <MultiStepProgress totalSteps={totalQuestions} currentStep={currentIndex} />
        </header>

        <Card className="border border-slate-700/60 bg-slate-900/80 shadow-2xl">
          <CardContent className="space-y-8 p-8">
            <div className="space-y-4 text-center">
              <h1 className="text-3xl font-bold text-white drop-shadow-lg md:text-4xl">
                {currentQuestion?.question || `Question ${currentIndex + 1}`}
              </h1>
              {currentQuestion?.image && (
                <div className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-slate-700/60">
                  <img src={currentQuestion.image} alt="Illustration" className="h-64 w-full object-cover" />
                </div>
              )}
            </div>
            {renderContent()}
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            className="ap-btn ap-btn--ghost ap-btn--sm"
            onClick={goPrevious}
            disabled={!hasPrevious}
            style={{ borderColor: "rgba(255,255,255,0.15)", color: "#cbd5e1" }}
          >
            Précédent
          </button>
          <div className="flex gap-3">
            {!sessionStarted && (
              <button className="ap-btn ap-btn--poll ap-btn--pill" onClick={handleStart}>
                Démarrer
              </button>
            )}
            {isLast ? (
              <button className="ap-btn ap-btn--poll ap-btn--pill" onClick={handleViewResults}>
                Voir les résultats
              </button>
            ) : (
              <button className="ap-btn ap-btn--poll ap-btn--pill" onClick={goNext} disabled={!sessionStarted && currentIndex === 0}>
                Question suivante
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
