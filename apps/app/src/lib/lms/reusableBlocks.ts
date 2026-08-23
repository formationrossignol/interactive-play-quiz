import { supabase } from '@/lib/supabase';

/** Spec 10 CNT-017/018 (20260823050000_templates_and_reusable_blocks.sql).
 *  'copy' mode is a one-time duplication of a version's `content` jsonb
 *  into the target content — nothing to track after the fact, no API here.
 *  Only 'link' mode (recordBlockUsage) has an ongoing relationship. */
export interface ReusableBlock {
  id: string;
  org_id: string;
  type: 'lesson' | 'slide';
  name: string;
  owner_id: string;
  created_at: string;
}

export interface ReusableBlockVersion {
  id: string;
  block_id: string;
  version: number;
  content: Record<string, unknown>;
  created_at: string;
}

export interface BlockUsage {
  id: string;
  block_version_id: string;
  content_id: string;
  usage_ref: string | null;
  adopted_version: number;
  created_at: string;
}

export interface BlockDeletableCheck {
  deletable: boolean;
  blocking_usages: Array<{ content_id: string; usage_ref: string | null }>;
}

export interface BlockUpdateCheck {
  usage_id: string;
  block_id: string;
  adopted_version: number;
  latest_version: number | null;
  has_update: boolean;
}

export async function listReusableBlocks(orgId: string): Promise<ReusableBlock[]> {
  const { data, error } = await supabase.from('reusable_blocks').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ReusableBlock[];
}

export async function createReusableBlock(orgId: string, type: ReusableBlock['type'], name: string, content: Record<string, unknown>): Promise<{ block: ReusableBlock; version: ReusableBlockVersion }> {
  const { data: block, error: blockError } = await supabase.from('reusable_blocks').insert({ org_id: orgId, type, name }).select().single();
  if (blockError) throw blockError;
  const version = await addReusableBlockVersion((block as ReusableBlock).id, content);
  return { block: block as ReusableBlock, version };
}

/** CNT-017: replacing a block's content creates a version — version number
 *  is trigger-assigned (race-safe), never client-computed. */
export async function addReusableBlockVersion(blockId: string, content: Record<string, unknown>): Promise<ReusableBlockVersion> {
  const { data, error } = await supabase.from('reusable_block_versions').insert({ block_id: blockId, content }).select().single();
  if (error) throw error;
  return data as ReusableBlockVersion;
}

export async function listReusableBlockVersions(blockId: string): Promise<ReusableBlockVersion[]> {
  const { data, error } = await supabase.from('reusable_block_versions').select('*').eq('block_id', blockId).order('version', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ReusableBlockVersion[];
}

export async function checkBlockDeletable(blockId: string): Promise<BlockDeletableCheck> {
  const { data, error } = await supabase.rpc('check_block_deletable', { p_block_id: blockId });
  if (error) throw error;
  return data as BlockDeletableCheck;
}

/** pedago/admin only (RPC-enforced) — a shared org block can be linked from
 *  content the deleting trainer has no visibility into. */
export async function deleteReusableBlock(blockId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_reusable_block', { p_block_id: blockId });
  if (error) throw error;
}

/** No dedicated list RPC: block_usages_read RLS already covers a direct
 *  select, this is a PostgREST embedded filter across block_version -> block. */
export async function listBlockUsages(blockId: string): Promise<BlockUsage[]> {
  const { data, error } = await supabase
    .from('block_usages')
    .select('*, reusable_block_versions!inner(block_id)')
    .eq('reusable_block_versions.block_id', blockId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BlockUsage[];
}

export async function recordBlockUsage(blockVersionId: string, contentId: string, usageRef?: string): Promise<BlockUsage> {
  const { data, error } = await supabase.rpc('record_block_usage', { p_block_version_id: blockVersionId, p_content_id: contentId, p_usage_ref: usageRef ?? null });
  if (error) throw error;
  return data as BlockUsage;
}

export async function removeBlockUsage(usageId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_block_usage', { p_usage_id: usageId });
  if (error) throw error;
}

export async function checkBlockUpdate(usageId: string): Promise<BlockUpdateCheck> {
  const { data, error } = await supabase.rpc('check_block_update', { p_usage_id: usageId });
  if (error) throw error;
  return data as BlockUpdateCheck;
}

/** CNT-018's "never silent" adoption: only ever called explicitly, records
 *  that the author has moved to a newer version. Does NOT rewrite the
 *  consuming content's own data — see the migration header for why
 *  (every builder's block-embedding shape is its own, not guessed at here). */
export async function adoptBlockUpdate(usageId: string, toVersion: number): Promise<BlockUsage> {
  const { data, error } = await supabase.rpc('adopt_block_update', { p_usage_id: usageId, p_to_version: toVersion });
  if (error) throw error;
  return data as BlockUsage;
}
