import { supabase } from './supabase';
import { getCurrentUser } from './auth';
import { PlanLimitError, AudienceCapError, type Plan } from './plans';
import { parseFunctionsError } from './functionsError';

/* ══ Types ══════════════════════════════════════════════════════ */

export type ExamStatus = 'draft' | 'scheduled' | 'open' | 'closed' | 'archived';
export type ShowResultsPolicy = 'immediately' | 'after-close' | 'never';
export type ShowDetailPolicy = 'score-only' | 'score-answers' | 'score-correction';
export type ScoreRetentionPolicy = 'best' | 'last' | 'average';
export type AttemptStatus = 'in-progress' | 'submitted' | 'auto-submitted' | 'expired' | 'cancelled';
export type SubmissionMode = 'manual' | 'auto';
export type LogEvent = 'started' | 'saved' | 'submitted' | 'auto-submitted' | 'expired' | 'cancelled';

export interface AttemptLog {
  event: LogEvent;
  timestamp: string;
}

export interface Exam {
  id: string;
  hostId: string;
  quizId: string;
  title: string;
  description: string;
  headerImage?: string;
  openAt: string;        // ISO datetime
  closeAt: string;       // ISO datetime
  durationMinutes: number | null;  // null = no time limit
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  passingScore: number;            // percentage 0–100
  showResultsPolicy: ShowResultsPolicy;
  showDetailPolicy: ShowDetailPolicy;
  scoreRetentionPolicy: ScoreRetentionPolicy;
  status: ExamStatus;
  joinCode: string;
  /** Host's plan-derived audience cap, baked in at creation (host has no
   *  Supabase-synced session to re-check plan against at attempt time). */
  maxParticipants: number | null;
  /** Correct-answer-stripped question snapshot, taken at save time — what
   *  ExamRoom renders from. Never contains correctAnswer/correctOrder/
   *  correctMatches/correctValue (see supabase/functions/_shared/examScoring.ts
   *  stripAnswerKey). */
  questionsPublic: Record<string, unknown>[];
  createdAt: string;
  updatedAt: string;
}

export interface Attempt {
  id: string;
  examId: string;
  participantId: string;
  participantName: string;
  participantEmail: string;
  startedAt: string;
  submittedAt: string | null;
  timeUsedSeconds: number;
  questionOrder: string[];                          // ordered question IDs
  answers: Record<string, number | string | null>;  // questionId → answer
  score: number | null;
  percentage: number | null;
  passed: boolean | null;
  submissionMode: SubmissionMode | null;
  status: AttemptStatus;
  logs: AttemptLog[];
}

export type MessageSender = 'host' | 'participant';

export interface ExamMessage {
  id: string;
  examId: string;
  attemptId: string;
  sender: MessageSender;
  body: string;
  createdAt: string;
}

/* ══ Row <-> object mapping ═══════════════════════════════════════
   `exams`/`exam_attempts` are dedicated Supabase tables (source of truth
   for the join/take/admin flow — see supabase/migrations/20260721120000_
   exam_tables.sql), separate from the generic `content` mirror the host's
   library view (MyExams.tsx) reads.

   Tier 2 (supabase/migrations/20260728010000_exam_scoring_tier2.sql): exam
   CRUD, attempt start/submit, and every participant-side attempt read now go
   through service-role Edge Functions instead of direct table access — see
   docs/exam-scoring-hardening-tier2.md. The functions below keep the exact
   same exported signatures ExamBuilder/ExamRoom/ExamResults already call. */

interface ExamRow {
  id: string; host_id: string; quiz_id: string; title: string; description: string;
  header_image: string | null;
  open_at: string; close_at: string; duration_minutes: number | null; max_attempts: number;
  shuffle_questions: boolean; shuffle_answers: boolean; passing_score: number;
  show_results_policy: string; show_detail_policy: string; score_retention_policy: string;
  status: string; join_code: string; max_participants: number | null;
  questions_public: Record<string, unknown>[] | null;
  created_at: string; updated_at: string;
}

function examFromRow(r: ExamRow): Exam {
  return {
    id: r.id,
    hostId: r.host_id,
    quizId: r.quiz_id,
    title: r.title,
    description: r.description,
    headerImage: r.header_image ?? undefined,
    openAt: r.open_at,
    closeAt: r.close_at,
    durationMinutes: r.duration_minutes,
    maxAttempts: r.max_attempts,
    shuffleQuestions: r.shuffle_questions,
    shuffleAnswers: r.shuffle_answers,
    passingScore: r.passing_score,
    showResultsPolicy: r.show_results_policy as ShowResultsPolicy,
    showDetailPolicy: r.show_detail_policy as ShowDetailPolicy,
    scoreRetentionPolicy: r.score_retention_policy as ScoreRetentionPolicy,
    status: r.status as ExamStatus,
    joinCode: r.join_code,
    maxParticipants: r.max_participants,
    questionsPublic: r.questions_public ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

interface AttemptRow {
  id: string; exam_id: string; participant_id: string; participant_name: string; participant_email: string;
  started_at: string; submitted_at: string | null; time_used_seconds: number;
  question_order: string[]; answers: Record<string, number | string | null>;
  score: number | null; percentage: number | null; passed: boolean | null;
  submission_mode: string | null; status: string; logs: AttemptLog[];
}

interface ExamMessageRow {
  id: string; exam_id: string; attempt_id: string; sender: string; body: string; created_at: string;
}

function messageFromRow(r: ExamMessageRow): ExamMessage {
  return {
    id: r.id,
    examId: r.exam_id,
    attemptId: r.attempt_id,
    sender: r.sender as MessageSender,
    body: r.body,
    createdAt: r.created_at,
  };
}

function attemptFromRow(r: AttemptRow): Attempt {
  return {
    id: r.id,
    examId: r.exam_id,
    participantId: r.participant_id,
    participantName: r.participant_name,
    participantEmail: r.participant_email,
    startedAt: r.started_at,
    submittedAt: r.submitted_at,
    timeUsedSeconds: r.time_used_seconds,
    questionOrder: r.question_order ?? [],
    answers: r.answers ?? {},
    score: r.score,
    percentage: r.percentage,
    passed: r.passed,
    submissionMode: r.submission_mode as SubmissionMode | null,
    status: r.status as AttemptStatus,
    logs: r.logs ?? [],
  };
}

/* ══ Exam CRUD ═══════════════════════════════════════════════════ */

export const getExamById = async (id: string): Promise<Exam | null> => {
  const { data, error } = await supabase.from('exams').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return examFromRow(data);
};

/** Participant-side lookup by join code — goes through the get-exam-by-code
 *  Edge Function now that exams_public_read (`using (true)`, which let an
 *  anon key select every exam in the table) has been dropped. */
export const getExamByJoinCode = async (code: string): Promise<Exam | null> => {
  const { data, error } = await supabase.functions.invoke('get-exam-by-code', {
    body: { joinCode: code },
  });
  if (error || !(data as { exam?: ExamRow })?.exam) return null;
  return examFromRow((data as { exam: ExamRow }).exam);
};

export const getHostExams = async (hostId: string): Promise<Exam[]> => {
  const { data, error } = await supabase.from('exams').select('*').eq('host_id', hostId).neq('status', 'archived');
  if (error || !data) return [];
  return data.map(examFromRow);
};

export type ExamPayload = Omit<Exam, 'id' | 'hostId' | 'joinCode' | 'createdAt' | 'updatedAt' | 'maxParticipants' | 'questionsPublic'>;

async function invokeSaveExam(examId: string | undefined, data: ExamPayload): Promise<Exam> {
  const { data: result, error } = await supabase.functions.invoke('save-exam', {
    body: { examId, ...data },
  });
  if (error) {
    const { body } = await parseFunctionsError(error);
    if (body.error === 'plan_limit') {
      throw new PlanLimitError('exam', body.cap as number, (body.plan as Plan) ?? 'starter');
    }
    throw new Error(body.error === 'quiz_not_found' ? 'Quiz introuvable' : 'Échec de sauvegarde');
  }
  return examFromRow((result as { exam: ExamRow }).exam);
}

export const createExam = async (data: ExamPayload): Promise<Exam> => {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  return invokeSaveExam(undefined, data);
};

const examUpdatesToRow = (updates: Partial<Exam>): Partial<ExamRow> => {
  const patch: Partial<ExamRow> = {};
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.headerImage !== undefined) patch.header_image = updates.headerImage || null;
  if (updates.openAt !== undefined) patch.open_at = updates.openAt;
  if (updates.closeAt !== undefined) patch.close_at = updates.closeAt;
  if (updates.durationMinutes !== undefined) patch.duration_minutes = updates.durationMinutes;
  if (updates.maxAttempts !== undefined) patch.max_attempts = updates.maxAttempts;
  if (updates.shuffleQuestions !== undefined) patch.shuffle_questions = updates.shuffleQuestions;
  if (updates.shuffleAnswers !== undefined) patch.shuffle_answers = updates.shuffleAnswers;
  if (updates.passingScore !== undefined) patch.passing_score = updates.passingScore;
  if (updates.showResultsPolicy !== undefined) patch.show_results_policy = updates.showResultsPolicy;
  if (updates.showDetailPolicy !== undefined) patch.show_detail_policy = updates.showDetailPolicy;
  if (updates.scoreRetentionPolicy !== undefined) patch.score_retention_policy = updates.scoreRetentionPolicy;
  if (updates.status !== undefined) patch.status = updates.status;
  return patch;
};

/**
 * Two distinct call patterns share this export: ExamBuilder always sends a
 * complete payload (including quizId, possibly changed) — that goes through
 * save-exam so questions_public/exam_answer_keys stay derived from whatever
 * quiz the exam ends up pointing at. ExamAdmin/archiveExam send a bare
 * `{ status }` patch — no quiz re-derivation needed, stays a direct
 * authenticated table write under exams_owner_update (unchanged by Tier 2).
 */
export const updateExam = async (id: string, updates: Partial<Exam>): Promise<Exam | null> => {
  const user = getCurrentUser();
  if (!user) return null;

  if (updates.quizId !== undefined) {
    try {
      return await invokeSaveExam(id, updates as ExamPayload);
    } catch {
      return null;
    }
  }

  const { data, error } = await supabase
    .from('exams')
    .update(examUpdatesToRow(updates))
    .eq('id', id)
    .eq('host_id', user.id)
    .select()
    .maybeSingle();
  if (error || !data) return null;
  return examFromRow(data);
};

export const archiveExam = async (id: string): Promise<boolean> => {
  const result = await updateExam(id, { status: 'archived' });
  return result !== null;
};

export const duplicateExam = async (id: string): Promise<Exam | null> => {
  const user = getCurrentUser();
  if (!user) return null;
  const original = await getExamById(id);
  if (!original || original.hostId !== user.id) return null;

  try {
    return await invokeSaveExam(undefined, {
      quizId: original.quizId,
      title: `Copie de ${original.title}`,
      description: original.description,
      headerImage: original.headerImage,
      openAt: original.openAt,
      closeAt: original.closeAt,
      durationMinutes: original.durationMinutes,
      maxAttempts: original.maxAttempts,
      shuffleQuestions: original.shuffleQuestions,
      shuffleAnswers: original.shuffleAnswers,
      passingScore: original.passingScore,
      showResultsPolicy: original.showResultsPolicy,
      showDetailPolicy: original.showDetailPolicy,
      scoreRetentionPolicy: original.scoreRetentionPolicy,
      status: 'draft',
    });
  } catch {
    return null;
  }
};

/* ══ Computed exam status ═══════════════════════════════════════ */

export function computeExamStatus(exam: Exam): ExamStatus {
  if (exam.status === 'draft' || exam.status === 'archived') return exam.status;
  const now = Date.now();
  const open = new Date(exam.openAt).getTime();
  const close = new Date(exam.closeAt).getTime();
  if (now < open) return 'scheduled';
  if (now < close) return 'open';
  return 'closed';
}

export function isExamOpen(exam: Exam): boolean {
  return computeExamStatus(exam) === 'open';
}

/* ══ Attempt CRUD ═══════════════════════════════════════════════ */

/** Host-only direct read (RLS: exam_attempts_host_read) — used by cancelAttempt
 *  and the admin dashboard, both already authenticated as the exam's host. */
export const getAttemptById = async (id: string): Promise<Attempt | null> => {
  const { data, error } = await supabase.from('exam_attempts').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return attemptFromRow(data);
};

export const getAttemptsForExam = async (examId: string): Promise<Attempt[]> => {
  const { data, error } = await supabase.from('exam_attempts').select('*').eq('exam_id', examId);
  if (error || !data) return [];
  return data.map(attemptFromRow);
};

/** Participant-side reads (no auth session) go through get-participant-attempts,
 *  filtered server-side by participantId — the thing RLS could never do for
 *  an anonymous caller (see exam_attempts_read_published's removal in
 *  20260728010000_exam_scoring_tier2.sql). */
async function fetchParticipantAttempts(examId: string, participantId: string): Promise<Attempt[]> {
  const { data, error } = await supabase.functions.invoke('get-participant-attempts', {
    body: { examId, participantId },
  });
  if (error || !(data as { attempts?: AttemptRow[] })?.attempts) return [];
  return (data as { attempts: AttemptRow[] }).attempts.map(attemptFromRow);
}

export const getAttemptsForParticipant = async (examId: string, participantId: string): Promise<Attempt[]> =>
  fetchParticipantAttempts(examId, participantId);

export const getActiveAttempt = async (examId: string, participantId: string): Promise<Attempt | null> => {
  const attempts = await fetchParticipantAttempts(examId, participantId);
  return attempts.find((a) => a.status === 'in-progress') ?? null;
};

export const startAttempt = async (
  exam: Exam,
  participantId: string,
  participantName: string,
  participantEmail: string,
): Promise<Attempt> => {
  const { data, error } = await supabase.functions.invoke('start-exam-attempt', {
    body: { examId: exam.id, participantId, participantName, participantEmail },
  });
  if (error) throw new Error('Impossible de démarrer la tentative');

  const result = data as { outcome: 'resumed' | 'started' | 'exhausted' | 'full'; attempt?: AttemptRow };
  if (result.outcome === 'exhausted') throw new Error('Nombre maximum de tentatives atteint');
  if (result.outcome === 'full') throw new AudienceCapError();
  if (!result.attempt) throw new Error('Impossible de démarrer la tentative');
  return attemptFromRow(result.attempt);
};

/** Autosave: goes through the save_exam_answers RPC (SQL does the
 *  read-modify-write for the logs append in one statement) rather than a
 *  client-side read-then-update — there is no SELECT policy left on
 *  exam_attempts for an anonymous caller to read the current row first. */
export const saveAnswers = async (
  attemptId: string,
  answers: Record<string, number | string | null>,
  timeUsedSeconds: number,
): Promise<boolean> => {
  const { data, error } = await supabase.rpc('save_exam_answers', {
    p_attempt_id: attemptId,
    p_answers: answers,
    p_time_used_seconds: timeUsedSeconds,
  });
  return !error && data === true;
};

export const submitAttempt = async (
  attemptId: string,
  answers: Record<string, number | string | null>,
  timeUsedSeconds: number,
  mode: SubmissionMode = 'manual',
): Promise<Attempt | null> => {
  const { data, error } = await supabase.functions.invoke('submit-exam-attempt', {
    body: { attemptId, answers, timeUsedSeconds, mode },
  });
  if (error) throw new Error('Échec de la soumission');
  const result = (data as { attempt?: AttemptRow }).attempt;
  return result ? attemptFromRow(result) : null;
};

/** Host-side removal: excludes an attempt from the live view and stats,
 *  whatever its current status (in-progress or already submitted). */
export const cancelAttempt = async (attemptId: string): Promise<boolean> => {
  const current = await getAttemptById(attemptId);
  if (!current) return false;
  const { data, error } = await supabase
    .from('exam_attempts')
    .update({
      status: 'cancelled',
      logs: [...current.logs, { event: 'cancelled', timestamp: new Date().toISOString() }],
    })
    .eq('id', attemptId)
    .select('id');
  if (error) throw error;
  return (data?.length ?? 0) > 0;
};

/* ══ Host ↔ participant chat thread ═══════════════════════════════ */

export const getMessagesForAttempt = async (attemptId: string): Promise<ExamMessage[]> => {
  const { data, error } = await supabase
    .from('exam_messages').select('*')
    .eq('attempt_id', attemptId).order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map(messageFromRow);
};

export const sendMessage = async (
  examId: string, attemptId: string, sender: MessageSender, body: string,
): Promise<ExamMessage> => {
  const { data, error } = await supabase
    .from('exam_messages')
    .insert({ exam_id: examId, attempt_id: attemptId, sender, body })
    .select()
    .single();
  if (error) throw error;
  return messageFromRow(data);
};

/* ══ Answer correctness (client-side display only — scoring itself now
   happens server-side, see supabase/functions/_shared/examScoring.ts) ══ */

/** Structural correctness check used by ExamResults' checkCorrect to render
 *  the ✓/✕ per-question status against the correction the server already
 *  computed. `correctAnswer` is `unknown` because the same field carries
 *  wildly different shapes per question type (string, number[], {leftId,
 *  rightId}[], {id,correctAnswer}[]) — a plain `===` only ever works for the
 *  primitive types, so array/object-shaped answers (ranking, matching,
 *  fill-blank) would otherwise always display wrong regardless of what was
 *  submitted. Mirrors the equivalent structural fix in
 *  supabase/functions/_shared/examScoring.ts's calculateScore — keep both in
 *  sync (browser vs Deno runtime, can't share the module directly). */
export function isAnswerCorrect(
  answer: unknown,
  q: { type: string; correctAnswer?: unknown },
): boolean {
  if (q.type === 'true-false') {
    return String(answer).toLowerCase() === String(q.correctAnswer).toLowerCase();
  }
  if (q.type === 'short-answer') {
    return String(answer).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
  }
  if (q.type === 'ranking') {
    const order = q.correctAnswer as number[] | undefined;
    if (!Array.isArray(order) || !Array.isArray(answer)) return false;
    return order.length === answer.length && order.every((v, i) => v === answer[i]);
  }
  if (q.type === 'matching') {
    const matches = q.correctAnswer as { leftId: string; rightId: string }[] | undefined;
    if (!Array.isArray(matches) || !Array.isArray(answer)) return false;
    if (matches.length !== answer.length) return false;
    const expected = new Map(matches.map((m) => [m.leftId, m.rightId]));
    return (answer as { leftId: string; rightId: string }[]).every(
      (m) => expected.get(m.leftId) === m.rightId
    );
  }
  if (q.type === 'fill-blank') {
    const blanks = q.correctAnswer as { id: string; correctAnswer: string; acceptableAnswers?: string[] }[] | undefined;
    if (!Array.isArray(blanks) || typeof answer !== 'object' || answer === null) return false;
    const given = answer as Record<string, string>;
    return blanks.every((b) => {
      const submitted = String(given[b.id] ?? '').trim().toLowerCase();
      const accepted = [b.correctAnswer, ...(b.acceptableAnswers ?? [])].map((a) => a.trim().toLowerCase());
      return accepted.includes(submitted);
    });
  }
  return answer === q.correctAnswer;
}

/* ══ Best score for participant ════════════════════════════════ */

export async function getRetainedAttempt(exam: Exam, participantId: string): Promise<Attempt | null> {
  const done = (await fetchParticipantAttempts(exam.id, participantId))
    .filter((a) => a.status === 'submitted' || a.status === 'auto-submitted');
  if (!done.length) return null;
  if (exam.scoreRetentionPolicy === 'last') return done[done.length - 1];
  if (exam.scoreRetentionPolicy === 'best') return done.reduce((b, a) => (a.percentage ?? 0) > (b.percentage ?? 0) ? a : b);
  // average — return the attempt with percentage closest to mean
  const avg = done.reduce((s, a) => s + (a.percentage ?? 0), 0) / done.length;
  return done.reduce((b, a) => Math.abs((a.percentage ?? 0) - avg) < Math.abs((b.percentage ?? 0) - avg) ? a : b);
}

/* ══ Admin stats ════════════════════════════════════════════════ */

export interface ExamStats {
  totalAttempts: number;
  completedAttempts: number;
  passRate: number | null;
  avgScore: number | null;
  avgTimeMinutes: number | null;
}

export async function computeExamStats(examId: string): Promise<ExamStats> {
  const attempts = await getAttemptsForExam(examId);
  const completed = attempts.filter((a) => a.status === 'submitted' || a.status === 'auto-submitted');
  const passed = completed.filter((a) => a.passed === true).length;
  const avgPct = completed.length
    ? Math.round(completed.reduce((s, a) => s + (a.percentage ?? 0), 0) / completed.length)
    : null;
  const avgTime = completed.length
    ? Math.round(completed.reduce((s, a) => s + a.timeUsedSeconds, 0) / completed.length / 60)
    : null;
  return {
    totalAttempts: attempts.length,
    completedAttempts: completed.length,
    passRate: completed.length ? Math.round((passed / completed.length) * 100) : null,
    avgScore: avgPct,
    avgTimeMinutes: avgTime,
  };
}

/* ══ Results exports ═══════════════════════════════════════════ */

const EXAM_EXPORT_HEADERS = [
  'Participant',
  'Email',
  'Début',
  'Soumission',
  'Temps (min)',
  'Score (%)',
  'Statut',
  'Mode',
] as const;

type ExamExportValue = string | number;

async function getExamExportRows(exam: Exam): Promise<ExamExportValue[][]> {
  const attempts = (await getAttemptsForExam(exam.id))
    .filter((a) => a.status !== 'in-progress' && a.status !== 'cancelled');

  return attempts.map((a) => [
    a.participantName,
    a.participantEmail || '',
    new Date(a.startedAt).toLocaleString('fr'),
    a.submittedAt ? new Date(a.submittedAt).toLocaleString('fr') : '',
    Math.round(a.timeUsedSeconds / 60),
    a.percentage ?? '',
    a.passed === true ? 'Réussi' : a.passed === false ? 'Échoué' : '',
    a.submissionMode === 'manual' ? 'Manuel' : a.submissionMode === 'auto' ? 'Automatique' : '',
  ]);
}

function examExportFilename(exam: Exam): string {
  const safeTitle = exam.title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `resultats_${safeTitle || 'examen'}_${exam.joinCode}`;
}

export async function exportCSV(exam: Exam): Promise<void> {
  const rows = await getExamExportRows(exam);

  const csv = [[...EXAM_EXPORT_HEADERS], ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const bom = '﻿'; // UTF-8 BOM for Excel
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${examExportFilename(exam)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportExcel(exam: Exam): Promise<void> {
  const rows = await getExamExportRows(exam);
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.aoa_to_sheet([[...EXAM_EXPORT_HEADERS], ...rows]);
  worksheet['!cols'] = [
    { wch: 24 },
    { wch: 30 },
    { wch: 21 },
    { wch: 21 },
    { wch: 13 },
    { wch: 11 },
    { wch: 12 },
    { wch: 14 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Résultats');
  XLSX.writeFile(workbook, `${examExportFilename(exam)}.xlsx`);
}

export async function exportPDF(exam: Exam): Promise<void> {
  const rows = await getExamExportRows(exam);
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  document.setFont('helvetica', 'bold');
  document.setFontSize(16);
  document.text(`Résultats — ${exam.title}`, 14, 15);
  document.setFont('helvetica', 'normal');
  document.setFontSize(9);
  document.setTextColor(100);
  document.text(`Code : ${exam.joinCode} · Exporté le ${new Date().toLocaleString('fr')}`, 14, 21);

  autoTable(document, {
    startY: 27,
    head: [[...EXAM_EXPORT_HEADERS]],
    body: rows.map((row) => row.map(String)),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.2, overflow: 'linebreak' },
    headStyles: { fillColor: [76, 57, 168], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 244, 238] },
    margin: { left: 10, right: 10 },
  });

  document.save(`${examExportFilename(exam)}.pdf`);
}

export async function exportJSON(exam: Exam): Promise<void> {
  const rows = await getExamExportRows(exam);
  const attempts = rows.map((row) => Object.fromEntries(
    EXAM_EXPORT_HEADERS.map((header, index) => [header, row[index]]),
  ));
  const payload = {
    exam: {
      id: exam.id,
      title: exam.title,
      joinCode: exam.joinCode,
      openAt: exam.openAt,
      closeAt: exam.closeAt,
      passingScore: exam.passingScore,
    },
    exportedAt: new Date().toISOString(),
    attempts,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${examExportFilename(exam)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
