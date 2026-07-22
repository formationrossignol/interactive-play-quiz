import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getExamById, getAttemptsForExam, computeExamStats, computeExamStatus,
  updateExam, exportCSV, cancelAttempt, sendHostMessage, type Exam, type Attempt, type ExamStats,
} from '@/lib/examStorage';
import { getCurrentUser } from '@/lib/auth';
import { getContentBySource } from '@/lib/content/contentRepo';
import type { SavedQuiz } from '@/lib/quizStorage';
import { supabase } from '@/lib/supabase';
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

/** Live countdown for an in-progress attempt, derived from startedAt + the
 *  exam's duration — null when the exam has no time limit. */
function remainingFor(att: Attempt, exam: Exam, now: number): number | null {
  if (!exam.durationMinutes) return null;
  const deadline = new Date(att.startedAt).getTime() + exam.durationMinutes * 60000;
  return Math.max(0, Math.floor((deadline - now) / 1000));
}

export default function ExamAdmin() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [exam, setExam] = useState<Exam | null>(null);
  const [quiz, setQuiz] = useState<SavedQuiz | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [stats, setStats] = useState<ExamStats>({ totalAttempts: 0, completedAttempts: 0, passRate: null, avgScore: null, avgTimeMinutes: null });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [messagingId, setMessagingId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');

  const load = useCallback(async () => {
    if (!examId) return;
    const e = await getExamById(examId);
    if (!e) { setError('Examen introuvable'); return; }
    if (!user || e.hostId !== user.id) { setError('Accès refusé'); return; }
    setExam(e);
    const [fetchedAttempts, fetchedStats, quizRow] = await Promise.all([
      getAttemptsForExam(examId),
      computeExamStats(examId),
      getContentBySource(e.hostId, 'quiz', e.quizId),
    ]);
    setAttempts(
      fetchedAttempts
        .filter((a) => a.status !== 'cancelled')
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    );
    setStats(fetchedStats);
    setQuiz((quizRow?.data as unknown as SavedQuiz) ?? null);
  }, [examId, user?.id]);

  useEffect(() => { void load(); }, [load]);

  // Live per-participant remaining-time countdown (client-derived, no extra reads).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Live results: subscribe to attempt changes for this exam instead of polling.
  useEffect(() => {
    if (!examId) return;
    const channel = supabase
      .channel(`exam-attempts-${examId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exam_attempts', filter: `exam_id=eq.${examId}` },
        () => { void load(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [examId, load]);

  const handleStatusChange = async (newStatus: Exam['status']) => {
    if (!exam) return;
    const updated = await updateExam(exam.id, { status: newStatus });
    if (updated) { setExam(updated); toast.success('Statut mis à jour'); }
  };

  const handleRemove = async (att: Attempt) => {
    if (!window.confirm(`Retirer ${att.participantName} ? Sa tentative sera exclue du suivi en direct et des statistiques.`)) return;
    const ok = await cancelAttempt(att.id);
    if (ok) { toast.success('Participant retiré'); void load(); } else { toast.error('Échec du retrait'); }
  };

  const handleSendMessage = async (attemptId: string) => {
    const text = messageText.trim();
    if (!text) return;
    const ok = await sendHostMessage(attemptId, text);
    if (ok) { toast.success('Message envoyé'); setMessagingId(null); setMessageText(''); } else { toast.error("Échec de l'envoi"); }
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

  const liveStatus = computeExamStatus(exam);
  const badge = STATUS_LABEL[liveStatus];
  const completed = attempts.filter((a) => a.status === 'submitted' || a.status === 'auto-submitted');
  const inProgress = attempts.filter((a) => a.status === 'in-progress');
  const finished = attempts.filter((a) => a.status !== 'in-progress');

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 80 }}>
      <style>{`
        .ea-row { display: grid; gap: 16px; }
        @media (min-width: 600px) { .ea-row { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); } }
        .ea-attempt { background: var(--ap-card); border: var(--ap-border-w) solid var(--ap-line); border-radius: var(--ap-r-lg); overflow: hidden; }
        .ea-attempt-header { padding: 14px 18px; display: flex; align-items: center; gap: 12; cursor: pointer; transition: background .15s; }
        .ea-attempt-header:hover { background: var(--ap-paper); }
      `}</style>

      {/* Topbar */}
      <div style={{
        background: 'var(--ap-card)', borderBottom: 'var(--ap-border-w) solid var(--ap-line)',
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
          style={{ padding: '6px 14px', borderRadius: 999, border: 'var(--ap-border-w) solid var(--ap-line)', background: 'none', fontFamily: 'var(--ap-font-body)', fontWeight: 800, fontSize: 12, color: 'var(--ap-ink)', cursor: 'pointer', flexShrink: 0 }}
        >
          Modifier
        </button>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>

        {/* Join code */}
        {liveStatus !== 'draft' && (
          <div style={{
            background: 'var(--ap-card)', border: 'var(--ap-border-w) solid var(--ap-line)',
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
            value={stats.passRate !== null ? `${stats.passRate}%` : '-'}
            highlight={stats.passRate !== null}
          />
          <StatCard
            icon="📊"
            label="Score moyen"
            value={stats.avgScore !== null ? `${stats.avgScore}%` : '-'}
          />
          <StatCard
            icon="⏱️"
            label="Durée moy."
            value={stats.avgTimeMinutes !== null ? `${stats.avgTimeMinutes} min` : '-'}
          />
        </div>

        {/* Exam info */}
        <div style={{
          background: 'var(--ap-card)', border: 'var(--ap-border-w) solid var(--ap-line)',
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

        {/* In-progress participants — kept visually separate from submissions */}
        {inProgress.length > 0 && (
          <>
            <h2 style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 600, fontSize: 18, marginBottom: 12 }}>
              En cours ({inProgress.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {inProgress.map((att) => (
                <AttemptRow
                  key={att.id}
                  att={att} exam={exam} quiz={quiz} now={now}
                  isExpanded={expanded === att.id}
                  onToggleExpand={() => setExpanded(expanded === att.id ? null : att.id)}
                  onRemove={() => handleRemove(att)}
                  isMessaging={messagingId === att.id}
                  messageText={messageText}
                  onMessageTextChange={setMessageText}
                  onOpenMessage={() => { setMessagingId(att.id); setMessageText(''); }}
                  onCloseMessage={() => setMessagingId(null)}
                  onSendMessage={() => handleSendMessage(att.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* Submissions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 600, fontSize: 18 }}>
            Résultats ({completed.length} soumis{completed.length > 1 ? 's' : ''})
          </h2>
          {completed.length > 0 && (
            <button
              onClick={() => { void exportCSV(exam); toast.success('Export CSV lancé'); }}
              style={{ ...outlineBtn, fontSize: 12 }}
            >
              ⬇️ Exporter CSV
            </button>
          )}
        </div>

        {attempts.length === 0 ? (
          <div style={{
            background: 'var(--ap-card)', border: 'var(--ap-border-w) solid var(--ap-line)',
            borderRadius: 'var(--ap-r-lg)', padding: '36px 24px', textAlign: 'center',
            color: 'var(--ap-muted)', fontWeight: 700, fontSize: 14,
          }}>
            Aucune tentative pour l'instant. Partagez le code <strong style={{ color: 'var(--ap-ink)', fontFamily: 'var(--ap-font-mono)' }}>{exam.joinCode}</strong> aux participants.
          </div>
        ) : finished.length === 0 ? (
          <div style={{
            background: 'var(--ap-card)', border: 'var(--ap-border-w) solid var(--ap-line)',
            borderRadius: 'var(--ap-r-lg)', padding: '36px 24px', textAlign: 'center',
            color: 'var(--ap-muted)', fontWeight: 700, fontSize: 14,
          }}>
            Personne n'a encore soumis.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {finished.map((att) => (
              <AttemptRow
                key={att.id}
                att={att} exam={exam} quiz={quiz} now={now}
                isExpanded={expanded === att.id}
                onToggleExpand={() => setExpanded(expanded === att.id ? null : att.id)}
                onRemove={() => handleRemove(att)}
                isMessaging={false}
                messageText={messageText}
                onMessageTextChange={setMessageText}
                onOpenMessage={() => {}}
                onCloseMessage={() => {}}
                onSendMessage={() => {}}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AttemptRow({
  att, exam, quiz, now, isExpanded, onToggleExpand, onRemove,
  isMessaging, messageText, onMessageTextChange, onOpenMessage, onCloseMessage, onSendMessage,
}: {
  att: Attempt; exam: Exam; quiz: SavedQuiz | null; now: number;
  isExpanded: boolean; onToggleExpand: () => void; onRemove: () => void;
  isMessaging: boolean; messageText: string; onMessageTextChange: (v: string) => void;
  onOpenMessage: () => void; onCloseMessage: () => void; onSendMessage: () => void;
}) {
  const ab = STATUS_LABEL[att.status];
  const isLive = att.status === 'in-progress';
  const remaining = isLive ? remainingFor(att, exam, now) : null;

  return (
    <div className="ea-attempt">
      <div
        className="ea-attempt-header"
        onClick={onToggleExpand}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer', transition: 'background .15s', background: isExpanded ? 'var(--ap-paper)' : 'transparent' }}
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

        {/* Remaining time (live attempts only, timed exams only) */}
        {isLive && remaining !== null && (
          <div style={{
            fontFamily: 'var(--ap-font-mono)', fontSize: 12, fontWeight: 800, flexShrink: 0,
            color: remaining < 120 ? '#ff5a4d' : 'var(--ap-muted)',
          }}>
            ⏳ {fmt(remaining)}
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

        {/* Host actions */}
        {isLive && (
          <button
            onClick={(e) => { e.stopPropagation(); if (isMessaging) onCloseMessage(); else onOpenMessage(); }}
            title="Envoyer un message"
            style={{ ...rowIconBtn, color: isMessaging ? 'var(--ap-brand)' : 'var(--ap-muted)' }}
          >
            💬
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="Retirer ce participant"
          style={{ ...rowIconBtn, color: '#ff5a4d' }}
        >
          🗑️
        </button>

        <span style={{ color: 'var(--ap-muted)', fontSize: 12, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▼</span>
      </div>

      {/* Message composer */}
      {isMessaging && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ padding: '0 18px 14px', borderTop: 'var(--ap-border-w) solid var(--ap-line)', display: 'flex', gap: 8, paddingTop: 14 }}
        >
          <input
            autoFocus
            value={messageText}
            onChange={(e) => onMessageTextChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSendMessage(); if (e.key === 'Escape') onCloseMessage(); }}
            placeholder={`Message à ${att.participantName}…`}
            style={{
              flex: 1, padding: '9px 12px', fontFamily: 'var(--ap-font-body)', fontWeight: 700, fontSize: 13,
              color: 'var(--ap-ink)', background: 'var(--ap-paper-2)', border: 'var(--ap-border-w) solid var(--ap-line)',
              borderRadius: 'var(--ap-r-sm)', outline: 'none',
            }}
          />
          <button onClick={onSendMessage} style={{ ...outlineBtn, fontSize: 12 }}>Envoyer</button>
        </div>
      )}

      {/* Expanded details */}
      {isExpanded && (
        <AttemptDetail att={att} exam={exam} quiz={quiz} />
      )}
    </div>
  );
}

function AttemptDetail({ att, exam, quiz }: { att: Attempt; exam: Exam; quiz: SavedQuiz | null }) {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '0 18px 18px', borderTop: 'var(--ap-border-w) solid var(--ap-line)' }}>
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
                <div key={qId} title={`Q${i + 1}`} style={{
                  width: 28, height: 28, borderRadius: 6, fontSize: 11, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: noAnswer ? 'var(--ap-paper-2)' : correct === true ? '#e8faf3' : correct === false ? '#fff3f0' : '#eef4ff',
                  color: noAnswer ? 'var(--ap-muted)' : correct === true ? '#15c08a' : correct === false ? '#ff5a4d' : '#2f7bff',
                  border: `1.5px solid ${noAnswer ? 'var(--ap-line)' : correct === true ? '#4dd9a0' : correct === false ? '#ff9e96' : '#89b4ff'}`,
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
      background: 'var(--ap-card)', border: 'var(--ap-border-w) solid var(--ap-line)',
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

const rowIconBtn: React.CSSProperties = {
  flexShrink: 0, width: 28, height: 28, borderRadius: '50%', border: 'none',
  background: 'transparent', fontSize: 14, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const outlineBtn: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 999,
  border: 'var(--ap-border-w) solid var(--ap-line)', background: 'var(--ap-paper-2)',
  fontFamily: 'var(--ap-font-body)', fontWeight: 800, fontSize: 13,
  color: 'var(--ap-ink)', cursor: 'pointer',
};

const wrapSt: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  padding: 24, gap: 12,
};
