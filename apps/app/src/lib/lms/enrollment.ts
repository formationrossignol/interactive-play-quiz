import { supabase } from '@/lib/supabase';

export type EnrollmentStatus =
  | 'invited' | 'pending' | 'waitlisted' | 'active' | 'completed'
  | 'failed' | 'withdrawn' | 'cancelled' | 'expired';

export interface CourseOffering {
  id: string;
  org_id: string;
  content_id: string;
  visibility: 'uncatalogued' | 'internal' | 'public' | 'invite_only';
  created_at: string;
}

export interface EnrollmentPolicy {
  mode?: 'open' | 'approval' | 'closed' | 'payment';
  email_domains?: string[];
  requires_code?: boolean;
  /** A single evaluate_rule_definition() leaf — not the full AND/OR
   *  builder from Automation.tsx (see SelfEnrollmentPolicyPanel). */
  prerequisite?: Record<string, unknown> | null;
}

export interface CourseSession {
  id: string;
  org_id: string;
  offering_id: string;
  label: string;
  code: string;
  mode: 'fixed' | 'self_paced_relative' | 'self_paced_open' | 'recurring';
  timezone: string;
  starts_at: string | null;
  ends_at: string | null;
  capacity: number | null;
  relative_duration_days: number | null;
  enrollment_policy: EnrollmentPolicy;
  status: 'draft' | 'published' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
}

export type WaitlistEntryStatus = 'waiting' | 'offered' | 'expired' | 'accepted' | 'declined';

export interface WaitlistEntry {
  id: string;
  session_id: string;
  learner_id: string;
  position: number;
  status: WaitlistEntryStatus;
  offered_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface Enrollment {
  id: string;
  org_id: string;
  session_id: string;
  learner_id: string;
  status: EnrollmentStatus;
  source: string;
  effective_start_at: string;
  effective_due_at: string | null;
  created_at: string;
}

/** Idempotent: reuses the existing offering for a course if already catalogued. */
export async function ensureCourseOffering(orgId: string, contentId: string): Promise<CourseOffering> {
  const { data: existing } = await supabase
    .from('course_offerings')
    .select('*')
    .eq('content_id', contentId)
    .maybeSingle();
  if (existing) return existing as CourseOffering;

  const { data, error } = await supabase
    .from('course_offerings')
    .insert({ org_id: orgId, content_id: contentId })
    .select()
    .single();
  if (error) throw error;
  return data as CourseOffering;
}

/** Sessions visible to the caller within an org (staff: all; learner: RLS-scoped). */
export async function listOrgSessions(orgId: string): Promise<CourseSession[]> {
  const { data, error } = await supabase
    .from('course_sessions')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CourseSession[];
}

/** Sessions actually delivering a given content item — for attaching a
 *  content_deployments row (spec 10, CNT-011) to the right session. Only
 *  'course' content has a catalogued offering at all today. */
export async function listSessionsForContent(contentId: string): Promise<CourseSession[]> {
  const { data, error } = await supabase
    .from('course_sessions')
    .select('*, course_offerings!inner(content_id)')
    .eq('course_offerings.content_id', contentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CourseSession[];
}

/** Creates a session for an already-catalogued offering. Registrar/pedago/admin only (RLS). */
export async function createCourseSession(input: {
  orgId: string; offeringId: string; label: string; code: string;
  capacity?: number | null; startsAt?: string | null; endsAt?: string | null;
  contentSnapshot: Record<string, unknown>; contentHash: string;
}): Promise<CourseSession> {
  const { data, error } = await supabase
    .from('course_sessions')
    .insert({
      org_id: input.orgId,
      offering_id: input.offeringId,
      label: input.label,
      code: input.code,
      capacity: input.capacity ?? null,
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      content_snapshot: input.contentSnapshot,
      content_hash: input.contentHash,
      status: 'draft',
    })
    .select()
    .single();
  if (error) throw error;
  return data as CourseSession;
}

export async function publishSession(sessionId: string): Promise<void> {
  const { error } = await supabase.from('course_sessions').update({ status: 'published' }).eq('id', sessionId);
  if (error) throw error;
}

/** ENR-013: direct RLS write (course_sessions_manage already allows staff
 *  writes) — no invariant beyond role/org to enforce, same reasoning
 *  RESTE-A-FAIRE gives for due_override needing no new RPC. The invite
 *  code itself never goes through this — see setSessionInviteCode(). */
export async function updateSessionEnrollmentPolicy(sessionId: string, policy: EnrollmentPolicy): Promise<void> {
  const { error } = await supabase.from('course_sessions').update({ enrollment_policy: policy }).eq('id', sessionId);
  if (error) throw error;
}

export async function updateSessionRelativeDuration(sessionId: string, days: number | null): Promise<void> {
  const { error } = await supabase.from('course_sessions').update({ relative_duration_days: days }).eq('id', sessionId);
  if (error) throw error;
}

/** Staff-only in both directions at the RLS layer (session_enrollment_codes
 *  has no learner/public read policy at all) — safe to select directly. */
export async function getSessionInviteCode(sessionId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('session_enrollment_codes')
    .select('code')
    .eq('session_id', sessionId)
    .maybeSingle();
  if (error) throw error;
  return data?.code ?? null;
}

/** Pass null/empty to clear the code. */
export async function setSessionInviteCode(sessionId: string, code: string | null): Promise<void> {
  const { error } = await supabase.rpc('set_session_invite_code', { p_session_id: sessionId, p_code: code });
  if (error) throw error;
}

/** ENR-013: learner-facing self-enrollment, gated by the session's
 *  enrollment_policy (domain/code/approval/prerequisite) — see
 *  self_enroll_in_session() migration. Payment mode raises
 *  'payment_required_not_implemented': deliberately not built this pass. */
export async function selfEnrollInSession(sessionId: string, inviteCode?: string): Promise<Enrollment> {
  const { data, error } = await supabase.rpc('self_enroll_in_session', {
    p_session_id: sessionId,
    p_invite_code: inviteCode ?? null,
  });
  if (error) throw error;
  return data as Enrollment;
}

/** Staff: approve or reject a 'pending' self-enrollment request. Approving
 *  re-checks capacity (waitlists instead of oversubscribing) — see
 *  resolve_pending_enrollment() migration. */
export async function resolvePendingEnrollment(enrollmentId: string, approve: boolean, reason?: string): Promise<Enrollment> {
  const { data, error } = await supabase.rpc('resolve_pending_enrollment', {
    p_enrollment_id: enrollmentId,
    p_approve: approve,
    p_reason: reason ?? null,
  });
  if (error) throw error;
  return data as Enrollment;
}

/** Sessions a learner can browse to self-enroll into: published, within an
 *  org they already belong to (internal/invite_only/public visibility —
 *  'uncatalogued' is deliberately excluded, that's the point of the flag),
 *  minus sessions they're already enrolled/pending/waitlisted in. Filtered
 *  client-side against myEnrollments() since course_sessions_org_read
 *  already scopes the base query to the org RLS allows. */
export async function listCatalogSessions(orgId: string): Promise<CourseSession[]> {
  const { data, error } = await supabase
    .from('course_sessions')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'published')
    .order('starts_at', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as CourseSession[];
}

/** Staff: pending self-enrollment requests awaiting approval. */
export async function listPendingEnrollments(sessionId: string): Promise<Enrollment[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('*')
    .eq('session_id', sessionId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Enrollment[];
}

/** All enrollments belonging to the current user (their "Mes formations" view). */
export async function myEnrollments(): Promise<Enrollment[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Enrollment[];
}

export interface EnrollmentWithSession extends Enrollment {
  session: CourseSession | null;
}

/** ENR-017: "Mes formations" needs the session's label/dates alongside the
 *  enrollment row — one PostgREST embed via the enrollments→course_sessions
 *  FK instead of a second round trip per row. */
export async function myEnrollmentsDetailed(): Promise<EnrollmentWithSession[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('*, session:course_sessions(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as EnrollmentWithSession[];
}

/** effective_enrollment_access_start_at()/effective_enrollment_due_at() —
 *  see migration: composes session.mode + relative_duration_days +
 *  effective_start_at/effective_due_at into the dates ENR-017 actually
 *  needs to bucket by, instead of the raw columns. */
export async function effectiveEnrollmentAccessStartAt(enrollmentId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('effective_enrollment_access_start_at', { p_enrollment_id: enrollmentId });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function effectiveEnrollmentDueAt(enrollmentId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('effective_enrollment_due_at', { p_enrollment_id: enrollmentId });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function listSessionEnrollments(sessionId: string): Promise<Enrollment[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Enrollment[];
}

/** Atomic: reserves a seat or waitlists — see enroll_in_session() migration. */
export async function enrollInSession(sessionId: string, learnerId?: string, source = 'self'): Promise<Enrollment> {
  const { data, error } = await supabase.rpc('enroll_in_session', {
    p_session_id: sessionId,
    p_learner_id: learnerId ?? undefined,
    p_source: source,
  });
  if (error) throw error;
  return data as Enrollment;
}

export interface ResolvedOrgMember {
  identifier: string;
  learner_id: string;
  username: string | null;
}

/** ENR-014: matches only against existing members of `orgId` (join through
 *  `user_org_roles`) — never invents an account for an unmatched identifier,
 *  see 20260812100000_enrollment_csv_import.sql. */
export async function resolveOrgMembersByIdentifier(orgId: string, kind: "email" | "username", identifiers: string[]): Promise<ResolvedOrgMember[]> {
  if (identifiers.length === 0) return [];
  const { data, error } = await supabase.rpc("resolve_org_members_by_identifier", {
    p_org_id: orgId, p_kind: kind, p_identifiers: identifiers,
  });
  if (error) throw error;
  return (data ?? []) as ResolvedOrgMember[];
}

export async function transitionEnrollment(enrollmentId: string, toStatus: EnrollmentStatus, reason?: string): Promise<Enrollment> {
  const { data, error } = await supabase.rpc('transition_enrollment', {
    p_enrollment_id: enrollmentId,
    p_to_status: toStatus,
    p_reason: reason ?? null,
  });
  if (error) throw error;
  return data as Enrollment;
}

/** ENR-015 "prolonger": first writer of effective_due_at after creation —
 *  audited through enrollment_history like every other enrollment change. */
export async function extendEnrollmentDueDate(enrollmentId: string, newDueAt: string, reason?: string): Promise<Enrollment> {
  const { data, error } = await supabase.rpc('extend_enrollment_due_date', {
    p_enrollment_id: enrollmentId,
    p_new_due_at: newDueAt,
    p_reason: reason ?? null,
  });
  if (error) throw error;
  return data as Enrollment;
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceEvent {
  id: string;
  org_id: string;
  session_id: string;
  learner_id: string;
  occurred_on: string;
  status: AttendanceStatus;
  source: 'manual' | 'import';
  note: string | null;
  recorded_by: string;
  created_at: string;
  updated_at: string;
}

/** One row per (session, learner, day) — course_sessions has no
 *  meeting/occurrence sub-table to attach to (RESTE-A-FAIRE §02), so a
 *  calendar day is the unit. */
export async function listSessionAttendance(sessionId: string, occurredOnIsoDate: string): Promise<AttendanceEvent[]> {
  const { data, error } = await supabase
    .from('attendance_events')
    .select('*')
    .eq('session_id', sessionId)
    .eq('occurred_on', occurredOnIsoDate);
  if (error) throw error;
  return (data ?? []) as AttendanceEvent[];
}

/** Upserts on (session_id, learner_id, occurred_on) — re-marking the same
 *  day corrects the existing row rather than accumulating history (see
 *  20260812190000_attendance_events.sql: no history table, spec calls this
 *  "facultatif V1"). Trainer of the session, or registrar/pedago/admin. */
export async function recordAttendance(sessionId: string, learnerId: string, occurredOnIsoDate: string, status: AttendanceStatus, note?: string): Promise<AttendanceEvent> {
  const { data, error } = await supabase.rpc('record_attendance', {
    p_session_id: sessionId,
    p_learner_id: learnerId,
    p_occurred_on: occurredOnIsoDate,
    p_status: status,
    p_note: note ?? null,
  });
  if (error) throw error;
  return data as AttendanceEvent;
}

/** All waitlist entries belonging to the current user, any status —
 *  callers filter to 'offered' for the accept/decline banner. */
export async function myWaitlistEntries(): Promise<WaitlistEntry[]> {
  const { data, error } = await supabase
    .from('waitlist_entries')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as WaitlistEntry[];
}

/** Atomic: accepting turns this entry into an active enrollment — see
 *  accept_waitlist_offer() migration (48h offer window, position-ordered). */
export async function acceptWaitlistOffer(waitlistEntryId: string): Promise<Enrollment> {
  const { data, error } = await supabase.rpc('accept_waitlist_offer', { p_waitlist_entry_id: waitlistEntryId });
  if (error) throw error;
  return data as Enrollment;
}

/** Declining re-chains promote_waitlist() to offer the seat to the next
 *  learner in line. */
export async function declineWaitlistOffer(waitlistEntryId: string): Promise<void> {
  const { error } = await supabase.rpc('decline_waitlist_offer', { p_waitlist_entry_id: waitlistEntryId });
  if (error) throw error;
}

// ── Completion policy (versioned) ───────────────────────────────────────
// "La complétion est calculée par politique versionnée : activités
// obligatoires, score, présence et durée éventuelle" — every key optional
// and independent; publishing a new version never touches an
// already-computed enrollment_completion_results row (see migration).

export interface CompletionPolicyDefinition {
  required_assignment_ids?: string[];
  min_score_pct?: number;
  min_attendance_pct?: number;
  min_duration_days?: number;
}

export interface CompletionPolicySet {
  id: string;
  session_id: string;
  status: 'draft' | 'published';
  published_version: number;
  created_at: string;
}

export interface CompletionPolicySetVersion {
  id: string;
  set_id: string;
  version: number;
  definition: CompletionPolicyDefinition;
  created_at: string;
}

export async function publishCompletionPolicy(sessionId: string, definition: CompletionPolicyDefinition): Promise<CompletionPolicySet> {
  const { data, error } = await supabase.rpc('publish_completion_policy', {
    p_session_id: sessionId,
    p_definition: definition,
  });
  if (error) throw error;
  return data as CompletionPolicySet;
}

export async function getCompletionPolicy(sessionId: string): Promise<{ set: CompletionPolicySet; version: CompletionPolicySetVersion } | null> {
  const { data: set, error: setError } = await supabase
    .from('completion_policy_sets')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle();
  if (setError) throw setError;
  if (!set || set.status !== 'published') return null;

  const { data: version, error: versionError } = await supabase
    .from('completion_policy_set_versions')
    .select('*')
    .eq('set_id', set.id)
    .eq('version', set.published_version)
    .maybeSingle();
  if (versionError) throw versionError;
  if (!version) return null;

  return { set: set as CompletionPolicySet, version: version as CompletionPolicySetVersion };
}

export interface EnrollmentCompletionResult {
  enrollment_id: string;
  policy_set_id: string;
  policy_version: number;
  satisfied: boolean;
  details: Record<string, unknown>;
  computed_at: string;
}

export async function getEnrollmentCompletionResult(enrollmentId: string): Promise<EnrollmentCompletionResult | null> {
  const { data, error } = await supabase
    .from('enrollment_completion_results')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .maybeSingle();
  if (error) throw error;
  return (data as EnrollmentCompletionResult) ?? null;
}

/** Staff on-demand recompute — e.g. right after publishing a new policy
 *  version, without waiting for the nightly sweep (6th step of
 *  run_scheduled_lms_analytics_jobs()). */
export async function recomputeEnrollmentCompletion(enrollmentId: string): Promise<void> {
  const { error } = await supabase.rpc('recompute_enrollment_completion', { p_enrollment_id: enrollmentId });
  if (error) throw error;
}
