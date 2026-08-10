import { supabase } from '@/lib/supabase';

export type ResponseMode = 'text' | 'file' | 'url' | 'audio' | 'video' | 'none' | 'combo';
export type SubmissionStatus =
  | 'draft' | 'submitted' | 'late' | 'returned' | 'resubmission_requested'
  | 'graded' | 'excused' | 'void';

export interface Assignment {
  id: string;
  org_id: string;
  session_id: string | null;
  owner_id: string;
  title: string;
  instructions: string;
  response_mode: ResponseMode;
  open_at: string | null;
  due_at: string | null;
  close_at: string | null;
  max_points: number;
  weight: number;
  allowed_attempts: number;
  status: 'draft' | 'published';
  created_at: string;
}

export interface Submission {
  id: string;
  assignment_id: string;
  learner_id: string;
  status: SubmissionStatus;
  active_version: number;
  created_at: string;
  updated_at: string;
}

export interface GradeResult {
  id: string;
  grade_item_id: string;
  learner_id: string;
  status: 'graded' | 'excused' | 'missing' | 'not_graded';
  points: number | null;
  published_at: string | null;
}

/** Assignments a trainer/pedago/admin owns or can grade within an org. */
export async function listOrgAssignments(orgId: string): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Assignment[];
}

/** Assignments visible to the current learner (published + targeted at them). */
export async function listMyAssignments(): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('status', 'published')
    .order('due_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Assignment[];
}

export async function createAssignment(input: {
  orgId: string; ownerId: string; sessionId?: string | null; title: string;
  instructions?: string; responseMode: ResponseMode; dueAt?: string | null; maxPoints?: number;
}): Promise<Assignment> {
  const { data, error } = await supabase
    .from('assignments')
    .insert({
      org_id: input.orgId,
      owner_id: input.ownerId,
      session_id: input.sessionId ?? null,
      title: input.title,
      instructions: input.instructions ?? '',
      response_mode: input.responseMode,
      due_at: input.dueAt ?? null,
      max_points: input.maxPoints ?? 20,
      status: 'draft',
    })
    .select()
    .single();
  if (error) throw error;
  return data as Assignment;
}

/** Publishing also requires at least one target — callers add rows to
 *  assignment_targets before calling this. */
export async function publishAssignment(assignmentId: string): Promise<void> {
  const { error } = await supabase.from('assignments').update({ status: 'published' }).eq('id', assignmentId);
  if (error) throw error;
}

export async function addAssignmentTarget(assignmentId: string, targetType: 'session' | 'group' | 'learner', targetId: string): Promise<void> {
  const { error } = await supabase.from('assignment_targets').insert({ assignment_id: assignmentId, target_type: targetType, target_id: targetId });
  if (error) throw error;
}

export async function listAssignmentSubmissions(assignmentId: string): Promise<Submission[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('assignment_id', assignmentId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Submission[];
}

export async function mySubmission(assignmentId: string): Promise<Submission | null> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('assignment_id', assignmentId)
    .maybeSingle();
  if (error) throw error;
  return (data as Submission | null) ?? null;
}

/** Atomic: server computes lateness from the effective due date — see submit_assignment() migration. */
export async function submitAssignment(input: {
  assignmentId: string; kind: ResponseMode; textContent?: string; url?: string; finalize?: boolean;
}): Promise<Submission> {
  const { data, error } = await supabase.rpc('submit_assignment', {
    p_assignment_id: input.assignmentId,
    p_kind: input.kind,
    p_text_content: input.textContent ?? null,
    p_url: input.url ?? null,
    p_finalize: input.finalize ?? true,
  });
  if (error) throw error;
  return data as Submission;
}

/** Atomic: writes the correction, upserts the gradebook line, and audits any revision. */
export async function publishSubmissionGrade(input: {
  submissionId: string; score: number; feedback?: string; reason?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('publish_submission_grade', {
    p_submission_id: input.submissionId,
    p_score: input.score,
    p_feedback: input.feedback ?? '',
    p_rubric_id: null,
    p_rubric_ratings: [],
    p_reason: input.reason ?? null,
  });
  if (error) throw error;
}

export async function myGradeResults(): Promise<GradeResult[]> {
  const { data, error } = await supabase
    .from('grade_results')
    .select('*')
    .order('published_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as GradeResult[];
}
