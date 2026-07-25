import { describe, it, expect } from 'vitest';

// searchContent.ts imports the real Supabase client at module load (for the
// searchContent() query fn); stub it so the pure helpers can be tested
// without VITE_SUPABASE_URL in the env — same pattern as foldersRepo.test.ts.
import { vi } from 'vitest';
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

import { mapSearchRows, getSearchResultRoute } from '../searchContent';

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
