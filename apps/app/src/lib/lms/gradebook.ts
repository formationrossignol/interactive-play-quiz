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
  policy: Record<string, unknown>;
  status: 'draft' | 'published';
  created_at: string;
}

export type PlagiarismCheckStatus = 'not_requested' | 'pending' | 'reviewed';

export interface Submission {
  id: string;
  assignment_id: string;
  /** null when the assignment has anonymous_grading on and the caller
   *  hasn't lifted this submission's anonymity yet — see `anonymized`. */
  learner_id: string | null;
  status: SubmissionStatus;
  active_version: number;
  created_at: string;
  updated_at: string;
  plagiarism_check_status: PlagiarismCheckStatus;
  plagiarism_check_note: string | null;
  plagiarism_checked_by: string | null;
  plagiarism_checked_at: string | null;
  anonymized: boolean;
}

export interface GradeResult {
  id: string;
  grade_item_id: string;
  learner_id: string;
  status: 'graded' | 'excused' | 'missing' | 'not_graded';
  points: number | null;
  published_at: string | null;
  grade_items: { title: string; max_points: number; source_type: string; category: string; weight: number } | null;
}

export type GradeItemSourceType = 'assignment' | 'quiz' | 'exam' | 'manual' | 'scorm' | 'h5p';

export interface GradeItem {
  id: string;
  org_id: string;
  session_id: string | null;
  source_type: GradeItemSourceType;
  source_id: string;
  title: string;
  category: string;
  weight: number;
  max_points: number;
  created_at: string;
}

/** Every grade_item scoped to a session (source_type='assignment' sets
 *  session_id), plus org-wide items (exam/manual) that carry no session_id
 *  in this data model — see 20260811050000_lms_reconciliation.sql. Excluding
 *  them would silently hide real grades rather than reflect a real gap. */
export async function listSessionGradeItems(orgId: string, sessionId: string): Promise<GradeItem[]> {
  const pageSize = 500;
  const items: GradeItem[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('grade_items')
      .select('id, org_id, session_id, source_type, source_id, title, category, weight, max_points, created_at')
      .eq('org_id', orgId)
      .or(`session_id.eq.${sessionId},session_id.is.null`)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    items.push(...((data ?? []) as GradeItem[]));
    if ((data ?? []).length < pageSize) break;
  }
  return items;
}

export async function listGradeResultsForItems(itemIds: string[]): Promise<GradeResult[]> {
  if (itemIds.length === 0) return [];
  const { data, error } = await supabase
    .from('grade_results')
    .select('*')
    .in('grade_item_id', itemIds);
  if (error) throw error;
  return (data ?? []) as GradeResult[];
}

export interface Rubric {
  id: string;
  org_id: string;
  owner_id: string;
  title: string;
  is_template: boolean;
  created_at: string;
}

export interface RubricLevel {
  id: string;
  criterion_id: string;
  label: string;
  points: number;
  position: number;
}

export interface RubricCriterion {
  id: string;
  rubric_id: string;
  label: string;
  description: string;
  position: number;
  max_points: number;
  rubric_levels: RubricLevel[];
}

export interface RubricRating {
  criterion_id: string;
  level_id: string | null;
  points: number;
  comment?: string;
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
  anonymousGrading?: boolean;
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
      policy: input.anonymousGrading ? { anonymous_grading: true } : {},
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

export interface AssignmentTarget {
  id: string;
  assignment_id: string;
  target_type: 'session' | 'group' | 'learner';
  target_id: string;
  due_override: string | null;
}

/** Per-learner deadline/accommodation override (RESTE-A-FAIRE §01,
 *  due_override column). effective_assignment_due_at() already reads this
 *  for target_type='learner' rows (20260811040000_accommodation_effective_dates.sql)
 *  — this only lists the ones actually carrying an override. */
export async function listLearnerDueOverrides(assignmentId: string): Promise<AssignmentTarget[]> {
  const { data, error } = await supabase
    .from('assignment_targets')
    .select('*')
    .eq('assignment_id', assignmentId)
    .eq('target_type', 'learner')
    .not('due_override', 'is', null)
    .order('due_override', { ascending: true });
  if (error) throw error;
  return (data ?? []) as AssignmentTarget[];
}

/** Upserts on the (assignment_id, target_type, target_id) uniqueness added
 *  by 20260812180000 — safe to call again for the same learner (updates
 *  the date rather than duplicating the target row). Also makes the
 *  assignment visible to this learner (assignment_visible_to_learner() ORs
 *  across target rows) — the intended effect for a personalised deadline,
 *  but means clearLearnerDueOverride() below removes that visibility grant
 *  too if nothing else already targets this learner. */
export async function setLearnerDueOverride(assignmentId: string, learnerId: string, dueOverrideIso: string): Promise<AssignmentTarget> {
  const { data, error } = await supabase
    .from('assignment_targets')
    .upsert(
      { assignment_id: assignmentId, target_type: 'learner', target_id: learnerId, due_override: dueOverrideIso },
      { onConflict: 'assignment_id,target_type,target_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data as AssignmentTarget;
}

/** All target rows (session/group/learner), unfiltered — DueOverridesPanel's
 *  listLearnerDueOverrides() only returns learner-type rows carrying an
 *  override; this is the general-purpose read used by AssignmentTargetsPanel
 *  to show the full targeting state of an assignment. Covered by the
 *  existing assignment_targets_staff_read RLS policy, no new grant needed. */
export async function listAssignmentTargets(assignmentId: string): Promise<AssignmentTarget[]> {
  const { data, error } = await supabase
    .from('assignment_targets')
    .select('*')
    .eq('assignment_id', assignmentId);
  if (error) throw error;
  return (data ?? []) as AssignmentTarget[];
}

export async function removeAssignmentTarget(targetId: string): Promise<void> {
  const { error } = await supabase.from('assignment_targets').delete().eq('id', targetId);
  if (error) throw error;
}

export async function clearLearnerDueOverride(assignmentId: string, learnerId: string): Promise<void> {
  const { error } = await supabase
    .from('assignment_targets')
    .delete()
    .eq('assignment_id', assignmentId)
    .eq('target_type', 'learner')
    .eq('target_id', learnerId);
  if (error) throw error;
}

/** GRD-005: goes through list_submissions_for_grading() rather than a
 *  direct table select — submissions_staff_read (RLS) exposes learner_id
 *  unconditionally, column-blind, so masking for anonymous_grading
 *  assignments has to happen in a function, not a policy. Behaves
 *  identically to a plain select for non-anonymous assignments
 *  (anonymized: false, learner_id populated). */
export async function listAssignmentSubmissions(assignmentId: string): Promise<Submission[]> {
  const { data, error } = await supabase.rpc('list_submissions_for_grading', { p_assignment_id: assignmentId });
  if (error) throw error;
  return (data ?? []) as Submission[];
}

/** The only way a submission's learner_id is ever revealed under an
 *  anonymous_grading assignment — logs the reveal (submission_anonymity_lifts)
 *  before returning it. Persists across reloads: once this actor lifts a
 *  submission, list_submissions_for_grading() stops masking it for them. */
export async function liftSubmissionAnonymity(submissionId: string): Promise<string> {
  const { data, error } = await supabase.rpc('lift_submission_anonymity', { p_submission_id: submissionId });
  if (error) throw error;
  return data as string;
}

/** Interface only (RESTE-A-FAIRE §01): no vendor connector, staff record
 *  the outcome of a check run outside this system (Turnitin/Compilatio/…),
 *  same posture as a manual grade override. No direct staff write policy
 *  exists on submissions — this RPC is the only writer. */
export async function setPlagiarismCheck(submissionId: string, status: PlagiarismCheckStatus, note?: string): Promise<Submission> {
  const { data, error } = await supabase.rpc('set_plagiarism_check', {
    p_submission_id: submissionId, p_status: status, p_note: note ?? null,
  });
  if (error) throw error;
  return data as Submission;
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

/** ASG file/audio/video submissions (20260812150000). Bucket is private —
 *  storage RLS (owner folder or staff-by-assignment-org) is the real gate;
 *  createSignedUrl() below is checked against it independently of whatever
 *  submission_files says. Path: <learnerId>/<assignmentId>/<random>-<name>,
 *  matched by submit_assignment()'s own ownership check on p_files. */
export interface SubmissionFile {
  id: string;
  submission_version_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  scan_status: 'pending' | 'clean' | 'rejected';
}

const MAX_SUBMISSION_FILE_BYTES = 25 * 1024 * 1024;

export async function uploadSubmissionFiles(
  learnerId: string, assignmentId: string, files: File[],
): Promise<Array<{ storage_path: string; file_name: string; mime_type: string; size_bytes: number }>> {
  const uploaded: Array<{ storage_path: string; file_name: string; mime_type: string; size_bytes: number }> = [];
  for (const file of files) {
    if (file.size > MAX_SUBMISSION_FILE_BYTES) {
      throw new Error(`« ${file.name} » dépasse la taille maximale (25 Mo).`);
    }
    const path = `${learnerId}/${assignmentId}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from('assignment-submissions').upload(path, file, { contentType: file.type });
    if (error) throw error;
    uploaded.push({ storage_path: path, file_name: file.name, mime_type: file.type, size_bytes: file.size });
  }
  return uploaded;
}

/** Short-lived (5 min) — a fresh one is requested each time a download is opened. */
export async function getSubmissionFileSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from('assignment-submissions').createSignedUrl(storagePath, 300);
  if (error) throw error;
  return data.signedUrl;
}

export async function listActiveSubmissionFiles(submissionId: string, activeVersion: number): Promise<SubmissionFile[]> {
  if (activeVersion <= 0) return [];
  const { data: version, error: versionError } = await supabase
    .from('submission_versions')
    .select('id')
    .eq('submission_id', submissionId)
    .eq('version', activeVersion)
    .maybeSingle();
  if (versionError) throw versionError;
  if (!version) return [];
  const { data, error } = await supabase.from('submission_files').select('*').eq('submission_version_id', version.id);
  if (error) throw error;
  return (data ?? []) as SubmissionFile[];
}

/** Atomic: server computes lateness from the effective due date — see submit_assignment() migration.
 *  `files` must already be uploaded (uploadSubmissionFiles()) — this only attaches their metadata. */
export async function submitAssignment(input: {
  assignmentId: string; kind: ResponseMode; textContent?: string; url?: string; finalize?: boolean;
  files?: Array<{ storage_path: string; file_name: string; mime_type: string; size_bytes: number }>;
}): Promise<Submission> {
  const { data, error } = await supabase.rpc('submit_assignment', {
    p_assignment_id: input.assignmentId,
    p_kind: input.kind,
    p_text_content: input.textContent ?? null,
    p_url: input.url ?? null,
    p_finalize: input.finalize ?? true,
    p_files: input.files ?? null,
  });
  if (error) throw error;
  return data as Submission;
}

/** Atomic: writes the correction, upserts the gradebook line, and audits any revision. */
export async function publishSubmissionGrade(input: {
  submissionId: string; score: number; feedback?: string; reason?: string;
  rubricId?: string | null; rubricRatings?: RubricRating[];
}): Promise<void> {
  const { error } = await supabase.rpc('publish_submission_grade', {
    p_submission_id: input.submissionId,
    p_score: input.score,
    p_feedback: input.feedback ?? '',
    p_rubric_id: input.rubricId ?? null,
    p_rubric_ratings: input.rubricRatings ?? [],
    p_reason: input.reason ?? null,
  });
  if (error) throw error;
}

/** Rubrics are reusable org templates (owner or pedago/admin manage them),
 *  picked at grading time — not stored on the assignment itself. */
export async function listOrgRubrics(orgId: string): Promise<Rubric[]> {
  const { data, error } = await supabase.from('rubrics').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Rubric[];
}

export async function createRubric(orgId: string, ownerId: string, title: string): Promise<Rubric> {
  const { data, error } = await supabase.from('rubrics').insert({ org_id: orgId, owner_id: ownerId, title }).select().single();
  if (error) throw error;
  return data as Rubric;
}

export async function getRubricCriteria(rubricId: string): Promise<RubricCriterion[]> {
  const { data, error } = await supabase
    .from('rubric_criteria')
    .select('*, rubric_levels(*)')
    .eq('rubric_id', rubricId)
    .order('position');
  if (error) throw error;
  return ((data ?? []) as RubricCriterion[]).map((c) => ({
    ...c,
    rubric_levels: (c.rubric_levels ?? []).slice().sort((a, b) => a.position - b.position),
  }));
}

export async function addRubricCriterion(rubricId: string, label: string, maxPoints: number, position: number): Promise<RubricCriterion> {
  const { data, error } = await supabase
    .from('rubric_criteria')
    .insert({ rubric_id: rubricId, label, max_points: maxPoints, position })
    .select('*, rubric_levels(*)')
    .single();
  if (error) throw error;
  return { ...(data as RubricCriterion), rubric_levels: [] };
}

export async function addRubricLevel(criterionId: string, label: string, points: number, position: number): Promise<RubricLevel> {
  const { data, error } = await supabase
    .from('rubric_levels')
    .insert({ criterion_id: criterionId, label, points, position })
    .select()
    .single();
  if (error) throw error;
  return data as RubricLevel;
}

/** GBK-006: creates a new source_type='manual' grade_item plus one
 *  grade_result per row, all-or-nothing (import_gradebook_csv() migration
 *  20260812080000). Caller is expected to have already resolved/filtered
 *  rows via gradebookImport.ts's preview — the RPC re-validates enrollment
 *  and points range regardless and aborts the whole import on any bad row. */
export async function importGradebookCsv(input: {
  orgId: string; sessionId: string; title: string; category: string; weight: number; maxPoints: number;
  rows: Array<{ learnerId: string; points: number }>;
}): Promise<GradeItem> {
  const { data, error } = await supabase.rpc('import_gradebook_csv', {
    p_org_id: input.orgId,
    p_session_id: input.sessionId,
    p_title: input.title,
    p_category: input.category,
    p_weight: input.weight,
    p_max_points: input.maxPoints,
    p_rows: input.rows.map((r) => ({ learner_id: r.learnerId, points: r.points })),
  });
  if (error) throw error;
  return data as GradeItem;
}

export async function myGradeResults(): Promise<GradeResult[]> {
  const { data, error } = await supabase
    .from('grade_results')
    .select('*, grade_items(title, max_points, source_type, category, weight)')
    .order('published_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as GradeResult[];
}
