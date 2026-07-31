import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { parseFunctionsError } from '@/lib/functionsError';
import { getParticipant } from '@/lib/examParticipant';
import { isAnswerCorrect } from '@/lib/examStorage';
import { Skeleton } from '@/components/ui/skeleton';

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

type QuestionView = { id: string; type: string; question: string; answers?: string[] };
type CorrectionView = { id: string; correctAnswer: unknown };

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
      <div style={{ fontSize: 52, marginBottom: 16 }}>🔒</div>
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

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{
        background: 'var(--ap-card)', borderBottom: 'var(--ap-border-w) solid var(--ap-line)',
        padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ap-muted)', fontSize: 20, padding: 4 }}
        >←</button>
        <span style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 600, fontSize: 18 }}>
          {exam.title} : Résultats
        </span>
      </div>

      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 16px' }}>
        {/* Score card */}
        <div style={{
          background: passed ? 'linear-gradient(135deg, #e8faf3, #d0f4e6)' : 'linear-gradient(135deg, #fff3f0, #ffe5e2)',
          border: `2px solid ${passed ? '#4dd9a0' : '#ff9e96'}`,
          borderRadius: 'var(--ap-r-lg)', padding: '28px 24px', textAlign: 'center', marginBottom: 24,
        }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>{passed ? '🎉' : '📚'}</div>
          <div style={{
            fontFamily: 'var(--ap-font-display)', fontWeight: 800, fontSize: 52,
            color: passed ? '#15c08a' : '#ff5a4d', lineHeight: 1, marginBottom: 8,
          }}>
            {pct}%
          </div>
          <div style={{ fontWeight: 800, fontSize: 18, color: passed ? '#15c08a' : '#ff5a4d', marginBottom: 16 }}>
            {passed ? '✅ Réussi' : '❌ Non réussi'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
            <Stat label="Seuil" value={`${exam.passingScore}%`} />
            <Stat label="Temps" value={`${Math.round(attempt.timeUsedSeconds / 60)} min`} />
            <Stat label="Répondu" value={`${Object.keys(attempt.answers).length}/${questions.length}`} />
          </div>
        </div>

        {showAnswers && (
          <div style={{
            overflowX: 'auto',
            background: 'var(--ap-card)',
            border: 'var(--ap-border-w) solid var(--ap-line)',
            borderRadius: 'var(--ap-r-lg)',
          }}>
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
                            color: isCorrect ? '#0d8f68' : '#d83d34', fontWeight: 800, fontSize: 13,
                          }}>
                            {isCorrect ? '✓ Correct' : '✕ Incorrect'}
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
    success: { background: '#e8faf3', color: '#0d8f68', border: '#9ce7ca' },
    error: { background: '#fff3f0', color: '#d83d34', border: '#ffc1bc' },
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
