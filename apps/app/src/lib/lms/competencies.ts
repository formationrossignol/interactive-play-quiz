import { supabase } from '@/lib/supabase';

export interface CompetencyFramework {
  id: string;
  org_id: string;
  title: string;
  status: 'draft' | 'published' | 'archived';
  visibility: 'private' | 'shared';
  created_at: string;
}

export interface Competency {
  id: string;
  framework_id: string;
  code: string;
  parent_id: string | null;
  position: number;
}

export interface CompetencyMastery {
  id: string;
  org_id: string;
  competency_id: string;
  learner_id: string;
  level_code: string;
  computed_at: string;
}

/** CMP-010/011. target_id is polymorphic (no FK — see the migration
 *  comment); this app only builds pickers for 'assignment' and
 *  'rubric_criterion' so far (both cleanly org-scoped via existing
 *  gradebook.ts list functions). The other 8 target_types the DB accepts
 *  (course/module/lesson/question/exam/scorm_activity/h5p_activity/
 *  path_step) have no coherent org-scoped listing in this codebase yet —
 *  not guessed here. */
export type AlignmentTargetType =
  | 'course' | 'module' | 'lesson' | 'question' | 'assignment'
  | 'rubric_criterion' | 'exam' | 'scorm_activity' | 'h5p_activity' | 'path_step';

export interface CompetencyAlignment {
  id: string;
  competency_id: string;
  target_type: AlignmentTargetType;
  target_id: string;
  weight: number;
  level_target: string | null;
  evidence_role: 'teaching' | 'practice' | 'assessment';
  is_required: boolean;
  created_at: string;
}

/** CMP-006/007. Minimal CRUD — RLS (`mastery_scales_manage`/
 *  `mastery_scale_levels_manage`, both `for all`, pedago/admin) already
 *  permits direct writes, same posture as competency_alignments. Until this
 *  pass no UI anywhere created a scale at all, which would have made every
 *  aggregation_method dead code — recompute_competency_mastery() has
 *  always silently fallen back to 'not_assessed' when an org has no
 *  default scale. */
export type AggregationMethod = 'latest' | 'best' | 'weighted_average' | 'recent_n' | 'manual';

export interface MasteryScale {
  id: string;
  org_id: string;
  title: string;
  is_default: boolean;
  aggregation_method: AggregationMethod;
  recent_n: number;
}

export interface MasteryScaleLevel {
  id: string;
  scale_id: string;
  code: string;
  label: string;
  position: number;
  min_score: number;
}

export async function listOrgMasteryScales(orgId: string): Promise<MasteryScale[]> {
  const { data, error } = await supabase.from('mastery_scales').select('*').eq('org_id', orgId).order('is_default', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MasteryScale[];
}

export async function createMasteryScale(orgId: string, title: string, isDefault: boolean): Promise<MasteryScale> {
  const { data, error } = await supabase.from('mastery_scales').insert({ org_id: orgId, title, is_default: isDefault }).select().single();
  if (error) throw error;
  return data as MasteryScale;
}

export async function updateMasteryScaleMethod(scaleId: string, method: AggregationMethod, recentN: number): Promise<void> {
  const { error } = await supabase.from('mastery_scales').update({ aggregation_method: method, recent_n: recentN }).eq('id', scaleId);
  if (error) throw error;
}

export async function listScaleLevels(scaleId: string): Promise<MasteryScaleLevel[]> {
  const { data, error } = await supabase.from('mastery_scale_levels').select('*').eq('scale_id', scaleId).order('position', { ascending: true });
  if (error) throw error;
  return (data ?? []) as MasteryScaleLevel[];
}

export async function addScaleLevel(input: { scaleId: string; code: string; label: string; position: number; minScore: number }): Promise<MasteryScaleLevel> {
  const { data, error } = await supabase
    .from('mastery_scale_levels')
    .insert({ scale_id: input.scaleId, code: input.code, label: input.label, position: input.position, min_score: input.minScore })
    .select()
    .single();
  if (error) throw error;
  return data as MasteryScaleLevel;
}

/** Only valid while the org's default scale is in 'manual' mode — the RPC
 *  itself re-checks this and rejects otherwise (20260812120000). */
export async function setManualMasteryLevel(competencyId: string, learnerId: string, levelCode: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('set_manual_mastery_level', {
    p_competency_id: competencyId, p_learner_id: learnerId, p_level_code: levelCode, p_reason: reason,
  });
  if (error) throw error;
}

export async function listOrgFrameworks(orgId: string): Promise<CompetencyFramework[]> {
  const { data, error } = await supabase
    .from('competency_frameworks')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CompetencyFramework[];
}

export async function createFramework(orgId: string, title: string): Promise<CompetencyFramework> {
  const { data, error } = await supabase
    .from('competency_frameworks')
    .insert({ org_id: orgId, title })
    .select()
    .single();
  if (error) throw error;
  return data as CompetencyFramework;
}

export async function publishFramework(frameworkId: string): Promise<void> {
  const { error } = await supabase.from('competency_frameworks').update({ status: 'published' }).eq('id', frameworkId);
  if (error) throw error;
}

export async function listFrameworkCompetencies(frameworkId: string): Promise<Competency[]> {
  const { data, error } = await supabase
    .from('competencies')
    .select('*')
    .eq('framework_id', frameworkId)
    .order('position', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Competency[];
}

export async function addCompetency(frameworkId: string, code: string, title: string): Promise<Competency> {
  const { data: competency, error } = await supabase
    .from('competencies')
    .insert({ framework_id: frameworkId, code })
    .select()
    .single();
  if (error) throw error;
  const { error: revError } = await supabase
    .from('competency_revisions')
    .insert({ competency_id: competency.id, version: 1, title, created_by: (await supabase.auth.getUser()).data.user?.id });
  if (revError) throw revError;
  return competency as Competency;
}

/** The learner's own mastery card (CMP-019). */
export async function myMastery(): Promise<CompetencyMastery[]> {
  const { data, error } = await supabase
    .from('competency_mastery')
    .select('*')
    .order('computed_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CompetencyMastery[];
}

/** RLS (`competency_alignments_manage`, `for all`) already lets pedago/admin
 *  insert/delete directly — no RPC needed, same posture as rubric criteria. */
export async function listCompetencyAlignments(competencyId: string): Promise<CompetencyAlignment[]> {
  const { data, error } = await supabase
    .from('competency_alignments')
    .select('*')
    .eq('competency_id', competencyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CompetencyAlignment[];
}

export async function createCompetencyAlignment(input: {
  competencyId: string; targetType: AlignmentTargetType; targetId: string;
  weight?: number; levelTarget?: string | null;
  evidenceRole?: CompetencyAlignment['evidence_role']; isRequired?: boolean;
}): Promise<CompetencyAlignment> {
  const { data, error } = await supabase
    .from('competency_alignments')
    .insert({
      competency_id: input.competencyId,
      target_type: input.targetType,
      target_id: input.targetId,
      weight: input.weight ?? 1,
      level_target: input.levelTarget ?? null,
      evidence_role: input.evidenceRole ?? 'assessment',
      is_required: input.isRequired ?? false,
    })
    .select()
    .single();
  if (error) throw error;
  return data as CompetencyAlignment;
}

export async function deleteCompetencyAlignment(alignmentId: string): Promise<void> {
  const { error } = await supabase.from('competency_alignments').delete().eq('id', alignmentId);
  if (error) throw error;
}

/** Atomic: writes the evidence fact and idempotently recomputes mastery. */
export async function recordCompetencyEvidence(input: {
  competencyId: string; learnerId: string; sourceType: 'question' | 'rubric' | 'global_result' | 'scorm' | 'h5p' | 'manual' | 'import';
  sourceId?: string | null; rawScore?: number | null; levelCode?: string | null; comment?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('record_competency_evidence', {
    p_competency_id: input.competencyId,
    p_learner_id: input.learnerId,
    p_source_type: input.sourceType,
    p_source_id: input.sourceId ?? null,
    p_raw_score: input.rawScore ?? null,
    p_level_code: input.levelCode ?? null,
    p_alignment_id: null,
    p_comment: input.comment ?? null,
  });
  if (error) throw error;
}

/** CMP-018: "L'apprenant peut demander une revue d'une preuve ou maîtrise ;
 *  il ne peut pas la modifier." RLS already covers both directions directly
 *  (`competency_review_requests_learner_insert`: learner_id = auth.uid();
 *  `competency_review_requests_staff`: `for all`, pedago/admin) — no RPC.
 *  Scoped to mastery-level requests (evidence_id left null): the learner
 *  UI (myMastery()) never surfaces individual competency_evidence rows to
 *  request a review *of*, only the computed level. */
export interface CompetencyReviewRequest {
  id: string;
  org_id: string;
  competency_id: string;
  learner_id: string;
  evidence_id: string | null;
  message: string;
  status: 'open' | 'resolved' | 'dismissed';
  created_at: string;
  resolved_at: string | null;
}

export async function myReviewRequests(): Promise<CompetencyReviewRequest[]> {
  const { data, error } = await supabase.from('competency_review_requests').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CompetencyReviewRequest[];
}

export async function requestCompetencyReview(orgId: string, competencyId: string, learnerId: string, message: string): Promise<CompetencyReviewRequest> {
  const { data, error } = await supabase
    .from('competency_review_requests')
    .insert({ org_id: orgId, competency_id: competencyId, learner_id: learnerId, message })
    .select()
    .single();
  if (error) throw error;
  return data as CompetencyReviewRequest;
}

export async function listOrgReviewRequests(orgId: string): Promise<CompetencyReviewRequest[]> {
  const { data, error } = await supabase.from('competency_review_requests').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CompetencyReviewRequest[];
}

export async function resolveReviewRequest(requestId: string, status: 'resolved' | 'dismissed'): Promise<void> {
  const { error } = await supabase.from('competency_review_requests').update({ status, resolved_at: new Date().toISOString() }).eq('id', requestId);
  if (error) throw error;
}
