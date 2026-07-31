import { Fragment, useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  type LucideIcon, XCircle, ChevronLeft, Lock, Unlock, Users, CheckCircle2,
  Trophy, BarChart2, Timer, Calendar, RotateCcw, HelpCircle, MessageCircle,
  Trash2, ChevronDown, Play, Flag, Save, Hand, Bot, Braces,
  ChartNoAxesColumnIncreasing, FileSpreadsheet, FileText,
} from 'lucide-react';
import {
  getExamById, getAttemptsForExam, computeExamStats, computeExamStatus,
  updateExam, exportCSV, exportExcel, exportJSON, exportPDF, cancelAttempt, getMessagesForAttempt, sendMessage,
  type Exam, type Attempt, type ExamStats, type ExamMessage,
} from '@/lib/examStorage';
import { ExportMenu } from '@/components/ExportMenu';
import { showError } from '@/lib/errorTaxonomy';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getCurrentUser } from '@/lib/auth';
import { getContentBySource } from '@/lib/content/contentRepo';
import type { SavedQuiz } from '@/lib/quizStorage';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { ProctoringDashboard } from '@/components/proctoring/ProctoringDashboard';

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
 *  exam's duration. Null when the exam has no time limit. */
function remainingFor(att: Attempt, exam: Exam, now: number): number | null {
  if (!exam.durationMinutes) return null;
  const deadline = new Date(att.startedAt).getTime() + exam.durationMinutes * 60000;
  return Math.max(0, Math.floor((deadline - now) / 1000));
}

interface QuestionStat {
  id: string;
  question: string;
  totalResponded: number;
  correctCount: number;
  pctCorrect: number;
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
  const [showQuestionStats, setShowQuestionStats] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [chatWithId, setChatWithId] = useState<string | null>(null);
  const [attemptToRemove, setAttemptToRemove] = useState<Attempt | null>(null);

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

  const confirmRemoveAttempt = async () => {
    const att = attemptToRemove;
    if (!att) return;
    setAttemptToRemove(null);
    try {
      const ok = await cancelAttempt(att.id);
      if (ok) {
        toast.success('Participant retiré');
        void load();
      } else {
        showError({ status: 403, message: 'permission denied' }, 'ExamAdmin.removeAttempt');
      }
    } catch (e) {
      showError(e, 'ExamAdmin.removeAttempt', 'Impossible de retirer ce participant.');
    }
  };

  const handleExport = async (
    format: 'CSV' | 'Excel' | 'PDF' | 'JSON',
    exporter: (targetExam: Exam) => Promise<void>,
  ) => {
    if (!exam) return;
    try {
      await exporter(exam);
      toast.success(`Export ${format} téléchargé`);
    } catch (exportError) {
      showError(exportError, `ExamAdmin.export${format}`, `Impossible de générer l’export ${format}. Réessayez dans un instant.`);
    }
  };

  if (error) return (
    <div style={wrapSt}>
      <div style={{ marginBottom: 12 }}><XCircle style={{ width: 52, height: 52, color: 'var(--ap-danger)' }} /></div>
      <h1 style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 700, fontSize: 22 }}>{error}</h1>
    </div>
  );

  if (!exam) return (
    <ExamAdminSkeleton />
  );

  const liveStatus = computeExamStatus(exam);
  const badge = STATUS_LABEL[liveStatus];
  const completed = attempts.filter((a) => a.status === 'submitted' || a.status === 'auto-submitted');
  const inProgress = attempts.filter((a) => a.status === 'in-progress');
  const finished = attempts.filter((a) => a.status !== 'in-progress');

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
    <div className="product-flow">
      <style>{`
        .ea-row { display: grid; gap: 16px; }
        @media (min-width: 600px) { .ea-row { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); } }
        .ea-attempt { background: var(--ap-card); border: var(--ap-border-w) solid var(--ap-line); border-radius: var(--ap-r-lg); overflow: hidden; }
        .ea-attempt-header { padding: 14px 18px; display: flex; align-items: center; gap: 12; cursor: pointer; transition: background .15s; }
        .ea-attempt-header:hover { background: var(--ap-paper); }
      `}</style>

      {/* Topbar */}
      <div className="product-flow-topbar">
        <button
          onClick={() => navigate('/my-exams')}
          aria-label="Retour"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ap-muted)', padding: 4, display: 'flex' }}
        ><ChevronLeft style={{ width: 22, height: 22 }} /></button>
        <span style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 600, fontSize: 18, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {exam.title}
        </span>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.05em', padding: '4px 10px', borderRadius: "var(--ap-r-sm)", color: badge.color, background: badge.bg, flexShrink: 0 }}>
          {badge.label}
        </span>
        <button
          onClick={() => navigate(`/exam-builder?examId=${exam.id}`)}
          style={{ padding: '6px 14px', borderRadius: "var(--ap-r-sm)", border: 'var(--ap-border-w) solid var(--ap-line)', background: 'none', fontFamily: 'var(--ap-font-body)', fontWeight: 800, fontSize: 12, color: 'var(--ap-ink)', cursor: 'pointer', flexShrink: 0 }}
        >
          Modifier
        </button>
      </div>

      <div className="product-flow-page">

        {/* Join code */}
        {liveStatus !== 'draft' && (
          <div className="product-session-access">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--ap-font-mono)', fontSize: 28, fontWeight: 800, letterSpacing: '0.15em', color: 'var(--ap-ink)' }}>
                  {exam.joinCode}
                </span>
                <button
                  className="ap-btn ap-btn--sm"
                  onClick={async () => { try { await navigator.clipboard.writeText(exam.joinCode); toast.success('Code copié'); } catch { toast.error('Copie échouée'); } }}
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
                  onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/join-exam/${exam.joinCode}`); toast.success('Lien copié'); } catch { toast.error('Copie échouée'); } }}
                  style={{ padding: '4px 10px', fontSize: 12 }}
                >
                  Copier le lien
                </button>
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>

              {liveStatus === 'open' && (
                <button onClick={() => handleStatusChange('closed')} style={{ ...outlineBtn, color: '#ff5a4d', borderColor: '#ff9e96', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Lock className="h-3.5 w-3.5" /> Fermer
                </button>
              )}
              {liveStatus === 'closed' && (
                <button onClick={() => handleStatusChange('open')} style={{ ...outlineBtn, color: '#15c08a', borderColor: '#4dd9a0', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Unlock className="h-3.5 w-3.5" /> Rouvrir
                </button>
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="ea-row" style={{ marginBottom: 24 }}>
          <StatCard icon={Users} label="Participants" value={String(stats.totalAttempts)} />
          <StatCard icon={CheckCircle2} label="Terminés" value={String(stats.completedAttempts)} />
          <StatCard
            icon={Trophy}
            label="Taux de réussite"
            value={stats.passRate !== null ? `${stats.passRate}%` : '-'}
            highlight={stats.passRate !== null}
          />
          <StatCard
            icon={BarChart2}
            label="Score moyen"
            value={stats.avgScore !== null ? `${stats.avgScore}%` : '-'}
          />
          <StatCard
            icon={Timer}
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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Calendar className="h-3.5 w-3.5" /> {new Date(exam.openAt).toLocaleString('fr')} → {new Date(exam.closeAt).toLocaleString('fr')}</span>
          {exam.durationMinutes && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Timer className="h-3.5 w-3.5" /> {exam.durationMinutes} min</span>}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><RotateCcw className="h-3.5 w-3.5" /> Max {exam.maxAttempts} tentative{exam.maxAttempts > 1 ? 's' : ''}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Trophy className="h-3.5 w-3.5" /> Seuil {exam.passingScore}%</span>
          {quiz && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><HelpCircle className="h-3.5 w-3.5" /> {quiz.questions.length} questions</span>}
        </div>

        {/* In-progress participants kept visually separate from submissions */}
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
                  onRemove={() => setAttemptToRemove(att)}
                  isChatOpen={chatWithId === att.id}
                  onToggleChat={() => setChatWithId(chatWithId === att.id ? null : att.id)}
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
          <ExportMenu
            style={{ ...outlineBtn, fontSize: 12 }}
            disabled={completed.length === 0}
            disabledReason={completed.length === 0 ? "Attendez au moins un examen rendu pour exporter les résultats." : undefined}
            options={[
              { id: 'pdf', label: 'PDF', icon: FileText, onSelect: () => handleExport('PDF', exportPDF) },
              { id: 'excel', label: 'Excel (.xlsx)', icon: FileSpreadsheet, onSelect: () => handleExport('Excel', exportExcel) },
              { id: 'csv', label: 'CSV', icon: ChartNoAxesColumnIncreasing, onSelect: () => handleExport('CSV', exportCSV) },
              { id: 'json', label: 'JSON', icon: Braces, onSelect: () => handleExport('JSON', exportJSON) },
            ]}
          />
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
          <ResultsTable
            attempts={finished}
            exam={exam}
            quiz={quiz}
            expandedId={expanded}
            chatWithId={chatWithId}
            onToggleExpand={(attemptId) => setExpanded(expanded === attemptId ? null : attemptId)}
            onToggleChat={(attemptId) => setChatWithId(chatWithId === attemptId ? null : attemptId)}
            onRemove={setAttemptToRemove}
          />
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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><BarChart2 className="h-4 w-4" /> Analyse par question</span>
              <ChevronDown style={{ width: 14, height: 14, color: 'var(--ap-muted)', transform: showQuestionStats ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
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
                      <div style={{ height: 6, background: 'var(--ap-line)', borderRadius: "var(--ap-r-sm)", overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: "var(--ap-r-sm)",
                          width: `${qs.pctCorrect}%`,
                          background: qs.pctCorrect >= 70 ? '#15c08a' : qs.pctCorrect >= 40 ? '#f4970a' : '#ff5a4d',
                          transition: 'width .4s',
                        }} />
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-muted)', marginTop: 6 }}>
                        {qs.correctCount}/{qs.totalResponded} bonne{qs.correctCount !== 1 ? 's' : ''} réponse{qs.correctCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {exam.proctoring.enabled && (
          <ProctoringDashboard exam={exam} attempts={attempts} />
        )}
      </div>

      <AlertDialog open={attemptToRemove !== null} onOpenChange={(open) => { if (!open) setAttemptToRemove(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer {attemptToRemove?.participantName} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Sa tentative sera exclue du suivi en direct et des statistiques.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmRemoveAttempt()} className="bg-destructive hover:bg-destructive/90">
              Retirer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ExamAdminSkeleton() {
  return (
    <div style={{ minHeight: '100vh' }} role="status" aria-label="Chargement des résultats de l’examen">
      <div style={{ height: 60, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: 'var(--ap-border-w) solid var(--ap-line)' }}>
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-5 w-64" />
        <Skeleton className="ml-auto h-8 w-24 rounded-full" />
      </div>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 16px' }}>
        <Skeleton className="mb-5 h-28 w-full rounded-2xl" />
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-28 w-full rounded-2xl" />)}
        </div>
        <Skeleton className="mb-4 h-12 w-full rounded-xl" />
        {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="mb-2 h-16 w-full rounded-xl" />)}
      </div>
    </div>
  );
}

function ResultsTable({
  attempts, exam, quiz, expandedId, chatWithId, onToggleExpand, onToggleChat, onRemove,
}: {
  attempts: Attempt[];
  exam: Exam;
  quiz: SavedQuiz | null;
  expandedId: string | null;
  chatWithId: string | null;
  onToggleExpand: (attemptId: string) => void;
  onToggleChat: (attemptId: string) => void;
  onRemove: (attempt: Attempt) => void;
}) {
  const totalQuestions = quiz?.questions.length ?? 0;

  return (
    <div style={{
      overflowX: 'auto', background: 'var(--ap-card)',
      border: 'var(--ap-border-w) solid var(--ap-line)', borderRadius: 'var(--ap-r-lg)',
    }}>
      <table style={{ width: '100%', minWidth: 920, borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ background: 'var(--ap-paper-2)' }}>
            <ResultsHeader>Participant</ResultsHeader>
            <ResultsHeader>Statut</ResultsHeader>
            <ResultsHeader>Réponses</ResultsHeader>
            <ResultsHeader>Score</ResultsHeader>
            <ResultsHeader>Temps</ResultsHeader>
            <ResultsHeader>Rendu le</ResultsHeader>
            <ResultsHeader style={{ width: 132, textAlign: 'right' }}>Actions</ResultsHeader>
          </tr>
        </thead>
        <tbody>
          {attempts.map((att) => {
            const badge = STATUS_LABEL[att.status];
            const answered = Object.values(att.answers).filter((value) => value !== null && value !== undefined && value !== '').length;
            const isExpanded = expandedId === att.id;
            const isChatOpen = chatWithId === att.id;
            return (
              <Fragment key={att.id}>
                <tr style={{ borderTop: '1px solid var(--ap-line)', background: isExpanded ? 'var(--ap-paper)' : 'transparent' }}>
                  <ResultsCell>
                    <button
                      type="button"
                      onClick={() => onToggleExpand(att.id)}
                      aria-expanded={isExpanded}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                        border: 0, padding: 0, background: 'transparent', color: 'var(--ap-ink)',
                        textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <ChevronDown
                        className="h-3.5 w-3.5"
                        style={{ color: 'var(--ap-muted)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}
                        aria-hidden="true"
                      />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 800 }}>{att.participantName}</span>
                        {att.participantEmail && (
                          <span style={{ display: 'block', color: 'var(--ap-muted)', fontSize: 11, marginTop: 2 }}>{att.participantEmail}</span>
                        )}
                      </span>
                    </button>
                  </ResultsCell>
                  <ResultsCell>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.05em', padding: '4px 8px', borderRadius: "var(--ap-r-sm)", color: badge.color, background: badge.bg }}>
                      {badge.label}
                    </span>
                  </ResultsCell>
                  <ResultsCell style={{ fontWeight: 800 }}>
                    {answered}/{totalQuestions || att.questionOrder.length}
                  </ResultsCell>
                  <ResultsCell>
                    <span style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 800, fontSize: 17, color: att.passed ? '#0d8f68' : '#d83d34' }}>
                      {att.percentage === null ? '-' : `${att.percentage}%`}
                    </span>
                  </ResultsCell>
                  <ResultsCell style={{ fontFamily: 'var(--ap-font-mono)', fontWeight: 700 }}>{fmt(att.timeUsedSeconds)}</ResultsCell>
                  <ResultsCell style={{ color: 'var(--ap-muted)', fontSize: 12, fontWeight: 700 }}>
                    {att.submittedAt ? new Date(att.submittedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                  </ResultsCell>
                  <ResultsCell style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => onToggleChat(att.id)}
                        className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn"
                        title="Discussion avec ce participant"
                        aria-label={`Discussion avec ${att.participantName}`}
                        style={{ color: isChatOpen ? 'var(--ap-brand)' : 'var(--ap-muted)' }}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(att)}
                        className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn"
                        title="Retirer ce participant"
                        aria-label={`Retirer ${att.participantName}`}
                        style={{ color: '#d83d34' }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </ResultsCell>
                </tr>
                {isChatOpen && (
                  <tr style={{ borderTop: '1px solid var(--ap-line)' }}>
                    <td colSpan={7}>
                      <AttemptChat examId={exam.id} attemptId={att.id} participantName={att.participantName} />
                    </td>
                  </tr>
                )}
                {isExpanded && (
                  <tr style={{ borderTop: '1px solid var(--ap-line)' }}>
                    <td colSpan={7}><AttemptDetail att={att} exam={exam} quiz={quiz} /></td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ResultsHeader({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th style={{ padding: '13px 15px', fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ap-muted)', ...style }}>
      {children}
    </th>
  );
}

function ResultsCell({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: '13px 15px', verticalAlign: 'middle', fontSize: 13, ...style }}>{children}</td>;
}

function AttemptRow({
  att, exam, quiz, now, isExpanded, onToggleExpand, onRemove, isChatOpen, onToggleChat,
}: {
  att: Attempt; exam: Exam; quiz: SavedQuiz | null; now: number;
  isExpanded: boolean; onToggleExpand: () => void; onRemove: () => void;
  isChatOpen: boolean; onToggleChat: () => void;
}) {
  const ab = STATUS_LABEL[att.status];
  const isLive = att.status === 'in-progress';
  const remaining = isLive ? remainingFor(att, exam, now) : null;
  const totalQ = quiz?.questions.length ?? att.questionOrder.length;
  const answeredQ = Object.values(att.answers).filter((v) => v !== null && v !== undefined && v !== '').length;
  const progressPct = totalQ > 0 ? Math.round((answeredQ / totalQ) * 100) : 0;

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

        {/* Live progress bar */}
        {isLive && (
          <div style={{ width: 90, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ height: 6, borderRadius: "var(--ap-r-sm)", background: 'var(--ap-line)', overflow: 'hidden' }}>
              <div style={{ width: `${progressPct}%`, height: '100%', background: 'var(--ap-brand)', transition: 'width .3s' }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--ap-muted)', textAlign: 'center' }}>
              {answeredQ}/{totalQ}
            </span>
          </div>
        )}

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
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.05em', padding: '3px 8px', borderRadius: "var(--ap-r-sm)", color: ab.color, background: ab.bg, flexShrink: 0 }}>
          {ab.label}
        </span>

        {/* Host actions */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleChat(); }}
          title="Discussion avec ce participant"
          style={{ ...rowIconBtn, color: isChatOpen ? 'var(--ap-brand)' : 'var(--ap-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <MessageCircle className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="Retirer ce participant"
          style={{ ...rowIconBtn, color: '#ff5a4d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Trash2 className="h-4 w-4" />
        </button>

        <ChevronDown style={{ width: 14, height: 14, color: 'var(--ap-muted)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </div>

      {/* Persistent chat thread */}
      {isChatOpen && (
        <div onClick={(e) => e.stopPropagation()} style={{ borderTop: 'var(--ap-border-w) solid var(--ap-line)' }}>
          <AttemptChat examId={exam.id} attemptId={att.id} participantName={att.participantName} />
        </div>
      )}

      {/* Expanded details */}
      {isExpanded && (
        <AttemptDetail att={att} exam={exam} quiz={quiz} />
      )}
    </div>
  );
}

function AttemptChat({ examId, attemptId, participantName }: { examId: string; attemptId: string; participantName: string }) {
  const [messages, setMessages] = useState<ExamMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getMessagesForAttempt(attemptId).then((m) => { if (!cancelled) setMessages(m); });
    return () => { cancelled = true; };
  }, [attemptId]);

  useEffect(() => {
    const channel = supabase
      .channel(`exam-messages-host-${attemptId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'exam_messages', filter: `attempt_id=eq.${attemptId}` },
        (payload) => {
          const row = payload.new as { id: string };
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, payload.new as unknown as ExamMessage]));
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [attemptId]);

  const handleSend = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const sent = await sendMessage(examId, attemptId, 'host', body);
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      setText('');
    } catch (e) {
      showError(e, 'ExamAdmin.sendMessage', 'Impossible d’envoyer le message. Vérifiez votre connexion puis réessayez.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
        {messages.length === 0 ? (
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ap-muted)', margin: 0 }}>
            Aucun message avec {participantName} pour l'instant.
          </p>
        ) : messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.sender === 'host' ? 'flex-end' : 'flex-start',
              maxWidth: '80%', padding: '8px 12px', borderRadius: 'var(--ap-r-sm)',
              background: m.sender === 'host' ? 'var(--ap-brand-soft)' : 'var(--ap-paper-2)',
              color: 'var(--ap-ink)', fontSize: 13, fontWeight: 700,
            }}
          >
            {m.body}
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ap-muted)', marginTop: 2 }}>
              {m.sender === 'host' ? 'Vous' : participantName} · {new Date(m.createdAt).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleSend(); }}
          placeholder={`Message à ${participantName}…`}
          style={{
            flex: 1, padding: '9px 12px', fontFamily: 'var(--ap-font-body)', fontWeight: 700, fontSize: 13,
            color: 'var(--ap-ink)', background: 'var(--ap-paper-2)', border: 'var(--ap-border-w) solid var(--ap-line)',
            borderRadius: 'var(--ap-r-sm)', outline: 'none',
          }}
        />
        <button onClick={() => void handleSend()} disabled={sending} style={{ ...outlineBtn, fontSize: 12 }}>Envoyer</button>
      </div>
    </div>
  );
}

function AttemptDetail({ att, exam, quiz }: { att: Attempt; exam: Exam; quiz: SavedQuiz | null }) {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '0 18px 18px', borderTop: 'var(--ap-border-w) solid var(--ap-line)' }}>
      <div style={{ display: 'flex', gap: 20, padding: '14px 0', fontSize: 12, fontWeight: 700, color: 'var(--ap-muted)', flexWrap: 'wrap', borderBottom: '1px solid var(--ap-line)', marginBottom: 14 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Play className="h-3.5 w-3.5" /> {new Date(att.startedAt).toLocaleString('fr')}</span>
        {att.submittedAt && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Flag className="h-3.5 w-3.5" /> {new Date(att.submittedAt).toLocaleString('fr')}</span>}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Timer className="h-3.5 w-3.5" /> {Math.floor(att.timeUsedSeconds / 60)} min {att.timeUsedSeconds % 60} s</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Save className="h-3.5 w-3.5" /> {att.logs.filter((l) => l.event === 'saved').length} sauvegardes auto</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {att.submissionMode === 'manual' ? <><Hand className="h-3.5 w-3.5" /> Manuel</> : <><Bot className="h-3.5 w-3.5" /> Automatique</>}
        </span>
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

function StatCard({ icon: Icon, label, value, highlight }: { icon: LucideIcon; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="product-metric">
      <div className="product-metric__icon"><Icon className="h-5 w-5" /></div>
      <div>
        <strong style={{ color: highlight ? 'var(--ap-brand-deep)' : undefined }}>{value}</strong>
        <small>{label}</small>
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
  padding: '8px 14px', borderRadius: "var(--ap-r-sm)",
  border: 'var(--ap-border-w) solid var(--ap-line)', background: 'var(--ap-paper-2)',
  fontFamily: 'var(--ap-font-body)', fontWeight: 800, fontSize: 13,
  color: 'var(--ap-ink)', cursor: 'pointer',
};

const wrapSt: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  padding: 24, gap: 12,
};
