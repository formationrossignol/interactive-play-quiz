import { supabase } from '@/lib/supabase';
import type { ContentType, FolderRow } from './types';

export interface FolderNode extends FolderRow {
  children: FolderNode[];
}

/**
 * Build a nested tree from a flat list of folders.
 * Roots are folders with parent_id === null. Sibling order matches input order.
 */
export function buildTree(folders: FolderRow[]): FolderNode[] {
  const nodes = new Map<string, FolderNode>();
  for (const folder of folders) {
    nodes.set(folder.id, { ...folder, children: [] });
  }

  const roots: FolderNode[] = [];
  for (const folder of folders) {
    const node = nodes.get(folder.id)!;
    if (folder.parent_id === null) {
      roots.push(node);
    } else {
      const parent = nodes.get(folder.parent_id);
      if (parent) {
        parent.children.push(node);
      } else {
        // Orphaned parent reference: treat as a root so it isn't lost.
        roots.push(node);
      }
    }
  }

  return roots;
}

/**
 * Return all descendant folder ids of `id` (excluding `id` itself).
 */
export function getDescendantIds(folders: FolderRow[], id: string): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const folder of folders) {
    if (folder.parent_id === null) continue;
    const list = childrenByParent.get(folder.parent_id);
    if (list) list.push(folder.id);
    else childrenByParent.set(folder.parent_id, [folder.id]);
  }

  const result: string[] = [];
  const stack = [...(childrenByParent.get(id) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop()!;
    result.push(current);
    const children = childrenByParent.get(current);
    if (children) stack.push(...children);
  }

  return result;
}

/**
 * Return true if setting `id.parent_id = newParentId` would create a cycle.
 * - newParentId === null → false
 * - newParentId === id → true
 * - newParentId is a descendant of id → true
 * - otherwise false
 */
export function wouldCreateCycle(
  folders: FolderRow[],
  id: string,
  newParentId: string | null,
): boolean {
  if (newParentId === null) return false;
  if (newParentId === id) return true;
  return getDescendantIds(folders, id).includes(newParentId);
}

// --- Async CRUD (Supabase-backed) ---

export async function listFolders(
  userId: string,
  type: ContentType,
): Promise<FolderRow[]> {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .eq('type', type)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function createFolder(
  userId: string,
  type: ContentType,
  name: string,
  parentId: string | null = null,
  // When set (the localStorage import passes the original folder id), the row
  // is upserted on (user_id, source_id) so re-running the import can never
  // create a duplicate folder. UI-created folders pass no sourceId → plain insert.
  sourceId: string | null = null,
): Promise<FolderRow> {
  const row = { user_id: userId, type, name, parent_id: parentId, source_id: sourceId };
  const builder = sourceId
    ? supabase.from('folders').upsert(row, { onConflict: 'user_id,source_id' })
    : supabase.from('folders').insert(row);
  const { data, error } = await builder.select().single();
  if (error) throw error;
  return data;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('folders')
    .update({ name })
    .eq('id', id);
  if (error) throw error;
}

export async function moveFolder(
  id: string,
  newParentId: string | null,
  allFolders: FolderRow[],
): Promise<void> {
  if (wouldCreateCycle(allFolders, id, newParentId)) {
    throw new Error('cycle');
  }
  const { error } = await supabase
    .from('folders')
    .update({ parent_id: newParentId })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteFolder(
  id: string,
  parentId: string | null,
): Promise<void> {
  // Reassign direct children to this folder's parent so subfolders survive.
  const { error: reassignError } = await supabase
    .from('folders')
    .update({ parent_id: parentId })
    .eq('parent_id', id);
  if (reassignError) throw reassignError;

  const { error: deleteError } = await supabase
    .from('folders')
    .delete()
    .eq('id', id);
  if (deleteError) throw deleteError;
}
