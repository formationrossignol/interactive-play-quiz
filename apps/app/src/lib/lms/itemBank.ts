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

/** A passage's content copied (not live-referenced — see
 *  20260813140000_assessment_new_item_types.sql) into a sub-question's own
 *  prompt at authoring time — ASM-017 without a new join. */
export interface PassageStimulus {
  text?: string;
  mediaUrl?: string;
}

export interface LabelingTarget {
  id: string;
  text: string;
}

export interface ItemPrompt {
  text: string;
  options?: ItemOption[];
  passage?: PassageStimulus;
  /** labeling (ASM-021): named targets matched to labels via a dropdown —
   *  deliberately not pixel zones on an image, see migration header. */
  targets?: LabelingTarget[];
  labels?: LabelingTarget[];
  /** audio_video (ASM-019) / file (ASM-023) */
  instructions?: string;
  kind?: "audio" | "video";
  maxDurationSeconds?: number;
  consentRequired?: boolean;
  allowedMime?: string[];
}

/** Matches item_answer_keys.correct_answer's shape per item_type — see
 *  20260812060000_assessment_correction_engine.sql's header comment
 *  (true_false/single_choice/mcq/short_answer) and
 *  20260813140000_assessment_new_item_types.sql (labeling). audio_video/
 *  file never populate a real correct_answer — item_answer_keys still
 *  needs a row (points-only scoring_rules) but correct_answer is unused,
 *  see that migration's start_assessment_attempt() comment. */
export type CorrectAnswer =
  | boolean
  | { optionId: string }
  | { optionIds: string[] }
  | { equivalents: string[] }
  | { assignments: Record<string, string> }
  | null;

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

export interface SimulationResult {
  is_correct: boolean;
  points_earned: number;
  max_points: number;
}

/** ASM-013: scores a hypothetical response server-side against
 *  item_answer_keys (never readable by the client directly) using the same
 *  comparator submit_assessment_response() uses — never diverges from real
 *  scoring. Never writes assessment_responses/assessment_attempts. */
export async function simulateItemScoring(itemRevisionId: string, response: unknown): Promise<SimulationResult> {
  const { data, error } = await supabase
    .rpc('simulate_item_scoring', { p_item_revision_id: itemRevisionId, p_response: response })
    .single();
  if (error) throw error;
  return data as SimulationResult;
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

/** ADP-009/010/011: a placement test's score-range outcomes, versioned
 *  (see 20260813080000_placement_thresholds.sql). Evaluated automatically
 *  when the learner submits an attempt for this assessment
 *  (_apply_placement_outcome(), called from submit_assessment_attempt()) —
 *  no separate "run placement" action to trigger from the UI. */
export interface PlacementThreshold {
  min_percentage: number;
  max_percentage: number;
  outcome: 'recommend' | 'impose' | 'exempt';
  remediation_assignment_id?: string;
  exempt_target_type?: string;
  exempt_target_id?: string;
}

export async function publishPlacementThresholds(assessmentId: string, thresholds: PlacementThreshold[]): Promise<void> {
  const { error } = await supabase.rpc('publish_placement_thresholds', { p_assessment_id: assessmentId, p_thresholds: thresholds });
  if (error) throw error;
}

export interface PlacementThresholdSet {
  id: string;
  assessment_id: string;
  status: 'draft' | 'published';
  published_version: number;
}

export async function getPlacementThresholds(assessmentId: string): Promise<PlacementThreshold[]> {
  const { data: set, error: setError } = await supabase
    .from('placement_threshold_sets')
    .select('*')
    .eq('assessment_id', assessmentId)
    .eq('status', 'published')
    .maybeSingle();
  if (setError) throw setError;
  if (!set) return [];
  const { data, error } = await supabase
    .from('placement_threshold_set_versions')
    .select('thresholds')
    .eq('set_id', (set as PlacementThresholdSet).id)
    .eq('version', (set as PlacementThresholdSet).published_version)
    .maybeSingle();
  if (error) throw error;
  return (data?.thresholds as PlacementThreshold[]) ?? [];
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
