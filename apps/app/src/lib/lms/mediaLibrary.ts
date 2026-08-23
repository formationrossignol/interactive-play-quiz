import { supabase } from '@/lib/supabase';

/** Spec 10 CNT-020 to CNT-023 (20260823030000_media_asset_library.sql).
 *  Private bucket, org-scoped storage RLS (path <org_id>/<asset_id>/<file>,
 *  same shape as assignment-submissions) — every download goes through a
 *  short-lived signed URL regardless of the asset's own visibility (no
 *  public/private matrix in this schema, a deliberate simplification, not
 *  a partial implementation of one). */
const BUCKET = 'content-media-assets';
const MAX_ASSET_BYTES = 50 * 1024 * 1024;

export interface MediaAsset {
  id: string;
  org_id: string;
  owner_id: string;
  file_name: string;
  mime_type: string | null;
  license: string | null;
  alt_text: string | null;
  language: string;
  created_at: string;
}

export interface MediaAssetVersion {
  id: string;
  asset_id: string;
  version: number;
  storage_path: string;
  hash: string;
  created_at: string;
}

export interface AssetUsage {
  id: string;
  asset_version_id: string;
  content_id: string;
  usage_ref: string | null;
  created_at: string;
}

export interface AssetDeletableCheck {
  deletable: boolean;
  blocking_usages: Array<{ content_id: string; usage_ref: string | null }>;
}

async function hashFileBytes(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function listMediaAssets(orgId: string): Promise<MediaAsset[]> {
  const { data, error } = await supabase.from('media_assets').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MediaAsset[];
}

export async function listAssetVersions(assetId: string): Promise<MediaAssetVersion[]> {
  const { data, error } = await supabase.from('media_asset_versions').select('*').eq('asset_id', assetId).order('version', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MediaAssetVersion[];
}

/** New asset, first version — id generated client-side so the storage path
 *  and the media_assets row can reference the same asset_id atomically
 *  enough for this use case (no concurrent creators of the same asset). */
export async function createMediaAsset(
  orgId: string, file: File, meta: { license?: string; altText?: string; language?: string },
): Promise<{ asset: MediaAsset; version: MediaAssetVersion }> {
  if (file.size > MAX_ASSET_BYTES) {
    throw new Error(`« ${file.name} » dépasse la taille maximale (50 Mo).`);
  }
  const assetId = crypto.randomUUID();
  const { data: asset, error: assetError } = await supabase
    .from('media_assets')
    .insert({ id: assetId, org_id: orgId, file_name: file.name, mime_type: file.type, license: meta.license ?? null, alt_text: meta.altText ?? null, language: meta.language ?? 'fr' })
    .select()
    .single();
  if (assetError) throw assetError;

  const version = await uploadAssetVersion(orgId, assetId, file);
  return { asset: asset as MediaAsset, version };
}

/** CNT-021: replacing an asset creates a version — never overwrites an
 *  existing one. Version number is assigned server-side by a trigger
 *  (race-safe), never computed here. */
export async function uploadAssetVersion(orgId: string, assetId: string, file: File): Promise<MediaAssetVersion> {
  if (file.size > MAX_ASSET_BYTES) {
    throw new Error(`« ${file.name} » dépasse la taille maximale (50 Mo).`);
  }
  const path = `${orgId}/${assetId}/${crypto.randomUUID()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
  if (uploadError) throw uploadError;

  const hash = await hashFileBytes(file);
  const { data, error } = await supabase
    .from('media_asset_versions')
    .insert({ asset_id: assetId, storage_path: path, hash })
    .select()
    .single();
  if (error) throw error;
  return data as MediaAssetVersion;
}

export async function updateMediaAssetMeta(assetId: string, patch: Partial<Pick<MediaAsset, 'license' | 'alt_text' | 'language'>>): Promise<MediaAsset> {
  const { data, error } = await supabase.from('media_assets').update(patch).eq('id', assetId).select().single();
  if (error) throw error;
  return data as MediaAsset;
}

/** Short-lived (5 min) — matches getSubmissionFileSignedUrl's contract. */
export async function getAssetVersionSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 300);
  if (error) throw error;
  return data.signedUrl;
}

/** No dedicated RPC for the read: asset_usages_read RLS already covers a
 *  direct select, this is a PostgREST embedded filter across the version ->
 *  asset_id relationship. */
export async function listAssetUsages(assetId: string): Promise<AssetUsage[]> {
  const { data, error } = await supabase
    .from('asset_usages')
    .select('*, media_asset_versions!inner(asset_id)')
    .eq('media_asset_versions.asset_id', assetId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AssetUsage[];
}

/** An author explicitly records "I used this asset here" — nothing scans
 *  content.data for asset references (every builder has its own shape,
 *  guessing at that is the mistake this program has already made and
 *  walked back elsewhere). */
export async function recordAssetUsage(assetVersionId: string, contentId: string, usageRef?: string): Promise<AssetUsage> {
  const { data, error } = await supabase.rpc('record_asset_usage', { p_asset_version_id: assetVersionId, p_content_id: contentId, p_usage_ref: usageRef ?? null });
  if (error) throw error;
  return data as AssetUsage;
}

export async function removeAssetUsage(usageId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_asset_usage', { p_usage_id: usageId });
  if (error) throw error;
}

export async function checkAssetDeletable(assetId: string): Promise<AssetDeletableCheck> {
  const { data, error } = await supabase.rpc('check_asset_deletable', { p_asset_id: assetId });
  if (error) throw error;
  return data as AssetDeletableCheck;
}

/** pedago/admin only (RPC-enforced) — a shared org asset can be in use by
 *  content a given trainer has no visibility into. Row deletion only: the
 *  storage bytes behind each version aren't removed (no service-role
 *  storage call from a client RPC) — a documented gap, not a silent one. */
export async function deleteMediaAsset(assetId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_media_asset', { p_asset_id: assetId });
  if (error) throw error;
}
