import type { ContentType } from './types';
import { createFolder } from './foldersRepo';
import { createContent } from './contentRepo';

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

export interface LocalData {
  folders: any[]; // parsed content_folders
  savedQuizzes: any[]; // parsed saved_quizzes
  exams: any[]; // parsed lms_exams
  courses: any[]; // parsed lms_courses
}

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

function readArray(key: string): any[] {
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
 * Import this user's localStorage content into Supabase exactly once.
 * Idempotent: subsequent calls no-op via the `content_migrated_v1` flag.
 * Non-destructive: the source localStorage keys are never modified or removed.
 */
export async function migrateLocalToSupabase(
  userId: string,
): Promise<{ migrated: boolean; folders: number; content: number }> {
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

  localStorage.setItem(MIGRATED_FLAG, new Date().toISOString());

  return {
    migrated: true,
    folders: plan.folders.length,
    content: plan.content.length,
  };
}
