import { useState, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { computeExamStats, computeExamStatus, type Exam, type ExamStatus } from '@/lib/examStorage';
import { getCurrentUser } from '@/lib/auth';
import { Header } from '@/components/Header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, LayoutGrid, List, ChevronRight, GripVertical } from 'lucide-react';
import { DndContext, useDraggable, type DragEndEvent } from '@dnd-kit/core';
import { toast } from 'sonner';
import { useContentCollection } from '@/hooks/useContentCollection';
import { FolderExplorer } from '@/components/FolderExplorer';
import type { ContentRow, FolderRow } from '@/lib/content/types';

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Brouillon',  color: '#6d6288', bg: '#f3ecdd' },
  scheduled: { label: 'Planifié',   color: '#2f7bff', bg: '#eef4ff' },
  open:      { label: 'Ouvert',     color: '#15c08a', bg: '#e8faf3' },
  closed:    { label: 'Fermé',      color: '#ff5a4d', bg: '#fff3f0' },
  archived:  { label: 'Archivé',    color: '#aaa',    bg: '#f3f3f3' },
};

type SortOption = 'newest' | 'oldest' | 'az' | 'closing';

const VIEW_KEY = 'view-mode-exams';

const triggerStyle: CSSProperties = {
  fontFamily: 'var(--ap-font-body)', fontWeight: 700, fontSize: '14px',
  border: 'var(--ap-border-w) solid var(--ap-line)', borderRadius: 'var(--ap-r-sm)',
  background: 'var(--ap-card)', color: 'var(--ap-ink)', height: '42px',
};

const toggleBtnStyle = (active: boolean): CSSProperties => ({
  padding: '8px',
  background: active ? 'var(--ap-brand-soft)' : 'transparent',
  color: active ? 'var(--ap-brand)' : 'var(--ap-muted)',
  border: `2px solid ${active ? 'var(--ap-brand)' : 'var(--ap-line)'}`,
  borderRadius: 'var(--ap-r-sm)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
});

const selectContentStyle: CSSProperties = {
  background: 'var(--ap-card)', border: 'var(--ap-border-w) solid var(--ap-line)', borderRadius: 'var(--ap-r-md)',
};

const gripStyle: CSSProperties = {
  cursor: 'grab', color: 'var(--ap-muted)', display: 'flex', alignItems: 'center',
  touchAction: 'none', flexShrink: 0,
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

const renderMeta = (exam: Exam, stats: ReturnType<typeof computeExamStats>) => (
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

function ExamCard({ row, navigate }: { row: ContentRow; navigate: ReturnType<typeof useNavigate> }) {
  const exam = row.data as unknown as Exam;
  const liveStatus = computeExamStatus(exam);
  const stats = computeExamStats(exam.id);
  const { attributes, listeners, setNodeRef } = useDraggable({ id: row.id });
  return (
    <div
      ref={setNodeRef}
      className="ap-card ap-card--hover"
      style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer', height: '100%' }}
      onClick={() => navigate(`/exam/${exam.id}/admin`)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span {...attributes} {...listeners} style={gripStyle} onClick={(e) => e.stopPropagation()}>
          <GripVertical className="h-4 w-4" />
        </span>
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
      <div style={{ marginTop: 'auto', display: 'flex', gap: 8, paddingTop: 4 }} onClick={(e) => e.stopPropagation()}>
        {actionButtons(exam, navigate)}
      </div>
    </div>
  );
}

function ExamRow({ row, navigate }: { row: ContentRow; navigate: ReturnType<typeof useNavigate> }) {
  const exam = row.data as unknown as Exam;
  const liveStatus = computeExamStatus(exam);
  const stats = computeExamStats(exam.id);
  const { attributes, listeners, setNodeRef } = useDraggable({ id: row.id });
  return (
    <div
      ref={setNodeRef}
      className="ap-card ap-card--hover"
      style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}
      onClick={() => navigate(`/exam/${exam.id}/admin`)}
    >
      <span {...attributes} {...listeners} style={gripStyle} onClick={(e) => e.stopPropagation()}>
        <GripVertical className="h-4 w-4" />
      </span>
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
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
        {actionButtons(exam, navigate)}
      </div>
    </div>
  );
}

export default function MyExams() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const c = useContentCollection('exam');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('Tous');
  const [sort, setSort] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(
    () => (localStorage.getItem(VIEW_KEY) as 'grid' | 'list') ?? 'grid',
  );

  const setView = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem(VIEW_KEY, mode);
  };

  // Each content row's blob is an Exam; compute its live status once.
  const withStatus = useMemo(
    () => c.items.map((row) => ({ row, exam: row.data as unknown as Exam, liveStatus: computeExamStatus(row.data as unknown as Exam) })),
    [c.items],
  );

  const statusOptions = useMemo(() => {
    const present = new Set(withStatus.map((e) => e.liveStatus));
    return ['Tous', ...Object.keys(STATUS_LABEL).filter((s) => present.has(s as ExamStatus))];
  }, [withStatus]);

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const { row } of withStatus) {
      if (row.folder_id) counts[row.folder_id] = (counts[row.folder_id] ?? 0) + 1;
    }
    return counts;
  }, [withStatus]);

  const breadcrumb = useMemo(() => {
    const path: FolderRow[] = [];
    let id = c.currentFolderId;
    const byId = new Map(c.folders.map((f) => [f.id, f]));
    while (id) {
      const folder = byId.get(id);
      if (!folder) break;
      path.unshift(folder);
      id = folder.parent_id;
    }
    return path;
  }, [c.currentFolderId, c.folders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = withStatus.filter(({ row, exam, liveStatus }) => {
      const inFolder = (row.folder_id ?? null) === c.currentFolderId;
      const matchSearch =
        !q ||
        (exam.title ?? '').toLowerCase().includes(q) ||
        (exam.description ?? '').toLowerCase().includes(q) ||
        (exam.joinCode ?? '').toLowerCase().includes(q);
      const matchStatus = status === 'Tous' || liveStatus === status;
      return inFolder && matchSearch && matchStatus;
    });
    result = [...result].sort((a, b) => {
      switch (sort) {
        case 'oldest': return (a.exam.createdAt ?? '').localeCompare(b.exam.createdAt ?? '');
        case 'az': return (a.exam.title ?? '').localeCompare(b.exam.title ?? '', 'fr');
        case 'closing': return (a.exam.closeAt ?? '').localeCompare(b.exam.closeAt ?? '');
        default: return (b.exam.createdAt ?? '').localeCompare(a.exam.createdAt ?? '');
      }
    });
    return result;
  }, [withStatus, search, status, sort, c.currentFolderId]);

  const handleDragEnd = (e: DragEndEvent) => {
    const over = e.over ? String(e.over.id) : null;
    if (!over || !over.startsWith('folder:')) return;
    const target = over === 'folder:root' ? null : over.slice('folder:'.length);
    const active = String(e.active.id);
    if (active.startsWith('movefolder:')) {
      c.moveFolder(active.slice('movefolder:'.length), target).catch(() => toast.error('Déplacement impossible (cycle)'));
    } else {
      c.moveContent(active, target);
    }
  };

  if (!user) { navigate('/auth'); return null; }

  return (
    <div style={{ minHeight: '100vh' }}>
      <Header />
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 700, fontSize: 26, marginBottom: 4 }}>
              Mes examens
            </h1>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ap-muted)' }}>
              Examens asynchrones · résultats en temps réel
            </p>
          </div>
          <button
            onClick={() => navigate('/exam-builder')}
            style={{
              padding: '12px 22px', borderRadius: 999, border: 'none',
              background: 'var(--ap-brand)', color: '#fff',
              fontFamily: 'var(--ap-font-body)', fontWeight: 800, fontSize: 14,
              cursor: 'pointer', boxShadow: '0 4px 0 var(--ap-brand-deep)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            + Nouvel examen
          </button>
        </div>

        {c.error && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 'var(--ap-r-sm)', background: '#fff3f0', color: '#ff5a4d', fontWeight: 700, fontSize: 13 }}>
            {c.error}
          </div>
        )}

        {!c.loading && c.items.length === 0 ? (
          <div style={{
            background: 'var(--ap-card)', border: 'var(--ap-border-w) solid var(--ap-line)',
            borderRadius: 'var(--ap-r-lg)', padding: '48px 24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>📝</div>
            <div style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 600, fontSize: 18, marginBottom: 8 }}>
              Aucun examen
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ap-muted)', marginBottom: 20 }}>
              Créez un examen asynchrone à partir d'un quiz existant
            </div>
            <button
              onClick={() => navigate('/exam-builder')}
              style={{
                padding: '12px 28px', borderRadius: 999, border: 'none',
                background: 'var(--ap-brand)', color: '#fff',
                fontFamily: 'var(--ap-font-body)', fontWeight: 800, fontSize: 14, cursor: 'pointer',
              }}
            >
              Créer un examen
            </button>
          </div>
        ) : (
          <DndContext onDragEnd={handleDragEnd}>
            <div className="flex flex-col md:flex-row gap-6">
              <aside className="md:w-64 md:flex-shrink-0">
                <div className="ap-card" style={{ padding: '12px' }}>
                  <FolderExplorer
                    tree={c.tree}
                    currentFolderId={c.currentFolderId}
                    storageKey="explorer-expanded-exam"
                    counts={folderCounts}
                    onNavigate={(id) => c.setCurrentFolderId(id)}
                    onCreate={(pid, name) => c.createFolder(pid, name)}
                    onRename={c.renameFolder}
                    onDelete={c.deleteFolder}
                    onMoveFolder={c.moveFolder}
                  />
                </div>
              </aside>

              <div className="flex-1 min-w-0">
                {/* Breadcrumb */}
                <div className="flex items-center gap-1 flex-wrap mb-4" style={{ fontSize: '14px' }}>
                  <button className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: '2px 6px', fontWeight: 700 }} onClick={() => c.setCurrentFolderId(null)}>Tous</button>
                  {breadcrumb.map((f) => (
                    <span key={f.id} className="flex items-center gap-1">
                      <ChevronRight className="h-4 w-4" style={{ color: 'var(--ap-muted)' }} />
                      <button className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: '2px 6px', fontWeight: 700, color: f.id === c.currentFolderId ? 'var(--ap-brand)' : 'var(--ap-ink)' }} onClick={() => c.setCurrentFolderId(f.id)}>{f.name}</button>
                    </span>
                  ))}
                </div>

                {/* Filters toolbar */}
                <div className="flex flex-col sm:flex-row gap-3 mb-5">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--ap-muted)' }} />
                    <input
                      placeholder="Rechercher..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 14px 10px 38px',
                        fontFamily: 'var(--ap-font-body)', fontWeight: 700, fontSize: '14px',
                        color: 'var(--ap-ink)', background: 'var(--ap-card)',
                        border: 'var(--ap-border-w) solid var(--ap-line)', borderRadius: 'var(--ap-r-sm)',
                        outline: 'none', boxSizing: 'border-box',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--ap-brand)'; e.currentTarget.style.boxShadow = '0 0 0 4px var(--ap-brand-soft)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--ap-line)'; e.currentTarget.style.boxShadow = 'none'; }}
                    />
                  </div>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="w-[160px]" style={triggerStyle}>
                      <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                    <SelectContent style={selectContentStyle}>
                      {statusOptions.map((s) => (
                        <SelectItem key={s} value={s}>{s === 'Tous' ? 'Tous' : STATUS_LABEL[s].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
                    <SelectTrigger className="w-[150px]" style={triggerStyle}>
                      <SelectValue placeholder="Trier" />
                    </SelectTrigger>
                    <SelectContent style={selectContentStyle}>
                      <SelectItem value="newest">Plus récent</SelectItem>
                      <SelectItem value="oldest">Plus ancien</SelectItem>
                      <SelectItem value="az">A → Z</SelectItem>
                      <SelectItem value="closing">Ferme bientôt</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => setView('grid')} style={toggleBtnStyle(viewMode === 'grid')} title="Vue grille"><LayoutGrid className="w-4 h-4" /></button>
                    <button onClick={() => setView('list')} style={toggleBtnStyle(viewMode === 'list')} title="Vue liste"><List className="w-4 h-4" /></button>
                  </div>
                </div>

                {c.loading ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Chargement…</p>
                ) : filtered.length === 0 ? (
                  <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--ap-muted)', fontWeight: 700, fontSize: 14 }}>
                    {c.currentFolderId ? 'Aucun examen dans ce dossier.' : 'Aucun examen ne correspond à votre recherche.'}
                  </div>
                ) : viewMode === 'grid' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                    {filtered.map(({ row }) => <ExamCard key={row.id} row={row} navigate={navigate} />)}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filtered.map(({ row }) => <ExamRow key={row.id} row={row} navigate={navigate} />)}
                  </div>
                )}
              </div>
            </div>
          </DndContext>
        )}
      </div>
    </div>
  );
}
