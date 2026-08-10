import { supabase } from '@/lib/supabase';

export interface AssessmentItem {
  id: string;
  org_id: string;
  item_type: string;
  status: 'draft' | 'in_review' | 'approved' | 'published' | 'deprecated' | 'archived';
  owner_id: string;
  created_at: string;
}

export interface ItemRevision {
  id: string;
  item_id: string;
  version: number;
  prompt: Record<string, unknown>;
  changelog: string | null;
  created_at: string;
}

export async function listOrgItems(orgId: string): Promise<AssessmentItem[]> {
  const { data, error } = await supabase.from('assessment_items').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AssessmentItem[];
}

export async function createItem(orgId: string, itemType: string): Promise<AssessmentItem> {
  const { data, error } = await supabase.from('assessment_items').insert({ org_id: orgId, item_type: itemType }).select().single();
  if (error) throw error;
  return data as AssessmentItem;
}

export async function listItemRevisions(itemId: string): Promise<ItemRevision[]> {
  const { data, error } = await supabase.from('assessment_item_revisions').select('*').eq('item_id', itemId).order('version', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ItemRevision[];
}

/** Atomic: always inserts a new immutable revision — correcting an item never touches past attempts (ASM-003). */
export async function createItemRevision(input: {
  itemId: string; promptText: string; correctAnswer: unknown; changelog?: string;
}): Promise<ItemRevision> {
  const { data, error } = await supabase.rpc('create_item_revision', {
    p_item_id: input.itemId,
    p_prompt: { text: input.promptText },
    p_correct_answer: input.correctAnswer,
    p_changelog: input.changelog ?? null,
    p_scoring_rules: {},
  });
  if (error) throw error;
  return data as ItemRevision;
}
