import { supabase } from '@/lib/supabase';
import type { ContentRow } from '@/lib/content/types';

export interface Group {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string | null;
  pending_email: string | null;
  created_at: string;
}

export interface ContentShare {
  id: string;
  content_id: string;
  shared_with_user_id: string | null;
  shared_with_group_id: string | null;
  pending_email: string | null;
  created_at: string;
}

export interface UsernameMatch {
  id: string;
  username: string;
}

/** Autocomplete search: users whose username starts with `prefix` (excludes the caller). */
export async function searchUsernames(prefix: string): Promise<UsernameMatch[]> {
  const { data, error } = await supabase.rpc('search_profiles_by_username', { prefix });
  if (error) throw error;
  return data ?? [];
}

/** Resolve a batch of user ids to id+username, for displaying an existing share list. */
export async function usernamesByIds(ids: string[]): Promise<UsernameMatch[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.rpc('usernames_by_ids', { ids });
  if (error) throw error;
  return data ?? [];
}

export async function listGroups(ownerId: string): Promise<Group[]> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createGroup(ownerId: string, name: string): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .insert({ owner_id: ownerId, name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase.from('groups').delete().eq('id', groupId);
  if (error) throw error;
}

export async function listGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addGroupMemberByUserId(groupId: string, userId: string): Promise<GroupMember> {
  const { data, error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// The DB function inserts `on conflict (...) do nothing returning * into result`, so a
// duplicate invite (already a member) leaves `result` NULL and PostgREST returns `data: null`.
export async function resolveGroupMemberByEmail(groupId: string, email: string): Promise<GroupMember | null> {
  const { data, error } = await supabase.rpc('resolve_group_member', { p_group_id: groupId, p_email: email });
  if (error) throw error;
  return data ?? null;
}

export async function removeGroupMember(memberId: string): Promise<void> {
  const { error } = await supabase.from('group_members').delete().eq('id', memberId);
  if (error) throw error;
}

export async function listContentShares(contentId: string): Promise<ContentShare[]> {
  const { data, error } = await supabase
    .from('content_shares')
    .select('*')
    .eq('content_id', contentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addContentShareByUserId(contentId: string, userId: string): Promise<ContentShare> {
  const { data, error } = await supabase
    .from('content_shares')
    .insert({ content_id: contentId, shared_with_user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addContentShareByGroupId(contentId: string, groupId: string): Promise<ContentShare> {
  const { data, error } = await supabase
    .from('content_shares')
    .insert({ content_id: contentId, shared_with_group_id: groupId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// The DB function inserts `on conflict (...) do nothing returning * into result`, so a
// duplicate invite (already shared) leaves `result` NULL and PostgREST returns `data: null`.
export async function resolveContentShareByEmail(contentId: string, email: string): Promise<ContentShare | null> {
  const { data, error } = await supabase.rpc('resolve_content_share', { p_content_id: contentId, p_email: email });
  if (error) throw error;
  return data ?? null;
}

export async function removeContentShare(shareId: string): Promise<void> {
  const { error } = await supabase.from('content_shares').delete().eq('id', shareId);
  if (error) throw error;
}

/** Pure: dedupe content ids across any number of `{content_id}` row lists. No I/O. */
export function mergeSharedContentIds(...lists: { content_id: string }[][]): string[] {
  return Array.from(new Set(lists.flat().map((r) => r.content_id)));
}

/** Courses shared with `userId`, directly or via any group they belong to. */
export async function listSharedWithMe(userId: string): Promise<ContentRow[]> {
  const { data: direct, error: directError } = await supabase
    .from('content_shares')
    .select('content_id')
    .eq('shared_with_user_id', userId);
  if (directError) throw directError;

  const { data: myGroups, error: groupsError } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);
  if (groupsError) throw groupsError;
  const groupIds = (myGroups ?? []).map((g: { group_id: string }) => g.group_id);

  let viaGroups: { content_id: string }[] = [];
  if (groupIds.length > 0) {
    const { data, error } = await supabase
      .from('content_shares')
      .select('content_id')
      .in('shared_with_group_id', groupIds);
    if (error) throw error;
    viaGroups = data ?? [];
  }

  const contentIds = mergeSharedContentIds(direct ?? [], viaGroups);
  if (contentIds.length === 0) return [];

  const { data: rows, error: rowsError } = await supabase
    .from('content')
    .select('*')
    .eq('type', 'course')
    .in('id', contentIds)
    .order('updated_at', { ascending: false });
  if (rowsError) throw rowsError;
  return rows ?? [];
}
