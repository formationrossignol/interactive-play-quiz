import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabase';
import { upsertScormTracking, getScormTrackingForCourse, computeScormStats } from '../scormTracking';

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }));
vi.mock('@/lib/content/contentRepo', () => ({
  getContentBySourceAnyOwner: vi.fn(async () => ({ id: 'content-row-1' })),
}));

type Result = { data: unknown; error: unknown };

function makeBuilder(result: Result) {
  const builder: Record<string, ReturnType<typeof vi.fn>> & {
    then: (resolve: (r: Result) => unknown) => unknown;
  } = {
    select: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    then: (resolve) => resolve(result),
  } as never;
  return builder;
}

const fromMock = supabase.from as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  fromMock.mockReset();
});

describe('upsertScormTracking', () => {
  it('resolves the course content id and upserts keyed by user/course/lesson', async () => {
    const builder = makeBuilder({ data: null, error: null });
    fromMock.mockReturnValue(builder);

    await upsertScormTracking({
      userId: 'user-1',
      localCourseId: 'course-local-1',
      lessonId: 'lesson-1',
      scormVersion: '1.2',
      lessonStatus: 'completed',
      scoreRaw: 90,
      totalTime: '0000:12:30',
      interactions: [],
    });

    expect(fromMock).toHaveBeenCalledWith('scorm_tracking');
    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        course_id: 'content-row-1',
        lesson_id: 'lesson-1',
        scorm_version: '1.2',
        lesson_status: 'completed',
        score_raw: 90,
      }),
      { onConflict: 'user_id,course_id,lesson_id' },
    );
  });
});

describe('computeScormStats', () => {
  it('computes completion rate, average score, average time from tracking rows', async () => {
    const rows = [
      { lesson_status: 'completed', score_raw: 80, total_time: '0000:10:00' },
      { lesson_status: 'incomplete', score_raw: null, total_time: '0000:05:00' },
      { lesson_status: 'passed', score_raw: 100, total_time: '0000:20:00' },
    ];
    const builder = makeBuilder({ data: rows, error: null });
    fromMock.mockReturnValue(builder);

    const stats = await computeScormStats('course-local-1', 'lesson-1');
    expect(stats.totalLearners).toBe(3);
    expect(stats.completedCount).toBe(2); // 'completed' and 'passed' both count as done
    expect(stats.completionRate).toBe(67); // round(2/3 * 100)
    expect(stats.avgScore).toBe(90); // (80 + 100) / 2, only scored rows
    expect(stats.avgTimeMinutes).toBe(11.67); // (10 + 5 + 20) / 3 minutes, rounded to 2dp
  });
});
