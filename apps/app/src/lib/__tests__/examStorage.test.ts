import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentUser } from '../auth';
import { createExam, getHostExams, startAttempt, type Exam } from '../examStorage';
import { PlanLimitError, AudienceCapError } from '../plans';

vi.mock('../auth', () => ({ getCurrentUser: vi.fn() }));
vi.mock('../content/contentRepo', () => ({
  getContentBySource: vi.fn(async () => ({
    id: 'content-1',
    data: { questions: [{ id: 'a' }, { id: 'b' }] },
  })),
}));
vi.mock('../supabase', () => ({ supabase: { from: vi.fn() } }));

type Row = Record<string, unknown>;

/**
 * Minimal in-memory fake of the two tables examStorage talks to, wired
 * through the mocked `supabase.from`. Supports just the query shapes
 * examStorage.ts actually issues (select/insert/update + eq/neq +
 * single/maybeSingle + bare await for a filtered array).
 */
function makeBuilder(rows: Row[]) {
  let filtered = rows;
  let insertRow: Row | null = null;
  let updatePatch: Row | null = null;

  const builder: {
    select: () => typeof builder;
    insert: (row: Row) => typeof builder;
    update: (patch: Row) => typeof builder;
    eq: (col: string, val: unknown) => typeof builder;
    neq: (col: string, val: unknown) => typeof builder;
    single: () => Promise<{ data: Row | null; error: { code?: string } | null }>;
    maybeSingle: () => Promise<{ data: Row | null; error: null }>;
    then: (resolve: (r: { data: Row[]; error: null }) => unknown) => unknown;
  } = {
    select: () => builder,
    insert: (row: Row) => { insertRow = { ...row }; return builder; },
    update: (patch: Row) => { updatePatch = patch; return builder; },
    eq: (col: string, val: unknown) => { filtered = filtered.filter((r) => r[col] === val); return builder; },
    neq: (col: string, val: unknown) => { filtered = filtered.filter((r) => r[col] !== val); return builder; },
    single: async () => {
      if (insertRow) {
        if (insertRow.join_code !== undefined && rows.some((r) => r.join_code === insertRow!.join_code)) {
          return { data: null, error: { code: '23505' } };
        }
        rows.push(insertRow);
        return { data: insertRow, error: null };
      }
      if (updatePatch) { for (const r of filtered) Object.assign(r, updatePatch); }
      return { data: filtered[0] ?? null, error: null };
    },
    maybeSingle: async () => {
      if (updatePatch) { for (const r of filtered) Object.assign(r, updatePatch); }
      return { data: filtered[0] ?? null, error: null };
    },
    then: (resolve) => resolve({ data: filtered, error: null }),
  };
  return builder;
}

const USER_ID = 'host-1';

let tables: { exams: Row[]; exam_attempts: Row[] };

const examPayload = (): Omit<Exam, 'id' | 'hostId' | 'joinCode' | 'createdAt' | 'updatedAt' | 'maxParticipants'> => ({
  title: 'Exam', description: '', quizId: 'quiz-1', openAt: '2026-01-01T00:00:00Z',
  closeAt: '2026-01-02T00:00:00Z', durationMinutes: null, maxAttempts: 3,
  shuffleQuestions: false, shuffleAnswers: false, passingScore: 70,
  showResultsPolicy: 'immediately', showDetailPolicy: 'score-only',
  scoreRetentionPolicy: 'best', status: 'draft',
});

beforeEach(async () => {
  tables = { exams: [], exam_attempts: [] };
  const { supabase } = await import('../supabase');
  vi.mocked(supabase.from).mockImplementation(
    (table: string) => makeBuilder(tables[table as 'exams' | 'exam_attempts']) as never,
  );
  vi.mocked(getCurrentUser).mockReturnValue({
    id: USER_ID, email: 'h@b.com', username: 'H', createdAt: '2026-01-01T00:00:00Z',
  });
});

describe('createExam cap enforcement', () => {
  it('throws PlanLimitError when a starter host already has 5 exams', async () => {
    for (let i = 0; i < 5; i++) await createExam(examPayload());
    expect(await getHostExams(USER_ID)).toHaveLength(5);
    await expect(createExam(examPayload())).rejects.toThrow(PlanLimitError);
  });

  it('stores the starter audience cap (20) on the exam', async () => {
    const exam = await createExam(examPayload());
    expect(exam.maxParticipants).toBe(20);
  });

  it('stores the pro audience cap (200) on the exam', async () => {
    vi.mocked(getCurrentUser).mockReturnValue({
      id: USER_ID, email: 'h@b.com', username: 'H', createdAt: '2026-01-01T00:00:00Z', plan: 'pro',
    });
    const exam = await createExam(examPayload());
    expect(exam.maxParticipants).toBe(200);
  });

  it('stores null (unlimited) for an entreprise host', async () => {
    vi.mocked(getCurrentUser).mockReturnValue({
      id: USER_ID, email: 'h@b.com', username: 'H', createdAt: '2026-01-01T00:00:00Z', plan: 'entreprise',
    });
    const exam = await createExam(examPayload());
    expect(exam.maxParticipants).toBeNull();
  });
});

describe('startAttempt audience cap', () => {
  const makeExam = (maxParticipants: number | null): Exam => ({
    id: 'exam-1', hostId: USER_ID, quizId: 'quiz-1', title: 'E', description: '',
    openAt: '2026-01-01T00:00:00Z', closeAt: '2026-01-02T00:00:00Z', durationMinutes: null,
    maxAttempts: 3, shuffleQuestions: false, shuffleAnswers: false, passingScore: 70,
    showResultsPolicy: 'immediately', showDetailPolicy: 'score-only', scoreRetentionPolicy: 'best',
    status: 'open', joinCode: 'ABC123', createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z', maxParticipants,
  });

  const seedSubmittedAttempt = (examId: string, participantId: string) => {
    tables.exam_attempts.push({
      id: `att-${participantId}`, exam_id: examId, participant_id: participantId,
      participant_name: participantId, participant_email: `${participantId}@b.com`,
      started_at: '2026-01-01T00:00:00Z', submitted_at: '2026-01-01T00:10:00Z',
      time_used_seconds: 600, question_order: ['a', 'b'], answers: {}, score: 1, percentage: 50,
      passed: false, submission_mode: 'manual', status: 'submitted', logs: [],
    });
  };

  it('blocks a brand-new participant once the audience cap is reached', async () => {
    const exam = makeExam(2);
    seedSubmittedAttempt(exam.id, 'p1');
    seedSubmittedAttempt(exam.id, 'p2');
    await expect(startAttempt(exam, 'p3', 'P3', 'p3@b.com')).rejects.toThrow(AudienceCapError);
  });

  it('never blocks a participant who already has an attempt (retakes)', async () => {
    const exam = makeExam(1);
    seedSubmittedAttempt(exam.id, 'p1');
    await expect(startAttempt(exam, 'p1', 'P1', 'p1@b.com')).resolves.toBeTruthy();
  });

  it('never blocks when maxParticipants is null', async () => {
    const exam = makeExam(null);
    for (let i = 0; i < 5; i++) seedSubmittedAttempt(exam.id, `p${i}`);
    await expect(startAttempt(exam, 'p5', 'P5', 'p5@b.com')).resolves.toBeTruthy();
  });

  it("never blocks a retake even if the participant's only prior attempt was cancelled", async () => {
    const exam = makeExam(1);
    tables.exam_attempts.push({
      id: 'att-p1-cancelled', exam_id: exam.id, participant_id: 'p1', participant_name: 'p1',
      participant_email: 'p1@b.com', started_at: '2026-01-01T00:00:00Z', submitted_at: null,
      time_used_seconds: 60, question_order: ['a', 'b'], answers: {}, score: null, percentage: null,
      passed: null, submission_mode: null, status: 'cancelled', logs: [],
    });
    await expect(startAttempt(exam, 'p1', 'P1', 'p1@b.com')).resolves.not.toThrow();
  });
});
