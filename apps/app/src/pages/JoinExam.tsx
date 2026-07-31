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
    <div className="product-entry-shell">
      <div className="product-entry-card">
        <div className="product-entry-heading">
          <span className="product-entry-heading__icon"><BookOpen className="h-6 w-6" /></span>
          <h1>Rejoindre un examen</h1>
          <p>Entrez le code transmis par votre formateur pour accéder à l’épreuve.</p>
        </div>

        {state === 'not-found' && (
          <div className="product-entry-alert" role="alert">
            <AlertTriangle size={16} />
            <span style={{ fontSize: 14 }}>Code introuvable. Vérifiez et réessayez.</span>
          </div>
        )}

        {state === 'not-open' && (
          <div className="product-entry-alert" role="alert">
            <AlertTriangle size={16} />
            <span style={{ fontSize: 14 }}>{statusMsg}</span>
          </div>
        )}

        <label htmlFor="exam-access-code" style={{ display: 'block', marginBottom: 7, fontSize: 13, fontWeight: 750 }}>
          Code d’accès
        </label>
        <input
          id="exam-access-code"
          className="ap-code"
          type="text"
          placeholder="AB3D7K"
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
          {state === 'checking' ? 'Vérification...' : "Accéder à l'examen"}
        </button>

        <button
          className="ap-btn ap-btn--ghost ap-btn--sm"
          onClick={() => { window.location.href = '/'; }}
          style={{ marginTop: 16, background: 'transparent', color: 'var(--ap-muted)' }}
        >
          Retour
        </button>
      </div>
    </div>
  );
}
