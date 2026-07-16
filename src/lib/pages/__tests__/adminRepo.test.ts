import { describe, it, expect, vi } from 'vitest';
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/lib/auth', () => ({ getCurrentUser: () => ({ id: 'u1' }) }));
import { ideaToRoadmapInsert } from '../adminRepo';

describe('ideaToRoadmapInsert', () => {
  it('shapes a draft roadmap row from an idea conversion', () => {
    const row = ideaToRoadmapInsert({ col: 'idea', category: 'builder', title: 'T', subtitle: 'S' });
    expect(row).toEqual({
      col: 'idea', category: 'builder', title: 'T', subtitle: 'S',
      tags: [], beta: false, locked: false, base_votes: 0,
      shipped_label: null, shipped_link: false, status: 'draft', sort: 0,
    });
  });
});
