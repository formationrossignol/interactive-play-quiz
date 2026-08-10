import { supabase } from '@/lib/supabase';

export interface ContentVersion {
  id: string;
  content_id: string;
  version: number;
  status: string;
  changelog: string | null;
  created_at: string;
}

export async function listContentVersions(contentId: string): Promise<ContentVersion[]> {
  const { data, error } = await supabase.from('content_versions').select('*').eq('content_id', contentId).order('version', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ContentVersion[];
}

/** Atomic: rejects the write if someone else published since p_expected_version (no silent overwrite). */
export async function publishContentVersion(contentId: string, expectedVersion: number, snapshot: Record<string, unknown>, changelog?: string): Promise<ContentVersion> {
  const { data, error } = await supabase.rpc('publish_content_version', {
    p_content_id: contentId, p_expected_version: expectedVersion, p_snapshot: snapshot, p_changelog: changelog ?? null,
  });
  if (error) throw error;
  return data as ContentVersion;
}

/** Always creates a new version — never mutates the restored one. */
export async function restoreContentVersion(contentId: string, fromVersion: number): Promise<ContentVersion> {
  const { data, error } = await supabase.rpc('restore_content_version', { p_content_id: contentId, p_from_version: fromVersion });
  if (error) throw error;
  return data as ContentVersion;
}

export interface ContentComment {
  id: string;
  content_id: string;
  author_id: string;
  body: string;
  resolved: boolean;
  created_at: string;
}

export async function listContentComments(contentId: string): Promise<ContentComment[]> {
  const { data, error } = await supabase.from('content_comments').select('*').eq('content_id', contentId).order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ContentComment[];
}

export async function addContentComment(contentId: string, body: string): Promise<ContentComment> {
  const { data, error } = await supabase.from('content_comments').insert({ content_id: contentId, body }).select().single();
  if (error) throw error;
  return data as ContentComment;
}
