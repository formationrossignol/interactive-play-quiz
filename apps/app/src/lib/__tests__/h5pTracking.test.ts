import { describe, expect, it, vi } from 'vitest';
import {
  applyXapiStatement,
  formatH5pDuration,
  type H5pTrackingRecord,
} from '../h5pTracking';

vi.mock('../supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
          }),
        }),
      }),
      upsert: async () => ({ error: null }),
    }),
  },
}));

const baseRecord = (): H5pTrackingRecord => ({
  userId: 'user-1',
  courseId: 'course-1',
  lessonId: 'lesson-1',
  packageId: 'package-1',
  status: 'in_progress',
  scoreRaw: null,
  scoreMax: null,
  scoreScaled: null,
  progress: 10,
  durationSeconds: 5,
  state: null,
  lastStatement: null,
  startedAt: '2026-07-29T08:00:00.000Z',
  completedAt: null,
  lastAccessedAt: '2026-07-29T08:00:00.000Z',
});

describe('applyXapiStatement', () => {
  it('extracts a passing score, completion and duration', () => {
    const statement = {
      verb: { id: 'http://adlnet.gov/expapi/verbs/passed' },
      result: {
        score: { raw: 8, max: 10, scaled: 0.8 },
        success: true,
        completion: true,
        duration: 'PT2M5S',
      },
    };

    const result = applyXapiStatement(baseRecord(), statement);

    expect(result.status).toBe('passed');
    expect(result.scoreRaw).toBe(8);
    expect(result.scoreMax).toBe(10);
    expect(result.scoreScaled).toBe(0.8);
    expect(result.progress).toBe(100);
    expect(result.durationSeconds).toBe(125);
    expect(result.completedAt).not.toBeNull();
  });

  it('distinguishes failure from a zero score and preserves the result', () => {
    const result = applyXapiStatement(baseRecord(), {
      verb: { id: 'http://adlnet.gov/expapi/verbs/failed' },
      result: { score: { raw: 0, max: 20 }, success: false, completion: true },
    });

    expect(result.status).toBe('failed');
    expect(result.scoreRaw).toBe(0);
    expect(result.scoreMax).toBe(20);
    expect(result.progress).toBe(100);
  });

  it('reads percentage progress from an xAPI extension', () => {
    const result = applyXapiStatement(baseRecord(), {
      verb: { id: 'http://adlnet.gov/expapi/verbs/progressed' },
      result: {
        extensions: {
          'http://id.tincanapi.com/extension/progress': 0.42,
        },
      },
    });

    expect(result.status).toBe('in_progress');
    expect(result.progress).toBe(42);
  });

  it('does not complete the whole activity for a simple answered event', () => {
    const result = applyXapiStatement(baseRecord(), {
      verb: { id: 'http://adlnet.gov/expapi/verbs/answered' },
      result: { score: { raw: 1, max: 1 } },
    });

    expect(result.status).toBe('in_progress');
    expect(result.progress).toBe(10);
  });
});

describe('formatH5pDuration', () => {
  it('formats seconds and hours for the learner UI', () => {
    expect(formatH5pDuration(45)).toBe('45 s');
    expect(formatH5pDuration(125)).toBe('2 min 05 s');
    expect(formatH5pDuration(3_725)).toBe('1 h 02 min');
  });
});
