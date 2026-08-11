import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Radio } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getLiveEventByCode, getOpenRun, joinLiveRun, type LiveEvent } from '@/lib/lms/liveEngagement';
import { genLiveClientId, getLiveParticipantIdentity, setLiveParticipantIdentity } from '@/lib/lms/liveParticipant';

type State = 'entry' | 'checking' | 'identify' | 'not-found' | 'not-open' | 'needs-auth' | 'joining' | 'error';

export default function LiveEventJoin() {
  const navigate = useNavigate();
  const { code: paramCode } = useParams<{ code?: string }>();
  const [code, setCode] = useState(paramCode?.toUpperCase() ?? '');
  const [state, setState] = useState<State>(paramCode ? 'checking' : 'entry');
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [displayName, setDisplayName] = useState(getLiveParticipantIdentity()?.displayName ?? '');
  const [errorMsg, setErrorMsg] = useState('');

  const resolveCode = async (trimmed: string) => {
    setState('checking');
    setErrorMsg('');
    try {
      const found = await getLiveEventByCode(trimmed);
      if (!found) {
        setState('not-found');
        return;
      }
      setEvent(found);
      if (found.access_policy === 'authenticated' || found.access_policy === 'allowlist') {
        if (!getCurrentUser()) {
          setState('needs-auth');
          return;
        }
      }
      setState('identify');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur inattendue.');
      setState('error');
    }
  };

  useEffect(() => {
    if (paramCode) void resolveCode(paramCode.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheckCode = () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    void resolveCode(trimmed);
  };

  const handleJoin = async () => {
    if (!event) return;
    const currentUser = getCurrentUser();
    const name = currentUser?.username?.trim() || displayName.trim();
    if (event.access_policy !== 'anonymous' && !name) {
      setErrorMsg('Un nom est requis pour rejoindre.');
      return;
    }

    setState('joining');
    setErrorMsg('');
    try {
      const run = await getOpenRun(event.id);
      if (!run) {
        setState('not-open');
        return;
      }
      const identity = getLiveParticipantIdentity() ?? { clientId: genLiveClientId(), displayName: name };
      identity.displayName = name;
      setLiveParticipantIdentity(identity);

      await joinLiveRun(run.id, identity.clientId, name || null);
      navigate(`/live/${event.code}/room`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Impossible de rejoindre.');
      setState('identify');
    }
  };

  return (
    <div className="product-entry-shell">
      <div className="product-entry-card">
        <div className="product-entry-heading">
          <span className="product-entry-heading__icon"><Radio className="h-6 w-6" /></span>
          <h1>Rejoindre une session live</h1>
          <p>Entrez le code transmis par l’animateur pour accéder à la Q&amp;A.</p>
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
            <span style={{ fontSize: 14 }}>Aucune session en cours pour cet événement. Réessayez dans un instant.</span>
          </div>
        )}
        {state === 'needs-auth' && (
          <div className="product-entry-alert" role="alert">
            <AlertTriangle size={16} />
            <span style={{ fontSize: 14 }}>Cet événement nécessite d’être connecté. Connectez-vous puis revenez sur ce lien.</span>
          </div>
        )}
        {(state === 'error' || (errorMsg && state === 'identify')) && (
          <div className="product-entry-alert" role="alert">
            <AlertTriangle size={16} />
            <span style={{ fontSize: 14 }}>{errorMsg}</span>
          </div>
        )}

        {state === 'needs-auth' ? (
          <button className="ap-btn ap-btn--pill" style={{ width: '100%' }} onClick={() => navigate('/auth')}>
            Se connecter
          </button>
        ) : state === 'identify' || state === 'joining' ? (
          <>
            {event && event.access_policy !== 'anonymous' && !getCurrentUser() && (
              <>
                <label htmlFor="live-display-name" style={{ display: 'block', marginBottom: 7, fontSize: 13, fontWeight: 750 }}>
                  Votre nom
                </label>
                <input
                  id="live-display-name"
                  className="ap-code"
                  type="text"
                  placeholder="Votre nom"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  style={{ width: '100%', marginBottom: 16, textAlign: 'center' }}
                  autoFocus
                />
              </>
            )}
            <button
              className="ap-btn ap-btn--pill"
              onClick={handleJoin}
              disabled={state === 'joining'}
              style={{ width: '100%', opacity: state === 'joining' ? 0.6 : 1 }}
            >
              {state === 'joining' ? 'Connexion...' : 'Rejoindre'}
            </button>
          </>
        ) : (
          <>
            <label htmlFor="live-access-code" style={{ display: 'block', marginBottom: 7, fontSize: 13, fontWeight: 750 }}>
              Code d’accès
            </label>
            <input
              id="live-access-code"
              className="ap-code"
              type="text"
              placeholder="AB3D7K"
              maxLength={8}
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setState('entry'); setErrorMsg(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleCheckCode()}
              style={{ width: '100%', marginBottom: 16, textAlign: 'center', letterSpacing: '0.2em' }}
              autoFocus
              aria-label="Code d'accès"
            />
            <button
              className="ap-btn ap-btn--pill"
              onClick={handleCheckCode}
              disabled={!code.trim() || state === 'checking'}
              style={{ width: '100%', opacity: code.trim() && state !== 'checking' ? 1 : 0.5 }}
            >
              {state === 'checking' ? 'Vérification...' : 'Continuer'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
