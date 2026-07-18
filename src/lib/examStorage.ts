import { getCurrentUser } from './auth';
import { getQuizById } from './quizStorage';
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

/* ══ Storage keys ═══════════════════════════════════════════════ */

const EXAMS_KEY   = 'lms_exams';
const ATTEMPTS_KEY = 'lms_exam_attempts';

/* ══ Helpers ════════════════════════════════════════════════════ */

export const genExamId = (): string =>
  crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function genJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function uniqueJoinCode(existing: Exam[]): string {
  const used = new Set(existing.map((e) => e.joinCode));
  let code: string;
  do { code = genJoinCode(); } while (used.has(code));
  return code;
}

/* ══ Exam CRUD ═══════════════════════════════════════════════════ */

const readExams = (): Exam[] => {
  try { return JSON.parse(localStorage.getItem(EXAMS_KEY) ?? '[]') as Exam[]; } catch { return []; }
};

const writeExams = (exams: Exam[]) =>
  localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));

export const getExamById = (id: string): Exam | null =>
  readExams().find((e) => e.id === id) ?? null;

export const getExamByJoinCode = (code: string): Exam | null =>
  readExams().find((e) => e.joinCode === code.toUpperCase()) ?? null;

export const getHostExams = (hostId: string): Exam[] =>
  readExams().filter((e) => e.hostId === hostId && e.status !== 'archived');

export const createExam = (
  data: Omit<Exam, 'id' | 'hostId' | 'joinCode' | 'createdAt' | 'updatedAt' | 'maxParticipants'>,
): Exam => {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const plan = getPlan(user);
  const cap = CONTENT_CAPS[plan].exam;
  if (cap !== null && getHostExams(user.id).length >= cap) throw new PlanLimitError('exam', cap, plan);

  const all = readExams();
  const now = new Date().toISOString();
  const exam: Exam = {
    ...data,
    id: genExamId(),
    hostId: user.id,
    joinCode: uniqueJoinCode(all),
    maxParticipants: AUDIENCE_CAP[plan],
    createdAt: now,
    updatedAt: now,
  };
  all.push(exam);
  writeExams(all);
  return exam;
};

export const updateExam = (id: string, updates: Partial<Exam>): Exam | null => {
  const user = getCurrentUser();
  if (!user) return null;
  const all = readExams();
  const idx = all.findIndex((e) => e.id === id);
  if (idx === -1 || all[idx].hostId !== user.id) return null;
  all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
  writeExams(all);
  return all[idx];
};

export const archiveExam = (id: string): boolean => {
  const result = updateExam(id, { status: 'archived' });
  return result !== null;
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

const readAttempts = (): Attempt[] => {
  try { return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) ?? '[]') as Attempt[]; } catch { return []; }
};

const writeAttempts = (attempts: Attempt[]) =>
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));

export const getAttemptById = (id: string): Attempt | null =>
  readAttempts().find((a) => a.id === id) ?? null;

export const getAttemptsForExam = (examId: string): Attempt[] =>
  readAttempts().filter((a) => a.examId === examId);

export const getAttemptsForParticipant = (examId: string, participantId: string): Attempt[] =>
  readAttempts().filter((a) => a.examId === examId && a.participantId === participantId);

export const getActiveAttempt = (examId: string, participantId: string): Attempt | null =>
  readAttempts().find(
    (a) => a.examId === examId && a.participantId === participantId && a.status === 'in-progress'
  ) ?? null;

export const startAttempt = (
  exam: Exam,
  participantId: string,
  participantName: string,
  participantEmail: string,
): Attempt => {
  const quiz = getQuizById(exam.quizId);
  if (!quiz) throw new Error('Quiz introuvable');

  const existing = getAttemptsForParticipant(exam.id, participantId);
  const completed = existing.filter((a) => a.status !== 'in-progress');
  if (completed.length >= exam.maxAttempts) throw new Error('Nombre maximum de tentatives atteint');

  const active = getActiveAttempt(exam.id, participantId);
  if (active) return active; // resume existing

  if (exam.maxParticipants !== null && existing.length === 0) {
    const distinctParticipants = new Set(getAttemptsForExam(exam.id).map((a) => a.participantId));
    if (distinctParticipants.size >= exam.maxParticipants) throw new AudienceCapError();
  }

  let qIds = quiz.questions.map((q: { id: string }) => q.id);
  if (exam.shuffleQuestions) qIds = shuffle(qIds);

  const now = new Date().toISOString();
  const attempt: Attempt = {
    id: genExamId(),
    examId: exam.id,
    participantId,
    participantName,
    participantEmail,
    startedAt: now,
    submittedAt: null,
    timeUsedSeconds: 0,
    questionOrder: qIds,
    answers: {},
    score: null,
    percentage: null,
    passed: null,
    submissionMode: null,
    status: 'in-progress',
    logs: [{ event: 'started', timestamp: now }],
  };

  const all = readAttempts();
  all.push(attempt);
  writeAttempts(all);
  return attempt;
};

export const saveAnswers = (
  attemptId: string,
  answers: Record<string, number | string | null>,
  timeUsedSeconds: number,
): boolean => {
  const all = readAttempts();
  const idx = all.findIndex((a) => a.id === attemptId);
  if (idx === -1 || all[idx].status !== 'in-progress') return false;
  const now = new Date().toISOString();
  all[idx] = {
    ...all[idx],
    answers,
    timeUsedSeconds,
    logs: [...all[idx].logs, { event: 'saved', timestamp: now }],
  };
  writeAttempts(all);
  return true;
};

export const submitAttempt = (
  attemptId: string,
  answers: Record<string, number | string | null>,
  timeUsedSeconds: number,
  mode: SubmissionMode = 'manual',
): Attempt | null => {
  const all = readAttempts();
  const idx = all.findIndex((a) => a.id === attemptId);
  if (idx === -1) return null;
  if (all[idx].status !== 'in-progress') return all[idx]; // already submitted

  const exam = getExamById(all[idx].examId);
  const quiz = exam ? getQuizById(exam.quizId) : null;
  const { score, percentage, passed } = quiz && exam
    ? calculateScore(answers, quiz.questions, exam.passingScore)
    : { score: null, percentage: null, passed: null };

  const now = new Date().toISOString();
  all[idx] = {
    ...all[idx],
    answers,
    timeUsedSeconds,
    submittedAt: now,
    score,
    percentage,
    passed,
    submissionMode: mode,
    status: mode === 'manual' ? 'submitted' : 'auto-submitted',
    logs: [...all[idx].logs, { event: mode === 'manual' ? 'submitted' : 'auto-submitted', timestamp: now }],
  };
  writeAttempts(all);
  return all[idx];
};

export const cancelAttempt = (attemptId: string): boolean => {
  const all = readAttempts();
  const idx = all.findIndex((a) => a.id === attemptId);
  if (idx === -1) return false;
  const now = new Date().toISOString();
  all[idx] = {
    ...all[idx],
    status: 'cancelled',
    logs: [...all[idx].logs, { event: 'cancelled', timestamp: now }],
  };
  writeAttempts(all);
  return true;
};

/* ══ Score calculation ═══════════════════════════════════════════ */

export function calculateScore(
  answers: Record<string, number | string | null>,
  questions: Array<{ id: string; type: string; correctAnswer: unknown; points?: number }>,
  passingScore: number,
): { score: number; percentage: number; passed: boolean } {
  const totalPossible = questions.reduce((s, q) => s + (q.points ?? 100), 0);
  let earned = 0;

  for (const q of questions) {
    const answer = answers[q.id];
    if (answer === null || answer === undefined || answer === '') continue;

    let correct = false;
    if (q.type === 'true-false') {
      correct = String(answer).toLowerCase() === String(q.correctAnswer).toLowerCase();
    } else if (q.type === 'short-answer') {
      correct = String(answer).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
    } else {
      correct = answer === q.correctAnswer;
    }

    if (correct) earned += q.points ?? 100;
  }

  const percentage = totalPossible > 0 ? Math.round((earned / totalPossible) * 100) : 0;
  return { score: earned, percentage, passed: percentage >= passingScore };
}

/* ══ Best score for participant ════════════════════════════════ */

export function getRetainedAttempt(exam: Exam, participantId: string): Attempt | null {
  const done = getAttemptsForParticipant(exam.id, participantId)
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

export function computeExamStats(examId: string): ExamStats {
  const attempts = getAttemptsForExam(examId);
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

/* ══ CSV export ════════════════════════════════════════════════ */

export function exportCSV(exam: Exam): void {
  const attempts = getAttemptsForExam(exam.id)
    .filter((a) => a.status !== 'in-progress' && a.status !== 'cancelled');

  const headers = ['Participant', 'Email', 'Début', 'Soumission', 'Temps (min)', 'Score (%)', 'Statut', 'Mode'];
  const rows = attempts.map((a) => [
    a.participantName,
    a.participantEmail || '',
    new Date(a.startedAt).toLocaleString('fr'),
    a.submittedAt ? new Date(a.submittedAt).toLocaleString('fr') : '',
    Math.round(a.timeUsedSeconds / 60),
    a.percentage ?? '',
    a.passed === true ? 'Réussi' : a.passed === false ? 'Échoué' : '',
    a.submissionMode === 'manual' ? 'Manuel' : a.submissionMode === 'auto' ? 'Automatique' : '',
  ]);

  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const bom = '﻿'; // UTF-8 BOM for Excel
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `resultats_${exam.title.replace(/\s+/g, '_')}_${exam.joinCode}.csv`;
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
