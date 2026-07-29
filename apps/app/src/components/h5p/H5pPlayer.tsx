import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, RotateCcw, Trophy } from 'lucide-react';
import type { User } from '@/lib/auth';
import { getH5pContentPath } from '@/lib/h5pImport';
import {
  applyXapiStatement,
  formatH5pDuration,
  getH5pTracking,
  saveH5pTracking,
  type H5pStatus,
  type H5pTrackingRecord,
} from '@/lib/h5pTracking';

interface H5pPlayerProps {
  ownerId: string;
  packageId: string;
  lessonId: string;
  courseId?: string;
  user?: User | null;
  preview?: boolean;
  onTrackingChange?: (record: H5pTrackingRecord) => void;
}

interface XapiEvent {
  data?: {
    statement?: Record<string, unknown>;
  };
}

interface H5pDispatcher {
  on: (eventName: string, handler: (event: XapiEvent) => void) => void;
  off?: (eventName: string, handler: (event: XapiEvent) => void) => void;
}

interface H5pWindow extends Window {
  H5P?: {
    externalDispatcher?: H5pDispatcher;
    instances?: Array<{ getCurrentState?: () => unknown }>;
  };
}

const statusLabel: Record<H5pStatus, string> = {
  not_started: 'Non commencée',
  in_progress: 'En cours',
  completed: 'Terminée',
  passed: 'Réussie',
  failed: 'Échouée',
};

const completedStatuses = new Set<H5pStatus>(['completed', 'passed', 'failed']);

const emptyTracking = (
  userId: string,
  courseId: string,
  lessonId: string,
  packageId: string,
): H5pTrackingRecord => {
  const now = new Date().toISOString();
  return {
    userId,
    courseId,
    lessonId,
    packageId,
    status: 'not_started',
    scoreRaw: null,
    scoreMax: null,
    scoreScaled: null,
    progress: 0,
    durationSeconds: 0,
    state: null,
    lastStatement: null,
    startedAt: now,
    completedAt: null,
    lastAccessedAt: now,
  };
};

export function H5pPlayer({
  ownerId,
  packageId,
  lessonId,
  courseId = 'preview',
  user,
  preview = false,
  onTrackingChange,
}: H5pPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackingRef = useRef<H5pTrackingRecord | null>(null);
  const onTrackingChangeRef = useRef(onTrackingChange);
  const [tracking, setTracking] = useState<H5pTrackingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    onTrackingChangeRef.current = onTrackingChange;
  }, [onTrackingChange]);

  useEffect(() => {
    const containerElement = containerRef.current;
    let disposed = false;
    let autosaveTimer: number | undefined;
    let dispatcher: H5pDispatcher | undefined;
    let xapiHandler: ((event: XapiEvent) => void) | undefined;
    let activeSeconds = 0;
    let activeSince: number | null = document.visibilityState === 'visible' ? Date.now() : null;
    let baseDuration = 0;

    const currentState = (): unknown | null => {
      const iframe = containerElement?.querySelector('iframe');
      const h5pWindow = iframe?.contentWindow as H5pWindow | null;
      try {
        return h5pWindow?.H5P?.instances?.[0]?.getCurrentState?.() ?? null;
      } catch {
        return null;
      }
    };

    const activeSessionSeconds = (): number => {
      const running = activeSince === null ? 0 : (Date.now() - activeSince) / 1_000;
      return Math.round(activeSeconds + running);
    };

    const emitTracking = (record: H5pTrackingRecord): void => {
      trackingRef.current = record;
      if (!disposed) setTracking(record);
      onTrackingChangeRef.current?.(record);
    };

    const persist = async (): Promise<void> => {
      if (preview || !trackingRef.current) return;
      const now = new Date().toISOString();
      const next: H5pTrackingRecord = {
        ...trackingRef.current,
        status: trackingRef.current.status === 'not_started' ? 'in_progress' : trackingRef.current.status,
        state: currentState() ?? trackingRef.current.state,
        durationSeconds: Math.max(
          trackingRef.current.durationSeconds,
          baseDuration + activeSessionSeconds(),
        ),
        lastAccessedAt: now,
      };
      emitTracking(next);
      await saveH5pTracking(next);
    };

    const handleVisibility = (): void => {
      if (document.visibilityState === 'hidden') {
        if (activeSince !== null) activeSeconds += (Date.now() - activeSince) / 1_000;
        activeSince = null;
        void persist();
      } else if (activeSince === null) {
        activeSince = Date.now();
      }
    };

    const initialize = async (): Promise<void> => {
      const element = containerElement;
      if (!element) return;
      element.innerHTML = '';
      setLoading(true);
      setError(null);

      try {
        const previous = !preview && user
          ? await getH5pTracking(user.id, courseId, lessonId)
          : null;
        if (disposed) return;

        const initial = previous ?? (
          user ? emptyTracking(user.id, courseId, lessonId, packageId) : null
        );
        if (initial) {
          baseDuration = initial.durationSeconds;
          emitTracking(initial);
        }

        const imported = await import('h5p-standalone');
        const importedShape = imported as unknown as {
          H5P?: new (element: HTMLElement, options: Record<string, unknown>) => Promise<unknown>;
          default?: {
            H5P?: new (element: HTMLElement, options: Record<string, unknown>) => Promise<unknown>;
          };
        };
        const Player = importedShape.H5P ?? importedShape.default?.H5P;
        if (!Player) throw new Error('Le lecteur H5P n’a pas pu être initialisé.');

        const runtimeId = `${preview ? 'preview' : 'lesson'}-${lessonId}`;
        const activityIri = `${window.location.origin}/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`;
        await new Player(element, {
          id: runtimeId,
          h5pJsonPath: getH5pContentPath(ownerId, packageId),
          frameJs: '/h5p-standalone/frame.bundle.js',
          frameCss: '/h5p-standalone/styles/h5p.css',
          frame: true,
          copyright: true,
          export: false,
          icon: true,
          fullScreen: true,
          reportingIsEnabled: true,
          saveFreq: 10,
          xAPIObjectIRI: activityIri,
          user: user ? { name: user.username || user.email, mail: user.email } : undefined,
          contentUserData: initial?.state
            ? [{ dataType: 'state', previousState: JSON.stringify(initial.state), subContentId: '*' }]
            : undefined,
        });
        if (disposed) return;

        const h5pGlobal = (window as H5pWindow).H5P;
        dispatcher = h5pGlobal?.externalDispatcher;
        xapiHandler = (event: XapiEvent) => {
          const statement = event.data?.statement;
          if (!statement || preview || !trackingRef.current) return;
          const objectId = (statement.object as { id?: unknown } | undefined)?.id;
          if (typeof objectId === 'string' && objectId !== activityIri) return;
          const next = applyXapiStatement(trackingRef.current, statement);
          emitTracking(next);
          if (completedStatuses.has(next.status)) void persist();
        };
        dispatcher?.on('xAPI', xapiHandler);
        document.addEventListener('visibilitychange', handleVisibility);
        autosaveTimer = window.setInterval(() => void persist(), 10_000);
        setLoading(false);
      } catch (cause) {
        if (disposed) return;
        setLoading(false);
        setError(cause instanceof Error ? cause.message : 'Impossible de charger cette activité H5P.');
      }
    };

    void initialize();

    return () => {
      disposed = true;
      if (autosaveTimer !== undefined) window.clearInterval(autosaveTimer);
      if (dispatcher && xapiHandler) dispatcher.off?.('xAPI', xapiHandler);
      document.removeEventListener('visibilitychange', handleVisibility);
      void persist();
      if (containerElement) containerElement.innerHTML = '';
    };
  }, [courseId, lessonId, ownerId, packageId, preview, reloadKey, user]);

  const score = tracking?.scoreRaw !== null && tracking?.scoreRaw !== undefined
    ? tracking.scoreMax
      ? `${tracking.scoreRaw}/${tracking.scoreMax}`
      : `${tracking.scoreRaw}`
    : null;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {!preview && tracking && (
        <div
          aria-label="Suivi de l’activité H5P"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            padding: '12px 14px',
            background: 'var(--ap-paper-2)',
            border: 'var(--ap-border-w) solid var(--ap-line)',
            borderRadius: 'var(--ap-r-sm)',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {tracking.status === 'passed'
            ? <CheckCircle2 size={17} color="var(--ap-pres-deep)" />
            : tracking.status === 'failed'
              ? <AlertTriangle size={17} color="var(--ap-quiz-deep)" />
              : <Clock3 size={17} color="var(--ap-brand)" />}
          <span>{statusLabel[tracking.status]}</span>
          <span style={{ color: 'var(--ap-muted)' }}>Progression {tracking.progress}%</span>
          {score && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Trophy size={15} /> Score {score}
            </span>
          )}
          <span style={{ color: 'var(--ap-muted)' }}>
            Temps {formatH5pDuration(tracking.durationSeconds)}
          </span>
        </div>
      )}

      <div
        style={{
          position: 'relative',
          minHeight: 240,
          overflow: 'hidden',
          background: '#fff',
          border: 'var(--ap-border-w) solid var(--ap-line)',
          borderRadius: 'var(--ap-r-md)',
        }}
      >
        {loading && (
          <div
            role="status"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              display: 'grid',
              placeItems: 'center',
              background: 'var(--ap-card)',
              color: 'var(--ap-muted)',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Chargement de l’activité H5P…
          </div>
        )}
        {error && (
          <div
            role="alert"
            style={{
              minHeight: 240,
              display: 'grid',
              placeItems: 'center',
              padding: 24,
              textAlign: 'center',
              color: 'var(--ap-quiz-deep)',
              fontWeight: 700,
            }}
          >
            <div>
              <AlertTriangle size={28} style={{ margin: '0 auto 10px' }} />
              <p>{error}</p>
              <button
                type="button"
                onClick={() => setReloadKey((key) => key + 1)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  marginTop: 14,
                  padding: '9px 14px',
                  border: 'var(--ap-border-w) solid var(--ap-line)',
                  borderRadius: 'var(--ap-r-sm)',
                  background: 'var(--ap-card)',
                  color: 'var(--ap-ink)',
                  cursor: 'pointer',
                  fontWeight: 800,
                }}
              >
                <RotateCcw size={15} /> Réessayer
              </button>
            </div>
          </div>
        )}
        <div ref={containerRef} style={{ minHeight: 240 }} />
      </div>
    </div>
  );
}
