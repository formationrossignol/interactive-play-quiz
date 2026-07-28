import { useEffect, useRef, useState } from 'react';
import type { Exam } from '@/lib/examStorage';
import type { Participant } from '@/lib/examParticipant';
import {
  readSebEnvironment,
  verifyProctoringEnvironment,
  type SebEnvironment,
} from '@/lib/proctoring';
import {
  AlertTriangle,
  Camera,
  Check,
  LockKeyhole,
  Mic,
  MonitorUp,
  ShieldCheck,
} from 'lucide-react';

export interface ProctoringStreams {
  camera: MediaStream | null;
  screen: MediaStream | null;
}

interface Props {
  exam: Exam;
  participant: Participant;
  onReady: (streams: ProctoringStreams) => void;
}

type CheckState = 'pending' | 'checking' | 'ok' | 'error' | 'optional';

interface CheckItem {
  id: 'seb' | 'fullscreen' | 'camera' | 'microphone' | 'screen';
  label: string;
  detail: string;
  state: CheckState;
  required: boolean;
}

export function ProctoringPreflight({ exam, participant, onReady }: Props) {
  const config = exam.proctoring;
  const [consented, setConsented] = useState(!config.consentRequired);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [checks, setChecks] = useState<CheckItem[]>(() => [
    {
      id: 'seb',
      label: 'Safe Exam Browser',
      detail: config.sebRequired ? `Version ${config.sebMinVersion} ou supérieure et configuration autorisée.` : 'Non requis pour cet examen.',
      state: config.sebRequired ? 'pending' : 'optional',
      required: config.sebRequired,
    },
    {
      id: 'fullscreen',
      label: 'Mode plein écran',
      detail: 'Requis pendant toute la durée de l’épreuve.',
      state: 'pending',
      required: true,
    },
    {
      id: 'camera',
      label: 'Caméra',
      detail: config.webcamRequired ? 'Autorisation, aperçu et continuité du flux.' : 'Non requise.',
      state: config.webcamRequired ? 'pending' : 'optional',
      required: config.webcamRequired,
    },
    {
      id: 'microphone',
      label: 'Microphone',
      detail: config.microphoneRequired ? 'Autorisation et test du signal.' : 'Non requis.',
      state: config.microphoneRequired ? 'pending' : 'optional',
      required: config.microphoneRequired,
    },
    {
      id: 'screen',
      label: 'Partage d’écran',
      detail: config.screenshotMode !== 'none' ? 'Choisissez l’écran complet utilisé pour l’examen.' : 'Aucune capture d’écran.',
      state: config.screenshotMode !== 'none' ? 'pending' : 'optional',
      required: config.screenshotMode !== 'none',
    },
  ]);
  const [preview, setPreview] = useState<MediaStream | null>(null);
  const streamsRef = useRef<ProctoringStreams>({ camera: null, screen: null });

  useEffect(() => () => {
    // If the preflight is abandoned, release hardware immediately. Streams
    // handed to ExamRoom stay alive because running becomes false only after
    // onReady changes the parent phase and this cleanup sees the same refs.
    if (running) return;
    streamsRef.current.camera?.getTracks().forEach((track) => track.stop());
    streamsRef.current.screen?.getTracks().forEach((track) => track.stop());
  }, [running]);

  const updateCheck = (id: CheckItem['id'], state: CheckState, detail?: string) => {
    setChecks((current) => current.map((item) => item.id === id ? { ...item, state, detail: detail ?? item.detail } : item));
  };

  const runChecks = async () => {
    if (!consented || running) return;
    setRunning(true);
    setError('');

    try {
      let seb: SebEnvironment = { detected: false, version: null, browserExamKey: null, configKey: null };
      if (config.sebRequired) {
        updateCheck('seb', 'checking');
        seb = await readSebEnvironment();
        const result = await verifyProctoringEnvironment(exam.id, participant.id, seb);
        if (!result.valid) {
          updateCheck('seb', 'error', seb.detected ? 'SEB détecté, mais la version ou la configuration est refusée.' : 'Safe Exam Browser non détecté.');
          throw new Error('Cet examen doit être ouvert avec la configuration Safe Exam Browser autorisée.');
        }
        updateCheck('seb', 'ok', seb.version ? `Vérifié : ${seb.version}` : 'Configuration SEB vérifiée.');
      }

      updateCheck('fullscreen', 'checking');
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      updateCheck('fullscreen', 'ok', 'Plein écran actif.');

      if (config.webcamRequired || config.microphoneRequired) {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Caméra et microphone non pris en charge par ce navigateur.');
        if (config.webcamRequired) updateCheck('camera', 'checking');
        if (config.microphoneRequired) updateCheck('microphone', 'checking');
        const camera = await navigator.mediaDevices.getUserMedia({
          video: config.webcamRequired ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
          audio: config.microphoneRequired,
        });
        streamsRef.current.camera = camera;
        setPreview(camera);
        if (config.webcamRequired) updateCheck('camera', 'ok', 'Caméra active.');
        if (config.microphoneRequired) {
          const audioTrack = camera.getAudioTracks()[0];
          if (!audioTrack || audioTrack.readyState !== 'live') throw new Error('Aucun signal microphone disponible.');
          updateCheck('microphone', 'ok', `Microphone actif : ${audioTrack.label || 'périphérique autorisé'}.`);
        }
      }

      if (config.screenshotMode !== 'none') {
        updateCheck('screen', 'checking');
        if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("Le partage d'écran n'est pas pris en charge par ce navigateur.");
        const screen = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'monitor' },
          audio: false,
        });
        streamsRef.current.screen = screen;
        updateCheck('screen', 'ok', 'Écran partagé. Le flux s’arrête automatiquement à la fin.');
      }

      // Let the user see the camera preview before explicitly entering the exam.
      if (!config.webcamRequired) {
        onReady(streamsRef.current);
        return;
      }
    } catch (checkError) {
      setRunning(false);
      setError(checkError instanceof Error ? checkError.message : 'Le contrôle préalable a échoué.');
    }
  };

  const enterExam = () => {
    onReady(streamsRef.current);
  };

  const allRequiredOk = checks.filter((item) => item.required).every((item) => item.state === 'ok');

  return (
    <div style={{
      background: 'var(--ap-card)',
      border: 'var(--ap-border-w) solid var(--ap-line)',
      borderRadius: 'var(--ap-r-lg)',
      padding: 24,
      width: '100%',
      textAlign: 'left',
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 20 }}>
        <ShieldCheck style={{ width: 30, height: 30, color: 'var(--ap-brand)', flexShrink: 0 }} />
        <div>
          <h1 style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 700, fontSize: 21, margin: 0 }}>
            Contrôle préalable
          </h1>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ap-muted)', lineHeight: 1.55, margin: '4px 0 0' }}>
            Niveau {levelLabel(config.level)} · vérifiez votre environnement avant de commencer.
          </p>
        </div>
      </div>

      <div style={{
        padding: '12px 14px',
        borderRadius: 'var(--ap-r-sm)',
        background: 'var(--ap-paper-2)',
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1.55,
        color: 'var(--ap-muted)',
        marginBottom: 16,
      }}>
        Cet examen journalise les événements de navigation
        {config.webcamRequired ? ', utilise votre caméra' : ''}
        {config.microphoneRequired ? ', analyse le niveau du microphone' : ''}
        {config.screenshotMode !== 'none' ? ' et réalise des captures horodatées' : ''}.
        Les alertes automatisées doivent être vérifiées par un enseignant et ne constituent pas une preuve de fraude.
        Conservation prévue : {config.retentionDays} jours.
      </div>

      <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        {checks.map((item) => <PreflightRow key={item.id} item={item} />)}
      </div>

      {preview && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--ap-muted)', marginBottom: 7 }}>
            Aperçu caméra
          </div>
          <video
            ref={(node) => { if (node) node.srcObject = preview; }}
            autoPlay
            muted
            playsInline
            style={{ width: '100%', maxHeight: 210, objectFit: 'cover', borderRadius: 'var(--ap-r-sm)', background: '#14121e', transform: 'scaleX(-1)' }}
          />
        </div>
      )}

      {config.consentRequired && (
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 16 }}>
          <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} style={{ marginTop: 3, accentColor: 'var(--ap-brand)' }} />
          <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.5 }}>
            Je confirme avoir lu l’information ci-dessus et les consignes de surveillance applicables à cet examen.
          </span>
        </label>
      )}

      {error && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 'var(--ap-r-sm)', background: '#fff3f0', color: '#b9382d', fontSize: 12, fontWeight: 800, marginBottom: 14 }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} /> {error}
        </div>
      )}

      {!allRequiredOk ? (
        <button
          className="ap-btn ap-btn--pill"
          onClick={() => void runChecks()}
          disabled={!consented || running}
          style={{ width: '100%', opacity: consented && !running ? 1 : .55 }}
        >
          {running ? 'Vérification en cours…' : 'Vérifier mon équipement'}
        </button>
      ) : (
        <button className="ap-btn ap-btn--pill" onClick={enterExam} style={{ width: '100%' }}>
          Commencer l’examen
        </button>
      )}
    </div>
  );
}

function PreflightRow({ item }: { item: CheckItem }) {
  const icons = {
    seb: LockKeyhole,
    fullscreen: MonitorUp,
    camera: Camera,
    microphone: Mic,
    screen: MonitorUp,
  };
  const Icon = icons[item.id];
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '28px minmax(0, 1fr) 22px',
      gap: 9,
      alignItems: 'center',
      padding: '10px 12px',
      border: 'var(--ap-border-w) solid var(--ap-line)',
      borderRadius: 'var(--ap-r-sm)',
    }}>
      <Icon size={18} style={{ color: 'var(--ap-muted)' }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 800 }}>{item.label}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: item.state === 'error' ? '#b9382d' : 'var(--ap-muted)', lineHeight: 1.4 }}>{item.detail}</div>
      </div>
      {item.state === 'ok' && <Check size={18} style={{ color: '#15a575' }} />}
      {item.state === 'error' && <AlertTriangle size={18} style={{ color: '#d84c40' }} />}
      {item.state === 'checking' && <span className="ap-skeleton-shimmer" style={{ width: 16, height: 16, borderRadius: '50%' }} />}
    </div>
  );
}

function levelLabel(level: Exam['proctoring']['level']): string {
  return {
    none: 'sans contrôle',
    light: 'léger',
    standard: 'standard',
    enhanced: 'renforcé',
  }[level];
}
