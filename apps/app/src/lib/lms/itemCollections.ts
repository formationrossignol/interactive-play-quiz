import { supabase } from '@/lib/supabase';

export interface ItemCollection {
  id: string;
  org_id: string;
  owner_id: string;
  title: string;
  visibility: 'private' | 'org' | 'shared';
  created_at: string;
}

export interface ItemPermission {
  id: string;
  collection_id: string;
  user_id: string;
  permission: 'view' | 'use' | 'comment' | 'edit';
}

export async function listItemCollections(orgId: string): Promise<ItemCollection[]> {
  const { data, error } = await supabase.from('item_collections').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ItemCollection[];
}

export async function createItemCollection(orgId: string, title: string, visibility: ItemCollection['visibility']): Promise<ItemCollection> {
  const { data, error } = await supabase.from('item_collections').insert({ org_id: orgId, title, visibility }).select().single();
  if (error) throw error;
  return data as ItemCollection;
}

export async function listItemPermissions(collectionId: string): Promise<ItemPermission[]> {
  const { data, error } = await supabase.from('item_permissions').select('*').eq('collection_id', collectionId).order('created_at');
  if (error) throw error;
  return (data ?? []) as ItemPermission[];
}

export async function grantItemPermission(collectionId: string, userId: string, permission: ItemPermission['permission']): Promise<ItemPermission> {
  const { data, error } = await supabase.from('item_permissions').upsert({ collection_id: collectionId, user_id: userId, permission }, { onConflict: 'collection_id,user_id,permission' }).select().single();
  if (error) throw error;
  return data as ItemPermission;
}

export async function revokeItemPermission(permissionId: string): Promise<void> {
  const { error } = await supabase.from('item_permissions').delete().eq('id', permissionId);
  if (error) throw error;
}

export interface ItemCollectionMember {
  id: string;
  collection_id: string;
  item_id: string;
  position: number;
}

export async function listCollectionMembers(collectionId: string): Promise<ItemCollectionMember[]> {
  const { data, error } = await supabase.from('item_collection_members').select('*').eq('collection_id', collectionId).order('position');
  if (error) throw error;
  return (data ?? []) as ItemCollectionMember[];
}

export async function addCollectionMember(collectionId: string, itemId: string, position = 0): Promise<ItemCollectionMember> {
  const { data, error } = await supabase.from('item_collection_members').insert({ collection_id: collectionId, item_id: itemId, position }).select().single();
  if (error) throw error;
  return data as ItemCollectionMember;
}

export async function removeCollectionMember(memberId: string): Promise<void> {
  const { error } = await supabase.from('item_collection_members').delete().eq('id', memberId);
  if (error) throw error;
}

export interface RescoreImpact {
  attempt_id: string;
  learner_id: string;
  response_id: string;
  current_points: number | null;
  projected_points: number;
  current_is_correct: boolean | null;
  projected_is_correct: boolean;
}

export async function previewRescore(itemRevisionId: string): Promise<RescoreImpact[]> {
  const { data, error } = await supabase.rpc('preview_rescore', { p_item_revision_id: itemRevisionId });
  if (error) throw error;
  return (data ?? []) as RescoreImpact[];
}

export async function executeRescore(itemRevisionId: string, reason: string): Promise<{ id: string; affected_count: number | null; status: string }> {
  const { data, error } = await supabase.rpc('execute_rescore', { p_item_revision_id: itemRevisionId, p_reason: reason });
  if (error) throw error;
  return data as { id: string; affected_count: number | null; status: string };
}
