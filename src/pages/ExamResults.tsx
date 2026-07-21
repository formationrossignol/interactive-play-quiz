import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAttemptById, getExamById, type Attempt, type Exam } from '@/lib/examStorage';
import { getContentBySource } from '@/lib/content/contentRepo';
import type { SavedQuiz } from '@/lib/quizStorage';

export default function ExamResults() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [quiz, setQuiz] = useState<SavedQuiz | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!attemptId) { setError('Tentative introuvable'); return; }
    let cancelled = false;
    (async () => {
      const att = await getAttemptById(attemptId);
      if (cancelled) return;
      if (!att) { setError('Tentative introuvable'); return; }
      const e = await getExamById(att.examId);
      if (cancelled) return;
      if (!e) { setError('Examen introuvable'); return; }

      if (e.showResultsPolicy === 'never') { setError('Les résultats ne sont pas disponibles pour cet examen.'); return; }
      if (e.showResultsPolicy === 'after-close' && new Date(e.closeAt) > new Date()) {
        setError(`Résultats disponibles après le ${new Date(e.closeAt).toLocaleString('fr')}`);
        return;
      }

      const quizRow = await getContentBySource(e.hostId, 'quiz', e.quizId);
      if (cancelled) return;
      setAttempt(att);
      setExam(e);
      setQuiz((quizRow?.data as unknown as SavedQuiz) ?? null);
    })();
    return () => { cancelled = true; };
  }, [attemptId]);

  if (error) return (
    <div style={wrapSt}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>🔒</div>
      <h1 style={titleSt}>{error}</h1>
    </div>
  );

  if (!attempt || !exam || !quiz) return (
    <div style={wrapSt}>
      <svg width="40" height="40" viewBox="0 0 40 40" style={{ animation: 'spin .9s linear infinite' }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <circle cx="20" cy="20" r="16" fill="none" stroke="var(--ap-line-2)" strokeWidth="4" />
        <circle cx="20" cy="20" r="16" fill="none" stroke="var(--ap-brand)" strokeWidth="4"
          strokeDasharray="80" strokeDashoffset="60" strokeLinecap="round" />
      </svg>
    </div>
  );

  const passed = attempt.passed;
  const pct = attempt.percentage ?? 0;
  const showAnswers = exam.showDetailPolicy !== 'score-only';
  const showCorrection = exam.showDetailPolicy === 'score-correction';

  const orderedQs = attempt.questionOrder
    .map((id) => quiz.questions.find((q: { id: string }) => q.id === id))
    .filter(Boolean);

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

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 16px' }}>
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
            <Stat label="Répondu" value={`${Object.keys(attempt.answers).length}/${quiz.questions.length}`} />
          </div>
        </div>

        {/* Q&A correction */}
        {showAnswers && orderedQs.map((q: { id: string; type: string; question: string; answers: string[]; correctAnswer: unknown }, idx: number) => {
          const given = attempt.answers[q.id];
          const isCorrect = showCorrection ? checkCorrect(q, given) : null;

          return (
            <div key={q.id} style={{
              background: 'var(--ap-card)', border: `2px solid ${isCorrect === true ? '#4dd9a0' : isCorrect === false ? '#ff9e96' : 'var(--ap-line)'}`,
              borderRadius: 'var(--ap-r-lg)', padding: '18px 20px', marginBottom: 12,
            }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                {showCorrection && (
                  <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>
                    {isCorrect === true ? '✅' : isCorrect === false ? '❌' : '⭕'}
                  </span>
                )}
                <p style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.4, margin: 0 }}>
                  <span style={{ color: 'var(--ap-muted)', fontWeight: 700, marginRight: 6 }}>Q{idx + 1}.</span>
                  {q.question}
                </p>
              </div>

              {/* Participant's answer */}
              <div style={{ marginBottom: showCorrection && isCorrect === false ? 8 : 0 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ap-muted)', marginBottom: 4 }}>
                  Votre réponse
                </div>
                <div style={{
                  padding: '8px 12px', borderRadius: 'var(--ap-r-sm)', fontSize: 13, fontWeight: 700,
                  background: isCorrect === true ? '#e8faf3' : isCorrect === false ? '#fff3f0' : 'var(--ap-paper)',
                  color: isCorrect === true ? '#15c08a' : isCorrect === false ? '#ff5a4d' : 'var(--ap-ink)',
                  border: `1.5px solid ${isCorrect === true ? '#4dd9a0' : isCorrect === false ? '#ff9e96' : 'var(--ap-line)'}`,
                }}>
                  {formatAnswer(q, given)}
                </div>
              </div>

              {/* Correct answer (if wrong) */}
              {showCorrection && isCorrect === false && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#15c08a', marginBottom: 4 }}>
                    Bonne réponse
                  </div>
                  <div style={{
                    padding: '8px 12px', borderRadius: 'var(--ap-r-sm)', fontSize: 13, fontWeight: 700,
                    background: '#e8faf3', color: '#15c08a', border: '1.5px solid #4dd9a0',
                  }}>
                    {formatCorrect(q)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function checkCorrect(q: { type: string; correctAnswer: unknown }, given: number | string | null | undefined): boolean {
  if (given === null || given === undefined || given === '') return false;
  if (q.type === 'true-false') return String(given).toLowerCase() === String(q.correctAnswer).toLowerCase();
  if (q.type === 'short-answer') return String(given).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
  return given === q.correctAnswer;
}

function formatAnswer(q: { type: string; answers?: string[] }, given: number | string | null | undefined): string {
  if (given === null || given === undefined || given === '') return '(sans réponse)';
  if (q.type === 'true-false') return given === 'true' ? 'Vrai' : 'Faux';
  if (q.type === 'short-answer') return String(given);
  if (typeof given === 'number' && q.answers) return q.answers[given] ?? String(given);
  return String(given);
}

function formatCorrect(q: { type: string; answers?: string[]; correctAnswer: unknown }): string {
  if (q.type === 'true-false') return q.correctAnswer === 'true' ? 'Vrai' : 'Faux';
  if (q.type === 'short-answer') return String(q.correctAnswer);
  if (typeof q.correctAnswer === 'number' && q.answers) return q.answers[q.correctAnswer] ?? String(q.correctAnswer);
  return String(q.correctAnswer);
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
