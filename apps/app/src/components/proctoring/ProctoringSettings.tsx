import {
  applyProctoringLevel,
  type ProctoringConfig,
  type ProctoringLevel,
  type ScreenshotMode,
} from '@/lib/proctoring';
import {
  BrainCircuit,
  Camera,
  Check,
  Eye,
  LockKeyhole,
  Mic,
  MonitorUp,
  Shield,
} from 'lucide-react';

interface Props {
  value: ProctoringConfig;
  onChange: (value: ProctoringConfig) => void;
  browserExamKey: string;
  configKey: string;
  onBrowserExamKeyChange: (value: string) => void;
  onConfigKeyChange: (value: string) => void;
}

const LEVELS: Array<{
  value: ProctoringLevel;
  title: string;
  description: string;
  icon: typeof Shield;
}> = [
  { value: 'none', title: 'Aucun contrôle', description: 'Utilisation classique, sans restriction.', icon: Eye },
  { value: 'light', title: 'Contrôle léger', description: 'Plein écran, focus et journal des événements.', icon: MonitorUp },
  { value: 'standard', title: 'Contrôle standard', description: 'Restrictions navigateur et captures sur incident.', icon: Shield },
  { value: 'enhanced', title: 'Contrôle renforcé', description: 'SEB, caméra, micro, captures et validation.', icon: LockKeyhole },
];

export function ProctoringSettings({
  value,
  onChange,
  browserExamKey,
  configKey,
  onBrowserExamKeyChange,
  onConfigKeyChange,
}: Props) {
  const set = <K extends keyof ProctoringConfig>(key: K, next: ProctoringConfig[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <>
      <div className="eb-section">
        <div className="eb-section-title"><Shield style={{ width: 18, height: 18 }} /> Niveau de surveillance</div>
        <p className="eb-hint" style={{ marginTop: -10, marginBottom: 16 }}>
          Le proctoring est optionnel. Chaque niveau reste ajustable en fonction de votre politique interne.
        </p>
        <div className="eb-radio-group">
          {LEVELS.map(({ value: level, title, description, icon: Icon }) => (
            <button
              type="button"
              key={level}
              className={`eb-radio ${value.level === level ? 'on' : ''}`}
              onClick={() => onChange(applyProctoringLevel(value, level))}
              style={{ width: '100%', textAlign: 'left', fontFamily: 'inherit', color: 'inherit', background: undefined }}
            >
              <div className="eb-radio-dot" />
              <Icon style={{ width: 18, height: 18, flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 800 }}>{title}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ap-muted)' }}>{description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {value.enabled && (
        <>
          <div className="eb-section">
            <div className="eb-section-title"><LockKeyhole style={{ width: 18, height: 18 }} /> Safe Exam Browser</div>
            <Toggle
              checked={value.sebRequired}
              onChange={(checked) => set('sebRequired', checked)}
              title="Safe Exam Browser obligatoire"
              description="Le démarrage sera refusé si SEB ou la configuration autorisée ne sont pas vérifiés."
            />
            {value.sebRequired && (
              <div style={{ marginTop: 16, display: 'grid', gap: 14 }}>
                <Field label="Version minimale">
                  <input className="eb-input" value={value.sebMinVersion} onChange={(e) => set('sebMinVersion', e.target.value)} placeholder="3.3.2" />
                </Field>
                <div className="eb-row">
                  <Field label={`Browser Exam Key${value.sebKeyConfigured ? ' (déjà configurée)' : ''}`}>
                    <input
                      className="eb-input"
                      type="password"
                      value={browserExamKey}
                      onChange={(e) => onBrowserExamKeyChange(e.target.value)}
                      placeholder={value.sebKeyConfigured ? 'Laisser vide pour conserver' : 'Clé générée par SEB'}
                      autoComplete="new-password"
                    />
                  </Field>
                  <Field label="Config Key (optionnelle)">
                    <input
                      className="eb-input"
                      type="password"
                      value={configKey}
                      onChange={(e) => onConfigKeyChange(e.target.value)}
                      placeholder="Clé de configuration SEB"
                      autoComplete="new-password"
                    />
                  </Field>
                </div>
                <p className="eb-hint">
                  Les clés sont stockées séparément de la configuration visible par le candidat et comparées côté serveur.
                </p>
              </div>
            )}
          </div>

          <div className="eb-section">
            <div className="eb-section-title"><Camera style={{ width: 18, height: 18 }} /> Sources de surveillance</div>
            <div style={{ display: 'grid', gap: 14 }}>
              <Toggle
                checked={value.webcamRequired}
                onChange={(checked) => set('webcamRequired', checked)}
                title="Webcam obligatoire"
                description="Autorisation et aperçu avant le démarrage, détection des coupures pendant l’épreuve."
                icon={Camera}
              />
              <Toggle
                checked={value.microphoneRequired}
                onChange={(checked) => set('microphoneRequired', checked)}
                title="Microphone obligatoire"
                description="Test avant l’épreuve et détection des coupures ou niveaux inhabituels."
                icon={Mic}
              />
              {value.microphoneRequired && (
                <Toggle
                  checked={value.audioRecording}
                  onChange={(checked) => set('audioRecording', checked)}
                  title="Enregistrement audio"
                  description="Option sensible : à activer uniquement avec une base légale et une information adaptées."
                />
              )}
              <Field label="Captures">
                <select
                  className="eb-input"
                  value={value.screenshotMode}
                  onChange={(e) => set('screenshotMode', e.target.value as ScreenshotMode)}
                >
                  <option value="none">Aucune</option>
                  <option value="manual">Manuelles</option>
                  <option value="periodic">Périodiques</option>
                  <option value="event">Lors d’un événement suspect</option>
                </select>
              </Field>
              {value.screenshotMode === 'periodic' && (
                <Field label={`Intervalle : ${value.screenshotIntervalSeconds} secondes`}>
                  <input
                    type="range"
                    className="eb-range"
                    min={30}
                    max={600}
                    step={30}
                    value={value.screenshotIntervalSeconds}
                    onChange={(e) => set('screenshotIntervalSeconds', Number(e.target.value))}
                  />
                </Field>
              )}
            </div>
          </div>

          <div className="eb-section">
            <div className="eb-section-title"><BrainCircuit style={{ width: 18, height: 18 }} /> Analyse et tolérances</div>
            <Toggle
              checked={value.aiAnalysis}
              onChange={(checked) => set('aiAnalysis', checked)}
              title="Analyse automatisée"
              description="Produit des alertes à vérifier. Elle ne constitue jamais une preuve de fraude."
              icon={BrainCircuit}
            />
            <div className="eb-row" style={{ marginTop: 18 }}>
              <NumberField label="Changements d’onglet tolérés" value={value.maxTabSwitches} min={0} max={50} onChange={(n) => set('maxTabSwitches', n)} />
              <NumberField label="Sorties plein écran tolérées" value={value.maxFullscreenExits} min={0} max={50} onChange={(n) => set('maxFullscreenExits', n)} />
              <NumberField label="Temps maximal hors focus (s)" value={value.maxOutOfFocusSeconds} min={0} max={600} onChange={(n) => set('maxOutOfFocusSeconds', n)} />
              <NumberField
                label="Arrêt après X violations (0 = désactivé)"
                value={value.autoSubmitAfterViolations ?? 0}
                min={0}
                max={100}
                onChange={(n) => set('autoSubmitAfterViolations', n > 0 ? n : null)}
              />
            </div>
            <Field label="Message lors d’une violation">
              <input className="eb-input" value={value.violationMessage} onChange={(e) => set('violationMessage', e.target.value)} />
            </Field>
          </div>

          <div className="eb-section">
            <div className="eb-section-title"><Shield style={{ width: 18, height: 18 }} /> Vie privée et conservation</div>
            <div className="eb-row">
              <NumberField label="Durée de conservation (jours)" value={value.retentionDays} min={1} max={3650} onChange={(n) => set('retentionDays', n)} />
              <div style={{ alignSelf: 'end', paddingBottom: 8 }}>
                <Toggle
                  checked={value.consentRequired}
                  onChange={(checked) => set('consentRequired', checked)}
                  title="Recueillir une confirmation"
                  description="Le candidat confirme avoir lu l’information préalable."
                />
              </div>
            </div>
            <p className="eb-hint" style={{ marginTop: 14 }}>
              La durée doit être justifiée par la finalité. Les accès aux médias sont tracés et la suppression est automatisable.
            </p>
          </div>
        </>
      )}
    </>
  );
}

function Toggle({
  checked,
  onChange,
  title,
  description,
  icon: Icon,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description: string;
  icon?: typeof Camera;
}) {
  return (
    <button
      type="button"
      className="eb-toggle"
      onClick={() => onChange(!checked)}
      style={{ border: 0, background: 'transparent', padding: 0, textAlign: 'left', color: 'inherit', fontFamily: 'inherit', width: '100%' }}
      aria-pressed={checked}
    >
      <div className={`eb-check ${checked ? 'on' : ''}`}>
        {checked && <Check style={{ width: 12, height: 12, color: '#fff', strokeWidth: 3 }} />}
      </div>
      {Icon && <Icon style={{ width: 18, height: 18, flexShrink: 0 }} />}
      <div>
        <div style={{ fontSize: 14, fontWeight: 800 }}>{title}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ap-muted)', lineHeight: 1.45 }}>{description}</div>
      </div>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span className="eb-label">{label}</span>
      {children}
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <input
        className="eb-input"
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
      />
    </Field>
  );
}
