import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getExamById, getAttemptsForExam, computeExamStats, computeExamStatus,
  updateExam, exportCSV, type Exam, type Attempt,
} from '@/lib/examStorage';
import { getCurrentUser } from '@/lib/auth';
import { getQuizById } from '@/lib/quizStorage';
import { toast } from 'sonner';

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  draft:          { label: 'Brouillon',          color: '#6d6288', bg: '#f3ecdd' },
  scheduled:      { label: 'Planifié',            color: '#2f7bff', bg: '#eef4ff' },
  open:           { label: 'Ouvert',              color: '#15c08a', bg: '#e8faf3' },
  closed:         { label: 'Fermé',               color: '#ff5a4d', bg: '#fff3f0' },
  archived:       { label: 'Archivé',             color: '#aaa',    bg: '#f3f3f3' },
  'in-progress':  { label: 'En cours',            color: '#2f7bff', bg: '#eef4ff' },
  submitted:      { label: 'Soumis',              color: '#15c08a', bg: '#e8faf3' },
  'auto-submitted': { label: 'Auto-soumis',       color: '#15c08a', bg: '#e8faf3' },
  expired:        { label: 'Expiré',              color: '#aaa',    bg: '#f3f3f3' },
  cancelled:      { label: 'Annulé',              color: '#aaa',    bg: '#f3f3f3' },
};

function fmt(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function ExamAdmin() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [exam, setExam] = useState<Exam | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showQuestionStats, setShowQuestionStats] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!examId) return;
    const e = getExamById(examId);
    if (!e) { setError('Examen introuvable'); return; }
    if (!user || e.hostId !== user.id) { setError('Accès refusé'); return; }
    setExam(e);
    setAttempts(
      getAttemptsForExam(examId)
        .filter((a) => a.status !== 'cancelled')
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    );
  }, [examId, user?.id]);

  useEffect(() => { load(); }, [load]);

  // Refresh every 30s when exam is open
  useEffect(() => {
    if (!exam) return;
    const status = computeExamStatus(exam);
    if (status !== 'open') return;
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [exam?.id, load]);

  const handleStatusChange = (newStatus: Exam['status']) => {
    if (!exam) return;
    const updated = updateExam(exam.id, { status: newStatus });
    if (updated) { setExam(updated); toast.success('Statut mis à jour'); }
  };

  if (error) return (
    <div style={wrapSt}>
      <div style={{ fontSize: 52, marginBottom: 12 }}>❌</div>
      <h1 style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 700, fontSize: 22 }}>{error}</h1>
    </div>
  );

  if (!exam) return (
    <div style={wrapSt}>
      <svg width="40" height="40" viewBox="0 0 40 40" style={{ animation: 'spin .9s linear infinite' }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <circle cx="20" cy="20" r="16" fill="none" stroke="var(--ap-line-2)" strokeWidth="4" />
        <circle cx="20" cy="20" r="16" fill="none" stroke="var(--ap-brand)" strokeWidth="4"
          strokeDasharray="80" strokeDashoffset="60" strokeLinecap="round" />
      </svg>
    </div>
  );

  const quiz = getQuizById(exam.quizId);
  const stats = computeExamStats(exam.id);
  const liveStatus = computeExamStatus(exam);
  const badge = STATUS_LABEL[liveStatus];
  const completed = attempts.filter((a) => a.status === 'submitted' || a.status === 'auto-submitted');

  interface QuestionStat {
    id: string;
    question: string;
    totalResponded: number;
    correctCount: number;
    pctCorrect: number;
  }

  const questionStats: QuestionStat[] = quiz
    ? quiz.questions.map((q: { id: string; question: string; type: string; correctAnswer: unknown }) => {
        const responded = completed.filter((a) => {
          const given = a.answers[q.id];
          return given !== null && given !== undefined && given !== '';
        });
        const correct = responded.filter((a) => checkCorrect(q, a.answers[q.id]));
        const pct = responded.length > 0 ? Math.round((correct.length / responded.length) * 100) : 0;
        return {
          id: q.id,
          question: q.question,
          totalResponded: responded.length,
          correctCount: correct.length,
          pctCorrect: pct,
        };
      })
    : [];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ap-paper)', paddingBottom: 80 }}>
      <style>{`
        .ea-row { display: grid; gap: 16px; }
        @media (min-width: 600px) { .ea-row { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); } }
        .ea-attempt { background: var(--ap-card); border: 2px solid var(--ap-line); border-radius: var(--ap-r-lg); overflow: hidden; }
        .ea-attempt-header { padding: 14px 18px; display: flex; align-items: center; gap: 12; cursor: pointer; transition: background .15s; }
        .ea-attempt-header:hover { background: var(--ap-paper); }
      `}</style>

      {/* Topbar */}
      <div style={{
        background: 'var(--ap-card)', borderBottom: '2px solid var(--ap-line)',
        padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', gap: 16,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button
          onClick={() => navigate('/my-exams')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ap-muted)', fontSize: 20, padding: 4 }}
        >←</button>
        <span style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 600, fontSize: 18, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {exam.title}
        </span>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.05em', padding: '4px 10px', borderRadius: 999, color: badge.color, background: badge.bg, flexShrink: 0 }}>
          {badge.label}
        </span>
        <button
          onClick={() => navigate(`/exam-builder?examId=${exam.id}`)}
          style={{ padding: '6px 14px', borderRadius: 999, border: '2px solid var(--ap-line)', background: 'none', fontFamily: 'var(--ap-font-body)', fontWeight: 800, fontSize: 12, color: 'var(--ap-ink)', cursor: 'pointer', flexShrink: 0 }}
        >
          Modifier
        </button>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>

        {/* Join code */}
        {liveStatus !== 'draft' && (
          <div style={{
            background: 'var(--ap-card)', border: '2px solid var(--ap-line)',
            borderRadius: 'var(--ap-r-lg)', padding: '16px 24px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--ap-font-mono)', fontSize: 28, fontWeight: 800, letterSpacing: '0.15em', color: 'var(--ap-ink)' }}>
                  {exam.joinCode}
                </span>
                <button
                  className="ap-btn ap-btn--sm"
                  onClick={async () => { try { await navigator.clipboard.writeText(exam.joinCode); toast.success('Code copié !'); } catch { toast.error('Copie échouée'); } }}
                  style={{ padding: '4px 10px' }}
                >
                  Copier
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ap-muted)' }}>
                <span style={{ fontFamily: 'var(--ap-font-mono)', fontSize: 12 }}>
                  {window.location.origin}/join-exam/{exam.joinCode}
                </span>
                <button
                  className="ap-btn ap-btn--sm"
                  onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/join-exam/${exam.joinCode}`); toast.success('Lien copié !'); } catch { toast.error('Copie échouée'); } }}
                  style={{ padding: '4px 10px', fontSize: 12 }}
                >
                  Copier le lien
                </button>
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>

              {liveStatus === 'open' && (
                <button onClick={() => handleStatusChange('closed')} style={{ ...outlineBtn, color: '#ff5a4d', borderColor: '#ff9e96' }}>
                  🔒 Fermer
                </button>
              )}
              {liveStatus === 'closed' && (
                <button onClick={() => handleStatusChange('open')} style={{ ...outlineBtn, color: '#15c08a', borderColor: '#4dd9a0' }}>
                  🔓 Rouvrir
                </button>
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="ea-row" style={{ marginBottom: 24 }}>
          <StatCard icon="👤" label="Participants" value={String(stats.totalAttempts)} />
          <StatCard icon="✅" label="Terminés" value={String(stats.completedAttempts)} />
          <StatCard
            icon="🏆"
            label="Taux de réussite"
            value={stats.passRate !== null ? `${stats.passRate}%` : '—'}
            highlight={stats.passRate !== null}
          />
          <StatCard
            icon="📊"
            label="Score moyen"
            value={stats.avgScore !== null ? `${stats.avgScore}%` : '—'}
          />
          <StatCard
            icon="⏱️"
            label="Durée moy."
            value={stats.avgTimeMinutes !== null ? `${stats.avgTimeMinutes} min` : '—'}
          />
        </div>

        {/* Exam info */}
        <div style={{
          background: 'var(--ap-card)', border: '2px solid var(--ap-line)',
          borderRadius: 'var(--ap-r-lg)', padding: '16px 20px', marginBottom: 20,
          fontSize: 12, fontWeight: 700, color: 'var(--ap-muted)',
          display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <span>📅 {new Date(exam.openAt).toLocaleString('fr')} → {new Date(exam.closeAt).toLocaleString('fr')}</span>
          {exam.durationMinutes && <span>⏱️ {exam.durationMinutes} min</span>}
          <span>🔄 Max {exam.maxAttempts} tentative{exam.maxAttempts > 1 ? 's' : ''}</span>
          <span>🏆 Seuil {exam.passingScore}%</span>
          {quiz && <span>❓ {quiz.questions.length} questions</span>}
        </div>

        {/* Attempts list */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 600, fontSize: 18 }}>
            Résultats ({completed.length} soumis{completed.length > 1 ? 's' : ''})
          </h2>
          {completed.length > 0 && (
            <button
              onClick={() => { exportCSV(exam); toast.success('Export CSV lancé'); }}
              style={{ ...outlineBtn, fontSize: 12 }}
            >
              ⬇️ Exporter CSV
            </button>
          )}
        </div>

        {attempts.length === 0 ? (
          <div style={{
            background: 'var(--ap-card)', border: '2px solid var(--ap-line)',
            borderRadius: 'var(--ap-r-lg)', padding: '36px 24px', textAlign: 'center',
            color: 'var(--ap-muted)', fontWeight: 700, fontSize: 14,
          }}>
            Aucune tentative pour l'instant. Partagez le code <strong style={{ color: 'var(--ap-ink)', fontFamily: 'var(--ap-font-mono)' }}>{exam.joinCode}</strong> aux participants.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {attempts.map((att) => {
              const ab = STATUS_LABEL[att.status];
              const isExp = expanded === att.id;

              return (
                <div key={att.id} className="ea-attempt">
                  <div
                    className="ea-attempt-header"
                    onClick={() => setExpanded(isExp ? null : att.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer', transition: 'background .15s', background: isExp ? 'var(--ap-paper)' : 'transparent' }}
                  >
                    {/* Status dot */}
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: ab.color, flexShrink: 0 }} />

                    {/* Name */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {att.participantName}
                      </div>
                      {att.participantEmail && (
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-muted)' }}>{att.participantEmail}</div>
                      )}
                    </div>

                    {/* Score */}
                    {att.percentage !== null && (
                      <div style={{
                        fontFamily: 'var(--ap-font-display)', fontWeight: 800, fontSize: 18,
                        color: att.passed ? '#15c08a' : '#ff5a4d', flexShrink: 0,
                      }}>
                        {att.percentage}%
                      </div>
                    )}

                    {/* Time */}
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ap-muted)', flexShrink: 0 }}>
                      {fmt(att.timeUsedSeconds)}
                    </div>

                    {/* Status badge */}
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.05em', padding: '3px 8px', borderRadius: 999, color: ab.color, background: ab.bg, flexShrink: 0 }}>
                      {ab.label}
                    </span>

                    <span style={{ color: 'var(--ap-muted)', fontSize: 12, transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▼</span>
                  </div>

                  {/* Expanded details */}
                  {isExp && (
                    <AttemptDetail att={att} exam={exam} quiz={quiz} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Per-question analysis */}
        {quiz && questionStats.length > 0 && completed.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <button
              onClick={() => setShowQuestionStats((s) => !s)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontFamily: 'var(--ap-font-display)', fontWeight: 600, fontSize: 18,
                color: 'var(--ap-ink)',
              }}
            >
              <span>📊 Analyse par question</span>
              <span style={{ fontSize: 14, color: 'var(--ap-muted)', transform: showQuestionStats ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▼</span>
            </button>

            {showQuestionStats && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {questionStats
                  .slice()
                  .sort((a, b) => a.pctCorrect - b.pctCorrect)
                  .map((qs, idx) => (
                    <div key={qs.id} style={{
                      background: 'var(--ap-card)', border: '2px solid var(--ap-line)',
                      borderRadius: 'var(--ap-r-lg)', padding: '14px 18px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <span style={{
                          width: 22, height: 22, borderRadius: 6, fontSize: 10, fontWeight: 800,
                          background: 'var(--ap-paper-2)', color: 'var(--ap-muted)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          {idx + 1}
                        </span>
                        <p style={{ fontSize: 13, fontWeight: 700, margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {qs.question}
                        </p>
                        <span style={{
                          fontSize: 14, fontWeight: 800, flexShrink: 0,
                          color: qs.pctCorrect >= 70 ? '#15c08a' : qs.pctCorrect >= 40 ? '#f4970a' : '#ff5a4d',
                        }}>
                          {qs.pctCorrect}%
                        </span>
                      </div>
                      <div style={{ height: 6, background: 'var(--ap-line)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 999,
                          width: `${qs.pctCorrect}%`,
                          background: qs.pctCorrect >= 70 ? '#15c08a' : qs.pctCorrect >= 40 ? '#f4970a' : '#ff5a4d',
                          transition: 'width .4s',
                        }} />
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-muted)', marginTop: 6 }}>
                        {qs.correctCount}/{qs.totalResponded} bonne{qs.correctCount > 1 ? 's' : ''} réponse{qs.correctCount > 1 ? 's' : ''}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AttemptDetail({ att, exam, quiz }: { att: Attempt; exam: Exam; quiz: ReturnType<typeof getQuizById> }) {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '0 18px 18px', borderTop: '2px solid var(--ap-line)' }}>
      <div style={{ display: 'flex', gap: 20, padding: '14px 0', fontSize: 12, fontWeight: 700, color: 'var(--ap-muted)', flexWrap: 'wrap', borderBottom: '1px solid var(--ap-line)', marginBottom: 14 }}>
        <span>▶ {new Date(att.startedAt).toLocaleString('fr')}</span>
        {att.submittedAt && <span>🏁 {new Date(att.submittedAt).toLocaleString('fr')}</span>}
        <span>⏱ {Math.floor(att.timeUsedSeconds / 60)} min {att.timeUsedSeconds % 60} s</span>
        <span>💾 {att.logs.filter((l) => l.event === 'saved').length} sauvegardes auto</span>
        <span>{att.submissionMode === 'manual' ? '✋ Manuel' : '🤖 Automatique'}</span>
      </div>

      {/* Answers overview */}
      {quiz && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--ap-muted)', marginBottom: 10 }}>
            Réponses ({Object.keys(att.answers).length}/{quiz.questions.length})
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {(att.questionOrder.length ? att.questionOrder : quiz.questions.map((q: { id: string }) => q.id)).map((qId: string, i: number) => {
              const q = quiz.questions.find((q: { id: string }) => q.id === qId);
              if (!q) return null;
              const given = att.answers[qId];
              const noAnswer = given === null || given === undefined || given === '';
              let correct: boolean | null = null;
              if (att.status === 'submitted' || att.status === 'auto-submitted') {
                correct = checkCorrect(q, given);
              }
              return (
                <div key={qId} style={{
                  width: 28, height: 28, borderRadius: 6, fontSize: 11, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: noAnswer ? 'var(--ap-paper-2)' : correct === true ? '#e8faf3' : correct === false ? '#fff3f0' : '#eef4ff',
                  color: noAnswer ? 'var(--ap-muted)' : correct === true ? '#15c08a' : correct === false ? '#ff5a4d' : '#2f7bff',
                  border: `1.5px solid ${noAnswer ? 'var(--ap-line)' : correct === true ? '#4dd9a0' : correct === false ? '#ff9e96' : '#89b4ff'}`,
                  title: `Q${i + 1}`,
                }}>
                  {i + 1}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* View full results link */}
      {(att.status === 'submitted' || att.status === 'auto-submitted') && (
        <button
          onClick={() => navigate(`/exam/${att.id}/results`)}
          style={{ ...outlineBtn, fontSize: 12 }}
        >
          Voir la correction complète →
        </button>
      )}
    </div>
  );
}

function checkCorrect(q: { type: string; correctAnswer: unknown }, given: number | string | null | undefined): boolean {
  if (given === null || given === undefined || given === '') return false;
  if (q.type === 'true-false') return String(given).toLowerCase() === String(q.correctAnswer).toLowerCase();
  if (q.type === 'short-answer') return String(given).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
  return given === q.correctAnswer;
}

function StatCard({ icon, label, value, highlight }: { icon: string; label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      background: 'var(--ap-card)', border: '2px solid var(--ap-line)',
      borderRadius: 'var(--ap-r-lg)', padding: '16px 20px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{
        fontFamily: 'var(--ap-font-display)', fontWeight: 800, fontSize: 24,
        color: highlight ? 'var(--ap-brand)' : 'var(--ap-ink)', marginBottom: 4,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ap-muted)' }}>
        {label}
      </div>
    </div>
  );
}

const outlineBtn: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 999,
  border: '2px solid var(--ap-line)', background: 'var(--ap-paper-2)',
  fontFamily: 'var(--ap-font-body)', fontWeight: 800, fontSize: 13,
  color: 'var(--ap-ink)', cursor: 'pointer',
};

const wrapSt: React.CSSProperties = {
  minHeight: '100vh', background: 'var(--ap-paper)',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  padding: 24, gap: 12,
};
