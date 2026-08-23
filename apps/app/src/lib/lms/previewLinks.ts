import { supabase } from '@/lib/supabase';

/** Spec 10 PUB-004 (20260823060000_preview_links.sql). resolvePreviewLink()
 *  is the only anon-callable path — preview_links itself has no anon RLS
 *  policy, direct table access always returns nothing for an unauthenticated
 *  caller (verified: table-level grants alone don't bypass RLS). */
export interface PreviewLink {
  id: string;
  content_id: string;
  version: number | null;
  token: string;
  password_hash: string | null;
  watermark: boolean;
  expires_at: string;
  revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_by: string;
  created_at: string;
}

export async function listPreviewLinks(contentId: string): Promise<PreviewLink[]> {
  const { data, error } = await supabase.from('preview_links').select('*').eq('content_id', contentId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PreviewLink[];
}

export async function createPreviewLink(
  contentId: string, opts: { version?: number; expiresInHours?: number; password?: string; watermark?: boolean } = {},
): Promise<PreviewLink> {
  const { data, error } = await supabase.rpc('create_preview_link', {
    p_content_id: contentId,
    p_version: opts.version ?? null,
    p_expires_in_hours: opts.expiresInHours ?? 168,
    p_password: opts.password ?? null,
    p_watermark: opts.watermark ?? true,
  });
  if (error) throw error;
  return data as PreviewLink;
}

export async function revokePreviewLink(id: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_preview_link', { p_id: id });
  if (error) throw error;
}

export interface ResolvedPreview {
  type: string;
  version: number;
  snapshot: Record<string, unknown>;
  watermark: boolean;
}

const PREVIEW_ERROR_LABEL: Record<string, string> = {
  not_found: "Ce lien de prévisualisation n'existe pas.",
  revoked: "Ce lien a été révoqué.",
  expired: "Ce lien a expiré.",
  wrong_password: "Mot de passe incorrect.",
  no_published_version: "Aucune version publiée n'est disponible pour ce contenu.",
};

/** Callable by anon (no Brivia account) — an external reviewer's whole path. */
export async function resolvePreviewLink(token: string, password?: string): Promise<ResolvedPreview> {
  const { data, error } = await supabase.rpc('resolve_preview_link', { p_token: token, p_password: password ?? null });
  if (error) throw new Error(PREVIEW_ERROR_LABEL[error.message] ? PREVIEW_ERROR_LABEL[error.message] : error.message);
  return data as ResolvedPreview;
}

export function buildPreviewLinkUrl(token: string): string {
  return `${window.location.origin}/preview-link/${token}`;
}
