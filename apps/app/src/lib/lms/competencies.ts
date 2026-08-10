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
  competency_id: string;
  learner_id: string;
  level_code: string;
  computed_at: string;
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
