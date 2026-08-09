import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { toast } from 'sonner';
import { computeExamStats, computeExamStatus, computeHostExamStats, duplicateExam, listExamStatsForHost, type Exam, type ExamStats, type ExamStatsRow, type ExamStatus, type HostExamStats } from '@/lib/examStorage';
import { getCurrentUser } from '@/lib/auth';
import { showError } from '@/lib/errorTaxonomy';
import { createContent } from '@/lib/content/contentRepo';
import { listGroups, listGroupMembers, type Group } from '@/lib/sharing/sharingRepo';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  GripVertical,
  Link2,
  Pencil,
  Star,
  Trash2,
  Trophy,
  UserRound,
} from 'lucide-react';
import { ContentExplorer } from '@/components/content/ContentExplorer';
import type { ItemCtx } from '@/components/content/GenericItem';
import { ExamContextMenu } from '@/components/ExamContextMenu';
import type { ContentDisplay } from '@/lib/content/contentView';
import { ContentCardHeader, ContentRowThumbnail } from '@/components/content/ContentCardHeader';

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Brouillon', color: 'var(--ap-muted)', bg: 'var(--ap-paper-2)' },
  scheduled: { label: 'Planifié', color: 'var(--ap-brand-deep)', bg: 'var(--ap-brand-soft)' },
  open:      { label: 'Ouvert', color: 'var(--ap-pres-deep)', bg: 'var(--ap-pres-soft)' },
  closed:    { label: 'Fermé', color: 'var(--ap-danger-deep)', bg: 'var(--ap-danger-soft)' },
  archived:  { label: 'Archivé', color: 'var(--ap-muted)', bg: 'var(--ap-paper-2)' },
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
      borderRadius: "var(--ap-r-sm)", color: badge.color, background: badge.bg,
    }}>
      {badge.label}
    </span>
  );
};

const metaItemStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
};

const metaIconStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  flexShrink: 0,
};

const renderMeta = (exam: Exam, stats: ExamStats) => (
  <>
    <span style={metaItemStyle}>
      <CalendarDays aria-hidden="true" style={metaIconStyle} />
      {new Date(exam.openAt).toLocaleDateString('fr')}
      <ArrowRight aria-hidden="true" style={{ ...metaIconStyle, width: 12, height: 12 }} />
      {new Date(exam.closeAt).toLocaleDateString('fr')}
    </span>
    {exam.durationMinutes && (
      <span style={metaItemStyle}>
        <Clock3 aria-hidden="true" style={metaIconStyle} />
        {exam.durationMinutes} min
      </span>
    )}
    {stats.completedAttempts > 0 && (
      <>
        <span style={metaItemStyle}>
          <UserRound aria-hidden="true" style={metaIconStyle} />
          {stats.completedAttempts} réponse{stats.completedAttempts > 1 ? 's' : ''}
        </span>
        {stats.avgScore !== null && (
          <span style={metaItemStyle}>
            <BarChart3 aria-hidden="true" style={metaIconStyle} />
            moy. {stats.avgScore}%
          </span>
        )}
        {stats.passRate !== null && (
          <span style={metaItemStyle}>
            <CheckCircle2 aria-hidden="true" style={metaIconStyle} />
            {stats.passRate}% réussite
          </span>
        )}
      </>
    )}
  </>
);

const EMPTY_STATS: ExamStats = { totalAttempts: 0, completedAttempts: 0, passRate: null, avgScore: null, avgTimeMinutes: null };
const EMPTY_HOST_STATS: HostExamStats = { ...EMPTY_STATS, totalExams: 0 };

/** Fetches the trainer's groups once — the "Promotion" filter's option list. */
function useOwnedGroups(hostId: string): Group[] {
  const [groups, setGroups] = useState<Group[]>([]);
  useEffect(() => {
    let cancelled = false;
    listGroups(hostId).then((g) => { if (!cancelled) setGroups(g); }).catch(() => {});
    return () => { cancelled = true; };
  }, [hostId]);
  return groups;
}

/** Resolves a group's email-invited members (share_group_members.pending_email)
 *  into the lowercased Set computeHostExamStats filters attempts against —
 *  see that function's docstring for why user_id-only members can't join here. */
function useGroupEmailFilter(groupId: string | null): Set<string> | undefined {
  const [emails, setEmails] = useState<Set<string> | undefined>(undefined);
  useEffect(() => {
    if (!groupId) { setEmails(undefined); return; }
    let cancelled = false;
    listGroupMembers(groupId).then((members) => {
      if (cancelled) return;
      const set = new Set(
        members.map((m) => m.pending_email?.toLowerCase()).filter((e): e is string => !!e),
      );
      setEmails(set);
    }).catch(() => { if (!cancelled) setEmails(new Set()); });
    return () => { cancelled = true; };
  }, [groupId]);
  return emails;
}

function useHostExamStats(hostId: string, emailFilter?: Set<string>): HostExamStats {
  const [stats, setStats] = useState<HostExamStats>(EMPTY_HOST_STATS);
  useEffect(() => {
    let cancelled = false;
    computeHostExamStats(hostId, emailFilter).then((s) => { if (!cancelled) setStats(s); });
    return () => { cancelled = true; };
  }, [hostId, emailFilter]);
  return stats;
}

interface GroupComparisonRow {
  group: Group;
  stats: HostExamStats;
}

/** "Comparaison entre promotions" (responsable pédagogique) — same
 *  computeHostExamStats + email-join already used for the single-group
 *  filter above, just run for every group at once instead of one at a
 *  time, so they can be read side by side instead of switched between. */
function usePromotionComparison(hostId: string, groups: Group[]): GroupComparisonRow[] {
  const [rows, setRows] = useState<GroupComparisonRow[]>([]);
  useEffect(() => {
    if (groups.length < 2) { setRows([]); return; }
    let cancelled = false;
    Promise.all(groups.map(async (group) => {
      const members = await listGroupMembers(group.id).catch(() => []);
      const emails = new Set(members.map((m) => m.pending_email?.toLowerCase()).filter((e): e is string => !!e));
      const stats = await computeHostExamStats(hostId, emails);
      return { group, stats };
    })).then((r) => { if (!cancelled) setRows(r); });
    return () => { cancelled = true; };
  }, [hostId, groups]);
  return rows;
}

function PromotionComparisonPanel({ hostId }: { hostId: string }) {
  const groups = useOwnedGroups(hostId);
  const rows = usePromotionComparison(hostId, groups);
  if (rows.length < 2) return null;

  return (
    <section className="product-panel product-insight-panel">
      <div className="product-panel-heading">
        <div>
          <h2>Comparaison des promotions</h2>
          <p>Comparez les résultats des groupes sur l’ensemble de vos examens.</p>
        </div>
      </div>
      <div className="product-data-table-wrap product-data-table-wrap--flush">
        <table className="product-data-table" style={{ minWidth: 520 }}>
          <thead>
            <tr style={{ background: 'var(--ap-paper)' }}>
              <th>Promotion</th>
              <th>Tentatives</th>
              <th>Taux de réussite</th>
              <th>Score moyen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ group, stats }) => (
              <tr key={group.id}>
                <td style={{ fontWeight: 700 }}>{group.name}</td>
                <td style={{ color: 'var(--ap-muted)' }}>{stats.completedAttempts}</td>
                <td style={{ fontWeight: 720 }}>{stats.passRate !== null ? `${stats.passRate}%` : '-'}</td>
                <td style={{ fontWeight: 720 }}>{stats.avgScore !== null ? `${stats.avgScore}%` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HostStatTile({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: string }) {
  return (
    <div className="product-metric">
      <span className="product-metric__icon"><Icon aria-hidden="true" /></span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </div>
  );
}

/** Cross-exam overview — analytics phase A "formateur" persona: a trainer's
 *  global success rate/score/time across every exam they host, not just one.
 *  Phase B adds an optional "Promotion" filter (groups from Partage), scoping
 *  the same stats to attempts whose participant email matches a group
 *  member invited by email — see computeHostExamStats' docstring. */
function HostStatsRow({ hostId }: { hostId: string }) {
  const groups = useOwnedGroups(hostId);
  const [groupId, setGroupId] = useState<string | null>(null);
  const emailFilter = useGroupEmailFilter(groupId);
  const stats = useHostExamStats(hostId, emailFilter);

  if (groups.length === 0 && stats.totalExams === 0) return null;

  return (
    <section className="product-panel product-insight-panel">
      <div className="product-panel-heading">
        <div>
          <h2>Vue d’ensemble</h2>
          <p>Les indicateurs clés de votre activité d’évaluation.</p>
        </div>
      </div>
      {groups.length > 0 && (
        <div className="product-filter-bar product-filter-bar--insight">
          <Select value={groupId ?? 'all'} onValueChange={(v) => setGroupId(v === 'all' ? null : v)}>
            <SelectTrigger className="w-[200px]" style={triggerStyle}>
              <SelectValue placeholder="Promotion" />
            </SelectTrigger>
            <SelectContent style={selectContentStyle}>
              <SelectItem value="all">Toutes les promotions</SelectItem>
              {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {groupId && (
            <span className="product-filter-note">
              Le rapprochement utilise l’adresse d’invitation. Les participants sans adresse ne sont pas comptés.
            </span>
          )}
        </div>
      )}
      {(stats.totalExams > 0 || groupId) && (
        <div className="product-metric-grid product-metric-grid--wide product-metric-grid--compact">
          <HostStatTile icon={ClipboardCheck} label="Examens" value={String(stats.totalExams)} />
          <HostStatTile icon={UserRound} label="Tentatives" value={String(stats.completedAttempts)} />
          <HostStatTile icon={Trophy} label="Taux de réussite" value={stats.passRate !== null ? `${stats.passRate}%` : '-'} />
          <HostStatTile icon={BarChart3} label="Score moyen" value={stats.avgScore !== null ? `${stats.avgScore}%` : '-'} />
          <HostStatTile icon={Clock3} label="Durée moy." value={stats.avgTimeMinutes !== null ? `${stats.avgTimeMinutes} min` : '-'} />
        </div>
      )}
    </section>
  );
}

const PROBLEM_THRESHOLD_PCT = 50;

/** "Identification des modules problématiques" (responsable pédagogique) —
 *  same per-exam computeExamStats already shown on each exam's own admin
 *  page, just ranked worst-pass-rate-first across the trainer's whole
 *  portfolio instead of read one exam at a time. */
function useExamStatsRows(hostId: string): ExamStatsRow[] {
  const [rows, setRows] = useState<ExamStatsRow[]>([]);
  useEffect(() => {
    let cancelled = false;
    listExamStatsForHost(hostId).then((r) => { if (!cancelled) setRows(r); }).catch(() => {});
    return () => { cancelled = true; };
  }, [hostId]);
  return rows;
}

function ProblemModulesPanel({ hostId, navigate }: { hostId: string; navigate: ReturnType<typeof useNavigate> }) {
  const rows = useExamStatsRows(hostId);
  const problematic = rows
    .filter((r) => r.stats.completedAttempts > 0 && r.stats.passRate !== null && r.stats.passRate < PROBLEM_THRESHOLD_PCT)
    .slice(0, 5);

  if (problematic.length === 0) return null;

  return (
    <section className="product-panel product-insight-panel">
      <div className="product-panel-heading product-panel-heading--compact">
        <div className="product-insight-title">
          <span className="product-insight-title__icon product-insight-title__icon--warning"><AlertTriangle aria-hidden="true" /></span>
          <div>
            <h2>Examens à surveiller</h2>
            <p>Taux de réussite inférieur à {PROBLEM_THRESHOLD_PCT}%.</p>
          </div>
        </div>
      </div>
      <div className="product-alert-list">
        {problematic.map(({ exam, stats }) => (
          <button
            type="button"
            key={exam.id}
            onClick={() => navigate(`/exam/${exam.id}/admin`)}
            className="product-alert-item"
          >
            <span className="product-alert-item__title">
              {exam.title}
            </span>
            <span className="product-alert-item__meta">
              {stats.passRate}% de réussite, {stats.completedAttempts} tentative{stats.completedAttempts > 1 ? 's' : ''}
            </span>
            <ArrowRight aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}

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
    Résultats
    <ArrowRight aria-hidden="true" className="h-4 w-4" />
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
      className="ap-card ap-card--hover flex h-full cursor-pointer flex-col overflow-hidden p-0"
      style={{ opacity: isDragging ? 0.4 : 1, padding: 0 }}
      onClick={() => navigate(`/exam/${exam.id}/admin`)}
    >
      <ContentCardHeader image={exam.headerImage} alt={exam.title} icon="assignment_turned_in" accent="var(--content-exam-accent)" background="var(--content-exam-surface)" label="Examen">
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
      </ContentCardHeader>
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
            onManageAccess={ctx.onManageAccess}
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
      className="ap-row group"
      style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', opacity: isDragging ? 0.4 : 1 }}
      onClick={() => navigate(`/exam/${exam.id}/admin`)}
    >
      <button type="button" {...attributes} {...listeners} style={gripStyle} onClick={(e) => e.stopPropagation()} aria-label={`Déplacer ${exam.title}`}>
        <GripVertical className="h-4 w-4" />
      </button>
      <ContentRowThumbnail image={exam.headerImage} alt={exam.title} icon="assignment_turned_in" accent="var(--content-exam-accent)" background="var(--content-exam-surface)" />
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
      <div className="ap-hover-actions" style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
        <button className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn" title="Modifier" aria-label={`Modifier ${exam.title}`} onClick={() => navigate(`/exam-builder?examId=${exam.id}`)}>
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn" title="Copier le lien" aria-label={`Copier le lien de ${exam.title}`} onClick={ctx.onCopyLink}>
          <Link2 className="h-3.5 w-3.5" />
        </button>
        <button className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn" style={{ color: 'var(--ap-danger)' }} title="Mettre à la corbeille" aria-label={`Mettre ${exam.title} à la corbeille`} onClick={ctx.onTrash}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <ExamContextMenu
          isFavorite={d.isFavorite}
          onEdit={() => navigate(`/exam-builder?examId=${exam.id}`)}
          onDuplicate={() => onDuplicate(d)}
          onToggleFavorite={ctx.onFavorite}
          onManageAccess={ctx.onManageAccess}
          onTrash={ctx.onTrash}
        />
      </div>
    </div>
  );
}

export default function MyExams() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [status, setStatus] = useState<'Tous' | ExamStatus>(
    () => (localStorage.getItem('my-exams-status-filter') as 'Tous' | ExamStatus | null) ?? 'Tous',
  );
  const reloadRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    localStorage.setItem('my-exams-status-filter', status);
  }, [status]);

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
      showError(e, 'MyExams.duplicate', 'Impossible de dupliquer cet examen. Réessayez dans un instant.');
    }
  };

  if (!user) { navigate('/auth'); return null; }

  return (
    <ContentExplorer
      type="exam"
      reloadRef={reloadRef}
      accentBtn=""
      headerTitle="Mes examens"
      headerSubtitle="Planifiez vos évaluations et suivez les résultats en temps réel."
      rootLabel="Tous les examens"
      oneLabel="examen"
      cta={{ label: 'Nouvel examen', onClick: () => navigate('/exam-builder') }}
      statsRow={<div className="product-insights-stack">
        <HostStatsRow hostId={user.id} />
        <PromotionComparisonPanel hostId={user.id} />
        <ProblemModulesPanel hostId={user.id} navigate={navigate} />
      </div>}
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
