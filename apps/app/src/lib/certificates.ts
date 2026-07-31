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

/** Idempotent: re-completing an already-certified course updates the existing row instead of duplicating it. */
export async function recordCertificate(certificate: {
  userId: string;
  courseId: string;
  courseTitle: string;
  learnerName: string;
  totalLessons: number;
}): Promise<void> {
  const { error } = await supabase.from("certificates").upsert(
    {
      user_id: certificate.userId,
      course_id: certificate.courseId,
      course_title: certificate.courseTitle,
      learner_name: certificate.learnerName,
      total_lessons: certificate.totalLessons,
      certificate_number: certificateNumberFor(certificate.courseId, certificate.userId),
    },
    { onConflict: "user_id,course_id" },
  );
  if (error) throw error;
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
