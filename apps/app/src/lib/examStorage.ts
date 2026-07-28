import { supabase } from './supabase';
import { getCurrentUser } from './auth';
import { getContentBySource } from './content/contentRepo';
import { CONTENT_CAPS, AUDIENCE_CAP, getPlan, PlanLimitError, AudienceCapError } from './plans';

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
   library view (MyExams.tsx) reads. */

interface ExamRow {
  id: string; host_id: string; quiz_id: string; title: string; description: string;
  header_image: string | null;
  open_at: string; close_at: string; duration_minutes: number | null; max_attempts: number;
  shuffle_questions: boolean; shuffle_answers: boolean; passing_score: number;
  show_results_policy: string; show_detail_policy: string; score_retention_policy: string;
  status: string; join_code: string; max_participants: number | null;
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

/* ══ Helpers ════════════════════════════════════════════════════ */

export const genExamId = (): string =>
  crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function genJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/**
 * Insert a new exams row with a fresh random join_code, retrying on a unique
 * constraint conflict (join_code is unique across ALL hosts, so a per-host
 * check isn't enough — the DB constraint is the actual source of truth).
 */
async function insertExamWithUniqueJoinCode(
  row: Omit<ExamRow, 'join_code' | 'created_at' | 'updated_at'>,
  maxAttempts = 5,
): Promise<ExamRow> {
  for (let i = 0; i < maxAttempts; i++) {
    const { data, error } = await supabase
      .from('exams')
      .insert({ ...row, join_code: genJoinCode() })
      .select()
      .single();
    if (!error) return data;
    if (error.code !== '23505') throw error; // not a unique-violation, real error
  }
  throw new Error('Impossible de générer un code unique, réessayez');
}

/* ══ Exam CRUD ═══════════════════════════════════════════════════ */

export const getExamById = async (id: string): Promise<Exam | null> => {
  const { data, error } = await supabase.from('exams').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return examFromRow(data);
};

export const getExamByJoinCode = async (code: string): Promise<Exam | null> => {
  const { data, error } = await supabase.from('exams').select('*').eq('join_code', code.toUpperCase()).maybeSingle();
  if (error || !data) return null;
  return examFromRow(data);
};

export const getHostExams = async (hostId: string): Promise<Exam[]> => {
  const { data, error } = await supabase.from('exams').select('*').eq('host_id', hostId).neq('status', 'archived');
  if (error || !data) return [];
  return data.map(examFromRow);
};

export const createExam = async (
  data: Omit<Exam, 'id' | 'hostId' | 'joinCode' | 'createdAt' | 'updatedAt' | 'maxParticipants'>,
): Promise<Exam> => {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const plan = getPlan(user);
  const cap = CONTENT_CAPS[plan].exam;
  if (cap !== null) {
    const existing = await getHostExams(user.id);
    if (existing.length >= cap) throw new PlanLimitError('exam', cap, plan);
  }

  const row = await insertExamWithUniqueJoinCode({
    id: genExamId(),
    host_id: user.id,
    quiz_id: data.quizId,
    title: data.title,
    description: data.description,
    header_image: data.headerImage ?? null,
    open_at: data.openAt,
    close_at: data.closeAt,
    duration_minutes: data.durationMinutes,
    max_attempts: data.maxAttempts,
    shuffle_questions: data.shuffleQuestions,
    shuffle_answers: data.shuffleAnswers,
    passing_score: data.passingScore,
    show_results_policy: data.showResultsPolicy,
    show_detail_policy: data.showDetailPolicy,
    score_retention_policy: data.scoreRetentionPolicy,
    status: data.status,
    max_participants: AUDIENCE_CAP[plan],
  });
  return examFromRow(row);
};

const examUpdatesToRow = (updates: Partial<Exam>): Partial<ExamRow> => {
  const patch: Partial<ExamRow> = {};
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.headerImage !== undefined) patch.header_image = updates.headerImage || null;
  if (updates.quizId !== undefined) patch.quiz_id = updates.quizId;
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
  if (updates.maxParticipants !== undefined) patch.max_participants = updates.maxParticipants;
  return patch;
};

export const updateExam = async (id: string, updates: Partial<Exam>): Promise<Exam | null> => {
  const user = getCurrentUser();
  if (!user) return null;
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

  const plan = getPlan(user);
  const cap = CONTENT_CAPS[plan].exam;
  if (cap !== null) {
    const existing = await getHostExams(user.id);
    if (existing.length >= cap) throw new PlanLimitError('exam', cap, plan);
  }

  const row = await insertExamWithUniqueJoinCode({
    id: genExamId(),
    host_id: user.id,
    quiz_id: original.quizId,
    title: `Copie de ${original.title}`,
    description: original.description,
    header_image: original.headerImage ?? null,
    open_at: original.openAt,
    close_at: original.closeAt,
    duration_minutes: original.durationMinutes,
    max_attempts: original.maxAttempts,
    shuffle_questions: original.shuffleQuestions,
    shuffle_answers: original.shuffleAnswers,
    passing_score: original.passingScore,
    show_results_policy: original.showResultsPolicy,
    show_detail_policy: original.showDetailPolicy,
    score_retention_policy: original.scoreRetentionPolicy,
    status: 'draft',
    max_participants: original.maxParticipants,
  });
  return examFromRow(row);
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

export const getAttemptsForParticipant = async (examId: string, participantId: string): Promise<Attempt[]> => {
  const { data, error } = await supabase
    .from('exam_attempts').select('*')
    .eq('exam_id', examId).eq('participant_id', participantId);
  if (error || !data) return [];
  return data.map(attemptFromRow);
};

export const getActiveAttempt = async (examId: string, participantId: string): Promise<Attempt | null> => {
  const { data, error } = await supabase
    .from('exam_attempts').select('*')
    .eq('exam_id', examId).eq('participant_id', participantId).eq('status', 'in-progress')
    .maybeSingle();
  if (error || !data) return null;
  return attemptFromRow(data);
};

export const startAttempt = async (
  exam: Exam,
  participantId: string,
  participantName: string,
  participantEmail: string,
): Promise<Attempt> => {
  const quizRow = await getContentBySource(exam.hostId, 'quiz', exam.quizId);
  if (!quizRow) throw new Error('Quiz introuvable');
  const quiz = quizRow.data as unknown as { questions: Array<{ id: string }> };

  const existing = await getAttemptsForParticipant(exam.id, participantId);
  const completed = existing.filter((a) => a.status !== 'in-progress');
  if (completed.length >= exam.maxAttempts) throw new Error('Nombre maximum de tentatives atteint');

  const active = existing.find((a) => a.status === 'in-progress');
  if (active) return active; // resume existing

  if (exam.maxParticipants !== null && existing.length === 0) {
    const all = await getAttemptsForExam(exam.id);
    const distinctParticipants = new Set(all.map((a) => a.participantId));
    if (distinctParticipants.size >= exam.maxParticipants) throw new AudienceCapError();
  }

  let qIds = quiz.questions.map((q) => q.id);
  if (exam.shuffleQuestions) qIds = shuffle(qIds);

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('exam_attempts')
    .insert({
      exam_id: exam.id,
      participant_id: participantId,
      participant_name: participantName,
      participant_email: participantEmail,
      question_order: qIds,
      answers: {},
      status: 'in-progress',
      logs: [{ event: 'started', timestamp: now }],
    })
    .select()
    .single();
  if (error) throw error;

  // The maxParticipants check above is read-then-write, not atomic — two
  // concurrent starts (double-click, two tabs) can both pass it before
  // either insert lands. Without a DB-side unique constraint or RPC (out of
  // scope here — see docs/exam-scoring-hardening-tier2.md for the broader
  // atomic-attempt-start plan), re-check after inserting and roll back this
  // attempt if it pushed the room over capacity, rather than letting a small
  // overshoot silently stand. Only applies to a genuinely new participant —
  // `existing` (fetched before the insert) already excludes this attempt.
  const isNewParticipant = existing.length === 0;
  if (exam.maxParticipants !== null && isNewParticipant) {
    const all = await getAttemptsForExam(exam.id);
    const distinctParticipants = new Set(all.map((a) => a.participantId));
    if (distinctParticipants.size > exam.maxParticipants) {
      await supabase.from('exam_attempts').delete().eq('id', data.id);
      throw new AudienceCapError();
    }
  }

  // Same race for maxAttempts (this participant double-clicking / two tabs).
  const freshCompleted = (await getAttemptsForParticipant(exam.id, participantId))
    .filter((a) => a.status !== 'in-progress' && a.id !== data.id);
  if (freshCompleted.length >= exam.maxAttempts) {
    await supabase.from('exam_attempts').delete().eq('id', data.id);
    throw new Error('Nombre maximum de tentatives atteint');
  }

  return attemptFromRow(data);
};

export const saveAnswers = async (
  attemptId: string,
  answers: Record<string, number | string | null>,
  timeUsedSeconds: number,
): Promise<boolean> => {
  // `.eq('status', 'in-progress')` makes the guard atomic with the write
  // itself (was: a separate getAttemptById read, then an unconditional
  // update — a TOCTOU window where a submit landing in between would get
  // silently overwritten by this stale save).
  const { data, error } = await supabase
    .from('exam_attempts')
    .update({ answers, time_used_seconds: timeUsedSeconds })
    .eq('id', attemptId)
    .eq('status', 'in-progress')
    .select('id');
  if (error || !data || data.length === 0) return false;

  // Logged via an atomic DB-side append (see 20260728150000_append_exam_
  // attempt_log.sql) rather than read-current-logs-then-overwrite-whole-
  // array — that pattern let a concurrent submitAttempt's 'submitted' log
  // entry get silently clobbered by a stale autosave landing after it.
  const { error: logError } = await supabase.rpc('append_exam_attempt_log', {
    p_attempt_id: attemptId,
    p_entry: { event: 'saved', timestamp: new Date().toISOString() },
  });
  return !logError;
};

export const submitAttempt = async (
  attemptId: string,
  answers: Record<string, number | string | null>,
  timeUsedSeconds: number,
  mode: SubmissionMode = 'manual',
): Promise<Attempt | null> => {
  const current = await getAttemptById(attemptId);
  if (!current) return null;
  if (current.status !== 'in-progress') return current; // already submitted

  const exam = await getExamById(current.examId);
  const quizRow = exam ? await getContentBySource(exam.hostId, 'quiz', exam.quizId) : null;
  const quiz = quizRow?.data as unknown as
    | { questions: Array<{ id: string; type: string; correctAnswer: unknown; points?: number }> }
    | undefined;
  const { score, percentage, passed } = quiz && exam
    ? calculateScore(answers, quiz.questions, exam.passingScore)
    : { score: null, percentage: null, passed: null };

  const now = new Date().toISOString();
  const status = mode === 'manual' ? 'submitted' : 'auto-submitted';
  // Append the terminal log entry first, while status is still 'in-progress'
  // (required by exam_attempts_update_own's RLS), then flip status — see
  // saveAnswers for why this is an atomic DB-side append rather than a
  // read-then-overwrite of the whole logs array.
  await supabase.rpc('append_exam_attempt_log', {
    p_attempt_id: attemptId,
    p_entry: { event: status, timestamp: now },
  });
  const { data, error } = await supabase
    .from('exam_attempts')
    .update({
      answers,
      time_used_seconds: timeUsedSeconds,
      submitted_at: now,
      score,
      percentage,
      passed,
      submission_mode: mode,
      status,
    })
    .eq('id', attemptId)
    .select()
    .single();
  if (error) throw error;
  return attemptFromRow(data);
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

/* ══ Score calculation ═══════════════════════════════════════════ */

/** Structural correctness check shared by calculateScore and ExamResults'
 *  checkCorrect. `correctAnswer` is `unknown` because the same field carries
 *  wildly different shapes per question type (string, number[], {leftId,
 *  rightId}[], {id,correctAnswer}[]) — a plain `===` only ever works for the
 *  primitive types, so array/object-shaped answers (ranking, matching,
 *  fill-blank) would otherwise always score wrong regardless of what was
 *  submitted. ExamRoom doesn't currently render input for these types
 *  (ExamBuilder's quiz picker blocks them at the source, see
 *  unsupportedQuestionTypes in ExamBuilder.tsx), but this keeps scoring
 *  correct for any exam created before that guard shipped, or if UI support
 *  is added later.
 */
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

export function calculateScore(
  answers: Record<string, unknown>,
  questions: Array<{ id: string; type: string; correctAnswer: unknown; points?: number }>,
  passingScore: number,
): { score: number; percentage: number; passed: boolean } {
  const totalPossible = questions.reduce((s, q) => s + (q.points ?? 100), 0);
  let earned = 0;

  for (const q of questions) {
    const answer = answers[q.id];
    if (answer === null || answer === undefined || answer === '') continue;

    if (isAnswerCorrect(answer, q)) earned += q.points ?? 100;
  }

  const percentage = totalPossible > 0 ? Math.round((earned / totalPossible) * 100) : 0;
  return { score: earned, percentage, passed: percentage >= passingScore };
}

/* ══ Best score for participant ════════════════════════════════ */

export async function getRetainedAttempt(exam: Exam, participantId: string): Promise<Attempt | null> {
  const done = (await getAttemptsForParticipant(exam.id, participantId))
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

/* ══ Utils ══════════════════════════════════════════════════════ */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export { shuffle };
