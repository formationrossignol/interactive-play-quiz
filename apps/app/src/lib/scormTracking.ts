import { supabase } from '@/lib/supabase';
import { getContentBySourceAnyOwner } from '@/lib/content/contentRepo';

export interface ScormInteraction {
  id: string;
  type?: string;
  learnerResponse?: string;
  correctResponse?: string;
  result?: string;
  description?: string;
  timestamp: string;
}

export interface ScormTrackingInput {
  userId: string;
  localCourseId: string;
  lessonId: string;
  scormVersion: '1.2' | '2004';
  lessonStatus?: string;
  completionStatus?: string;
  successStatus?: string;
  scoreRaw?: number;
  scoreMin?: number;
  scoreMax?: number;
  scoreScaled?: number;
  progressMeasure?: number;
  totalTime?: string;
  suspendData?: string;
  entry?: string;
  exit?: string;
  interactions: ScormInteraction[];
}

/**
 * Resolve the Supabase `content` row id backing a course, given the local
 * (`courseStorage.ts`) id the player/builder actually has. Course ownership
 * can differ from the learner writing tracking data (shared/public courses),
 * so this always looks up by source_id across all owners — the same pattern
 * CourseViewer.tsx uses to load a course it doesn't own. Every read/write in
 * this module goes through this first.
 */
async function resolveCourseContentId(localCourseId: string): Promise<string> {
  const row = await getContentBySourceAnyOwner('course', localCourseId);
  if (!row) throw new Error('Course content row not found — save/share the course before tracking SCORM progress.');
  return row.id;
}

export async function upsertScormTracking(input: ScormTrackingInput): Promise<void> {
  const courseId = await resolveCourseContentId(input.localCourseId);
  const { error } = await supabase.from('scorm_tracking').upsert(
    {
      user_id: input.userId,
      course_id: courseId,
      lesson_id: input.lessonId,
      scorm_version: input.scormVersion,
      lesson_status: input.lessonStatus ?? null,
      completion_status: input.completionStatus ?? null,
      success_status: input.successStatus ?? null,
      score_raw: input.scoreRaw ?? null,
      score_min: input.scoreMin ?? null,
      score_max: input.scoreMax ?? null,
      score_scaled: input.scoreScaled ?? null,
      progress_measure: input.progressMeasure ?? null,
      total_time: input.totalTime ?? null,
      suspend_data: input.suspendData ?? null,
      entry: input.entry ?? null,
      exit: input.exit ?? null,
      interactions: input.interactions,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,course_id,lesson_id' },
  );
  if (error) throw error;
}

/**
 * Mirrors every column of the `scorm_tracking` table (see
 * supabase/migrations/20260729120000_scorm_tracking.sql) rather than just the
 * subset this module's own stats computation needs — Task 12's reporting
 * page renders a per-learner table (learner id, attempt count, last-updated)
 * straight off rows returned by getScormTrackingForCourse, so every column
 * needs to already be typed here.
 */
export interface ScormTrackingRow {
  id: string;
  user_id: string;
  course_id: string;
  lesson_id: string;
  scorm_version: '1.2' | '2004';
  lesson_status: string | null;
  completion_status: string | null;
  success_status: string | null;
  score_raw: number | null;
  score_min: number | null;
  score_max: number | null;
  score_scaled: number | null;
  progress_measure: number | null;
  total_time: string | null;
  suspend_data: string | null;
  entry: string | null;
  exit: string | null;
  attempt_count: number;
  interactions: ScormInteraction[];
  updated_at: string;
}

export async function getScormTrackingForCourse(localCourseId: string, lessonId: string): Promise<ScormTrackingRow[]> {
  const courseId = await resolveCourseContentId(localCourseId);
  const { data, error } = await supabase
    .from('scorm_tracking')
    .select('*')
    .eq('course_id', courseId)
    .eq('lesson_id', lessonId);
  if (error) throw error;
  return data ?? [];
}

const DONE_STATUSES = new Set(['completed', 'passed']);

/** SCORM total_time is HHHH:MM:SS(.ss) (1.2) or an ISO 8601 duration (2004,
 *  e.g. PT1H2M3S). Both formats appear in the wild depending on the
 *  authoring tool; this handles the common HHHH:MM:SS case used by both. */
function parseTotalTimeMinutes(totalTime: string | null): number | null {
  if (!totalTime) return null;
  const hms = totalTime.match(/^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/);
  if (hms) return Number(hms[1]) * 60 + Number(hms[2]) + Number(hms[3]) / 60;
  const iso = totalTime.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (iso) return Number(iso[1] ?? 0) * 60 + Number(iso[2] ?? 0) + Number(iso[3] ?? 0) / 60;
  return null;
}

export interface ScormStats {
  totalLearners: number;
  completedCount: number;
  completionRate: number | null;
  avgScore: number | null;
  avgTimeMinutes: number | null;
}

export async function computeScormStats(localCourseId: string, lessonId: string): Promise<ScormStats> {
  const rows = await getScormTrackingForCourse(localCourseId, lessonId);
  const completed = rows.filter((r) => DONE_STATUSES.has(r.lesson_status ?? r.completion_status ?? ''));
  const scored = rows.filter((r): r is ScormTrackingRow & { score_raw: number } => r.score_raw != null);
  const timed = rows.map((r) => parseTotalTimeMinutes(r.total_time)).filter((m): m is number => m != null);

  return {
    totalLearners: rows.length,
    completedCount: completed.length,
    completionRate: rows.length ? Math.round((completed.length / rows.length) * 100) : null,
    avgScore: scored.length ? Math.round(scored.reduce((s, r) => s + r.score_raw, 0) / scored.length) : null,
    avgTimeMinutes: timed.length ? Math.round((timed.reduce((s, m) => s + m, 0) / timed.length) * 100) / 100 : null,
  };
}
