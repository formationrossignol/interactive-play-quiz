import { supabase } from '@/lib/supabase';

export interface AssessmentItem {
  id: string;
  org_id: string;
  item_type: string;
  status: 'draft' | 'in_review' | 'approved' | 'published' | 'deprecated' | 'archived';
  owner_id: string;
  created_at: string;
}

export interface ItemOption {
  id: string;
  label: string;
}

export interface ItemPrompt {
  text: string;
  options?: ItemOption[];
}

/** Matches item_answer_keys.correct_answer's shape per item_type — see
 *  20260812060000_assessment_correction_engine.sql's header comment for
 *  the authoritative contract. Only these 4 types have a scoring
 *  comparator; the other 17 assessment_items.item_type values have no
 *  authoring UI and start_assessment_attempt() refuses to attempt them. */
export type CorrectAnswer =
  | boolean
  | { optionId: string }
  | { optionIds: string[] }
  | { equivalents: string[] };

export interface ScoringRules {
  points?: number;
  partialCredit?: boolean;
  penaltyPerWrong?: number;
  caseSensitive?: boolean;
  trim?: boolean;
}

export interface ItemRevision {
  id: string;
  item_id: string;
  version: number;
  prompt: ItemPrompt;
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
  itemId: string; prompt: ItemPrompt; correctAnswer: CorrectAnswer; scoringRules?: ScoringRules; changelog?: string;
}): Promise<ItemRevision> {
  const { data, error } = await supabase.rpc('create_item_revision', {
    p_item_id: input.itemId,
    p_prompt: input.prompt,
    p_correct_answer: input.correctAnswer,
    p_changelog: input.changelog ?? null,
    p_scoring_rules: input.scoringRules ?? {},
  });
  if (error) throw error;
  return data as ItemRevision;
}

export interface Assessment {
  id: string;
  org_id: string;
  owner_id: string;
  title: string;
  status: 'draft' | 'published' | 'archived';
  published_version: number;
  created_at: string;
}

export interface AssessmentSection {
  id: string;
  assessment_id: string;
  title: string;
  position: number;
  selection_mode: 'fixed' | 'pool';
}

export interface AssessmentItemRef {
  id: string;
  section_id: string;
  item_revision_id: string;
  position: number;
}

export async function listOrgAssessments(orgId: string): Promise<Assessment[]> {
  const { data, error } = await supabase.from('assessments').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Assessment[];
}

export async function createAssessment(orgId: string, title: string): Promise<Assessment> {
  const { data, error } = await supabase.from('assessments').insert({ org_id: orgId, title }).select().single();
  if (error) throw error;
  return data as Assessment;
}

/** V1 supports one fixed section per assessment — pool sections have no
 *  draw executor yet (start_assessment_attempt() rejects them). */
export async function addFixedSection(assessmentId: string, title: string, position = 0): Promise<AssessmentSection> {
  const { data, error } = await supabase.from('assessment_sections').insert({ assessment_id: assessmentId, title, position, selection_mode: 'fixed' }).select().single();
  if (error) throw error;
  return data as AssessmentSection;
}

export async function listAssessmentSections(assessmentId: string): Promise<AssessmentSection[]> {
  const { data, error } = await supabase.from('assessment_sections').select('*').eq('assessment_id', assessmentId).order('position');
  if (error) throw error;
  return (data ?? []) as AssessmentSection[];
}

export async function listSectionItemRefs(sectionId: string): Promise<AssessmentItemRef[]> {
  const { data, error } = await supabase.from('assessment_item_refs').select('*').eq('section_id', sectionId).order('position');
  if (error) throw error;
  return (data ?? []) as AssessmentItemRef[];
}

export async function addItemRef(sectionId: string, itemRevisionId: string, position: number): Promise<AssessmentItemRef> {
  const { data, error } = await supabase.from('assessment_item_refs').insert({ section_id: sectionId, item_revision_id: itemRevisionId, position }).select().single();
  if (error) throw error;
  return data as AssessmentItemRef;
}

/** Snapshots the current fixed structure into assessment_versions and
 *  flips status to 'published' — see publish_assessment() migration. */
export async function publishAssessment(assessmentId: string): Promise<Assessment> {
  const { data, error } = await supabase.rpc('publish_assessment', { p_assessment_id: assessmentId });
  if (error) throw error;
  return data as Assessment;
}

export interface AttemptItem {
  attempt_id: string;
  response_id: string;
  item_revision_id: string;
  item_type: string;
  prompt: ItemPrompt;
  response: unknown;
  item_position: number;
}

export interface AssessmentResponse {
  id: string;
  attempt_id: string;
  item_revision_id: string;
  position: number;
  response: unknown;
  is_correct: boolean | null;
  points_earned: number | null;
  max_points: number;
  answered_at: string | null;
}

export interface AssessmentAttempt {
  id: string;
  assessment_id: string;
  assessment_version: number;
  learner_id: string;
  status: 'in_progress' | 'submitted';
  started_at: string;
  submitted_at: string | null;
  total_points: number | null;
  max_points: number | null;
  percentage: number | null;
}

/** Idempotent: resuming an in-progress attempt returns the same frozen
 *  draw instead of starting a second one (partial unique index enforces
 *  this even under a concurrent double-click). */
export async function startAssessmentAttempt(assessmentId: string): Promise<AttemptItem[]> {
  const { data, error } = await supabase.rpc('start_assessment_attempt', { p_assessment_id: assessmentId });
  if (error) throw error;
  return (data ?? []) as AttemptItem[];
}

/** The correction engine call — response is scored server-side against
 *  item_answer_keys, which the client never receives. */
export async function submitAssessmentResponse(responseId: string, response: unknown): Promise<AssessmentResponse> {
  const { data, error } = await supabase.rpc('submit_assessment_response', { p_response_id: responseId, p_response: response });
  if (error) throw error;
  return data as AssessmentResponse;
}

export async function submitAssessmentAttempt(attemptId: string): Promise<AssessmentAttempt> {
  const { data, error } = await supabase.rpc('submit_assessment_attempt', { p_attempt_id: attemptId });
  if (error) throw error;
  return data as AssessmentAttempt;
}

export async function myAssessmentAttempts(): Promise<AssessmentAttempt[]> {
  const { data, error } = await supabase.from('assessment_attempts').select('*').order('started_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AssessmentAttempt[];
}
