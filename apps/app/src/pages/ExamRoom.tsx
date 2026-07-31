import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getExamByJoinCode, computeExamStatus,
  startAttempt, saveAnswers, submitAttempt,
  getActiveAttempt, getAttemptsForParticipant,
  getRetainedAttempt, getMessagesForAttempt, sendMessage,
  type Exam, type Attempt, type ExamMessage,
} from '@/lib/examStorage';
import { genParticipantId, getParticipant, setParticipant, type Participant } from '@/lib/examParticipant';
import { AudienceCapError } from '@/lib/plans';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Map as MapIcon, Flag, MessageCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { MaterialSymbol } from '@/components/MaterialSymbol';
import {
  ProctoringPreflight,
  type ProctoringStreams,
} from '@/components/proctoring/ProctoringPreflight';
import { ProctoringMonitor } from '@/components/proctoring/ProctoringMonitor';
import { recordProctoringEvent } from '@/lib/proctoring';

function loadFlags(attemptId: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(`exam_flags_${attemptId}`);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}

function getAnswerOrder(attemptId: string, questionId: string, count: number): number[] {
  let hash = 0;
  const str = attemptId + questionId;
  for (let i = 0; i < str.length; i++) {
    hash = (((hash << 5) - hash) + str.charCodeAt(i)) | 0;
  }
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    hash = Math.abs((((hash << 5) - hash) + i) | 0);
    const j = hash % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

type Phase = 'loading' | 'not-found' | 'not-open' | 'identify' | 'ready' | 'taking' | 'submitted' | 'exhausted' | 'full' | 'kicked';

export default function ExamRoom() {
  const { joinCode } = useParams<{ joinCode: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('loading');
  const [exam, setExam] = useState<Exam | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [participant, setParticipantState] = useState<Participant | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [identError, setIdentError] = useState('');

  const [answers, setAnswers] = useState<Record<string, number | string | null>>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [retainedAttempt, setRetainedAttempt] = useState<Attempt | null>(null);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [currentQId, setCurrentQId] = useState<string | null>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ExamMessage[]>([]);
  const [chatText, setChatText] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [proctoringStreams, setProctoringStreams] = useState<ProctoringStreams>({ camera: null, screen: null });

  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSubmittingRef = useRef(false);
  const elapsedRef = useRef(0);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  /* ── Load exam ────────────────────────────────────────────────── */
  useEffect(() => {
    if (!joinCode) { setPhase('not-found'); return; }
    let cancelled = false;
    (async () => {
      const e = await getExamByJoinCode(joinCode);
      if (cancelled) return;
      if (!e) { setPhase('not-found'); return; }
      setExam(e);

      const status = computeExamStatus(e);
      if (status === 'draft' || status === 'scheduled' || status === 'closed' || status === 'archived') {
        setPhase('not-open');
        return;
      }

      const part = getParticipant();
      if (part) {
        setParticipantState(part);
        await checkExistingAttempt(e, part);
      } else {
        setPhase('identify');
      }
    })();
    return () => { cancelled = true; };
  }, [joinCode]);

  async function checkExistingAttempt(e: Exam, part: Participant) {
    const active = await getActiveAttempt(e.id, part.id);
    if (active) {
      setAttempt(active);
      setAnswers(active.answers ?? {});
      setFlagged(loadFlags(active.id));
      elapsedRef.current = active.timeUsedSeconds;
      setElapsed(active.timeUsedSeconds);
      setPhase(e.proctoring.enabled ? 'ready' : 'taking');
      return;
    }
    const done = (await getAttemptsForParticipant(e.id, part.id)).filter(
      (a) => a.status !== 'in-progress' && a.status !== 'cancelled'
    );
    if (done.length >= e.maxAttempts) { setPhase('exhausted'); return; }
    setPhase('ready');
  }

  /* ── Start exam ───────────────────────────────────────────────── */
  const handleStart = async () => {
    if (!exam || !participant) return;
    try {
      const att = await startAttempt(exam, participant.id, participant.name, participant.email);
      setAttempt(att);
      setAnswers(att.answers ?? {});
      setFlagged(loadFlags(att.id));
      elapsedRef.current = att.timeUsedSeconds;
      setElapsed(att.timeUsedSeconds);
      setPhase('taking');
    } catch (e) {
      setPhase(e instanceof AudienceCapError ? 'full' : 'exhausted');
    }
  };

  const stopProctoringStreams = useCallback(() => {
    proctoringStreams.camera?.getTracks().forEach((track) => track.stop());
    proctoringStreams.screen?.getTracks().forEach((track) => track.stop());
    setProctoringStreams({ camera: null, screen: null });
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }, [proctoringStreams.camera, proctoringStreams.screen]);

  const recordExamFinished = useCallback(() => {
    if (!exam?.proctoring.enabled || !attempt || !participant) return Promise.resolve();
    return recordProctoringEvent({
      examId: exam.id,
      attemptId: attempt.id,
      participantId: participant.id,
      type: 'exam_finished',
      severity: 'info',
      details: {},
    });
  }, [attempt, exam, participant]);

  /* ── Timer ────────────────────────────────────────────────────── */
  useEffect(() => {
    if (phase !== 'taking' || !attempt || !exam) return;

    const deadline = exam.durationMinutes
      ? new Date(attempt.startedAt).getTime() + exam.durationMinutes * 60000
      : null;

    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);

      if (deadline) {
        const remaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
        setSecondsLeft(remaining);
        if (remaining === 0) {
          clearInterval(timerRef.current!);
          handleAutoSubmit();
        }
      }
    }, 1000);

    if (deadline) {
      setSecondsLeft(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    }

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, attempt?.id]);

  /* ── Auto-save every 30s ──────────────────────────────────────── */
  useEffect(() => {
    if (phase !== 'taking' || !attempt) return;
    autoSaveRef.current = setInterval(() => {
      void saveAnswers(attempt.id, answersRef.current, elapsedRef.current);
    }, 30000);
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current); };
  }, [phase, attempt?.id]);

  /* ── Live proctor removal ────────────────────────────────────────── */
  useEffect(() => {
    if (phase !== 'taking' || !attempt) return;
    const channel = supabase
      .channel(`exam-attempt-${attempt.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'exam_attempts', filter: `id=eq.${attempt.id}` },
        (payload) => {
          const row = payload.new as { status: string };
          if (row.status === 'cancelled') {
            if (timerRef.current) clearInterval(timerRef.current);
            if (autoSaveRef.current) clearInterval(autoSaveRef.current);
            setPhase('kicked');
          }
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [phase, attempt?.id]);

  /* ── Host ↔ participant chat thread ──────────────────────────────── */
  useEffect(() => {
    if (phase !== 'taking' || !attempt) return;
    let cancelled = false;
    void getMessagesForAttempt(attempt.id).then((m) => { if (!cancelled) setChatMessages(m); });
    return () => { cancelled = true; };
  }, [phase, attempt?.id]);

  useEffect(() => {
    if (phase !== 'taking' || !attempt) return;
    const channel = supabase
      .channel(`exam-messages-${attempt.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'exam_messages', filter: `attempt_id=eq.${attempt.id}` },
        (payload) => {
          const row = payload.new as unknown as ExamMessage;
          setChatMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          if (row.sender === 'host') {
            toast.info(row.body, { duration: 15000 });
            setChatOpen((open) => { if (!open) setUnreadCount((c) => c + 1); return open; });
          }
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [phase, attempt?.id]);

  const handleSendChat = async () => {
    const body = chatText.trim();
    if (!body || !attempt || !exam || chatSending) return;
    setChatSending(true);
    try {
      const sent = await sendMessage(exam.id, attempt.id, 'participant', body);
      setChatMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      setChatText('');
    } catch {
      toast.error("Échec de l'envoi du message");
    } finally {
      setChatSending(false);
    }
  };

  /* ── Auto-submit ──────────────────────────────────────────────── */
  const handleAutoSubmit = useCallback(() => {
    if (!attempt || autoSubmittingRef.current) return;
    autoSubmittingRef.current = true;
    // Don't clear timerRef/autoSaveRef or flip phase until the write actually
    // succeeds — on failure (network blip) the attempt stays 'in-progress'
    // server-side, so autosave must keep running rather than optimistically
    // showing a success screen the DB doesn't back up (see handleSubmit).
    recordExamFinished()
      .catch(() => undefined)
      .then(() => submitAttempt(attempt.id, answersRef.current, elapsedRef.current, 'auto'))
      .then(() => {
        stopProctoringStreams();
        if (timerRef.current) clearInterval(timerRef.current);
        if (autoSaveRef.current) clearInterval(autoSaveRef.current);
        setPhase('submitted');
      })
      .catch(() => {
        autoSubmittingRef.current = false;
        toast.error("Échec de l'envoi automatique — nouvelle tentative en cours…", { duration: 8000 });
        // Time is already up; retry shortly rather than leaving the
        // participant stuck on an expired timer with no way to submit.
        setTimeout(() => handleAutoSubmit(), 5000);
      });
  }, [attempt, recordExamFinished, stopProctoringStreams]);

  /* ── Manual submit ────────────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!attempt) return;
    setSubmitting(true);
    try {
      await recordExamFinished();
      const result = await submitAttempt(attempt.id, answersRef.current, elapsedRef.current, 'manual');
      stopProctoringStreams();
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
      setAttempt(result);
      setPhase('submitted');
      setConfirmSubmit(false);
    } catch {
      toast.error("Échec de l'envoi. Vérifiez votre connexion et réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Retained attempt (for the exhausted/submitted screens) ──────── */
  useEffect(() => {
    if ((phase !== 'submitted' && phase !== 'exhausted') || !exam || !participant) return;
    getRetainedAttempt(exam, participant.id).then(setRetainedAttempt);
  }, [phase, exam, participant]);

  /* ── Answer change ────────────────────────────────────────────── */
  const setAnswer = (qId: string, val: number | string | null) => {
    setAnswers((prev) => ({ ...prev, [qId]: val }));
  };

  /* ── Flag toggle (mark a question to revisit later) ──────────────── */
  const toggleFlag = (qId: string) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId); else next.add(qId);
      if (attempt) sessionStorage.setItem(`exam_flags_${attempt.id}`, JSON.stringify([...next]));
      return next;
    });
  };

  /* ── Track which question is currently in view, for the map's highlight ── */
  useEffect(() => {
    if (phase !== 'taking' || !attempt) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (!visible.length) return;
        const top = visible.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b));
        const id = top.target.getAttribute('data-qid');
        if (id) setCurrentQId(id);
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: 0 },
    );
    attempt.questionOrder.forEach((id) => {
      const el = questionRefs.current[id];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [phase, attempt]);

  const scrollToQuestion = (qId: string) => {
    questionRefs.current[qId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  /* ── Identity form ────────────────────────────────────────────── */
  const handleIdentify = () => {
    if (!nameInput.trim()) { setIdentError('Nom requis'); return; }
    const part: Participant = {
      id: genParticipantId(),
      name: nameInput.trim(),
      email: emailInput.trim(),
    };
    setParticipant(part);
    setParticipantState(part);
    void checkExistingAttempt(exam!, part);
  };

  /* ── Render helpers ───────────────────────────────────────────── */
  if (phase === 'loading') return <Screen maxWidth={520}><ExamRoomSkeleton /></Screen>;

  if (phase === 'not-found') return (
    <Screen>
      <BigIcon name="search" />
      <Title>Examen introuvable</Title>
      <Sub>Vérifiez le code d'accès et réessayez.</Sub>
    </Screen>
  );

  if (phase === 'not-open') {
    const status = exam ? computeExamStatus(exam) : null;
    return (
      <Screen>
        <BigIcon name={status === 'scheduled' ? 'hourglass_top' : 'lock'} />
        <Title>{status === 'scheduled' ? 'Pas encore ouvert' : 'Examen fermé'}</Title>
        <Sub>
          {status === 'scheduled'
            ? `Ouverture le ${exam ? new Date(exam.openAt).toLocaleString('fr') : ''}`
            : `Cet examen est terminé.`}
        </Sub>
      </Screen>
    );
  }

  if (phase === 'exhausted') return (
    <Screen>
      <BigIcon name="check_circle" color="var(--ap-pres)" />
      <Title>Tentatives épuisées</Title>
      <Sub>Vous avez atteint le nombre maximum de tentatives pour cet examen.</Sub>
      {exam && retainedAttempt && (
        <ViewResultsBtn retained={retainedAttempt} exam={exam} navigate={navigate} />
      )}
    </Screen>
  );

  if (phase === 'kicked') return (
    <Screen>
      <BigIcon name="block" color="var(--ap-quiz)" />
      <Title>Retiré de l'examen</Title>
      <Sub>Le surveillant vous a retiré de cet examen. Contactez-le pour plus d'informations.</Sub>
    </Screen>
  );

  if (phase === 'full') return (
    <Screen>
      <BigIcon name="meeting_room" color="var(--ap-quiz)" />
      <Title>Capacité maximale atteinte</Title>
      <Sub>Cet examen a atteint son nombre maximum de participants. Contactez l'organisateur.</Sub>
    </Screen>
  );

  if (exam && exam.questionsPublic.length === 0) return (
    <Screen>
      <BigIcon name="warning" color="var(--ap-quiz)" />
      <Title>Quiz introuvable</Title>
      <Sub>Le contenu associé à cet examen n'est pas disponible. Contactez l'organisateur.</Sub>
    </Screen>
  );

  if (phase === 'identify') return (
    <Screen maxWidth={420}>
      <BigIcon name="edit" />
      <Title>{exam?.title}</Title>
      {exam?.description && <Sub style={{ marginBottom: 20 }}>{exam.description}</Sub>}
      <div style={{ width: '100%', textAlign: 'left' }}>
        <label className="ap-label">Prénom et nom *</label>
        <input
          className="ap-input"
          placeholder="Marie Dupont"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleIdentify(); }}
        />
        <label className="ap-label" style={{ marginTop: 14 }}>Email (optionnel)</label>
        <input
          className="ap-input"
          type="email"
          placeholder="marie@exemple.fr"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleIdentify(); }}
        />
        {identError && <p style={{ color: 'var(--ap-quiz)', fontSize: 13, fontWeight: 800, marginTop: 8 }}>{identError}</p>}
        <button className="ap-btn ap-btn--pill" style={{ width: '100%', marginTop: 20 }} onClick={handleIdentify}>Continuer →</button>
      </div>
    </Screen>
  );

  if (phase === 'ready' && exam) return (
    <Screen maxWidth={520}>
      {exam.proctoring.enabled && participant ? (
        <ProctoringPreflight
          exam={exam}
          participant={participant}
          onReady={(streams) => {
            setProctoringStreams(streams);
            void handleStart();
          }}
        />
      ) : (
      <div className="ap-card" style={{ padding: '28px 28px', width: '100%', textAlign: 'center' }}>
        <div style={{ marginBottom: 12, color: 'var(--ap-brand)' }}><MaterialSymbol name="assignment" size={44} /></div>
        <h1 style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 700, fontSize: 22, marginBottom: 8 }}>
          {exam.title}
        </h1>
        {exam.description && (
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ap-muted)', marginBottom: 20 }}>
            {exam.description}
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
          <Info icon="help" label={`${exam.questionsPublic.length} questions`} />
          {exam.durationMinutes && <Info icon="timer" label={`${exam.durationMinutes} min`} />}
          <Info icon="replay" label={`${exam.maxAttempts} tentative${exam.maxAttempts > 1 ? 's' : ''}`} />
          <Info icon="emoji_events" label={`Seuil : ${exam.passingScore}%`} />
        </div>
        <div style={{
          background: 'var(--ap-paper)', borderRadius: 'var(--ap-r-sm)',
          padding: '12px 16px', marginBottom: 20, fontSize: 12, fontWeight: 700,
          color: 'var(--ap-muted)', textAlign: 'left', lineHeight: 1.8,
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <MaterialSymbol name="push_pin" size={16} style={{ marginTop: 2, flexShrink: 0 }} />
          <span>
            Vos réponses sont sauvegardées automatiquement toutes les 30 secondes.
            {exam.durationMinutes && ` L'examen se soumet automatiquement à la fin du temps.`}
          </span>
        </div>
        <button className="ap-btn ap-btn--pill" style={{ width: '100%', marginTop: 4 }} onClick={handleStart}>Commencer l'examen →</button>
      </div>
      )}
    </Screen>
  );

  if (phase === 'submitted') {
    const retained = retainedAttempt;
    const showResults = exam?.showResultsPolicy === 'immediately';
    return (
      <Screen>
        <BigIcon name="celebration" />
        <Title>Examen soumis !</Title>
        {showResults && retained?.percentage !== null ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 52, fontFamily: 'var(--ap-font-display)', fontWeight: 800,
              color: retained?.passed ? 'var(--ap-pres)' : 'var(--ap-quiz)', marginBottom: 8,
            }}>
              {retained?.percentage}%
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontSize: 16, fontWeight: 800,
              color: retained?.passed ? 'var(--ap-pres)' : 'var(--ap-quiz)', marginBottom: 16,
            }}>
              <MaterialSymbol name={retained?.passed ? 'check_circle' : 'cancel'} size={20} />
              {retained?.passed ? 'Réussi' : 'Non réussi'}
            </div>
            {exam?.showDetailPolicy !== 'score-only' && retained && (
              <button
                className="ap-btn ap-btn--pill"
                style={{ marginTop: 8 }}
                onClick={() => navigate(`/exam/${retained.id}/results`)}
              >
                Voir la correction →
              </button>
            )}
          </div>
        ) : (
          <Sub>Votre tentative a été enregistrée.{exam?.showResultsPolicy === 'after-close' ? ' Les résultats seront disponibles après la fermeture.' : ''}</Sub>
        )}
      </Screen>
    );
  }

  /* ── Taking phase ─────────────────────────────────────────────── */
  if (phase === 'taking' && attempt && exam) {
    const orderedQs = attempt.questionOrder
      .map((id) => exam.questionsPublic.find((q) => (q as { id: string }).id === id))
      .filter(Boolean) as { id: string; type: string; question: string; answers: string[]; correctAnswer: unknown }[];
    const answered = orderedQs.filter((q: { id: string }) => answers[q.id] !== null && answers[q.id] !== undefined).length;
    const minutesLeft = secondsLeft !== null ? Math.ceil(secondsLeft / 60) : null;

    return (
      <div style={{ minHeight: '100vh', paddingBottom: 100 }}>
        {exam.proctoring.enabled && participant && (
          <ProctoringMonitor
            exam={exam}
            attempt={attempt}
            participant={participant}
            streams={proctoringStreams}
            onAutoSubmit={handleAutoSubmit}
          />
        )}
        <style>{`
          .er-opt { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: var(--ap-border-w) solid var(--ap-line); border-radius: var(--ap-r-sm); cursor: pointer; transition: border-color .15s, background .15s; margin-bottom: 8px; font-weight: 700; font-size: 14px; color: var(--ap-ink); background: var(--ap-paper); }
          .er-opt:hover { border-color: var(--ap-brand); background: var(--ap-brand-soft); }
          .er-opt.sel { border-color: var(--ap-brand); background: var(--ap-brand-soft); }
          .er-dot { width: 18px; height: 18px; border-radius: 50%; border: var(--ap-border-w) solid var(--ap-line); flex-shrink: 0; transition: background .15s, border-color .15s; }
          .er-opt.sel .er-dot { background: var(--ap-brand); border-color: var(--ap-brand); }
          .er-body { display: flex; align-items: flex-start; gap: 24px; max-width: 1180px; margin: 0 auto; padding: 24px 16px; }
          .er-sidebar { width: 340px; flex-shrink: 0; position: sticky; top: 72px; }
          @media (max-width: 980px) {
            .er-body { flex-direction: column; }
            .er-sidebar { width: 100%; position: static; }
          }
        `}</style>

        {/* Topbar */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: 'var(--ap-card)', borderBottom: 'var(--ap-border-w) solid var(--ap-line)',
          padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {exam.title}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-muted)' }}>
              {answered}/{orderedQs.length} répondu{answered > 1 ? 's' : ''}
            </div>
          </div>

          {minutesLeft !== null && (
            <div style={{
              fontSize: 13, fontWeight: 800, color: 'var(--ap-muted)',
              background: 'var(--ap-paper-2)',
              padding: '4px 12px', borderRadius: "var(--ap-r-sm)", whiteSpace: 'nowrap',
            }}>
              {minutesLeft} min
            </div>
          )}

          <button
            onClick={() => { setChatOpen((o) => !o); setUnreadCount(0); }}
            title="Discussion avec le surveillant"
            style={{
              position: 'relative', width: 36, height: 36, borderRadius: '50%',
              border: 'var(--ap-border-w) solid var(--ap-line)',
              background: chatOpen ? 'var(--ap-brand-soft)' : 'var(--ap-paper)',
              color: chatOpen ? 'var(--ap-brand)' : 'var(--ap-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <MessageCircle size={17} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: "var(--ap-r-sm)",
                background: '#ff5a4d', color: '#fff', fontSize: 10, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
              }}>
                {unreadCount}
              </span>
            )}
          </button>

          <style>{`
            @keyframes pulse-danger { 0%,100%{opacity:1} 50%{opacity:.6} }
          `}</style>

          {/* Progress bar */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0,
            height: 3, background: 'var(--ap-brand)',
            width: `${(answered / orderedQs.length) * 100}%`,
            transition: 'width .3s',
          }} />
        </div>

        {/* Chat drawer: docked top-right, over the content */}
        {chatOpen && (
          <div style={{
            position: 'fixed', top: 66, right: 16, zIndex: 20, width: 320, maxWidth: 'calc(100vw - 32px)',
            background: 'var(--ap-card)', border: 'var(--ap-border-w) solid var(--ap-line)',
            borderRadius: 'var(--ap-r-lg)', boxShadow: '0 8px 24px rgba(0,0,0,.12)',
            display: 'flex', flexDirection: 'column', maxHeight: 420,
          }}>
            <div style={{ padding: '10px 14px', borderBottom: 'var(--ap-border-w) solid var(--ap-line)', fontWeight: 800, fontSize: 13 }}>
              💬 Discussion avec le surveillant
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {chatMessages.length === 0 ? (
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ap-muted)', margin: 0 }}>
                  Aucun message pour l'instant.
                </p>
              ) : chatMessages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    alignSelf: m.sender === 'participant' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%', padding: '8px 12px', borderRadius: 'var(--ap-r-sm)',
                    background: m.sender === 'participant' ? 'var(--ap-brand-soft)' : 'var(--ap-paper-2)',
                    color: 'var(--ap-ink)', fontSize: 13, fontWeight: 700,
                  }}
                >
                  {m.body}
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ap-muted)', marginTop: 2 }}>
                    {m.sender === 'participant' ? 'Vous' : 'Surveillant'} · {new Date(m.createdAt).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: 10, borderTop: 'var(--ap-border-w) solid var(--ap-line)', display: 'flex', gap: 8 }}>
              <input
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleSendChat(); }}
                placeholder="Votre message…"
                style={{
                  flex: 1, padding: '8px 10px', fontFamily: 'var(--ap-font-body)', fontWeight: 700, fontSize: 13,
                  color: 'var(--ap-ink)', background: 'var(--ap-paper-2)', border: 'var(--ap-border-w) solid var(--ap-line)',
                  borderRadius: 'var(--ap-r-sm)', outline: 'none',
                }}
              />
              <button
                onClick={() => void handleSendChat()}
                disabled={chatSending}
                style={{ padding: '8px 12px', borderRadius: "var(--ap-r-sm)", border: 'none', background: 'var(--ap-brand)', color: '#fff', fontFamily: 'var(--ap-font-body)', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
              >
                Envoyer
              </button>
            </div>
          </div>
        )}

        <div className="er-body">
        {/* Questions */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {orderedQs.map((q: { id: string; type: string; question: string; answers: string[]; correctAnswer: unknown }, idx: number) => {
            const displayAnswers = exam.shuffleAnswers
              ? getAnswerOrder(attempt.id, q.id, (q.answers ?? []).length).map((i: number) => ({ orig: i, text: q.answers[i] }))
              : (q.answers ?? []).map((t: string, i: number) => ({ orig: i, text: t }));

            const currentAnswer = answers[q.id];

            const isFlagged = flagged.has(q.id);

            return (
              <div
                key={q.id}
                ref={(el) => { questionRefs.current[q.id] = el; }}
                data-qid={q.id}
                style={{
                  background: 'var(--ap-card)', border: 'var(--ap-border-w) solid var(--ap-line)',
                  borderRadius: 'var(--ap-r-lg)', padding: '22px', marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'flex-start' }}>
                  <span style={{
                    width: 26, height: 26, borderRadius: 8, background: 'var(--ap-brand-soft)',
                    color: 'var(--ap-brand)', fontWeight: 800, fontSize: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {idx + 1}
                  </span>
                  <p style={{ flex: 1, fontWeight: 800, fontSize: 15, lineHeight: 1.4, margin: 0 }}>{q.question}</p>
                  <button
                    onClick={() => toggleFlag(q.id)}
                    title={isFlagged ? 'Retirer le marquage' : 'Marquer pour y revenir plus tard'}
                    style={{
                      flexShrink: 0, width: 30, height: 30, borderRadius: 8,
                      border: 'var(--ap-border-w) solid var(--ap-line)',
                      background: isFlagged ? '#fff8ec' : 'var(--ap-paper)',
                      color: isFlagged ? '#f4970a' : 'var(--ap-muted)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Flag size={15} fill={isFlagged ? '#f4970a' : 'none'} />
                  </button>
                </div>

                {q.type === 'true-false' && (
                  <div>
                    {[{ val: 'true', label: 'Vrai' }, { val: 'false', label: 'Faux' }].map(({ val, label }) => (
                      <div
                        key={val}
                        className={`er-opt${currentAnswer === val ? ' sel' : ''}`}
                        onClick={() => setAnswer(q.id, val)}
                      >
                        <div className="er-dot" />
                        {label}
                      </div>
                    ))}
                  </div>
                )}

                {(q.type === 'single-choice' || q.type === 'multiple-choice') && (
                  <div>
                    {displayAnswers.map(({ orig, text }: { orig: number; text: string }) => (
                      <div
                        key={orig}
                        className={`er-opt${currentAnswer === orig ? ' sel' : ''}`}
                        onClick={() => setAnswer(q.id, orig)}
                      >
                        <div className="er-dot" />
                        {text}
                      </div>
                    ))}
                  </div>
                )}

                {q.type === 'short-answer' && (
                  <input
                    className="ap-input"
                    style={{
                      background: currentAnswer ? 'var(--ap-brand-soft)' : 'var(--ap-paper)',
                      borderColor: currentAnswer ? 'var(--ap-brand)' : 'var(--ap-line)',
                    }}
                    placeholder="Votre réponse…"
                    value={typeof currentAnswer === 'string' ? currentAnswer : ''}
                    onChange={(e) => setAnswer(q.id, e.target.value || null)}
                  />
                )}
              </div>
            );
          })}

          {/* Gentle time nudge when < 5 min remaining */}
          {minutesLeft !== null && minutesLeft <= 5 && minutesLeft > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontSize: 12, fontWeight: 700,
              color: 'var(--ap-muted)', padding: '8px 0', marginBottom: 8,
            }}>
              <MaterialSymbol name="hourglass_top" size={14} />
              Pensez à soumettre bientôt
            </div>
          )}

          {/* Submit button */}
          {!confirmSubmit ? (
            <button
              className="ap-btn ap-btn--pill"
              onClick={() => setConfirmSubmit(true)}
              style={{
                width: '100%',
                background: answered === orderedQs.length ? undefined : 'var(--ap-line-2)',
                boxShadow: answered === orderedQs.length ? undefined : 'none',
              }}
            >
              Soumettre l'examen ({answered}/{orderedQs.length} répondu{answered > 1 ? 's' : ''})
            </button>
          ) : (
            <div className="ap-card" style={{ padding: 20, textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 600, fontSize: 16, marginBottom: 6 }}>
                Confirmer la soumission ?
              </p>
              {answered < orderedQs.length && (
                <p style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  fontSize: 13, fontWeight: 700, color: 'var(--ap-flash-deep)', marginBottom: 14,
                }}>
                  <MaterialSymbol name="warning" size={16} />
                  {orderedQs.length - answered} question{orderedQs.length - answered > 1 ? 's' : ''} sans réponse
                </p>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="ap-btn ap-btn--ghost"
                  onClick={() => setConfirmSubmit(false)}
                  style={{ flex: 1 }}
                >
                  Continuer
                </button>
                <button
                  className="ap-btn"
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  {submitting ? '…' : <><MaterialSymbol name="check_circle" size={16} />Soumettre définitivement</>}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: always-visible question navigator, sticky on scroll */}
        <aside className="er-sidebar" style={{
          background: 'var(--ap-card)', border: 'var(--ap-border-w) solid var(--ap-line)',
          borderRadius: 'var(--ap-r-lg)', padding: 16,
        }}>
          <h3 style={{
            fontFamily: 'var(--ap-font-display)', fontWeight: 700, fontSize: 14, margin: '0 0 12px',
            display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ap-ink)',
          }}>
            <MapIcon size={15} /> Plan des questions
          </h3>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))',
            gap: 8, marginBottom: 16,
          }}>
            {orderedQs.map((q: { id: string }, idx: number) => {
              const a = answers[q.id];
              const isAnswered = a !== null && a !== undefined && a !== '';
              const isFlagged = flagged.has(q.id);
              const isCurrent = currentQId === q.id;
              return (
                <div
                  key={q.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => scrollToQuestion(q.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scrollToQuestion(q.id); } }}
                  style={{
                    position: 'relative', padding: '10px 0', borderRadius: 'var(--ap-r-sm)', textAlign: 'center',
                    border: isCurrent
                      ? '2px solid #15c08a'
                      : `var(--ap-border-w) solid ${isAnswered ? 'var(--ap-brand)' : 'var(--ap-line)'}`,
                    background: isAnswered ? 'var(--ap-brand-soft)' : 'var(--ap-paper)',
                    color: isAnswered ? 'var(--ap-brand)' : 'var(--ap-ink)',
                    fontWeight: 800, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  {idx + 1}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFlag(q.id); }}
                    aria-label={isFlagged ? 'Retirer le marquage' : 'Marquer cette question'}
                    style={{
                      position: 'absolute', top: -7, right: -7, width: 18, height: 18, borderRadius: '50%',
                      border: isFlagged ? 'none' : 'var(--ap-border-w) solid var(--ap-line)',
                      background: isFlagged ? '#f4970a' : 'var(--ap-card)',
                      color: isFlagged ? '#fff' : 'var(--ap-muted)', padding: 0, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Flag size={10} fill={isFlagged ? '#fff' : 'none'} />
                  </button>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--ap-muted)' }}>
            <LegendItem swatchBg="var(--ap-brand-soft)" swatchBorder="var(--ap-brand)" label="Répondu" />
            <LegendItem swatchBg="var(--ap-paper)" swatchBorder="var(--ap-line)" label="Non répondu" />
            <LegendItem dotColor="#f4970a" label="Marqué" />
            <LegendItem swatchBorder="#15c08a" label="Question actuelle" />
          </div>
        </aside>
        </div>
      </div>
    );
  }

  return null;
}

/* ── Shared sub-components ─────────────────────────────────────── */

function Screen({ children, maxWidth = 400 }: { children: React.ReactNode; maxWidth?: number }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

function BigIcon({ name, color }: { name: string; color?: string }) {
  return (
    <div style={{ marginBottom: 8, color: color ?? 'var(--ap-brand)' }}>
      <MaterialSymbol name={name} size={56} />
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <h1 style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 700, fontSize: 24, textAlign: 'center', margin: 0 }}>
      {children}
    </h1>
  );
}

function Sub({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ap-muted)', textAlign: 'center', ...style }}>
      {children}
    </p>
  );
}

function LegendItem({ swatchBg, swatchBorder, dotColor, label }: {
  swatchBg?: string; swatchBorder?: string; dotColor?: string; label: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {dotColor ? (
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
      ) : (
        <span style={{
          width: 14, height: 14, borderRadius: 4, flexShrink: 0,
          background: swatchBg ?? 'transparent',
          border: `2px solid ${swatchBorder ?? 'var(--ap-line)'}`,
        }} />
      )}
      <span>{label}</span>
    </div>
  );
}

function Info({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontSize: 13, fontWeight: 800, color: 'var(--ap-ink)',
      background: 'var(--ap-paper)', border: 'var(--ap-border-w) solid var(--ap-line)',
      borderRadius: "var(--ap-r-sm)", padding: '6px 14px',
    }}>
      <MaterialSymbol name={icon} size={16} /><span>{label}</span>
    </div>
  );
}

function ExamRoomSkeleton() {
  return (
    <div style={{
      width: '100%', padding: 24, background: 'var(--ap-card)',
      border: 'var(--ap-border-w) solid var(--ap-line)', borderRadius: 'var(--ap-r-lg)',
    }}>
      <Skeleton className="mx-auto mb-5 h-12 w-12 rounded-full" />
      <Skeleton className="mx-auto mb-3 h-7 w-3/5" />
      <Skeleton className="mx-auto mb-8 h-4 w-4/5" />
      <Skeleton className="mb-3 h-12 w-full" />
      <Skeleton className="mb-5 h-12 w-full" />
      <Skeleton className="h-12 w-full rounded-full" />
    </div>
  );
}

function ViewResultsBtn({ retained, exam, navigate }: {
  retained: Attempt; exam: Exam; navigate: ReturnType<typeof useNavigate>;
}) {
  if (exam.showResultsPolicy === 'never') return null;
  return (
    <button className="ap-btn ap-btn--pill" style={{ width: '100%', marginTop: 20 }} onClick={() => navigate(`/exam/${retained.id}/results`)}>
      Voir mes résultats →
    </button>
  );
}
