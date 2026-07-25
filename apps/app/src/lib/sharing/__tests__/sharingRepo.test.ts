import { describe, it, expect, vi } from 'vitest';

// sharingRepo.ts imports the real Supabase client at module load; stub it so
// the pure helper can be tested without VITE_SUPABASE_URL in the env — same
// pattern as foldersRepo.test.ts / searchContent.test.ts.
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

import { mergeSharedContentIds } from '../sharingRepo';

describe('mergeSharedContentIds', () => {
  it('dedupes content ids across multiple lists', () => {
    const result = mergeSharedContentIds(
      [{ content_id: 'a' }, { content_id: 'b' }],
      [{ content_id: 'b' }, { content_id: 'c' }],
    );
    expect(result.sort()).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty array when given no shares', () => {
    expect(mergeSharedContentIds([], [])).toEqual([]);
  });

  it('dedupes duplicates within a single list', () => {
    expect(mergeSharedContentIds([{ content_id: 'a' }, { content_id: 'a' }])).toEqual(['a']);
  });

  it('works with a single list argument', () => {
    expect(mergeSharedContentIds([{ content_id: 'x' }, { content_id: 'y' }]).sort()).toEqual(['x', 'y']);
  });
});
