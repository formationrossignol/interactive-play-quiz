import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHostExams, computeExamStats, computeExamStatus, type Exam } from '@/lib/examStorage';
import { getCurrentUser } from '@/lib/auth';
import { Header } from '@/components/Header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, LayoutGrid, List } from 'lucide-react';

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
  border: '2px solid var(--ap-line)', borderRadius: 'var(--ap-r-sm)',
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
  background: 'var(--ap-card)', border: '2px solid var(--ap-line)', borderRadius: 'var(--ap-r-md)',
};

export default function MyExams() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [exams, setExams] = useState<Exam[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('Tous');
  const [sort, setSort] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(
    () => (localStorage.getItem(VIEW_KEY) as 'grid' | 'list') ?? 'grid',
  );

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    setExams(getHostExams(user.id));
  }, [user, navigate]);

  const setView = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem(VIEW_KEY, mode);
  };

  // Live status per exam (memoized so filters/sort stay consistent within a render)
  const withStatus = useMemo(
    () => exams.map((exam) => ({ exam, liveStatus: computeExamStatus(exam) })),
    [exams],
  );

  const statusOptions = useMemo(() => {
    const present = new Set(withStatus.map((e) => e.liveStatus));
    return ['Tous', ...Object.keys(STATUS_LABEL).filter((s) => present.has(s as Exam['status']))];
  }, [withStatus]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = withStatus.filter(({ exam, liveStatus }) => {
      const matchSearch =
        !q ||
        exam.title.toLowerCase().includes(q) ||
        (exam.description ?? '').toLowerCase().includes(q) ||
        exam.joinCode.toLowerCase().includes(q);
      const matchStatus = status === 'Tous' || liveStatus === status;
      return matchSearch && matchStatus;
    });

    result = [...result].sort((a, b) => {
      switch (sort) {
        case 'oldest': return a.exam.createdAt.localeCompare(b.exam.createdAt);
        case 'az': return a.exam.title.localeCompare(b.exam.title, 'fr');
        case 'closing': return a.exam.closeAt.localeCompare(b.exam.closeAt);
        default: return b.exam.createdAt.localeCompare(a.exam.createdAt);
      }
    });
    return result;
  }, [withStatus, search, status, sort]);

  if (!user) return null;

  const renderMeta = (exam: Exam, liveStatus: string, stats: ReturnType<typeof computeExamStats>) => (
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

  const actionButtons = (exam: Exam, size: 'sm' | 'md' = 'md') => {
    const pad = size === 'sm' ? '5px 12px' : '6px 14px';
    const fs = size === 'sm' ? 11 : 12;
    return (
      <>
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/exam-builder?examId=${exam.id}`); }}
          style={{
            padding: pad, borderRadius: 999, border: '2px solid var(--ap-line)',
            background: 'var(--ap-paper-2)', fontFamily: 'var(--ap-font-body)',
            fontWeight: 800, fontSize: fs, color: 'var(--ap-ink)', cursor: 'pointer',
          }}
        >
          Modifier
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/exam/${exam.id}/admin`); }}
          style={{
            padding: pad, borderRadius: 999, border: 'none',
            background: 'var(--ap-brand)', color: '#fff', fontFamily: 'var(--ap-font-body)',
            fontWeight: 800, fontSize: fs, cursor: 'pointer',
          }}
        >
          Résultats →
        </button>
      </>
    );
  };

  const renderCard = (exam: Exam, liveStatus: string) => {
    const stats = computeExamStats(exam.id);
    return (
      <div
        key={exam.id}
        className="ap-card ap-card--hover"
        style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer', height: '100%' }}
        onClick={() => navigate(`/exam/${exam.id}/admin`)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
          {renderMeta(exam, liveStatus, stats)}
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', gap: 8, paddingTop: 4 }} onClick={(e) => e.stopPropagation()}>
          {actionButtons(exam)}
        </div>
      </div>
    );
  };

  const renderRow = (exam: Exam, liveStatus: string) => {
    const stats = computeExamStats(exam.id);
    return (
      <div
        key={exam.id}
        className="ap-card ap-card--hover"
        style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}
        onClick={() => navigate(`/exam/${exam.id}/admin`)}
      >
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
            {renderMeta(exam, liveStatus, stats)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          {actionButtons(exam)}
        </div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <Header />
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 16px' }}>
        {/* Header row */}
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

        {exams.length === 0 ? (
          <div style={{
            background: 'var(--ap-card)', border: '2px solid var(--ap-line)',
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
          <>
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
                    border: '2px solid var(--ap-line)', borderRadius: 'var(--ap-r-sm)',
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

            {filtered.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--ap-muted)', fontWeight: 700, fontSize: 14 }}>
                Aucun examen ne correspond à votre recherche.
              </div>
            ) : viewMode === 'grid' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {filtered.map(({ exam, liveStatus }) => renderCard(exam, liveStatus))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filtered.map(({ exam, liveStatus }) => renderRow(exam, liveStatus))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
