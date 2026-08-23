import { supabase } from '@/lib/supabase';
import type { ExtractedSegment } from './localization';

/** Spec 10 L10N-001 to 005 (20260823070000_localization.sql). L10N-006 (AI
 *  translation) is not built — explicitly "facultative" in the spec text
 *  itself, same posture already taken for spec 08's optional AI-assist items. */
export interface LocalizationSet {
  id: string;
  org_id: string;
  source_content_id: string;
  source_language: string;
  created_at: string;
}

export interface LocalizedVersion {
  id: string;
  localization_set_id: string;
  language: string;
  status: 'not_started' | 'translating' | 'validation' | 'needs_resync' | 'published';
  source_version: number;
  created_at: string;
  updated_at: string;
}

export interface TranslationSegmentRow {
  id: string;
  localized_version_id: string;
  path: string;
  source_text: string;
  translated_text: string | null;
  status: 'pending' | 'translated' | 'stale';
  updated_at: string;
}

export interface Glossary {
  id: string;
  org_id: string;
  term: string;
  translations: Record<string, string>;
  note: string | null;
  created_at: string;
}

export async function getLocalizationSet(contentId: string): Promise<LocalizationSet | null> {
  const { data, error } = await supabase.from('localization_sets').select('*').eq('source_content_id', contentId).maybeSingle();
  if (error) throw error;
  return (data as LocalizationSet | null) ?? null;
}

export async function createLocalizationSet(contentId: string, sourceLanguage = 'fr'): Promise<LocalizationSet> {
  const { data, error } = await supabase.rpc('create_localization_set', { p_content_id: contentId, p_source_language: sourceLanguage });
  if (error) throw error;
  return data as LocalizationSet;
}

export async function listLocalizedVersions(localizationSetId: string): Promise<LocalizedVersion[]> {
  const { data, error } = await supabase.from('localized_versions').select('*').eq('localization_set_id', localizationSetId).order('language');
  if (error) throw error;
  return (data ?? []) as LocalizedVersion[];
}

export async function addLocalizedVersion(localizationSetId: string, language: string, sourceVersion: number): Promise<LocalizedVersion> {
  const { data, error } = await supabase.rpc('add_localized_version', { p_localization_set_id: localizationSetId, p_language: language, p_source_version: sourceVersion });
  if (error) throw error;
  return data as LocalizedVersion;
}

export async function listTranslationSegments(localizedVersionId: string): Promise<TranslationSegmentRow[]> {
  const { data, error } = await supabase.from('translation_segments').select('*').eq('localized_version_id', localizedVersionId).order('path');
  if (error) throw error;
  return (data ?? []) as TranslationSegmentRow[];
}

/** L10N-004: reconciles the extraction from a (possibly newer)
 *  content_versions.snapshot against what's already stored — never erases
 *  an existing translated_text, only flags it 'stale' when its source
 *  changed. Returns counts, not the segments themselves (caller re-fetches
 *  via listTranslationSegments). */
export async function syncTranslationSegments(localizedVersionId: string, segments: ExtractedSegment[], newSourceVersion: number): Promise<{ inserted: number; staled: number; unchanged: number }> {
  const { data, error } = await supabase.rpc('sync_translation_segments', { p_localized_version_id: localizedVersionId, p_segments: segments, p_new_source_version: newSourceVersion });
  if (error) throw error;
  return data as { inserted: number; staled: number; unchanged: number };
}

/** Direct write — translation_segments_update RLS already scopes this to
 *  staff of the content's org, no invariant beyond that needs a function. */
export async function setTranslation(segmentId: string, translatedText: string): Promise<void> {
  const { error } = await supabase.from('translation_segments').update({ translated_text: translatedText, status: 'translated' }).eq('id', segmentId);
  if (error) throw error;
}

export async function setLocalizedVersionStatus(id: string, status: LocalizedVersion['status']): Promise<void> {
  const { error } = await supabase.from('localized_versions').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function listGlossaries(orgId: string): Promise<Glossary[]> {
  const { data, error } = await supabase.from('glossaries').select('*').eq('org_id', orgId).order('term');
  if (error) throw error;
  return (data ?? []) as Glossary[];
}

export async function createGlossaryTerm(orgId: string, term: string, translations: Record<string, string>, note?: string): Promise<Glossary> {
  const { data, error } = await supabase.from('glossaries').insert({ org_id: orgId, term, translations, note: note ?? null }).select().single();
  if (error) throw error;
  return data as Glossary;
}

export async function deleteGlossaryTerm(id: string): Promise<void> {
  const { error } = await supabase.from('glossaries').delete().eq('id', id);
  if (error) throw error;
}
