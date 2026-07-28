import type { ScormInteraction } from './scormTracking';

export interface ScormApiState {
  lessonStatus?: string;
  completionStatus?: string;
  successStatus?: string;
  scoreRaw?: number;
  scoreMin?: number;
  scoreMax?: number;
  scoreScaled?: number;
  progressMeasure?: number;
  suspendData?: string;
  entry?: string;
  exit?: string;
  totalTime?: string;
  interactions: ScormInteraction[];
}

export interface Scorm12Api {
  LMSInitialize(param: string): string;
  LMSGetValue(name: string): string;
  LMSSetValue(name: string, value: string): string;
  LMSCommit(param: string): string;
  LMSFinish(param: string): string;
  LMSGetLastError(): string;
  LMSGetErrorString(code: string): string;
  LMSGetDiagnostic(code: string): string;
}

export interface Scorm2004Api {
  Initialize(param: string): string;
  GetValue(name: string): string;
  SetValue(name: string, value: string): string;
  Commit(param: string): string;
  Terminate(param: string): string;
  GetLastError(): string;
  GetErrorString(code: string): string;
  GetDiagnostic(code: string): string;
}

const NOT_INITIALIZED = '301';
const GENERAL_EXCEPTION = '101';
const NO_ERROR = '0';

/** Parses SCORM total_time back to seconds — accepts both the 1.2
 *  HHHH:MM:SS(.ss) format and the 2004 ISO 8601 duration (PT1H2M3S). */
function parseTimeToSeconds(time: string | undefined): number {
  if (!time) return 0;
  const hms = time.match(/^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/);
  if (hms) return Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3]);
  const iso = time.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (iso) return Number(iso[1] ?? 0) * 3600 + Number(iso[2] ?? 0) * 60 + Number(iso[3] ?? 0);
  return 0;
}

/** Formats seconds as SCORM 1.2's HHHH:MM:SS — accepted by both versions'
 *  readers (scormTracking.ts's parseTotalTimeMinutes handles this format
 *  for both 1.2 and 2004 rows). */
function formatSecondsAsHms(totalSeconds: number): string {
  const whole = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const seconds = whole % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(hours).padStart(4, '0')}:${pad(minutes)}:${pad(seconds)}`;
}

/** Builds a SCORM 1.2 or 2004 runtime API object backed by an in-memory CMI
 *  model. `initial` seeds resume state (suspend_data, completion status)
 *  from a previously-persisted scorm_tracking row. `onCommit` is called with
 *  the full current state on every Commit/Terminate call — the caller
 *  (ScormPlayer) is responsible for persisting it. The `version` parameter
 *  only determines which method names ScormPlayer mounts on window
 *  (window.API vs window.API_1484_11); the CMI behavior is identical for
 *  both since both method-name sets are always present on the returned
 *  object. */
export function createScormApi(
  version: '1.2' | '2004',
  initial: Partial<ScormApiState>,
  onCommit: (state: ScormApiState) => void,
): Scorm12Api & Scorm2004Api {
  void version;

  let initialized = false;
  let terminated = false;
  let lastError = NO_ERROR;
  let sessionStartMs: number | null = null;
  const priorTotalSeconds = parseTimeToSeconds(initial.totalTime);

  const currentTotalTime = (): string => {
    const sessionSeconds = sessionStartMs != null ? (Date.now() - sessionStartMs) / 1000 : 0;
    return formatSecondsAsHms(priorTotalSeconds + sessionSeconds);
  };

  const state: ScormApiState = {
    lessonStatus: initial.lessonStatus ?? 'not attempted',
    completionStatus: initial.completionStatus ?? 'incomplete',
    successStatus: initial.successStatus,
    scoreRaw: initial.scoreRaw,
    scoreMin: initial.scoreMin,
    scoreMax: initial.scoreMax,
    scoreScaled: initial.scoreScaled,
    progressMeasure: initial.progressMeasure,
    suspendData: initial.suspendData,
    entry: initial.entry ?? 'ab-initio',
    exit: initial.exit,
    interactions: [...(initial.interactions ?? [])],
  };

  const interactionAt = (index: number): ScormInteraction => {
    let entry = state.interactions[index];
    if (!entry) {
      entry = { id: String(index), timestamp: new Date().toISOString() };
      state.interactions[index] = entry;
    }
    return entry;
  };

  function get(name: string): string {
    if (!initialized) { lastError = NOT_INITIALIZED; return ''; }
    lastError = NO_ERROR;
    switch (name) {
      case 'cmi.core.lesson_status': return state.lessonStatus ?? '';
      case 'cmi.completion_status': return state.completionStatus ?? '';
      case 'cmi.success_status': return state.successStatus ?? '';
      case 'cmi.core.score.raw':
      case 'cmi.score.raw': return state.scoreRaw != null ? String(state.scoreRaw) : '';
      case 'cmi.score.scaled': return state.scoreScaled != null ? String(state.scoreScaled) : '';
      case 'cmi.suspend_data': return state.suspendData ?? '';
      case 'cmi.core.entry':
      case 'cmi.entry': return state.entry ?? '';
      case 'cmi.progress_measure': return state.progressMeasure != null ? String(state.progressMeasure) : '';
      case 'cmi.core.total_time':
      case 'cmi.total_time': return currentTotalTime();
      default: return '';
    }
  }

  function set(name: string, value: string): string {
    if (!initialized) { lastError = NOT_INITIALIZED; return 'false'; }
    lastError = NO_ERROR;

    const interactionMatch = name.match(/^cmi\.interactions\.(\d+)\.(\w+)$/);
    if (interactionMatch) {
      const [, idxStr, field] = interactionMatch;
      const entry = interactionAt(Number(idxStr));
      if (field === 'id') entry.id = value;
      else if (field === 'type') entry.type = value;
      else if (field === 'student_response' || field === 'learner_response') entry.learnerResponse = value;
      else if (field === 'correct_responses.0.pattern') entry.correctResponse = value;
      else if (field === 'result') entry.result = value;
      else if (field === 'description') entry.description = value;
      return 'true';
    }

    switch (name) {
      case 'cmi.core.lesson_status': state.lessonStatus = value; return 'true';
      case 'cmi.completion_status': state.completionStatus = value; return 'true';
      case 'cmi.success_status': state.successStatus = value; return 'true';
      case 'cmi.core.score.raw':
      case 'cmi.score.raw': state.scoreRaw = Number(value); return 'true';
      case 'cmi.core.score.min':
      case 'cmi.score.min': state.scoreMin = Number(value); return 'true';
      case 'cmi.core.score.max':
      case 'cmi.score.max': state.scoreMax = Number(value); return 'true';
      case 'cmi.score.scaled': state.scoreScaled = Number(value); return 'true';
      case 'cmi.suspend_data': state.suspendData = value; return 'true';
      case 'cmi.core.exit':
      case 'cmi.exit': state.exit = value; return 'true';
      case 'cmi.progress_measure': state.progressMeasure = Number(value); return 'true';
      default: return 'true'; // unhandled but valid CMI element — accept, don't fail the SCO
    }
  }

  function commit(): string {
    if (!initialized) { lastError = NOT_INITIALIZED; return 'false'; }
    onCommit({ ...state, totalTime: currentTotalTime(), interactions: [...state.interactions] });
    return 'true';
  }

  function terminate(): string {
    if (!initialized || terminated) { lastError = GENERAL_EXCEPTION; return 'false'; }
    terminated = true;
    onCommit({ ...state, totalTime: currentTotalTime(), interactions: [...state.interactions] });
    return 'true';
  }

  function initialize(): string {
    if (initialized) { lastError = GENERAL_EXCEPTION; return 'false'; }
    initialized = true;
    sessionStartMs = Date.now();
    lastError = NO_ERROR;
    return 'true';
  }

  return {
    LMSInitialize: initialize,
    Initialize: initialize,
    LMSGetValue: get,
    GetValue: get,
    LMSSetValue: set,
    SetValue: set,
    LMSCommit: commit,
    Commit: commit,
    LMSFinish: terminate,
    Terminate: terminate,
    LMSGetLastError: () => lastError,
    GetLastError: () => lastError,
    LMSGetErrorString: (code: string) => (code === NO_ERROR ? 'No error' : 'Error'),
    GetErrorString: (code: string) => (code === NO_ERROR ? 'No error' : 'Error'),
    LMSGetDiagnostic: () => '',
    GetDiagnostic: () => '',
  };
}
