import { describe, it, expect, vi } from 'vitest';
import { computeDashboardStats } from '../dashboardStats';
import { getUserQuizzes } from '../quizStorage';
import { getUserCourses } from '../courseStorage';
import { getHostExams } from '../examStorage';
import { readSessionHistory } from '../sessionState';
import { getPollResults } from '../pollResults';

vi.mock('../quizStorage', () => ({ getUserQuizzes: vi.fn() }));
vi.mock('../courseStorage', () => ({ getUserCourses: vi.fn() }));
vi.mock('../examStorage', () => ({ getHostExams: vi.fn() }));
vi.mock('../sessionState', () => ({ readSessionHistory: vi.fn() }));
vi.mock('../pollResults', () => ({ getPollResults: vi.fn() }));

describe('computeDashboardStats', () => {
  it('aggregates sessions/participants/score across quiz + poll, counts creations across all kinds', async () => {
    vi.mocked(getUserQuizzes).mockReturnValue([
      { id: 'q1', type: 'quiz' },
      { id: 'p1', type: 'poll' },
      { id: 'f1', type: 'flashcard' },
    ] as ReturnType<typeof getUserQuizzes>);
    vi.mocked(getUserCourses).mockReturnValue([{ id: 'c1' }] as ReturnType<typeof getUserCourses>);
    vi.mocked(getHostExams).mockResolvedValue([{ id: 'e1' }] as Awaited<ReturnType<typeof getHostExams>>);
    vi.mocked(readSessionHistory).mockImplementation((id) =>
      id === 'q1'
        ? [{
            id: 'r1', date: '2026-01-01', questionCount: 5,
            players: [
              { id: 'pl1', name: 'A', avatar: '', score: 100, correctAnswers: 4 },
              { id: 'pl2', name: 'B', avatar: '', score: 80, correctAnswers: 3 },
            ],
          }]
        : [],
    );
    vi.mocked(getPollResults).mockImplementation((id) =>
      id === 'p1'
        ? { pollId: 'p1', pollTitle: 'Poll', sessions: [{ sessionId: 's1', date: '2026-01-01', totalParticipants: 12, questions: [] }] }
        : null,
    );

    const stats = await computeDashboardStats('user-1');

    expect(stats.totalCreations).toBe(5); // q1 + p1 + f1 + c1 + e1
    expect(stats.totalSessions).toBe(2); // 1 quiz run + 1 poll session
    expect(stats.totalParticipants).toBe(14); // 2 quiz players + 12 poll participants
    expect(stats.avgScore).toBe(90); // (100 + 80) / 2
  });

  it('returns avgScore null and zeroed totals for a fresh account', async () => {
    vi.mocked(getUserQuizzes).mockReturnValue([]);
    vi.mocked(getUserCourses).mockReturnValue([]);
    vi.mocked(getHostExams).mockResolvedValue([]);

    const stats = await computeDashboardStats('user-1');

    expect(stats).toEqual({ totalCreations: 0, totalSessions: 0, totalParticipants: 0, avgScore: null });
  });
});
