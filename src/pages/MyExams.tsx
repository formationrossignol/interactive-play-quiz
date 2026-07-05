import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHostExams, computeExamStats, computeExamStatus, type Exam } from '@/lib/examStorage';
import { getCurrentUser } from '@/lib/auth';
import { Header } from '@/components/Header';

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Brouillon',  color: '#6d6288', bg: '#f3ecdd' },
  scheduled: { label: 'Planifié',   color: '#2f7bff', bg: '#eef4ff' },
  open:      { label: 'Ouvert',     color: '#15c08a', bg: '#e8faf3' },
  closed:    { label: 'Fermé',      color: '#ff5a4d', bg: '#fff3f0' },
  archived:  { label: 'Archivé',    color: '#aaa',    bg: '#f3f3f3' },
};

export default function MyExams() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [exams, setExams] = useState<Exam[]>([]);

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    setExams(getHostExams(user.id));
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ap-paper)' }}>
      <Header />
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 16px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {exams.map((exam) => {
              const liveStatus = computeExamStatus(exam);
              const badge = STATUS_LABEL[liveStatus];
              const stats = computeExamStats(exam.id);
              return (
                <div
                  key={exam.id}
                  style={{
                    background: 'var(--ap-card)', border: '2px solid var(--ap-line)',
                    borderRadius: 'var(--ap-r-lg)', padding: '18px 22px',
                    display: 'flex', alignItems: 'center', gap: 16,
                    cursor: 'pointer', transition: 'border-color .15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--ap-brand)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--ap-line)'; }}
                  onClick={() => navigate(`/exam/${exam.id}/admin`)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 600, fontSize: 16 }}>
                        {exam.title}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 800, letterSpacing: '.05em', padding: '2px 8px',
                        borderRadius: 999, color: badge.color, background: badge.bg,
                      }}>
                        {badge.label}
                      </span>
                      {liveStatus !== 'draft' && (
                        <span style={{
                          fontFamily: 'var(--ap-font-mono)', fontSize: 12, fontWeight: 800,
                          color: 'var(--ap-muted)', letterSpacing: '.08em',
                        }}>
                          {exam.joinCode}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ap-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
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
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/exam-builder?examId=${exam.id}`); }}
                      style={{
                        padding: '6px 14px', borderRadius: 999,
                        border: '2px solid var(--ap-line)', background: 'var(--ap-paper-2)',
                        fontFamily: 'var(--ap-font-body)', fontWeight: 800, fontSize: 12,
                        color: 'var(--ap-ink)', cursor: 'pointer',
                      }}
                    >
                      Modifier
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/exam/${exam.id}/admin`); }}
                      style={{
                        padding: '6px 14px', borderRadius: 999, border: 'none',
                        background: 'var(--ap-brand)', color: '#fff',
                        fontFamily: 'var(--ap-font-body)', fontWeight: 800, fontSize: 12, cursor: 'pointer',
                      }}
                    >
                      Résultats →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
