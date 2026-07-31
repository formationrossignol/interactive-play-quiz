import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { parseFunctionsError } from '@/lib/functionsError';
import { getParticipant } from '@/lib/examParticipant';
import { isAnswerCorrect } from '@/lib/examStorage';
import { Skeleton } from '@/components/ui/skeleton';
import { MaterialSymbol } from '@/components/MaterialSymbol';

interface AttemptView {
  timeUsedSeconds: number;
  percentage: number | null;
  passed: boolean | null;
  answers: Record<string, number | string | null>;
  questionOrder: string[];
}

interface ExamView {
  title: string;
  passingScore: number;
  showDetailPolicy: string;
  showResultsPolicy: string;
}

type QuestionView = { id: string; type: string; question: string; answers?: string[]; skills?: string[] };
type CorrectionView = { id: string; correctAnswer: unknown };

interface SkillMastery {
  skill: string;
  correct: number;
  total: number;
}

/** Per-attempt skill mastery (analytics phase C, apprenant persona) — no
 *  cross-attempt aggregation, so no identity-linking problem: everything
 *  needed is already on the attempt the learner is looking at. */
function computeSkillMastery(
  orderedQs: QuestionView[],
  answers: Record<string, number | string | null>,
  correctionById: Map<string, CorrectionView>,
): SkillMastery[] {
  const bySkill = new Map<string, SkillMastery>();
  for (const q of orderedQs) {
    if (!q.skills?.length) continue;
    const given = answers[q.id];
    const correctAnswer = correctionById.get(q.id)?.correctAnswer;
    const isCorrect = given !== null && given !== undefined && given !== ''
      && isAnswerCorrect(given, { type: q.type, correctAnswer });
    for (const skill of q.skills) {
      const acc = bySkill.get(skill) ?? { skill, correct: 0, total: 0 };
      acc.total += 1;
      if (isCorrect) acc.correct += 1;
      bySkill.set(skill, acc);
    }
  }
  return [...bySkill.values()].sort((a, b) => (a.correct / a.total) - (b.correct / b.total));
}

export default function ExamResults() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState<AttemptView | null>(null);
  const [exam, setExam] = useState<ExamView | null>(null);
  const [questions, setQuestions] = useState<QuestionView[] | null>(null);
  const [correction, setCorrection] = useState<CorrectionView[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!attemptId) { setError('Tentative introuvable'); return; }
    const participant = getParticipant();
    if (!participant) { setError('Tentative introuvable'); return; }
    let cancelled = false;
    (async () => {
      const { data, error: invokeError } = await supabase.functions.invoke('get-attempt-result', {
        body: { attemptId, participantId: participant.id },
      });
      if (cancelled) return;
      if (invokeError) {
        const { body } = await parseFunctionsError(invokeError);
        if (cancelled) return;
        if (body.error === 'results_not_available') {
          setError('Les résultats ne sont pas disponibles pour cet examen.');
        } else if (body.error === 'results_after_close') {
          setError(`Résultats disponibles après le ${new Date(body.closeAt as string).toLocaleString('fr')}`);
        } else {
          setError('Tentative introuvable');
        }
        return;
      }
      const result = data as {
        attempt: { time_used_seconds: number; percentage: number | null; passed: boolean | null; answers: Record<string, number | string | null>; question_order: string[] };
        exam: ExamView;
        questionsPublic: QuestionView[];
        correction?: CorrectionView[];
      };
      setAttempt({
        timeUsedSeconds: result.attempt.time_used_seconds,
        percentage: result.attempt.percentage,
        passed: result.attempt.passed,
        answers: result.attempt.answers,
        questionOrder: result.attempt.question_order ?? [],
      });
      setExam(result.exam);
      setQuestions(result.questionsPublic ?? []);
      setCorrection(result.correction ?? null);
    })();
    return () => { cancelled = true; };
  }, [attemptId]);

  if (error) return (
    <div style={wrapSt}>
      <div style={{ marginBottom: 16, color: 'var(--ap-muted)' }}><MaterialSymbol name="lock" size={48} /></div>
      <h1 style={titleSt}>{error}</h1>
    </div>
  );

  if (!attempt || !exam || !questions) return (
    <ExamResultsSkeleton />
  );

  const passed = attempt.passed;
  const pct = attempt.percentage ?? 0;
  const showAnswers = exam.showDetailPolicy !== 'score-only';
  const showCorrection = exam.showDetailPolicy === 'score-correction' && correction;
  const correctionById = new Map((correction ?? []).map((c) => [c.id, c]));

  const orderedQs = attempt.questionOrder
    .map((id) => questions.find((q) => q.id === id))
    .filter(Boolean) as QuestionView[];
  const skillMastery = showCorrection ? computeSkillMastery(orderedQs, attempt.answers, correctionById) : [];

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{
        background: 'var(--ap-card)', borderBottom: 'var(--ap-border-w) solid var(--ap-line)',
        padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            flexShrink: 0, width: 32, height: 32, borderRadius: '50%', border: 'none',
            background: 'transparent', cursor: 'pointer', color: 'var(--ap-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        ><MaterialSymbol name="arrow_back" size={20} /></button>
        <span style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 600, fontSize: 18 }}>
          {exam.title} : Résultats
        </span>
      </div>

      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 16px' }}>
        {/* Score card */}
        <div className="ap-card" style={{
          background: passed ? 'var(--ap-pres-soft)' : 'var(--ap-quiz-soft)',
          borderColor: passed ? 'var(--ap-pres)' : 'var(--ap-quiz)',
          padding: '28px 24px', textAlign: 'center', marginBottom: 24,
        }}>
          <div style={{ marginBottom: 12, color: passed ? 'var(--ap-pres)' : 'var(--ap-quiz)' }}>
            <MaterialSymbol name={passed ? 'celebration' : 'menu_book'} size={44} />
          </div>
          <div style={{
            fontFamily: 'var(--ap-font-display)', fontWeight: 800, fontSize: 52,
            color: passed ? 'var(--ap-pres)' : 'var(--ap-quiz)', lineHeight: 1, marginBottom: 8,
          }}>
            {pct}%
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontWeight: 800, fontSize: 18, color: passed ? 'var(--ap-pres)' : 'var(--ap-quiz)', marginBottom: 16,
          }}>
            <MaterialSymbol name={passed ? 'check_circle' : 'cancel'} size={20} />
            {passed ? 'Réussi' : 'Non réussi'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
            <Stat label="Seuil" value={`${exam.passingScore}%`} />
            <Stat label="Temps" value={`${Math.round(attempt.timeUsedSeconds / 60)} min`} />
            <Stat label="Répondu" value={`${Object.keys(attempt.answers).length}/${questions.length}`} />
          </div>
        </div>

        {skillMastery.length > 0 && (
          <div className="ap-card" style={{ padding: '20px 24px', marginBottom: 24 }}>
            <h3 style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 600, fontSize: 15, marginBottom: 14 }}>
              Vos compétences
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {skillMastery.map((sm) => {
                const mastered = sm.correct === sm.total;
                return (
                  <span
                    key={sm.skill}
                    title={`${sm.correct}/${sm.total} bonne${sm.correct > 1 ? 's' : ''} réponse${sm.correct > 1 ? 's' : ''}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '7px 12px', borderRadius: 'var(--ap-r-sm)',
                      border: `1px solid ${mastered ? 'var(--ap-pres)' : 'var(--ap-quiz)'}`,
                      background: mastered ? 'var(--ap-pres-soft)' : 'var(--ap-quiz-soft)',
                      color: mastered ? 'var(--ap-pres-deep)' : 'var(--ap-quiz-deep)',
                      fontWeight: 700, fontSize: 13,
                    }}
                  >
                    <MaterialSymbol name={mastered ? 'check_circle' : 'trending_up'} size={15} />
                    {sm.skill}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {showAnswers && (
          <div className="ap-card" style={{ overflowX: 'auto', padding: 0 }}>
            <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--ap-paper)' }}>
                  <ResultHeader style={{ width: 64 }}>#</ResultHeader>
                  <ResultHeader>Question</ResultHeader>
                  <ResultHeader>Votre réponse</ResultHeader>
                  {showCorrection && <ResultHeader>Bonne réponse</ResultHeader>}
                  {showCorrection && <ResultHeader style={{ width: 112 }}>Statut</ResultHeader>}
                </tr>
              </thead>
              <tbody>
                {orderedQs.map((q, idx) => {
                  const given = attempt.answers[q.id];
                  const correctAnswer = correctionById.get(q.id)?.correctAnswer;
                  const isCorrect = showCorrection ? checkCorrect(q, given, correctAnswer) : null;
                  return (
                    <tr key={q.id} style={{ borderTop: '1px solid var(--ap-line)' }}>
                      <ResultCell style={{ color: 'var(--ap-muted)', fontWeight: 800 }}>Q{idx + 1}</ResultCell>
                      <ResultCell style={{ fontWeight: 800, minWidth: 240 }}>{q.question}</ResultCell>
                      <ResultCell>
                        <AnswerPill tone={isCorrect === true ? 'success' : isCorrect === false ? 'error' : 'neutral'}>
                          {formatAnswer(q, given)}
                        </AnswerPill>
                      </ResultCell>
                      {showCorrection && (
                        <ResultCell>
                          <AnswerPill tone="success">{formatCorrect(q, correctAnswer)}</AnswerPill>
                        </ResultCell>
                      )}
                      {showCorrection && (
                        <ResultCell>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            color: isCorrect ? 'var(--ap-pres-deep)' : 'var(--ap-quiz-deep)', fontWeight: 800, fontSize: 13,
                          }}>
                            <MaterialSymbol name={isCorrect ? 'check' : 'close'} size={15} />
                            {isCorrect ? 'Correct' : 'Incorrect'}
                          </span>
                        </ResultCell>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultHeader({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th style={{
      padding: '14px 16px', fontSize: 11, fontWeight: 800, letterSpacing: '.06em',
      textTransform: 'uppercase', color: 'var(--ap-muted)', ...style,
    }}>
      {children}
    </th>
  );
}

function ResultCell({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: '14px 16px', verticalAlign: 'top', fontSize: 14, ...style }}>{children}</td>;
}

function AnswerPill({ children, tone }: { children: React.ReactNode; tone: 'success' | 'error' | 'neutral' }) {
  const tones = {
    success: { background: 'var(--ap-pres-soft)', color: 'var(--ap-pres-deep)', border: 'var(--ap-pres)' },
    error: { background: 'var(--ap-quiz-soft)', color: 'var(--ap-quiz-deep)', border: 'var(--ap-quiz)' },
    neutral: { background: 'var(--ap-paper)', color: 'var(--ap-ink)', border: 'var(--ap-line)' },
  };
  const colors = tones[tone];
  return (
    <span style={{
      display: 'inline-block', padding: '7px 10px', borderRadius: 'var(--ap-r-sm)',
      border: `1px solid ${colors.border}`, background: colors.background,
      color: colors.color, fontWeight: 700, lineHeight: 1.35,
    }}>
      {children}
    </span>
  );
}

function ExamResultsSkeleton() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ height: 60, borderBottom: 'var(--ap-border-w) solid var(--ap-line)', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Skeleton className="h-7 w-7 rounded-full" />
        <Skeleton className="h-5 w-64" />
      </div>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 16px' }}>
        <Skeleton className="h-64 w-full rounded-2xl mb-6" />
        <div style={{ border: 'var(--ap-border-w) solid var(--ap-line)', borderRadius: 'var(--ap-r-lg)', padding: 16 }}>
          <Skeleton className="h-10 w-full mb-3" />
          {[0, 1, 2, 3].map((row) => <Skeleton key={row} className="h-16 w-full mb-2" />)}
        </div>
      </div>
    </div>
  );
}

function checkCorrect(q: { type: string }, given: unknown, correctAnswer: unknown): boolean {
  if (given === null || given === undefined || given === '') return false;
  return isAnswerCorrect(given, { type: q.type, correctAnswer });
}

function formatAnswer(q: { type: string; answers?: string[] }, given: number | string | null | undefined): string {
  if (given === null || given === undefined || given === '') return '(sans réponse)';
  if (q.type === 'true-false') return given === 'true' ? 'Vrai' : 'Faux';
  if (q.type === 'short-answer') return String(given);
  if (typeof given === 'number' && q.answers) return q.answers[given] ?? String(given);
  return String(given);
}

function formatCorrect(q: { type: string; answers?: string[] }, correctAnswer: unknown): string {
  if (q.type === 'true-false') {
    if (correctAnswer === 'true') return 'Vrai';
    if (correctAnswer === 'false') return 'Faux';
    return String(correctAnswer);
  }
  if (q.type === 'short-answer') return String(correctAnswer);
  if (typeof correctAnswer === 'number' && q.answers) return q.answers[correctAnswer] ?? String(correctAnswer);
  return String(correctAnswer);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
    </div>
  );
}

const wrapSt: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  padding: 24, gap: 12,
};

const titleSt: React.CSSProperties = {
  fontFamily: 'var(--ap-font-display)', fontWeight: 700, fontSize: 22, textAlign: 'center',
};
