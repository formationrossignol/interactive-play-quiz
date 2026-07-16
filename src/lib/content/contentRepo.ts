import { supabase } from '@/lib/supabase';
import type { ContentRow, ContentType } from './types';

// --- Async CRUD (Supabase-backed), polymorphic `content` table ---

/**
 * List content rows for a user of a given type.
 * - folderId omitted (undefined): no folder filter (all folders).
 * - folderId === null: only rows at the root (folder_id IS NULL).
 * - folderId is a string: only rows in that folder.
 * Ordered by updated_at descending.
 */
export async function listContent(
  userId: string,
  type: ContentType,
  folderId?: string | null,
): Promise<ContentRow[]> {
  let query = supabase
    .from('content')
    .select('*')
    .eq('user_id', userId)
    .eq('type', type);

  if (folderId !== undefined) {
    query = folderId === null
      ? query.is('folder_id', null)
      : query.eq('folder_id', folderId);
  }

  const { data, error } = await query.order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * List public content of a type across all users (for the "public" tab).
 * Relies on the `content_public_read` RLS policy (select allowed when
 * is_public = true). Ordered by updated_at descending.
 */
export async function listPublicContent(type: ContentType): Promise<ContentRow[]> {
  const { data, error } = await supabase
    .from('content')
    .select('*')
    .eq('type', type)
    .eq('is_public', true)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Fetch a single content row by id, or null if it does not exist. */
export async function getContent(id: string): Promise<ContentRow | null> {
  const { data, error } = await supabase
    .from('content')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function createContent(
  userId: string,
  type: ContentType,
  data: Record<string, unknown>,
  folderId: string | null = null,
  // When set (the localStorage import passes the item's original id), the row
  // is upserted on (user_id, source_id) so re-running the import updates the
  // existing row instead of duplicating it. UI-created content passes none.
  sourceId: string | null = null,
): Promise<ContentRow> {
  const insert = { user_id: userId, type, data, folder_id: folderId, source_id: sourceId };
  const builder = sourceId
    ? supabase.from('content').upsert(insert, { onConflict: 'user_id,source_id' })
    : supabase.from('content').insert(insert);
  const { data: row, error } = await builder.select().single();
  if (error) throw error;
  return row;
}

/**
 * Mirror a localStorage-backed item (quiz/poll/flashcard) into the `content`
 * table, keyed by its original id (`source_id`). Used by the builder so newly
 * saved items show up in the content-backed lists — the one-time
 * localStorage→Supabase migration only covers items that existed when it ran.
 *
 * Idempotent: updates the existing row's `data`/`is_public` (preserving its
 * folder) when one exists for (user_id, source_id); otherwise inserts at root.
 */
export async function upsertContentBySource(
  userId: string,
  type: ContentType,
  sourceId: string,
  data: Record<string, unknown>,
  isPublic: boolean,
): Promise<void> {
  const { data: existing, error: findError } = await supabase
    .from('content')
    .select('id')
    .eq('user_id', userId)
    .eq('source_id', sourceId)
    .maybeSingle();
  if (findError) throw findError;

  if (existing) {
    const { error } = await supabase
      .from('content')
      .update({ data, is_public: isPublic })
      .eq('id', (existing as { id: string }).id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('content')
      .insert({ user_id: userId, type, data, folder_id: null, source_id: sourceId, is_public: isPublic });
    if (error) throw error;
  }
}

export async function updateContent(
  id: string,
  patch: Partial<Pick<ContentRow, 'data' | 'folder_id' | 'is_public' | 'is_open'>>,
): Promise<void> {
  const { error } = await supabase
    .from('content')
    .update(patch)
    .eq('id', id);
  if (error) throw error;
}

export async function removeContent(id: string): Promise<void> {
  const { error } = await supabase
    .from('content')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function moveContent(id: string, folderId: string | null): Promise<void> {
  const { error } = await supabase
    .from('content')
    .update({ folder_id: folderId })
    .eq('id', id);
  if (error) throw error;
}

export async function setPublic(id: string, isPublic: boolean): Promise<void> {
  const { error } = await supabase
    .from('content')
    .update({ is_public: isPublic })
    .eq('id', id);
  if (error) throw error;
}

export async function setOpen(id: string, isOpen: boolean): Promise<void> {
  const { error } = await supabase
    .from('content')
    .update({ is_open: isOpen })
    .eq('id', id);
  if (error) throw error;
}
