import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Attempt, Exam } from '@/lib/examStorage';
import {
  getProctoringOverviewPage,
  reviewProctoringReport,
  type ProctoringAttemptOverview,
  type ProctoringDecision,
} from '@/lib/proctoring';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Eye,
  MonitorUp,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  exam: Exam;
  attempts: Attempt[];
}

const DECISIONS: Array<{ value: ProctoringDecision; label: string; color: string; icon: typeof CheckCircle2 }> = [
  { value: 'compliant', label: 'Conforme', color: '#15976d', icon: CheckCircle2 },
  { value: 'review', label: 'À vérifier', color: '#b97a12', icon: AlertTriangle },
  { value: 'non-compliant', label: 'Non conforme', color: '#c34035', icon: XCircle },
];

export function ProctoringDashboard({ exam, attempts }: Props) {
  const [items, setItems] = useState<ProctoringAttemptOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getProctoringOverviewPage(exam.id, 1);
      setItems(result.attempts);
      setPage(1);
      setHasMore(result.hasMore);
    } catch {
      toast.error('Impossible de charger les données de surveillance');
    } finally {
      setLoading(false);
    }
  }, [exam.id]);

  useEffect(() => { void load(); }, [load]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await getProctoringOverviewPage(exam.id, nextPage);
      setItems((current) => [...current, ...result.attempts]);
      setPage(nextPage);
      setHasMore(result.hasMore);
    } catch {
      toast.error('Impossible de charger la suite des rapports');
    } finally {
      setLoadingMore(false);
    }
  }, [exam.id, page]);

  const totals = useMemo(() => items.reduce((acc, item) => ({
    alerts: acc.alerts + item.alerts.length,
    captures: acc.captures + item.captures.length,
    review: acc.review + (effectiveDecision(item) === 'review' ? 1 : 0),
  }), { alerts: 0, captures: 0, review: 0 }), [items]);

  return (
    <section style={{ marginTop: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
        <ShieldCheck size={20} style={{ color: 'var(--ap-brand)' }} />
        <h2 style={{ fontFamily: 'var(--ap-font-display)', fontWeight: 650, fontSize: 19, margin: 0 }}>
          Rapport de surveillance
        </h2>
        <span style={{
          marginLeft: 4,
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: '.07em',
          textTransform: 'uppercase',
          color: 'var(--ap-brand-deep)',
          background: 'var(--ap-brand-soft)',
          padding: '3px 8px',
          borderRadius: 'var(--ap-r-sm)',
        }}>
          {levelLabel(exam.proctoring.level)}
        </span>
      </div>

      <div className="ea-row" style={{ marginBottom: 12 }}>
        <MiniStat icon={AlertTriangle} label="Alertes à vérifier" value={totals.alerts} />
        <MiniStat icon={Camera} label="Captures" value={totals.captures} />
        <MiniStat icon={Eye} label="Rapports à vérifier" value={totals.review} />
      </div>

      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ap-muted)', lineHeight: 1.5, margin: '0 0 12px' }}>
        Les signaux automatiques sont des éléments de contexte. Seule la décision de l’enseignant clôt la validation.
      </p>

      {loading ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {[0, 1].map((key) => <Skeleton key={key} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="ap-card" style={{ padding: 24, textAlign: 'center', color: 'var(--ap-muted)', fontSize: 13, fontWeight: 700 }}>
          Aucun événement de surveillance enregistré pour le moment.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {items.map((item) => {
            const attempt = attempts.find((candidate) => candidate.id === item.attemptId);
            const decision = effectiveDecision(item);
            const decisionMeta = DECISIONS.find((entry) => entry.value === decision)!;
            const DecisionIcon = decisionMeta.icon;
            const open = expanded === item.attemptId;
            return (
              <article key={item.attemptId} className="ap-card" style={{ padding: 0, overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : item.attemptId)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto auto',
                    alignItems: 'center',
                    gap: 14,
                    width: '100%',
                    padding: '13px 16px',
                    border: 0,
                    background: 'transparent',
                    color: 'inherit',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 850 }}>{item.participantName}</span>
                    <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--ap-muted)', marginTop: 2 }}>
                      {attempt?.percentage !== null && attempt?.percentage !== undefined ? `Score ${attempt.percentage}% · ` : ''}
                      {item.events.length} événement{item.events.length > 1 ? 's' : ''} · {item.alerts.length} alerte{item.alerts.length > 1 ? 's' : ''}
                    </span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: decisionMeta.color, fontSize: 11, fontWeight: 900 }}>
                    <DecisionIcon size={15} /> {decisionMeta.label}
                  </span>
                  <ChevronDown size={16} style={{ color: 'var(--ap-muted)', transform: open ? 'rotate(180deg)' : undefined }} />
                </button>

                {open && (
                  <AttemptProctoringDetail
                    item={item}
                    onReviewed={async (decision, note) => {
                      await reviewProctoringReport({ examId: exam.id, attemptId: item.attemptId, decision, note });
                      toast.success('Décision de surveillance enregistrée');
                      await load();
                    }}
                  />
                )}
              </article>
            );
          })}
          {hasMore && (
            <button
              type="button"
              className="ap-btn ap-btn--secondary ap-btn--sm"
              disabled={loadingMore}
              onClick={() => void loadMore()}
              style={{ justifySelf: 'center', marginTop: 6 }}
            >
              {loadingMore ? 'Chargement…' : 'Charger plus de rapports'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function AttemptProctoringDetail({
  item,
  onReviewed,
}: {
  item: ProctoringAttemptOverview;
  onReviewed: (decision: ProctoringDecision, note: string) => Promise<void>;
}) {
  const [decision, setDecision] = useState<ProctoringDecision>(effectiveDecision(item));
  const [note, setNote] = useState(item.report?.teacherNote ?? '');
  const [saving, setSaving] = useState(false);

  return (
    <div style={{ padding: '14px 16px 16px', borderTop: 'var(--ap-border-w) solid var(--ap-line)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 14 }}>
        <Metric icon={MonitorUp} label="Onglets" value={item.report?.tabSwitchCount ?? countEvents(item, 'tab_hidden')} />
        <Metric icon={MonitorUp} label="Plein écran" value={item.report?.fullscreenExitCount ?? countEvents(item, 'fullscreen_exited')} />
        <Metric icon={Clock3} label="Hors focus" value={`${item.report?.focusLostSeconds ?? focusSeconds(item)} s`} />
        <Metric icon={Camera} label="Captures" value={item.captures.length} />
      </div>

      {item.alerts.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <Label>Alertes</Label>
          <div style={{ display: 'grid', gap: 6 }}>
            {item.alerts.map((alert) => (
              <div key={alert.id} style={{ display: 'flex', gap: 8, padding: '8px 10px', borderRadius: 'var(--ap-r-sm)', background: alert.severity === 'critical' ? '#fff3f0' : '#fff9e9' }}>
                <AlertTriangle size={15} style={{ color: alert.severity === 'critical' ? '#c34035' : '#b97a12', flexShrink: 0, marginTop: 1 }} />
                <span>
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 850 }}>{alert.title}</span>
                  <span style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--ap-muted)', marginTop: 1 }}>
                    {new Date(alert.occurredAt).toLocaleString('fr')}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {item.captures.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <Label>Captures horodatées</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
            {item.captures.map((capture) => (
              <a key={capture.id} href={capture.signedUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                <div style={{ aspectRatio: '16/10', background: 'var(--ap-paper-2)', borderRadius: 'var(--ap-r-sm)', overflow: 'hidden' }}>
                  {capture.signedUrl
                    ? <img src={capture.signedUrl} alt={`Capture ${capture.source}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}><Camera size={20} /></div>}
                </div>
                <div style={{ fontSize: 10, fontWeight: 800, marginTop: 4 }}>{new Date(capture.occurredAt).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}</div>
              </a>
            ))}
          </div>
        </div>
      )}

      <Label>Décision de l’enseignant</Label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
        {DECISIONS.map((entry) => (
          <button
            key={entry.value}
            type="button"
            onClick={() => setDecision(entry.value)}
            style={{
              padding: '8px 6px',
              borderRadius: 'var(--ap-r-sm)',
              border: `1.5px solid ${decision === entry.value ? entry.color : 'var(--ap-line)'}`,
              background: decision === entry.value ? `color-mix(in srgb, ${entry.color} 10%, var(--ap-card))` : 'var(--ap-card)',
              color: decision === entry.value ? entry.color : 'var(--ap-muted)',
              fontFamily: 'inherit',
              fontSize: 11,
              fontWeight: 850,
              cursor: 'pointer',
            }}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Note de validation (optionnelle)"
        rows={2}
        style={{
          width: '100%',
          resize: 'vertical',
          boxSizing: 'border-box',
          padding: '9px 11px',
          border: 'var(--ap-border-w) solid var(--ap-line)',
          borderRadius: 'var(--ap-r-sm)',
          background: 'var(--ap-paper-2)',
          color: 'var(--ap-ink)',
          fontFamily: 'inherit',
          fontSize: 12,
          fontWeight: 700,
          outline: 'none',
        }}
      />
      <button
        className="ap-btn ap-btn--sm ap-btn--pill"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          try { await onReviewed(decision, note.trim()); } finally { setSaving(false); }
        }}
        style={{ marginTop: 9 }}
      >
        {saving ? 'Enregistrement…' : 'Enregistrer la décision'}
      </button>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: typeof AlertTriangle; label: string; value: number }) {
  return (
    <div className="ap-card" style={{ padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <Icon size={18} style={{ color: 'var(--ap-muted)' }} />
      <div>
        <div style={{ fontSize: 19, fontWeight: 900 }}>{value}</div>
        <div style={{ fontSize: 10, fontWeight: 850, color: 'var(--ap-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof MonitorUp; label: string; value: string | number }) {
  return (
    <div style={{ padding: '9px 10px', borderRadius: 'var(--ap-r-sm)', background: 'var(--ap-paper-2)' }}>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', color: 'var(--ap-muted)', fontSize: 10, fontWeight: 850, textTransform: 'uppercase' }}>
        <Icon size={12} /> {label}
      </div>
      <div style={{ fontSize: 17, fontWeight: 900, marginTop: 3 }}>{value}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10.5, fontWeight: 900, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--ap-muted)', marginBottom: 7 }}>{children}</div>;
}

function countEvents(item: ProctoringAttemptOverview, type: string) {
  return item.events.filter((event) => event.type === type).length;
}

function focusSeconds(item: ProctoringAttemptOverview) {
  return Math.round(item.events
    .filter((event) => event.type === 'focus_lost')
    .reduce((sum, event) => sum + Number(event.durationMs ?? 0), 0) / 1000);
}

function effectiveDecision(item: ProctoringAttemptOverview): ProctoringDecision {
  return item.report?.teacherDecision ?? item.report?.decision ?? (item.alerts.length > 0 ? 'review' : 'compliant');
}

function levelLabel(level: Exam['proctoring']['level']) {
  return { none: 'Aucun', light: 'Léger', standard: 'Standard', enhanced: 'Renforcé' }[level];
}
