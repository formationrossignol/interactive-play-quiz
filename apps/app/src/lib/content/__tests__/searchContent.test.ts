import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabase';

// Mock the Supabase client. `from()` returns a chainable builder whose methods
// all return the same builder; the builder is thenable so `await`-ing it at any
// terminal method resolves the configured { data, error } result — same pattern
// as contentRepo.test.ts.
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { mapSearchRows, getSearchResultRoute, searchContent } from '../searchContent';
import { CONTENT_TYPES } from '../types';

type Result = { data: unknown; error: unknown };

function makeBuilder(result: Result) {
  const builder: Record<string, ReturnType<typeof vi.fn>> & {
    then: (resolve: (r: Result) => unknown) => unknown;
  } = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (resolve) => resolve(result),
  } as never;
  return builder;
}

const fromMock = supabase.from as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  fromMock.mockReset();
});

describe('mapSearchRows', () => {
  it('drops trashed rows, keeps the rest shaped for display', () => {
    const rows = [
      { id: 'row-1', type: 'quiz', data: { id: 'item-1', title: 'Capitales du monde' } },
      { id: 'row-2', type: 'poll', data: { id: 'item-2', title: 'Sondage', deletedAt: '2026-01-01' } },
    ];
    expect(mapSearchRows(rows)).toEqual([
      { rowId: 'row-1', itemId: 'item-1', type: 'quiz', title: 'Capitales du monde' },
    ]);
  });

  it('falls back to the Supabase row id when data.id is missing', () => {
    const rows = [{ id: 'row-3', type: 'course', data: { title: 'Cours SVT' } }];
    expect(mapSearchRows(rows)).toEqual([
      { rowId: 'row-3', itemId: 'row-3', type: 'course', title: 'Cours SVT' },
    ]);
  });

  it('caps results at 8', () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      id: `row-${i}`,
      type: 'quiz',
      data: { id: `item-${i}`, title: `Quiz ${i}` },
    }));
    expect(mapSearchRows(rows)).toHaveLength(8);
  });
});

describe('getSearchResultRoute', () => {
  it('maps every content type to its editor route', () => {
    expect(getSearchResultRoute('quiz', 'id1')).toBe('/builder?type=quiz&quizId=id1');
    expect(getSearchResultRoute('poll', 'id1')).toBe('/builder?type=poll&quizId=id1');
    expect(getSearchResultRoute('flashcard', 'id1')).toBe('/builder?type=flashcard&quizId=id1');
    expect(getSearchResultRoute('slide', 'id1')).toBe('/presentation-editor?id=id1');
    expect(getSearchResultRoute('course', 'id1')).toBe('/course-builder?courseId=id1');
    expect(getSearchResultRoute('exam', 'id1')).toBe('/exam-builder?examId=id1');
  });
});

describe('searchContent', () => {
  it('builds the right query and returns mapped results', async () => {
    const rows = [
      { id: 'row-1', type: 'quiz', data: { id: 'item-1', title: 'Capitales du monde' } },
      { id: 'row-2', type: 'poll', data: { id: 'item-2', title: 'Sondage', deletedAt: '2026-01-01' } },
    ];
    const builder = makeBuilder({ data: rows, error: null });
    fromMock.mockReturnValue(builder);

    const result = await searchContent('u1', 'monde');

    expect(fromMock).toHaveBeenCalledWith('content');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(builder.in).toHaveBeenCalledWith('type', CONTENT_TYPES);
    expect(builder.ilike).toHaveBeenCalledWith('data->>title', '%monde%');
    expect(builder.order).toHaveBeenCalledWith('updated_at', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(50);
    expect(result).toEqual(mapSearchRows(rows));
  });

  it('throws when the query returns an error', async () => {
    const err = new Error('boom');
    const builder = makeBuilder({ data: null, error: err });
    fromMock.mockReturnValue(builder);

    await expect(searchContent('u1', 'x')).rejects.toBe(err);
  });

  it('falls back to fuzzy matching when the exact substring search finds nothing', async () => {
    const exactBuilder = makeBuilder({ data: [], error: null });
    const fuzzyRows = [
      { id: 'row-9', type: 'quiz', data: { id: 'item-9', title: 'Quiz de culture générale' } },
      { id: 'row-10', type: 'poll', data: { id: 'item-10', title: 'Sans rapport' } },
    ];
    const fuzzyBuilder = makeBuilder({ data: fuzzyRows, error: null });
    fromMock.mockReturnValueOnce(exactBuilder).mockReturnValueOnce(fuzzyBuilder);

    // "quizz" has no exact substring in either title, but is a 1-edit typo of "quiz".
    const result = await searchContent('u1', 'quizz');

    expect(fromMock).toHaveBeenCalledTimes(2);
    expect(exactBuilder.ilike).toHaveBeenCalledWith('data->>title', '%quizz%');
    expect(fuzzyBuilder.ilike).not.toHaveBeenCalled();
    expect(result).toEqual([
      { rowId: 'row-9', itemId: 'item-9', type: 'quiz', title: 'Quiz de culture générale' },
    ]);
  });

  it('does not fall back when the exact search already found results', async () => {
    const rows = [{ id: 'row-1', type: 'quiz', data: { id: 'item-1', title: 'Capitales du monde' } }];
    const builder = makeBuilder({ data: rows, error: null });
    fromMock.mockReturnValue(builder);

    await searchContent('u1', 'monde');

    expect(fromMock).toHaveBeenCalledTimes(1);
  });
});
