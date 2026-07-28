import { useEffect, useRef } from 'react';
import { createScormApi, type ScormApiState } from '@/lib/scormApi';
import { upsertScormTracking, type ScormTrackingInput } from '@/lib/scormTracking';

export interface ScormPlayerProps {
  userId: string;
  localCourseId: string;
  lessonId: string;
  scormVersion: '1.2' | '2004';
  packageId: string;
  launchPath: string;
  initialState: Partial<ScormApiState>;
}

const AUTOSAVE_INTERVAL_MS = 30_000;

function toTrackingInput(
  props: Pick<ScormPlayerProps, 'userId' | 'localCourseId' | 'lessonId' | 'scormVersion'>,
  state: ScormApiState,
): ScormTrackingInput {
  return {
    userId: props.userId,
    localCourseId: props.localCourseId,
    lessonId: props.lessonId,
    scormVersion: props.scormVersion,
    lessonStatus: state.lessonStatus,
    completionStatus: state.completionStatus,
    successStatus: state.successStatus,
    scoreRaw: state.scoreRaw,
    scoreMin: state.scoreMin,
    scoreMax: state.scoreMax,
    scoreScaled: state.scoreScaled,
    progressMeasure: state.progressMeasure,
    suspendData: state.suspendData,
    entry: state.entry,
    exit: state.exit,
    interactions: state.interactions,
  };
}

/** Renders a SCORM SCO in an iframe served through the same-origin
 *  /scorm-content proxy (required so the SCO's window.parent API lookup
 *  isn't blocked by cross-origin restrictions — see the design spec) and
 *  mounts the matching runtime API (window.API for 1.2, window.API_1484_11
 *  for 2004) that the SCO's own runtime-detection code walks up to find. */
export function ScormPlayer({
  userId, localCourseId, lessonId, scormVersion, packageId, launchPath, initialState,
}: ScormPlayerProps) {
  const latestStateRef = useRef<ScormApiState | null>(null);

  useEffect(() => {
    const globalKey = scormVersion === '1.2' ? 'API' : 'API_1484_11';

    const persist = (state: ScormApiState) => {
      latestStateRef.current = state;
      void upsertScormTracking(toTrackingInput({ userId, localCourseId, lessonId, scormVersion }, state));
    };

    const api = createScormApi(scormVersion, initialState, persist);
    (window as unknown as Record<string, unknown>)[globalKey] = api;

    const autosave = window.setInterval(() => {
      if (latestStateRef.current) persist(latestStateRef.current);
    }, AUTOSAVE_INTERVAL_MS);

    const onUnload = () => {
      if (latestStateRef.current) persist(latestStateRef.current);
    };
    window.addEventListener('beforeunload', onUnload);

    return () => {
      window.clearInterval(autosave);
      window.removeEventListener('beforeunload', onUnload);
      delete (window as unknown as Record<string, unknown>)[globalKey];
    };
    // Re-mounting the API on every keystroke elsewhere in the app would drop
    // in-flight SCO state; this effect intentionally runs once per lesson.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scormVersion, packageId, launchPath]);

  return (
    <iframe
      src={`/scorm-content/${userId}/${packageId}/${launchPath}`}
      title="Contenu SCORM"
      style={{ width: '100%', height: '75vh', border: 'none', display: 'block' }}
    />
  );
}
