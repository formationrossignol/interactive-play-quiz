import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentUser } from '../auth';
import { createExam, startAttempt, type Exam } from '../examStorage';
import { PlanLimitError, AudienceCapError } from '../plans';
import { DEFAULT_PROCTORING_CONFIG } from '../proctoring';

vi.mock('../auth', () => ({ getCurrentUser: vi.fn() }));
vi.mock('../supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }));

/**
 * Tier 2 (docs/exam-scoring-hardening-tier2.md) moved exam creation and
 * attempt-start off direct table writes and onto the save-exam /
 * start-exam-attempt Edge Functions — these now just verify the client
 * wrapper correctly maps each function's response into the same typed
 * return values / errors callers already depend on (PlanLimitError,
 * AudienceCapError). The actual cap-enforcement arithmetic lives
 * server-side now (save-exam's plan check, start_exam_attempt_atomic's SQL)
 * and isn't re-tested here.
 */

const examPayload = (): Omit<Exam, 'id' | 'hostId' | 'joinCode' | 'createdAt' | 'updatedAt' | 'maxParticipants' | 'questionsPublic'> => ({
  title: 'Exam', description: '', quizId: 'quiz-1', openAt: '2026-01-01T00:00:00Z',
  closeAt: '2026-01-02T00:00:00Z', durationMinutes: null, maxAttempts: 3,
  shuffleQuestions: false, shuffleAnswers: false, passingScore: 70,
  showResultsPolicy: 'immediately', showDetailPolicy: 'score-only',
  scoreRetentionPolicy: 'best', status: 'draft',
  proctoring: DEFAULT_PROCTORING_CONFIG,
});

const makeExam = (maxParticipants: number | null): Exam => ({
  id: 'exam-1', hostId: 'host-1', quizId: 'quiz-1', title: 'E', description: '',
  openAt: '2026-01-01T00:00:00Z', closeAt: '2026-01-02T00:00:00Z', durationMinutes: null,
  maxAttempts: 3, shuffleQuestions: false, shuffleAnswers: false, passingScore: 70,
  showResultsPolicy: 'immediately', showDetailPolicy: 'score-only', scoreRetentionPolicy: 'best',
  status: 'open', joinCode: 'ABC123', createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z', maxParticipants, questionsPublic: [],
  proctoring: DEFAULT_PROCTORING_CONFIG,
});

function httpError(status: number, body: Record<string, unknown>) {
  const context = new Response(JSON.stringify(body), { status });
  return Object.assign(new Error('Edge Function returned a non-2xx status code'), { context });
}

beforeEach(async () => {
  const { supabase } = await import('../supabase');
  vi.mocked(supabase.functions.invoke).mockReset();
  vi.mocked(getCurrentUser).mockReturnValue({
    id: 'host-1', email: 'h@b.com', username: 'H', createdAt: '2026-01-01T00:00:00Z',
  });
});

describe('createExam', () => {
  it('throws PlanLimitError when save-exam reports the plan cap exceeded', async () => {
    const { supabase } = await import('../supabase');
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null, error: httpError(409, { error: 'plan_limit', cap: 5, plan: 'starter' }),
    } as never);
    await expect(createExam(examPayload())).rejects.toThrow(PlanLimitError);
  });

  it('returns the created exam on success', async () => {
    const { supabase } = await import('../supabase');
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { exam: { ...rowFromPayload(), max_participants: 20 } }, error: null,
    } as never);
    const exam = await createExam(examPayload());
    expect(exam.maxParticipants).toBe(20);
  });
});

describe('startAttempt', () => {
  it('throws AudienceCapError when the function reports the audience cap reached', async () => {
    const { supabase } = await import('../supabase');
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { outcome: 'full' }, error: null,
    } as never);
    await expect(startAttempt(makeExam(2), 'p3', 'P3', 'p3@b.com')).rejects.toThrow(AudienceCapError);
  });

  it('throws a generic error when attempts are exhausted', async () => {
    const { supabase } = await import('../supabase');
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { outcome: 'exhausted' }, error: null,
    } as never);
    await expect(startAttempt(makeExam(1), 'p1', 'P1', 'p1@b.com')).rejects.toThrow();
  });

  it('returns the attempt when the function reports it started', async () => {
    const { supabase } = await import('../supabase');
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        outcome: 'started',
        attempt: {
          id: 'att-1', exam_id: 'exam-1', participant_id: 'p1', participant_name: 'P1',
          participant_email: 'p1@b.com', started_at: '2026-01-01T00:00:00Z', submitted_at: null,
          time_used_seconds: 0, question_order: ['a', 'b'], answers: {}, score: null,
          percentage: null, passed: null, submission_mode: null, status: 'in-progress', logs: [],
        },
      },
      error: null,
    } as never);
    const attempt = await startAttempt(makeExam(null), 'p1', 'P1', 'p1@b.com');
    expect(attempt.id).toBe('att-1');
    expect(attempt.status).toBe('in-progress');
  });

  it('resumes and returns an existing in-progress attempt', async () => {
    const { supabase } = await import('../supabase');
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        outcome: 'resumed',
        attempt: {
          id: 'att-1', exam_id: 'exam-1', participant_id: 'p1', participant_name: 'P1',
          participant_email: 'p1@b.com', started_at: '2026-01-01T00:00:00Z', submitted_at: null,
          time_used_seconds: 60, question_order: ['a', 'b'], answers: {}, score: null,
          percentage: null, passed: null, submission_mode: null, status: 'in-progress', logs: [],
        },
      },
      error: null,
    } as never);
    await expect(startAttempt(makeExam(1), 'p1', 'P1', 'p1@b.com')).resolves.toBeTruthy();
  });
});

function rowFromPayload() {
  const p = examPayload();
  return {
    id: 'exam-new', host_id: 'host-1', quiz_id: p.quizId, title: p.title, description: p.description,
    header_image: null, open_at: p.openAt, close_at: p.closeAt, duration_minutes: p.durationMinutes,
    max_attempts: p.maxAttempts, shuffle_questions: p.shuffleQuestions, shuffle_answers: p.shuffleAnswers,
    passing_score: p.passingScore, show_results_policy: p.showResultsPolicy,
    show_detail_policy: p.showDetailPolicy, score_retention_policy: p.scoreRetentionPolicy,
    status: p.status, join_code: 'ABCDEF', questions_public: [],
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  };
}
