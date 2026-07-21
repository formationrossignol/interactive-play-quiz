import type { ContentType } from './types';
import { createFolder } from './foldersRepo';
import { createContent, upsertContentBySource } from './contentRepo';
import { supabase } from '../supabase';

/**
 * One-time, idempotent, non-destructive import of the current user's
 * localStorage content into Supabase (`folders` + `content`).
 *
 * The pure `planMigration` maps parsed localStorage into insert plans and is
 * node/vitest testable in isolation. `migrateLocalToSupabase` is a thin async
 * executor that reads localStorage, runs the plan, performs the inserts, and
 * flips a done-flag so it never runs twice.
 */

// --- Types ---

interface LocalFolder {
  id: string;
  userId: string;
  type: string;
  name: string;
  [k: string]: unknown;
}

interface LocalRow {
  id?: string;
  userId?: string;
  hostId?: string;
  deletedAt?: unknown;
  type?: string;
  isPublic?: boolean;
  folderId?: string | null;
  [k: string]: unknown;
}

export interface LocalData {
  folders: LocalFolder[]; // parsed content_folders
  savedQuizzes: LocalRow[]; // parsed saved_quizzes
  exams: LocalRow[]; // parsed lms_exams
  courses: LocalRow[]; // parsed lms_courses
}

/** Parsed lms_exam_attempts — migrated straight into the dedicated `exam_attempts`
 *  table (see migrateExamsAndAttempts below), not part of the generic content plan. */
export type LocalAttempt = LocalRow;

export interface FolderInsert {
  tempId: string; // original localStorage folder id, used to remap content
  type: ContentType;
  name: string;
  // parent_id is always null: the localStorage source is flat (no nesting).
}

export interface ContentInsert {
  type: ContentType;
  data: Record<string, unknown>; // the entire original object, nothing lost
  isPublic: boolean;
  folderTempId: string | null; // references a FolderInsert.tempId, or null
}

export interface MigrationPlan {
  folders: FolderInsert[];
  content: ContentInsert[];
}

// --- Pure mapping ---

/**
 * Map parsed localStorage into an insert plan. Pure: does not touch the
 * network, localStorage, or mutate its inputs.
 *
 * Ownership/skip rules:
 * - folders: only the user's own folders.
 * - savedQuizzes: only the user's, not soft-deleted, and not slides (slides
 *   are out of scope).
 * - exams: only those the user hosts (owner field is `hostId`); no folder.
 * - courses: only the user's, not soft-deleted; no folder.
 */
export function planMigration(local: LocalData, userId: string): MigrationPlan {
  const folders: FolderInsert[] = local.folders
    .filter((f) => f.userId === userId)
    .map((f) => ({ tempId: f.id, type: f.type as ContentType, name: f.name }));

  const content: ContentInsert[] = [];

  for (const q of local.savedQuizzes) {
    if (q.userId !== userId) continue;
    if (q.deletedAt) continue;
    if (q.type === 'slide') continue;
    content.push({
      type: q.type as ContentType,
      data: q,
      isPublic: !!q.isPublic,
      folderTempId: q.folderId ?? null,
    });
  }

  for (const e of local.exams) {
    if (e.hostId !== userId) continue;
    content.push({
      type: 'exam',
      data: e,
      isPublic: false,
      folderTempId: null,
    });
  }

  for (const c of local.courses) {
    if (c.userId !== userId) continue;
    if (c.deletedAt) continue;
    content.push({
      type: 'course',
      data: c,
      isPublic: !!c.isPublic,
      folderTempId: null,
    });
  }

  return { folders, content };
}

// --- Async executor ---

const MIGRATED_FLAG = 'content_migrated_v1';

function readArray<T = Record<string, unknown>>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Import this user's `lms_exams`/`lms_exam_attempts` into the dedicated
 * `exams`/`exam_attempts` tables (source of truth for the join/take/admin
 * flow — see supabase/migrations/20260721120000_exam_tables.sql). Separate
 * from the generic `content` mirror above (still done via planMigration,
 * purely for the host's library view). Upserts on the original ids so a
 * repeated run never duplicates rows. Already-computed scores are carried
 * over as-is — they were fully client-trusted before this migration too.
 */
async function migrateExamsAndAttempts(userId: string): Promise<void> {
  const localExams = readArray<LocalRow>('lms_exams').filter((e) => e.hostId === userId);
  if (!localExams.length) return;
  const attempts = readArray<LocalAttempt>('lms_exam_attempts');

  for (const e of localExams) {
    const { error } = await supabase.from('exams').upsert({
      id: e.id as string,
      host_id: userId,
      quiz_id: e.quizId as string,
      title: e.title as string,
      description: (e.description as string) ?? '',
      open_at: e.openAt as string,
      close_at: e.closeAt as string,
      duration_minutes: (e.durationMinutes as number | null) ?? null,
      max_attempts: e.maxAttempts as number,
      shuffle_questions: !!e.shuffleQuestions,
      shuffle_answers: !!e.shuffleAnswers,
      passing_score: e.passingScore as number,
      show_results_policy: e.showResultsPolicy as string,
      show_detail_policy: e.showDetailPolicy as string,
      score_retention_policy: e.scoreRetentionPolicy as string,
      status: e.status as string,
      join_code: e.joinCode as string,
      max_participants: (e.maxParticipants as number | null) ?? null,
    }, { onConflict: 'id' });
    if (error) { console.error('[content-migration] exam upsert failed:', error); continue; }

    for (const a of attempts.filter((a) => a.examId === e.id)) {
      const { error: attemptError } = await supabase.from('exam_attempts').upsert({
        id: a.id as string,
        exam_id: e.id as string,
        participant_id: a.participantId as string,
        participant_name: a.participantName as string,
        participant_email: (a.participantEmail as string) ?? '',
        started_at: a.startedAt as string,
        submitted_at: (a.submittedAt as string | null) ?? null,
        time_used_seconds: a.timeUsedSeconds as number,
        question_order: a.questionOrder ?? [],
        answers: a.answers ?? {},
        score: (a.score as number | null) ?? null,
        percentage: (a.percentage as number | null) ?? null,
        passed: (a.passed as boolean | null) ?? null,
        submission_mode: (a.submissionMode as string | null) ?? null,
        status: a.status as string,
        logs: a.logs ?? [],
      }, { onConflict: 'id' });
      if (attemptError) console.error('[content-migration] exam attempt upsert failed:', attemptError);
    }
  }
}

/**
 * Import this user's localStorage content into Supabase exactly once.
 * Idempotent: subsequent calls no-op via the `content_migrated_v1` flag.
 * Non-destructive: the source localStorage keys are never modified or removed.
 */
type MigrationResult = { migrated: boolean; folders: number; content: number };

// syncFromSession can fire twice on a single page load (getSession +
// onAuthStateChange INITIAL_SESSION). Dedupe concurrent calls so the import
// body runs once per load; combined with the source_id upsert this makes a
// re-import fully duplicate-proof.
let inFlight: Promise<MigrationResult> | null = null;

export function migrateLocalToSupabase(userId: string): Promise<MigrationResult> {
  if (inFlight) return inFlight;
  inFlight = runMigration(userId).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runMigration(userId: string): Promise<MigrationResult> {
  if (localStorage.getItem(MIGRATED_FLAG)) {
    return { migrated: false, folders: 0, content: 0 };
  }

  const local: LocalData = {
    folders: readArray('content_folders'),
    savedQuizzes: readArray('saved_quizzes'),
    exams: readArray('lms_exams'),
    courses: readArray('lms_courses'),
  };

  const plan = planMigration(local, userId);

  // Insert folders first, mapping each temp id to its new Supabase row id so
  // content can be attached to the right folder.
  const idMap = new Map<string, string>();
  for (const f of plan.folders) {
    // sourceId = original localStorage folder id → upsert, idempotent re-runs.
    const row = await createFolder(userId, f.type, f.name, null, f.tempId);
    idMap.set(f.tempId, row.id);
  }

  for (const c of plan.content) {
    const folderId = c.folderTempId ? idMap.get(c.folderTempId) ?? null : null;
    // sourceId = the item's original id → upsert, so a repeated import never
    // duplicates content (it refreshes the existing row instead).
    const sourceId = typeof c.data.id === 'string' ? c.data.id : null;
    await createContent(userId, c.type, c.data, folderId, sourceId);
  }

  await migrateExamsAndAttempts(userId);

  localStorage.setItem(MIGRATED_FLAG, new Date().toISOString());

  return {
    migrated: true,
    folders: plan.folders.length,
    content: plan.content.length,
  };
}

const QUIZ_BACKFILL_FLAG = 'quiz_mirror_backfill_v1';

/**
 * One-time, idempotent backfill: mirror every local quiz/poll/flashcard this
 * user owns into the Supabase `content` table, for items that predate (or
 * were never touched by) `QuizBuilder`'s save-time mirror. Needed so an exam
 * created against an old, never-resaved quiz can still be read by a
 * participant (ExamRoom's getContentBySource depends on that row existing).
 * Upsert-based, so re-running is always safe even without the flag.
 */
export async function backfillQuizMirrors(userId: string): Promise<{ mirrored: number }> {
  if (localStorage.getItem(QUIZ_BACKFILL_FLAG)) return { mirrored: 0 };

  const quizzes = readArray<LocalRow>('saved_quizzes').filter(
    (q) => q.userId === userId && !q.deletedAt && q.type !== 'slide' && typeof q.id === 'string',
  );

  for (const q of quizzes) {
    await upsertContentBySource(userId, q.type as ContentType, q.id as string, q, !!q.isPublic);
  }

  localStorage.setItem(QUIZ_BACKFILL_FLAG, new Date().toISOString());
  return { mirrored: quizzes.length };
}
