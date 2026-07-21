import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { toast } from 'sonner';
import { computeExamStats, computeExamStatus, duplicateExam, type Exam, type ExamStats, type ExamStatus } from '@/lib/examStorage';
import { getCurrentUser } from '@/lib/auth';
import { PlanLimitError } from '@/lib/plans';
import { createContent } from '@/lib/content/contentRepo';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GripVertical } from 'lucide-react';
import { ContentExplorer } from '@/components/content/ContentExplorer';
import type { ItemCtx } from '@/components/content/GenericItem';
import { ExamContextMenu } from '@/components/ExamContextMenu';
import type { ContentDisplay } from '@/lib/content/contentView';

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Brouillon',  color: '#6d6288', bg: '#f3ecdd' },
  scheduled: { label: 'Planifié',   color: '#2f7bff', bg: '#eef4ff' },
  open:      { label: 'Ouvert',     color: '#15c08a', bg: '#e8faf3' },
  closed:    { label: 'Fermé',      color: '#ff5a4d', bg: '#fff3f0' },
  archived:  { label: 'Archivé',    color: '#aaa',    bg: '#f3f3f3' },
};

const triggerStyle: React.CSSProperties = {
  fontFamily: 'var(--ap-font-body)', fontWeight: 700, fontSize: '14px',
  border: 'var(--ap-border-w) solid var(--ap-line)', borderRadius: 'var(--ap-r-sm)',
  background: 'var(--ap-card)', color: 'var(--ap-ink)', height: '42px',
};

const selectContentStyle: React.CSSProperties = {
  background: 'var(--ap-card)', border: 'var(--ap-border-w) solid var(--ap-line)', borderRadius: 'var(--ap-r-md)',
};

const gripStyle: React.CSSProperties = {
  cursor: 'grab', color: 'var(--ap-muted)', display: 'flex', alignItems: 'center',
  touchAction: 'none', flexShrink: 0, background: 'none', border: 'none', padding: 2,
};

const statusBadge = (liveStatus: string) => {
  const badge = STATUS_LABEL[liveStatus];
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, letterSpacing: '.05em', padding: '2px 8px',
      borderRadius: 999, color: badge.color, background: badge.bg,
    }}>
      {badge.label}
    </span>
  );
};

const renderMeta = (exam: Exam, stats: ExamStats) => (
  <>
    <span>
      📅 {new Date(exam.openAt).toLocaleDateString('fr')} → {new Date(exam.closeAt).toLocaleDateString('fr')}
    </span>
    {exam.durationMinutes && <span>⏱️ {exam.durationMinutes} min</span>}
    {stats.completedAttempts > 0 && (
      <>
        <span>👤 {stats.completedAttempts} réponse{stats.completedAttempts > 1 ? 's' : ''}</span>
        {stats.avgScore !== null && <span>📊 moy. {stats.avgScore}%</span>}
        {stats.passRate !== null && <span>✅ {stats.passRate}% réussite</span>}
      </>
    )}
  </>
);

const EMPTY_STATS: ExamStats = { totalAttempts: 0, completedAttempts: 0, passRate: null, avgScore: null, avgTimeMinutes: null };

function useExamStats(examId: string): ExamStats {
  const [stats, setStats] = useState<ExamStats>(EMPTY_STATS);
  useEffect(() => {
    let cancelled = false;
    computeExamStats(examId).then((s) => { if (!cancelled) setStats(s); });
    return () => { cancelled = true; };
  }, [examId]);
  return stats;
}

interface ExamItemProps {
  d: ContentDisplay;
  ctx: ItemCtx;
  navigate: ReturnType<typeof useNavigate>;
  onDuplicate: (d: ContentDisplay) => void;
}

const actionButtons = (exam: Exam, navigate: ReturnType<typeof useNavigate>) => (
  <>
    <button
      onClick={(e) => { e.stopPropagation(); navigate(`/exam-builder?examId=${exam.id}`); }}
      style={{
        padding: '6px 14px', borderRadius: 999, border: 'var(--ap-border-w) solid var(--ap-line)',
        background: 'var(--ap-paper-2)', fontFamily: 'var(--ap-font-body)',
        fontWeight: 800, fontSize: 12, color: 'var(--ap-ink)', cursor: 'pointer',
      }}
    >
      Modifier
    </button>
    <button
      onClick={(e) => { e.stopPropagation(); navigate(`/exam/${exam.id}/admin`); }}
      style={{
        padding: '6px 14px', borderRadius: 999, border: 'none',
        background: 'var(--ap-brand)', color: '#fff', fontFamily: 'var(--ap-font-body)',
        fontWeight: 800, fontSize: 12, cursor: 'pointer',
      }}
    >
      Résultats →
    </button>
  </>
);

function ExamCard({ d, ctx, navigate, onDuplicate }: ExamItemProps) {
  const exam = d.data as unknown as Exam;
  const liveStatus = computeExamStatus(exam);
  const stats = useExamStats(exam.id);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: d.id });
  return (
    <div
      ref={setNodeRef}
      className="ap-card ap-card--hover"
      style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer', height: '100%', opacity: isDragging ? 0.4 : 1 }}
      onClick={() => navigate(`/exam/${exam.id}/admin`)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" {...attributes} {...listeners} style={gripStyle} onClick={(e) => e.stopPropagation()} aria-label={`Déplacer ${exam.title}`}>
          <GripVertical className="h-4 w-4" />
        </button>
        {statusBadge(liveStatus)}
        {liveStatus !== 'draft' && (
          <span style={{ fontFamily: 'var(--ap-font-mono)', fontSize: 12, fontWeight: 800, color: 'var(--ap-muted)', letterSpacing: '.08em' }}>
            {exam.joinCode}
          </span>
        )}
      </div>
      <div>
        <div style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
          {exam.title}
        </div>
        {exam.description && (
          <p className="ap-muted" style={{ fontSize: 12, fontWeight: 700 }}>{exam.description}</p>
        )}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ap-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {renderMeta(exam, stats)}
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }} onClick={(e) => e.stopPropagation()}>
        <ExamContextMenu
          isFavorite={d.isFavorite}
          onEdit={() => navigate(`/exam-builder?examId=${exam.id}`)}
          onDuplicate={() => onDuplicate(d)}
          onToggleFavorite={ctx.onFavorite}
          onTrash={ctx.onTrash}
        />
        <div style={{ flex: 1 }} />
        {actionButtons(exam, navigate)}
      </div>
    </div>
  );
}

function ExamRow({ d, ctx, navigate, onDuplicate }: ExamItemProps) {
  const exam = d.data as unknown as Exam;
  const liveStatus = computeExamStatus(exam);
  const stats = useExamStats(exam.id);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: d.id });
  return (
    <div
      ref={setNodeRef}
      className="ap-row"
      style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', opacity: isDragging ? 0.4 : 1 }}
      onClick={() => navigate(`/exam/${exam.id}/admin`)}
    >
      <button type="button" {...attributes} {...listeners} style={gripStyle} onClick={(e) => e.stopPropagation()} aria-label={`Déplacer ${exam.title}`}>
        <GripVertical className="h-4 w-4" />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 600, fontSize: 16 }}>
            {exam.title}
          </span>
          {statusBadge(liveStatus)}
          {liveStatus !== 'draft' && (
            <span style={{ fontFamily: 'var(--ap-font-mono)', fontSize: 12, fontWeight: 800, color: 'var(--ap-muted)', letterSpacing: '.08em' }}>
              {exam.joinCode}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ap-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {renderMeta(exam, stats)}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
        <ExamContextMenu
          isFavorite={d.isFavorite}
          onEdit={() => navigate(`/exam-builder?examId=${exam.id}`)}
          onDuplicate={() => onDuplicate(d)}
          onToggleFavorite={ctx.onFavorite}
          onTrash={ctx.onTrash}
        />
        {actionButtons(exam, navigate)}
      </div>
    </div>
  );
}

export default function MyExams() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [status, setStatus] = useState<'Tous' | ExamStatus>('Tous');
  const reloadRef = useRef<(() => void) | null>(null);

  const handleDuplicate = async (d: ContentDisplay) => {
    if (!user) return;
    const exam = d.data as unknown as Exam;
    try {
      const copy = await duplicateExam(exam.id);
      if (!copy) throw new Error('Échec de duplication');
      await createContent(user.id, 'exam', copy as unknown as Record<string, unknown>, d.folderId, copy.id);
      toast.success('Examen dupliqué');
      reloadRef.current?.();
    } catch (e) {
      if (e instanceof PlanLimitError) {
        toast.error(e.message, { action: { label: 'Passer Pro', onClick: () => navigate('/pricing') } });
      } else {
        toast.error((e as Error).message || 'Erreur lors de la duplication');
      }
    }
  };

  if (!user) { navigate('/auth'); return null; }

  return (
    <ContentExplorer
      type="exam"
      reloadRef={reloadRef}
      accentBtn=""
      headerTitle="Mes examens"
      headerSubtitle="Examens asynchrones · résultats en temps réel"
      rootLabel="Tous les examens"
      oneLabel="examen"
      cta={{ label: '+ Nouvel examen', onClick: () => navigate('/exam-builder') }}
      extraFilter={(d) => status === 'Tous' || computeExamStatus(d.data as unknown as Exam) === status}
      extraToolbar={
        <Select value={status} onValueChange={(v) => setStatus(v as 'Tous' | ExamStatus)}>
          <SelectTrigger className="w-[160px]" style={triggerStyle}>
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent style={selectContentStyle}>
            <SelectItem value="Tous">Tous</SelectItem>
            {Object.keys(STATUS_LABEL).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABEL[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      renderCard={(d, ctx) => <ExamCard d={d} ctx={ctx} navigate={navigate} onDuplicate={handleDuplicate} />}
      renderRow={(d, ctx) => <ExamRow d={d} ctx={ctx} navigate={navigate} onDuplicate={handleDuplicate} />}
    />
  );
}
