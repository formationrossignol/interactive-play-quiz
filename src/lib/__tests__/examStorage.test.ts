import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentUser } from '../auth';
import { createExam, getHostExams, startAttempt, type Exam, type Attempt } from '../examStorage';
import { PlanLimitError, AudienceCapError } from '../plans';

vi.mock('../auth', () => ({ getCurrentUser: vi.fn() }));
vi.mock('../quizStorage', () => ({
  getQuizById: () => ({ id: 'quiz-1', questions: [{ id: 'a' }, { id: 'b' }] }),
}));

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) { return this.store.get(k) ?? null; }
  setItem(k: string, v: string) { this.store.set(k, String(v)); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

const USER_ID = 'host-1';

const examPayload = (): Omit<Exam, 'id' | 'hostId' | 'joinCode' | 'createdAt' | 'updatedAt' | 'maxParticipants'> => ({
  title: 'Exam', description: '', quizId: 'quiz-1', openAt: '2026-01-01T00:00:00Z',
  closeAt: '2026-01-02T00:00:00Z', durationMinutes: null, maxAttempts: 3,
  shuffleQuestions: false, shuffleAnswers: false, passingScore: 70,
  showResultsPolicy: 'immediately', showDetailPolicy: 'score-only',
  scoreRetentionPolicy: 'best', status: 'draft',
});

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
  vi.mocked(getCurrentUser).mockReturnValue({
    id: USER_ID, email: 'h@b.com', username: 'H', createdAt: '2026-01-01T00:00:00Z',
  });
});

describe('createExam cap enforcement', () => {
  it('throws PlanLimitError when a starter host already has 5 exams', () => {
    for (let i = 0; i < 5; i++) createExam(examPayload());
    expect(getHostExams(USER_ID)).toHaveLength(5);
    expect(() => createExam(examPayload())).toThrow(PlanLimitError);
  });

  it('stores the starter audience cap (20) on the exam', () => {
    const exam = createExam(examPayload());
    expect(exam.maxParticipants).toBe(20);
  });

  it('stores the pro audience cap (200) on the exam', () => {
    vi.mocked(getCurrentUser).mockReturnValue({
      id: USER_ID, email: 'h@b.com', username: 'H', createdAt: '2026-01-01T00:00:00Z', plan: 'pro',
    });
    const exam = createExam(examPayload());
    expect(exam.maxParticipants).toBe(200);
  });

  it('stores null (unlimited) for an entreprise host', () => {
    vi.mocked(getCurrentUser).mockReturnValue({
      id: USER_ID, email: 'h@b.com', username: 'H', createdAt: '2026-01-01T00:00:00Z', plan: 'entreprise',
    });
    const exam = createExam(examPayload());
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
    const raw = localStorage.getItem('lms_exam_attempts');
    const attempts: Attempt[] = raw ? JSON.parse(raw) : [];
    attempts.push({
      id: `att-${participantId}`, examId, participantId, participantName: participantId,
      participantEmail: `${participantId}@b.com`, startedAt: '2026-01-01T00:00:00Z',
      submittedAt: '2026-01-01T00:10:00Z', timeUsedSeconds: 600, questionOrder: ['a', 'b'],
      answers: {}, score: 1, percentage: 50, passed: false, submissionMode: 'manual',
      status: 'submitted', logs: [],
    });
    localStorage.setItem('lms_exam_attempts', JSON.stringify(attempts));
  };

  it('blocks a brand-new participant once the audience cap is reached', () => {
    const exam = makeExam(2);
    seedSubmittedAttempt(exam.id, 'p1');
    seedSubmittedAttempt(exam.id, 'p2');
    expect(() => startAttempt(exam, 'p3', 'P3', 'p3@b.com')).toThrow(AudienceCapError);
  });

  it('never blocks a participant who already has an attempt (retakes)', () => {
    const exam = makeExam(1);
    seedSubmittedAttempt(exam.id, 'p1');
    expect(() => startAttempt(exam, 'p1', 'P1', 'p1@b.com')).not.toThrow();
  });

  it('never blocks when maxParticipants is null', () => {
    const exam = makeExam(null);
    for (let i = 0; i < 5; i++) seedSubmittedAttempt(exam.id, `p${i}`);
    expect(() => startAttempt(exam, 'p5', 'P5', 'p5@b.com')).not.toThrow();
  });
});
