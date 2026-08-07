import { supabase } from './supabase';
import { safeSetItem } from './safeLocalStorage';

export type H5pStatus = 'not_started' | 'in_progress' | 'completed' | 'passed' | 'failed';

export interface H5pTrackingRecord {
  userId: string;
  courseId: string;
  lessonId: string;
  packageId: string;
  status: H5pStatus;
  scoreRaw: number | null;
  scoreMax: number | null;
  scoreScaled: number | null;
  progress: number;
  durationSeconds: number;
  state: unknown | null;
  lastStatement: Record<string, unknown> | null;
  startedAt: string;
  completedAt: string | null;
  lastAccessedAt: string;
}

interface H5pTrackingRow {
  user_id: string;
  course_id: string;
  lesson_id: string;
  package_id: string;
  status: H5pStatus;
  score_raw: number | null;
  score_max: number | null;
  score_scaled: number | null;
  progress: number;
  duration_seconds: number;
  state: unknown | null;
  last_statement: Record<string, unknown> | null;
  started_at: string;
  completed_at: string | null;
  last_accessed_at: string;
}

const STORAGE_KEY = 'brivia_h5p_tracking';

const recordKey = (record: Pick<H5pTrackingRecord, 'userId' | 'courseId' | 'lessonId'>): string =>
  `${record.userId}:${record.courseId}:${record.lessonId}`;

const readLocal = (): Record<string, H5pTrackingRecord> => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, H5pTrackingRecord>;
  } catch {
    return {};
  }
};

const writeLocal = (record: H5pTrackingRecord): void => {
  try {
    const current = readLocal();
    current[recordKey(record)] = record;
    safeSetItem(STORAGE_KEY, current);
  } catch {
    // Tracking still continues in memory if storage is unavailable.
  }
};

const fromRow = (row: H5pTrackingRow): H5pTrackingRecord => ({
  userId: row.user_id,
  courseId: row.course_id,
  lessonId: row.lesson_id,
  packageId: row.package_id,
  status: row.status,
  scoreRaw: row.score_raw,
  scoreMax: row.score_max,
  scoreScaled: row.score_scaled,
  progress: row.progress,
  durationSeconds: row.duration_seconds,
  state: row.state,
  lastStatement: row.last_statement,
  startedAt: row.started_at,
  completedAt: row.completed_at,
  lastAccessedAt: row.last_accessed_at,
});

const toRow = (record: H5pTrackingRecord): H5pTrackingRow => ({
  user_id: record.userId,
  course_id: record.courseId,
  lesson_id: record.lessonId,
  package_id: record.packageId,
  status: record.status,
  score_raw: record.scoreRaw,
  score_max: record.scoreMax,
  score_scaled: record.scoreScaled,
  progress: record.progress,
  duration_seconds: record.durationSeconds,
  state: record.state,
  last_statement: record.lastStatement,
  started_at: record.startedAt,
  completed_at: record.completedAt,
  last_accessed_at: record.lastAccessedAt,
});

export function getLocalH5pTracking(
  userId: string,
  courseId: string,
  lessonId: string,
): H5pTrackingRecord | null {
  return readLocal()[recordKey({ userId, courseId, lessonId })] ?? null;
}

export async function getH5pTracking(
  userId: string,
  courseId: string,
  lessonId: string,
): Promise<H5pTrackingRecord | null> {
  const local = getLocalH5pTracking(userId, courseId, lessonId);
  const { data, error } = await supabase
    .from('h5p_tracking')
    .select('*')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .eq('lesson_id', lessonId)
    .maybeSingle();

  if (error || !data) return local;
  const remote = fromRow(data as H5pTrackingRow);
  writeLocal(remote);
  return remote;
}

export async function saveH5pTracking(record: H5pTrackingRecord): Promise<void> {
  writeLocal(record);
  const { error } = await supabase
    .from('h5p_tracking')
    .upsert(toRow(record), { onConflict: 'user_id,course_id,lesson_id' });
  if (error) {
    console.warn('[H5P] Le suivi distant sera resynchronisé lors de la prochaine activité.', error.message);
  }
}

const parseIsoDuration = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const match = value.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (!match) return null;
  return Math.round(
    Number(match[1] ?? 0) * 86_400
    + Number(match[2] ?? 0) * 3_600
    + Number(match[3] ?? 0) * 60
    + Number(match[4] ?? 0),
  );
};

const finiteNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function applyXapiStatement(
  current: H5pTrackingRecord,
  statement: Record<string, unknown>,
): H5pTrackingRecord {
  const typedStatement = statement as {
    verb?: { id?: unknown };
    result?: {
      score?: { raw?: unknown; max?: unknown; scaled?: unknown };
      success?: unknown;
      completion?: unknown;
      duration?: unknown;
      extensions?: unknown;
    };
  };
  const result = typedStatement.result ?? {};
  const verbId = String(typedStatement.verb?.id ?? '');
  const verb = verbId.split('/').pop()?.toLowerCase() ?? '';
  const now = new Date().toISOString();
  const raw = finiteNumber(result.score?.raw);
  const max = finiteNumber(result.score?.max);
  const scaled = finiteNumber(result.score?.scaled)
    ?? (raw !== null && max !== null && max > 0 ? raw / max : null);
  const statementDuration = parseIsoDuration(result.duration);
  const extensions = result.extensions && typeof result.extensions === 'object'
    ? Object.entries(result.extensions) as Array<[string, unknown]>
    : [];
  const progressValue = extensions.find(([key]) => key.toLowerCase().endsWith('/progress'))?.[1];
  const reportedProgress = finiteNumber(progressValue);

  let status: H5pStatus = current.status === 'not_started' ? 'in_progress' : current.status;
  if (result.success === true || verb === 'passed') status = 'passed';
  else if (result.success === false || verb === 'failed') status = 'failed';
  else if (result.completion === true || verb === 'completed') status = 'completed';

  let progress = current.progress;
  if (reportedProgress !== null) {
    progress = reportedProgress <= 1 ? Math.round(reportedProgress * 100) : Math.round(reportedProgress);
  } else if (['completed', 'passed', 'failed'].includes(status)) {
    progress = 100;
  } else if (verb === 'attempted' && progress === 0) {
    progress = 1;
  }

  return {
    ...current,
    status,
    scoreRaw: raw ?? current.scoreRaw,
    scoreMax: max ?? current.scoreMax,
    scoreScaled: scaled ?? current.scoreScaled,
    progress: Math.min(100, Math.max(0, progress)),
    durationSeconds: statementDuration === null
      ? current.durationSeconds
      : Math.max(current.durationSeconds, statementDuration),
    lastStatement: statement,
    completedAt: ['completed', 'passed', 'failed'].includes(status)
      ? current.completedAt ?? now
      : current.completedAt,
    lastAccessedAt: now,
  };
}

export function formatH5pDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  if (hours > 0) return `${hours} h ${minutes.toString().padStart(2, '0')} min`;
  if (minutes > 0) return `${minutes} min ${remainder.toString().padStart(2, '0')} s`;
  return `${remainder} s`;
}
