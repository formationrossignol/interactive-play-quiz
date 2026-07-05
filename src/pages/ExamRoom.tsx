import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getExamByJoinCode, computeExamStatus,
  startAttempt, saveAnswers, submitAttempt,
  getActiveAttempt, getAttemptsForParticipant,
  getRetainedAttempt,
  type Exam, type Attempt,
} from '@/lib/examStorage';
import { getQuizById } from '@/lib/quizStorage';

const PART_KEY = 'exam_participant';

interface Participant { id: string; name: string; email: string; }

function genId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getParticipant(): Participant | null {
  try { return JSON.parse(sessionStorage.getItem(PART_KEY) ?? 'null'); } catch { return null; }
}

function setParticipant(p: Participant) {
  sessionStorage.setItem(PART_KEY, JSON.stringify(p));
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

type Phase = 'loading' | 'not-found' | 'not-open' | 'identify' | 'ready' | 'taking' | 'submitted' | 'exhausted';

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

  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const quiz = exam ? getQuizById(exam.quizId) : null;

  /* ── Load exam ────────────────────────────────────────────────── */
  useEffect(() => {
    if (!joinCode) { setPhase('not-found'); return; }
    const e = getExamByJoinCode(joinCode);
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
      checkExistingAttempt(e, part);
    } else {
      setPhase('identify');
    }
  }, [joinCode]);

  function checkExistingAttempt(e: Exam, part: Participant) {
    const active = getActiveAttempt(e.id, part.id);
    if (active) {
      setAttempt(active);
      setAnswers(active.answers ?? {});
      elapsedRef.current = active.timeUsedSeconds;
      setElapsed(active.timeUsedSeconds);
      setPhase('taking');
      return;
    }
    const done = getAttemptsForParticipant(e.id, part.id).filter(
      (a) => a.status !== 'in-progress' && a.status !== 'cancelled'
    );
    if (done.length >= e.maxAttempts) { setPhase('exhausted'); return; }
    setPhase('ready');
  }

  /* ── Start exam ───────────────────────────────────────────────── */
  const handleStart = () => {
    if (!exam || !participant) return;
    try {
      const att = startAttempt(exam, participant.id, participant.name, participant.email);
      setAttempt(att);
      setAnswers(att.answers ?? {});
      elapsedRef.current = att.timeUsedSeconds;
      setElapsed(att.timeUsedSeconds);
      setPhase('taking');
    } catch (e) {
      setPhase('exhausted');
    }
  };

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
      saveAnswers(attempt.id, answersRef.current, elapsedRef.current);
    }, 30000);
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current); };
  }, [phase, attempt?.id]);

  /* ── Auto-submit ──────────────────────────────────────────────── */
  const handleAutoSubmit = useCallback(() => {
    if (!attempt) return;
    submitAttempt(attempt.id, answersRef.current, elapsedRef.current, 'auto');
    setPhase('submitted');
  }, [attempt]);

  /* ── Manual submit ────────────────────────────────────────────── */
  const handleSubmit = () => {
    if (!attempt) return;
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    const result = submitAttempt(attempt.id, answersRef.current, elapsedRef.current, 'manual');
    setAttempt(result);
    setPhase('submitted');
    setSubmitting(false);
    setConfirmSubmit(false);
  };

  /* ── Answer change ────────────────────────────────────────────── */
  const setAnswer = (qId: string, val: number | string | null) => {
    setAnswers((prev) => ({ ...prev, [qId]: val }));
  };

  /* ── Identity form ────────────────────────────────────────────── */
  const handleIdentify = () => {
    if (!nameInput.trim()) { setIdentError('Nom requis'); return; }
    const part: Participant = {
      id: genId(),
      name: nameInput.trim(),
      email: emailInput.trim(),
    };
    setParticipant(part);
    setParticipantState(part);
    checkExistingAttempt(exam!, part);
  };

  /* ── Render helpers ───────────────────────────────────────────── */
  if (phase === 'loading') return <Screen><Spinner /></Screen>;

  if (phase === 'not-found') return (
    <Screen>
      <BigIcon>🔍</BigIcon>
      <Title>Examen introuvable</Title>
      <Sub>Vérifiez le code d'accès et réessayez.</Sub>
    </Screen>
  );

  if (phase === 'not-open') {
    const status = exam ? computeExamStatus(exam) : null;
    return (
      <Screen>
        <BigIcon>{status === 'scheduled' ? '⏳' : '🔒'}</BigIcon>
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
      <BigIcon>✅</BigIcon>
      <Title>Tentatives épuisées</Title>
      <Sub>Vous avez atteint le nombre maximum de tentatives pour cet examen.</Sub>
      {exam && participant && (
        <ViewResultsBtn examId={exam.id} participantId={participant.id} exam={exam} navigate={navigate} />
      )}
    </Screen>
  );

  if (phase === 'identify') return (
    <Screen maxWidth={420}>
      <BigIcon>✏️</BigIcon>
      <Title>{exam?.title}</Title>
      {exam?.description && <Sub style={{ marginBottom: 20 }}>{exam.description}</Sub>}
      <div style={{ width: '100%', textAlign: 'left' }}>
        <label style={labelSt}>Prénom et nom *</label>
        <input
          style={inputSt}
          placeholder="Marie Dupont"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleIdentify(); }}
        />
        <label style={{ ...labelSt, marginTop: 14 }}>Email (optionnel)</label>
        <input
          style={inputSt}
          type="email"
          placeholder="marie@exemple.fr"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleIdentify(); }}
        />
        {identError && <p style={{ color: '#ff5a4d', fontSize: 13, fontWeight: 800, marginTop: 8 }}>{identError}</p>}
        <button style={primaryBtnSt} onClick={handleIdentify}>Continuer →</button>
      </div>
    </Screen>
  );

  if (phase === 'ready' && exam && quiz) return (
    <Screen maxWidth={520}>
      <div style={{
        background: 'var(--ap-card)', border: '2px solid var(--ap-line)',
        borderRadius: 'var(--ap-r-lg)', padding: '28px 28px', width: '100%', textAlign: 'center',
      }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>📝</div>
        <h1 style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 700, fontSize: 22, marginBottom: 8 }}>
          {exam.title}
        </h1>
        {exam.description && (
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ap-muted)', marginBottom: 20 }}>
            {exam.description}
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
          <Info icon="❓" label={`${quiz.questions.length} questions`} />
          {exam.durationMinutes && <Info icon="⏱️" label={`${exam.durationMinutes} min`} />}
          <Info icon="🔄" label={`${exam.maxAttempts} tentative${exam.maxAttempts > 1 ? 's' : ''}`} />
          <Info icon="🏆" label={`Seuil : ${exam.passingScore}%`} />
        </div>
        <div style={{
          background: 'var(--ap-paper)', borderRadius: 'var(--ap-r-sm)',
          padding: '12px 16px', marginBottom: 20, fontSize: 12, fontWeight: 700,
          color: 'var(--ap-muted)', textAlign: 'left', lineHeight: 1.8,
        }}>
          📌 Vos réponses sont sauvegardées automatiquement toutes les 30 secondes.
          {exam.durationMinutes && ` L'examen se soumet automatiquement à la fin du temps.`}
        </div>
        <button style={primaryBtnSt} onClick={handleStart}>Commencer l'examen →</button>
      </div>
    </Screen>
  );

  if (phase === 'submitted') {
    const retained = exam && participant ? getRetainedAttempt(exam, participant.id) : null;
    const showResults = exam?.showResultsPolicy === 'immediately';
    return (
      <Screen>
        <BigIcon>🎉</BigIcon>
        <Title>Examen soumis !</Title>
        {showResults && retained?.percentage !== null ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 52, fontFamily: 'var(--ap-font-display)', fontWeight: 800,
              color: retained?.passed ? '#15c08a' : '#ff5a4d', marginBottom: 8,
            }}>
              {retained?.percentage}%
            </div>
            <div style={{
              fontSize: 16, fontWeight: 800,
              color: retained?.passed ? '#15c08a' : '#ff5a4d', marginBottom: 16,
            }}>
              {retained?.passed ? '✅ Réussi' : '❌ Non réussi'}
            </div>
            {exam?.showDetailPolicy !== 'score-only' && retained && (
              <button
                style={{ ...primaryBtnSt, marginTop: 8 }}
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
  if (phase === 'taking' && attempt && quiz && exam) {
    const orderedQs = attempt.questionOrder
      .map((id) => quiz.questions.find((q: { id: string }) => q.id === id))
      .filter(Boolean);
    const answered = orderedQs.filter((q: { id: string }) => answers[q.id] !== null && answers[q.id] !== undefined).length;
    const minutesLeft = secondsLeft !== null ? Math.ceil(secondsLeft / 60) : null;

    return (
      <div style={{ minHeight: '100vh', background: 'var(--ap-paper)', paddingBottom: 100 }}>
        <style>{`
          .er-opt { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: 2px solid var(--ap-line); border-radius: var(--ap-r-sm); cursor: pointer; transition: border-color .15s, background .15s; margin-bottom: 8px; font-weight: 700; font-size: 14px; color: var(--ap-ink); background: var(--ap-paper); }
          .er-opt:hover { border-color: var(--ap-brand); background: var(--ap-brand-soft); }
          .er-opt.sel { border-color: var(--ap-brand); background: var(--ap-brand-soft); }
          .er-dot { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--ap-line); flex-shrink: 0; transition: background .15s, border-color .15s; }
          .er-opt.sel .er-dot { background: var(--ap-brand); border-color: var(--ap-brand); }
        `}</style>

        {/* Topbar */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: 'var(--ap-card)', borderBottom: '2px solid var(--ap-line)',
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
              padding: '4px 12px', borderRadius: 999, whiteSpace: 'nowrap',
            }}>
              {minutesLeft} min
            </div>
          )}


          {/* Progress bar */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0,
            height: 3, background: 'var(--ap-brand)',
            width: `${(answered / orderedQs.length) * 100}%`,
            transition: 'width .3s',
          }} />
        </div>

        {/* Questions */}
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px' }}>
          {orderedQs.map((q: { id: string; type: string; question: string; answers: string[]; correctAnswer: unknown }, idx: number) => {
            const displayAnswers = exam.shuffleAnswers
              ? getAnswerOrder(attempt.id, q.id, (q.answers ?? []).length).map((i: number) => ({ orig: i, text: q.answers[i] }))
              : (q.answers ?? []).map((t: string, i: number) => ({ orig: i, text: t }));

            const currentAnswer = answers[q.id];

            return (
              <div key={q.id} style={{
                background: 'var(--ap-card)', border: '2px solid var(--ap-line)',
                borderRadius: 'var(--ap-r-lg)', padding: '22px', marginBottom: 16,
              }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <span style={{
                    width: 26, height: 26, borderRadius: 8, background: 'var(--ap-brand-soft)',
                    color: 'var(--ap-brand)', fontWeight: 800, fontSize: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {idx + 1}
                  </span>
                  <p style={{ fontWeight: 800, fontSize: 15, lineHeight: 1.4, margin: 0 }}>{q.question}</p>
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
                    style={{
                      ...inputSt,
                      marginBottom: 0,
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
              textAlign: 'center', fontSize: 12, fontWeight: 700,
              color: 'var(--ap-muted)', padding: '8px 0', marginBottom: 8,
            }}>
              ⏳ Pensez à soumettre bientôt
            </div>
          )}

          {/* Submit button */}
          {!confirmSubmit ? (
            <button
              onClick={() => setConfirmSubmit(true)}
              style={{
                width: '100%', padding: '16px 0', borderRadius: 999, border: 'none',
                background: answered === orderedQs.length ? 'var(--ap-brand)' : 'var(--ap-line-2)',
                color: '#fff', fontFamily: 'var(--ap-font-body)', fontWeight: 800, fontSize: 16,
                cursor: 'pointer', boxShadow: answered === orderedQs.length ? '0 4px 0 var(--ap-brand-deep)' : 'none',
              }}
            >
              Soumettre l'examen ({answered}/{orderedQs.length} répondu{answered > 1 ? 's' : ''})
            </button>
          ) : (
            <div style={{
              background: 'var(--ap-card)', border: '2px solid var(--ap-line)',
              borderRadius: 'var(--ap-r-lg)', padding: 20, textAlign: 'center',
            }}>
              <p style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 600, fontSize: 16, marginBottom: 6 }}>
                Confirmer la soumission ?
              </p>
              {answered < orderedQs.length && (
                <p style={{ fontSize: 13, fontWeight: 700, color: '#f4970a', marginBottom: 14 }}>
                  ⚠️ {orderedQs.length - answered} question{orderedQs.length - answered > 1 ? 's' : ''} sans réponse
                </p>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setConfirmSubmit(false)}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 999, border: '2px solid var(--ap-line)', background: 'var(--ap-paper-2)', fontFamily: 'var(--ap-font-body)', fontWeight: 800, fontSize: 14, cursor: 'pointer', color: 'var(--ap-ink)' }}
                >
                  Continuer
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{ flex: 2, padding: '12px 0', borderRadius: 999, border: 'none', background: 'var(--ap-brand)', color: '#fff', fontFamily: 'var(--ap-font-body)', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
                >
                  {submitting ? '…' : '✅ Soumettre définitivement'}
                </button>
              </div>
            </div>
          )}
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
      minHeight: '100vh', background: 'var(--ap-paper)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

function BigIcon({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 8 }}>{children}</div>;
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

function Info({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontSize: 13, fontWeight: 800, color: 'var(--ap-ink)',
      background: 'var(--ap-paper)', border: '2px solid var(--ap-line)',
      borderRadius: 999, padding: '6px 14px',
    }}>
      <span>{icon}</span><span>{label}</span>
    </div>
  );
}

function Spinner() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" style={{ animation: 'spin .9s linear infinite' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle cx="20" cy="20" r="16" fill="none" stroke="var(--ap-line-2)" strokeWidth="4" />
      <circle cx="20" cy="20" r="16" fill="none" stroke="var(--ap-brand)" strokeWidth="4"
        strokeDasharray="80" strokeDashoffset="60" strokeLinecap="round" />
    </svg>
  );
}

function ViewResultsBtn({ examId, participantId, exam, navigate }: {
  examId: string; participantId: string; exam: Exam; navigate: ReturnType<typeof useNavigate>;
}) {
  const att = getRetainedAttempt(exam, participantId);
  if (!att || exam.showResultsPolicy === 'never') return null;
  return (
    <button style={primaryBtnSt} onClick={() => navigate(`/exam/${att.id}/results`)}>
      Voir mes résultats →
    </button>
  );
}

const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 800, letterSpacing: '.08em',
  textTransform: 'uppercase', color: 'var(--ap-muted)', marginBottom: 6,
};

const inputSt: React.CSSProperties = {
  width: '100%', padding: '11px 14px', fontFamily: 'var(--ap-font-body)',
  fontWeight: 700, fontSize: 14, color: 'var(--ap-ink)',
  background: 'var(--ap-paper-2)', border: '2px solid var(--ap-line)',
  borderRadius: 'var(--ap-r-sm)', outline: 'none',
  boxSizing: 'border-box', marginBottom: 4,
};

const primaryBtnSt: React.CSSProperties = {
  width: '100%', marginTop: 20, padding: '14px 0', borderRadius: 999,
  border: 'none', background: 'var(--ap-brand)', color: '#fff',
  fontFamily: 'var(--ap-font-body)', fontWeight: 800, fontSize: 15,
  cursor: 'pointer', boxShadow: '0 4px 0 var(--ap-brand-deep)',
};
