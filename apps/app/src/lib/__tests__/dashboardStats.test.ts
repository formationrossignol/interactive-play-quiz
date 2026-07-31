import { describe, it, expect, vi } from 'vitest';
import { computeDashboardStats } from '../dashboardStats';
import { getUserQuizzes } from '../quizStorage';
import { readSessionHistory } from '../sessionState';
import { getPollResults } from '../pollResults';
import { listContent } from '../content/contentRepo';
import type { ContentRow, ContentType } from '../content/types';

vi.mock('../quizStorage', () => ({ getUserQuizzes: vi.fn() }));
vi.mock('../sessionState', () => ({ readSessionHistory: vi.fn() }));
vi.mock('../pollResults', () => ({ getPollResults: vi.fn() }));
vi.mock('../content/contentRepo', () => ({ listContent: vi.fn() }));

/** Builds a minimal content-table row — totalCreations/creations-trend now
 *  read from here (the same table ContentExplorer/MyQuizzes read from)
 *  instead of the legacy per-kind localStorage stores. */
const row = (type: ContentType, id: string, createdAt: string): ContentRow => ({
  id,
  user_id: 'user-1',
  type,
  folder_id: null,
  data: { title: id },
  is_public: false,
  is_open: false,
  source_id: null,
  created_at: createdAt,
  updated_at: createdAt,
});

/** Wires listContent(userId, type) to return rows keyed by type; any type
 *  not listed resolves to []. */
const mockContent = (byType: Partial<Record<ContentType, ContentRow[]>>) => {
  vi.mocked(listContent).mockImplementation(async (_userId, type) => byType[type] ?? []);
};

describe('computeDashboardStats', () => {
  it('aggregates sessions/participants/score across quiz + poll, counts creations across all kinds', async () => {
    vi.mocked(getUserQuizzes).mockReturnValue([
      { id: 'q1', type: 'quiz' },
      { id: 'p1', type: 'poll' },
    ] as ReturnType<typeof getUserQuizzes>);
    mockContent({
      quiz: [row('quiz', 'q1', '2026-01-01')],
      poll: [row('poll', 'p1', '2026-01-01')],
      flashcard: [row('flashcard', 'f1', '2026-01-01')],
      course: [row('course', 'c1', '2026-01-01')],
      exam: [row('exam', 'e1', '2026-01-01')],
    });
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
    mockContent({});

    const stats = await computeDashboardStats('user-1');

    expect(stats).toEqual({
      totalCreations: 0, totalSessions: 0, totalParticipants: 0, avgScore: null,
      trends: {
        creations: { current: 0, previous: 0, deltaPct: null },
        sessions: { current: 0, previous: 0, deltaPct: null },
        participants: { current: 0, previous: 0, deltaPct: null },
        avgScore: { current: null, previous: null },
      },
    });
  });

  it('buckets sessions/participants/creations into trailing-14-day vs previous-14-day windows', async () => {
    const dayMs = 24 * 60 * 60 * 1000;
    const daysAgo = (n: number) => new Date(Date.now() - n * dayMs).toISOString();

    vi.mocked(getUserQuizzes).mockReturnValue([
      { id: 'q1', type: 'quiz' },
    ] as ReturnType<typeof getUserQuizzes>);
    mockContent({
      quiz: [row('quiz', 'q1', daysAgo(3))],
    });
    vi.mocked(readSessionHistory).mockReturnValue([
      { id: 'r-current', date: daysAgo(2), questionCount: 1, players: [{ id: 'p1', name: 'A', avatar: '', score: 100, correctAnswers: 1 }] },
      { id: 'r-current-2', date: daysAgo(10), questionCount: 1, players: [{ id: 'p2', name: 'B', avatar: '', score: 50, correctAnswers: 0 }] },
      { id: 'r-previous', date: daysAgo(20), questionCount: 1, players: [{ id: 'p3', name: 'C', avatar: '', score: 0, correctAnswers: 0 }] },
      { id: 'r-outside', date: daysAgo(40), questionCount: 1, players: [{ id: 'p4', name: 'D', avatar: '', score: 0, correctAnswers: 0 }] },
    ]);
    vi.mocked(getPollResults).mockReturnValue(null);

    const stats = await computeDashboardStats('user-1');

    expect(stats.trends.sessions).toEqual({ current: 2, previous: 1, deltaPct: 100 });
    expect(stats.trends.participants).toEqual({ current: 2, previous: 1, deltaPct: 100 });
    expect(stats.trends.creations).toEqual({ current: 1, previous: 0, deltaPct: null });
    expect(stats.trends.avgScore).toEqual({ current: 75, previous: 0 });
  });

  it('excludes trashed content from totalCreations, matching the content browser', async () => {
    vi.mocked(getUserQuizzes).mockReturnValue([]);
    mockContent({
      quiz: [
        row('quiz', 'q1', '2026-01-01'),
        { ...row('quiz', 'q2', '2026-01-01'), data: { title: 'q2', deletedAt: '2026-01-02T00:00:00.000Z' } },
      ],
    });

    const stats = await computeDashboardStats('user-1');

    expect(stats.totalCreations).toBe(1);
  });
});
