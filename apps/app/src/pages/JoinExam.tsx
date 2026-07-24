import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getExamByJoinCode, computeExamStatus } from '@/lib/examStorage';
import { AlertTriangle, BookOpen } from 'lucide-react';

type State = 'idle' | 'checking' | 'not-found' | 'not-open';

export default function JoinExam() {
  const navigate = useNavigate();
  const { joinCode: paramCode } = useParams<{ joinCode?: string }>();
  const [code, setCode] = useState(paramCode?.toUpperCase() ?? '');
  const [state, setState] = useState<State>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setState('checking');
    const exam = await getExamByJoinCode(trimmed);
    if (!exam) {
      setState('not-found');
      return;
    }

    const status = computeExamStatus(exam);
    if (status !== 'open') {
      const msgs: Record<string, string> = {
        draft: "Cet examen n'est pas encore disponible.",
        scheduled: "Cet examen n'a pas encore commencé.",
        closed: "Cet examen est terminé.",
        archived: "Cet examen est archivé.",
      };
      setStatusMsg(msgs[status] ?? "Cet examen n'est pas accessible.");
      setState('not-open');
      return;
    }

    navigate(`/take/${trimmed}`);
  };

  useEffect(() => {
    if (paramCode) handleJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
    }}>
      <div className="ap-card ap-card--floaty" style={{ maxWidth: 440, width: '100%', padding: '40px', textAlign: 'center' }}>
        <BookOpen className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--ap-brand)' }} />
        <h2 className="ap-h2" style={{ fontSize: '24px', marginBottom: '8px' }}>Rejoindre un examen</h2>
        <p className="ap-muted" style={{ fontSize: '15px', marginBottom: '28px' }}>
          Entrez le code fourni par votre formateur.
        </p>

        {state === 'not-found' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: '#fff3f3', color: '#c0392b' }}>
            <AlertTriangle size={16} />
            <span style={{ fontSize: 14 }}>Code introuvable. Vérifiez et réessayez.</span>
          </div>
        )}

        {state === 'not-open' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: '#fffbea', color: '#856404' }}>
            <AlertTriangle size={16} />
            <span style={{ fontSize: 14 }}>{statusMsg}</span>
          </div>
        )}

        <input
          className="ap-code"
          type="text"
          placeholder="EX: AB3D7K"
          maxLength={6}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setState('idle');
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          style={{ width: '100%', marginBottom: '16px', textAlign: 'center', letterSpacing: '0.2em' }}
          autoFocus
          aria-label="Code d'accès"
        />

        <button
          className="ap-btn ap-btn--pill"
          onClick={handleJoin}
          disabled={!code.trim() || state === 'checking'}
          style={{ width: '100%', opacity: code.trim() && state !== 'checking' ? 1 : 0.5 }}
        >
          {state === 'checking' ? '…' : "Accéder à l'examen"}
        </button>

        <button
          className="ap-btn ap-btn--sm"
          onClick={() => { window.location.href = '/'; }}
          style={{ marginTop: 16, background: 'transparent', color: 'var(--ap-muted)' }}
        >
          Retour
        </button>
      </div>
    </div>
  );
}
