import { supabase } from '@/lib/supabase';

export interface OrgAiSettings {
  org_id: string;
  ai_enabled: boolean;
  provider: string;
  monthly_request_limit: number | null;
  retention_days: number;
  updated_at: string;
}

export type AiSuggestionType = 'generation' | 'distractors' | 'bias_check';
export type AiSuggestionStatus = 'pending' | 'ready' | 'accepted' | 'rejected' | 'failed';

export interface ItemAiSuggestion {
  id: string;
  item_id: string;
  org_id: string;
  suggestion_type: AiSuggestionType;
  status: AiSuggestionStatus;
  source_excerpt: string | null;
  output: Record<string, unknown>;
  model: string | null;
  provenance: Record<string, unknown>;
  requested_by: string;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export async function getOrgAiSettings(orgId: string): Promise<OrgAiSettings | null> {
  const { data, error } = await supabase.from('org_ai_settings').select('*').eq('org_id', orgId).maybeSingle();
  if (error) throw error;
  return data as OrgAiSettings | null;
}

export async function updateOrgAiSettings(
  orgId: string,
  patch: Partial<Pick<OrgAiSettings, 'ai_enabled' | 'monthly_request_limit' | 'retention_days'>>,
): Promise<OrgAiSettings> {
  const { data, error } = await supabase
    .from('org_ai_settings')
    .upsert({ org_id: orgId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'org_id' })
    .select()
    .single();
  if (error) throw error;
  return data as OrgAiSettings;
}

export async function listItemAiSuggestions(itemId: string): Promise<ItemAiSuggestion[]> {
  const { data, error } = await supabase
    .from('item_ai_suggestions')
    .select('*')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ItemAiSuggestion[];
}

export interface RequestAiSuggestionInput {
  itemId: string;
  suggestionType: AiSuggestionType;
  sourceExcerpt?: string;
  itemContext?: { itemType: string; promptText: string; options?: string[] };
}

export async function requestItemAiSuggestion(input: RequestAiSuggestionInput): Promise<ItemAiSuggestion> {
  const { data, error } = await supabase.functions.invoke<ItemAiSuggestion>('generate-item-ai-suggestion', {
    body: {
      itemId: input.itemId,
      suggestionType: input.suggestionType,
      sourceExcerpt: input.sourceExcerpt,
      itemContext: input.itemContext,
    },
  });
  if (error) {
    let message = 'Erreur lors de la génération de la suggestion IA';
    const ctx = (error as { context?: Response }).context;
    if (ctx) {
      try {
        const respBody = await ctx.json() as { error?: string };
        if (respBody?.error) message = respBody.error;
      } catch { /* response body wasn't JSON — keep the generic message */ }
    }
    throw new Error(message);
  }
  if (!data) throw new Error('Réponse vide du service de suggestion IA');
  return data;
}

export async function reviewItemAiSuggestion(suggestionId: string, accept: boolean): Promise<ItemAiSuggestion> {
  const { data, error } = await supabase.rpc('review_item_ai_suggestion', { p_suggestion_id: suggestionId, p_accept: accept });
  if (error) throw error;
  return data as ItemAiSuggestion;
}
