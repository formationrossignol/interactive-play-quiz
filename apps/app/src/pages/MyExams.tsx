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
import { ClipboardCheck, GripVertical, Star } from 'lucide-react';
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

/** Drag handle overlaid on the header block (top-left) so the title row keeps the full card width. */
const gripOverlayStyle: React.CSSProperties = {
  position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--ap-card)', border: 'var(--ap-border-w) solid var(--ap-line)', color: 'var(--ap-muted)',
  cursor: 'grab', touchAction: 'none', padding: 4, borderRadius: 6, zIndex: 1,
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

// "Modifier" already lives in ExamContextMenu — this is the card's one primary action.
const primaryButton = (exam: Exam, navigate: ReturnType<typeof useNavigate>, size: { text: string; pad: string }) => (
  <button
    onClick={(e) => { e.stopPropagation(); navigate(`/exam/${exam.id}/admin`); }}
    className="ap-btn ap-btn--sm ap-btn--pill"
    style={{ fontSize: size.text, padding: size.pad }}
  >
    Résultats →
  </button>
);

function ExamCard({ d, ctx, navigate, onDuplicate }: ExamItemProps) {
  const exam = d.data as unknown as Exam;
  const liveStatus = computeExamStatus(exam);
  const stats = useExamStats(exam.id);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: d.id });
  return (
    <div
      ref={setNodeRef}
      className="ap-card ap-card--hover flex h-full cursor-pointer flex-col overflow-hidden"
      style={{ opacity: isDragging ? 0.4 : 1 }}
      onClick={() => navigate(`/exam/${exam.id}/admin`)}
    >
      <div
        className="relative h-40 w-full overflow-hidden flex-shrink-0 flex items-center justify-center"
        style={{ background: `color-mix(in srgb, var(--ap-brand) 14%, var(--ap-paper-2))` }}
      >
        <ClipboardCheck style={{ width: 40, height: 40, color: 'var(--ap-brand)', opacity: 0.8 }} />
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          style={gripOverlayStyle}
          className="ap-grip"
          title="Déplacer"
          aria-label={`Déplacer ${exam.title}`}
        >
          <GripVertical style={{ width: 14, height: 14 }} />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-2.5" style={{ padding: '14px 16px 12px' }}>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="ap-h3 line-clamp-2" style={{ fontSize: '15.5px', lineHeight: 1.25 }}>{exam.title}</h3>
            {exam.description && <p className="ap-muted mt-1 text-sm line-clamp-2">{exam.description}</p>}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); ctx.onFavorite(); }}
            className="text-amber-400 hover:text-amber-500 transition-colors cursor-pointer p-1 -mr-1 flex-shrink-0"
          >
            <Star className={`h-4 w-4 ${d.isFavorite ? 'fill-amber-400' : ''}`} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {statusBadge(liveStatus)}
          {liveStatus !== 'draft' && (
            <span className="ap-pill" style={{ fontFamily: 'var(--ap-font-mono)', fontSize: '11px', padding: '3px 9px', letterSpacing: '.06em' }}>
              {exam.joinCode}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ap-muted)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {renderMeta(exam, stats)}
        </div>
        <div className="mt-auto flex items-center justify-between gap-1.5 pt-3" style={{ borderTop: 'var(--ap-border-w) solid var(--ap-line)' }}>
          <ExamContextMenu
            isFavorite={d.isFavorite}
            onEdit={() => navigate(`/exam-builder?examId=${exam.id}`)}
            onDuplicate={() => onDuplicate(d)}
            onToggleFavorite={ctx.onFavorite}
            onTrash={ctx.onTrash}
          />
          <div onClick={(e) => e.stopPropagation()}>{primaryButton(exam, navigate, { text: '13px', pad: '8px 15px' })}</div>
        </div>
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
        {primaryButton(exam, navigate, { text: '12px', pad: '6px 12px' })}
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
        toast.error(e.message, { action: { label: 'Passer Pro', onClick: () => { window.location.href = '/pricing'; } } });
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
