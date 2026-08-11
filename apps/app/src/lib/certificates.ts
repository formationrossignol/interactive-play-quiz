import { supabase } from "@/lib/supabase";

export interface Certificate {
  id: string;
  userId: string;
  courseId: string;
  courseTitle: string;
  learnerName: string;
  totalLessons: number;
  certificateNumber: string;
  issuedAt: string;
}

interface CertificateRow {
  id: string;
  user_id: string;
  course_id: string;
  course_title: string;
  learner_name: string;
  total_lessons: number;
  certificate_number: string;
  issued_at: string;
}

const fromRow = (row: CertificateRow): Certificate => ({
  id: row.id,
  userId: row.user_id,
  courseId: row.course_id,
  courseTitle: row.course_title,
  learnerName: row.learner_name,
  totalLessons: row.total_lessons,
  certificateNumber: row.certificate_number,
  issuedAt: row.issued_at,
});

export const certificateNumberFor = (courseId: string, userId: string): string =>
  `BRV-${courseId.slice(0, 6).toUpperCase()}-${userId.slice(0, 6).toUpperCase()}`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Idempotent: re-completing an already-certified course updates the
 *  existing row instead of duplicating it. Server-verified — the
 *  issue_course_certificate() RPC checks course_lesson_progress rather
 *  than trusting totalLessons at face value (see
 *  20260812040000_course_completion_verification.sql).
 *
 *  courseStorage.ts's lesson-completion mirror to that table is
 *  fire-and-forget (never blocks the UI), so the very last lesson's mirror
 *  write can still be in flight when this fires — retry a few times
 *  instead of failing the certificate outright on that race. */
export async function recordCertificate(certificate: {
  userId: string;
  courseId: string;
  courseTitle: string;
  learnerName: string;
  totalLessons: number;
}): Promise<void> {
  const attempts = 4;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const { error } = await supabase.rpc("issue_course_certificate", {
      p_course_id: certificate.courseId,
      p_course_title: certificate.courseTitle,
      p_learner_name: certificate.learnerName,
      p_total_lessons: certificate.totalLessons,
    });
    if (!error) return;
    if (attempt === attempts) throw error;
    await sleep(attempt * 400);
  }
}

export async function listCertificates(userId: string): Promise<Certificate[]> {
  const { data, error } = await supabase
    .from("certificates")
    .select("id,user_id,course_id,course_title,learner_name,total_lessons,certificate_number,issued_at")
    .eq("user_id", userId)
    .order("issued_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as CertificateRow[]).map(fromRow);
}
