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

/** All enrollments belonging to the current user (their "Mes formations" view). */
export async function myEnrollments(): Promise<Enrollment[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Enrollment[];
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
