import { describe, it, expect, vi } from 'vitest';

// foldersRepo imports the real Supabase client at module load; stub it so the
// pure tree helpers can be tested without VITE_SUPABASE_URL in the env.
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

import { buildTree, getDescendantIds, wouldCreateCycle } from '../foldersRepo';

const flat = [
  { id:'a', parent_id:null, name:'A' },
  { id:'b', parent_id:'a', name:'B' },
  { id:'c', parent_id:'b', name:'C' },
] as unknown as Parameters<typeof buildTree>[0];

describe('folder tree helpers', () => {
  it('builds a nested tree', () => {
    const tree = buildTree(flat);
    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].children[0].id).toBe('c');
  });
  it('getDescendantIds returns all descendants', () => {
    expect(getDescendantIds(flat, 'a').sort()).toEqual(['b','c']);
    expect(getDescendantIds(flat, 'c')).toEqual([]);
  });
  it('detects a cycle (move A under C)', () => {
    expect(wouldCreateCycle(flat, 'a', 'c')).toBe(true);
    expect(wouldCreateCycle(flat, 'a', null)).toBe(false);
    expect(wouldCreateCycle(flat, 'c', 'a')).toBe(false);
  });
});
