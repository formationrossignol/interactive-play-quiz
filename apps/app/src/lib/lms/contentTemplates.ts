import { supabase } from '@/lib/supabase';
import type { ContentType } from '@/lib/content/types';

/** Spec 10 CNT-016 (20260823050000_templates_and_reusable_blocks.sql). */
export interface ContentTemplate {
  id: string;
  org_id: string;
  type: ContentType;
  name: string;
  tags: string[];
  data: Record<string, unknown>;
  preview_asset_id: string | null;
  status: 'draft' | 'published' | 'archived';
  version: number;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export async function listContentTemplates(orgId: string): Promise<ContentTemplate[]> {
  const { data, error } = await supabase.from('content_templates').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ContentTemplate[];
}

export async function createContentTemplate(orgId: string, type: ContentType, name: string, data: Record<string, unknown>, tags: string[] = []): Promise<ContentTemplate> {
  const { data: row, error } = await supabase.from('content_templates').insert({ org_id: orgId, type, name, data, tags }).select().single();
  if (error) throw error;
  return row as ContentTemplate;
}

export async function updateContentTemplate(
  id: string, patch: Partial<Pick<ContentTemplate, 'name' | 'tags' | 'data' | 'preview_asset_id' | 'status'>>,
): Promise<ContentTemplate> {
  const { data, error } = await supabase.from('content_templates').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as ContentTemplate;
}

/** No usage guard, unlike media assets/reusable blocks: nothing tracks
 *  "this content was instantiated from this template" after the fact —
 *  instantiation is a one-time copy (content.data), not an ongoing link,
 *  so there is nothing that would be broken by deleting the template. */
export async function deleteContentTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('content_templates').delete().eq('id', id);
  if (error) throw error;
}

export interface InstantiatedContent {
  id: string;
  type: ContentType;
  data: Record<string, unknown>;
}

/** The real, wired consumer — inserts a new `content` row from the
 *  template's data, unlike brand kits (no themeable surface) or
 *  content_deployments' non-session types (no consumer table). */
export async function instantiateContentTemplate(templateId: string, title?: string): Promise<InstantiatedContent> {
  const { data, error } = await supabase.rpc('instantiate_content_template', { p_template_id: templateId, p_title: title ?? null });
  if (error) throw error;
  return data as InstantiatedContent;
}
