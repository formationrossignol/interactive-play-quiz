import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '../supabase';
import { fetchLatestChangelog } from '../changelog';

vi.mock('../supabase', () => ({ supabase: { from: vi.fn() } }));

/** Minimal fake of the .select().order().limit() chain fetchLatestChangelog issues. */
function makeBuilder(rows: Record<string, unknown>[]) {
  const calls: { order?: [string, { ascending: boolean }]; limit?: number } = {};
  const builder = {
    select: () => builder,
    order: (col: string, opts: { ascending: boolean }) => { calls.order = [col, opts]; return builder; },
    limit: (n: number) => { calls.limit = n; return Promise.resolve({ data: rows, error: null }); },
  };
  return { builder, calls };
}

beforeEach(() => {
  vi.mocked(supabase.from).mockReset();
});

describe('fetchLatestChangelog', () => {
  it('orders by sort ascending — lower sort is the newer release', async () => {
    const { builder, calls } = makeBuilder([
      { id: 'r1', version: 'v2.15', title: 'Newest', date_label: '10 juillet 2026', intro: null, sort: 10 },
      { id: 'r2', version: 'v2.12', title: 'Oldest', date_label: '12 mai 2026', intro: null, sort: 40 },
    ]);
    vi.mocked(supabase.from).mockReturnValue(builder as never);

    const releases = await fetchLatestChangelog(5);

    expect(calls.order).toEqual(['sort', { ascending: true }]);
    expect(calls.limit).toBe(5);
    expect(releases[0].id).toBe('r1');
    expect(releases[1].id).toBe('r2');
  });

  it('degrades to [] when the query errors', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: null, error: new Error('boom') }) }) }),
    } as never);

    expect(await fetchLatestChangelog()).toEqual([]);
  });
});
