import { describe, it, expect } from 'vitest';
import { groupRoadmap, groupChangelog, mapGuide, groupFaq, mapReview, mergeRoadmapVotes, mapReport } from '../mappers';
import type { RoadmapRow, ReleaseRow, ChangelogItemRow, GuideRow, FaqRow, ReviewRow, ReportRow, RoadmapView } from '../types';

describe('groupRoadmap', () => {
  const rows: RoadmapRow[] = [
    { id: '1', col: 'idea', category: 'builder', title: 'A', subtitle: 'sa', tags: [{ label: 'Builder' }], beta: false, locked: false, base_votes: 64, shipped_label: null, shipped_link: false, sort: 10 },
    { id: '2', col: 'dev', category: 'live', title: 'B', subtitle: 'sb', tags: [], beta: true, locked: true, base_votes: 143, shipped_label: null, shipped_link: false, sort: 80 },
    { id: '3', col: 'shipped', category: 'builder', title: 'C', subtitle: 'sc', tags: [], beta: false, locked: false, base_votes: 126, shipped_label: 'Livré en juin', shipped_link: true, sort: 100 },
  ];
  it('splits rows into kanban columns', () => {
    const v = groupRoadmap(rows);
    expect(v.idea).toHaveLength(1);
    expect(v.dev).toHaveLength(1);
    expect(v.shipped).toHaveLength(1);
    expect(v.planned).toHaveLength(0);
  });
  it('maps a card with votes from base_votes and cat from category', () => {
    const card = groupRoadmap(rows).idea[0];
    expect(card).toEqual({ id: '1', votes: 64, title: 'A', sub: 'sa', tags: [{ label: 'Builder' }], cat: 'builder', locked: false, beta: false, voted: false });
  });
  it('maps a shipped card with link flag', () => {
    const s = groupRoadmap(rows).shipped[0];
    expect(s).toEqual({ id: '3', votes: 126, title: 'C', sub: 'Livré en juin', cat: 'builder', link: true });
  });
});

describe('groupChangelog', () => {
  const releases: ReleaseRow[] = [
    { id: 'r1', version: 'v2.15', title: 'T15', date_label: '10 juillet 2026', intro: 'intro', media: '🏆', sort: 10 },
    { id: 'r2', version: 'v2.14', title: 'T14', date_label: '24 juin 2026', intro: null, media: null, sort: 20 },
  ];
  const items: ChangelogItemRow[] = [
    { id: 'i1', release_id: 'r1', kind: 'new', text: 'feat', from_votes: true, sort: 10 },
    { id: 'i2', release_id: 'r1', kind: 'fix', text: 'bug', from_votes: false, sort: 20 },
    { id: 'i3', release_id: 'r2', kind: 'imp', text: 'imp', from_votes: false, sort: 10 },
  ];
  it('nests items under their release, preserving order', () => {
    const out = groupChangelog(releases, items);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      v: 'v2.15', title: 'T15', date: '10 juillet 2026', intro: 'intro', media: '🏆',
      items: [
        { t: 'new', text: 'feat', fromVotes: true },
        { t: 'fix', text: 'bug', fromVotes: false },
      ],
    });
    expect(out[1].intro).toBeUndefined();
    expect(out[1].media).toBeUndefined();
    expect(out[1].items).toHaveLength(1);
  });
});

describe('mapGuide', () => {
  it('renames columns to the page shape', () => {
    const row: GuideRow = { id: 'g1', emoji: '🎬', cover_token: '--ap-quiz-soft', duration_label: '▶ 4:32', title: 'Créer', level: 'deb', format: 'video', url: null, body: null, sort: 10 };
    expect(mapGuide(row)).toEqual({ id: 'g1', emoji: '🎬', cover: '--ap-quiz-soft', dur: '▶ 4:32', title: 'Créer', lvl: 'deb', fmt: 'video', url: null });
  });
});

describe('groupFaq', () => {
  it('groups questions by category, preserving first-seen order', () => {
    const rows: FaqRow[] = [
      { id: 'f1', category: 'Démarrage', question: 'q1', answer: 'a1', sort: 10 },
      { id: 'f2', category: 'Démarrage', question: 'q2', answer: 'a2', sort: 20 },
      { id: 'f3', category: 'Données', question: 'q3', answer: 'a3', sort: 30 },
    ];
    expect(groupFaq(rows)).toEqual([
      { category: 'Démarrage', questions: [{ q: 'q1', a: 'a1' }, { q: 'q2', a: 'a2' }] },
      { category: 'Données', questions: [{ q: 'q3', a: 'a3' }] },
    ]);
  });
});

describe('mapReview', () => {
  it('renames columns to the page shape', () => {
    const row: ReviewRow = { id: 'v1', persona: 'formateur', stars: 5, text: 'great', author_name: 'Karim T.', author_role: 'Formateur', avatar_emoji: '🧔', sort: 10 };
    expect(mapReview(row)).toEqual({ id: 'v1', p: 'formateur', stars: 5, text: 'great', av: '🧔', name: 'Karim T.', role: 'Formateur' });
  });
});

describe('groupRoadmap voted default', () => {
  it('sets voted=false on freshly mapped cards', () => {
    const rows = [
      { id: '1', col: 'idea', category: 'builder', title: 'A', subtitle: 's', tags: [], beta: false, locked: false, base_votes: 5, shipped_label: null, shipped_link: false, sort: 10 },
    ] as Parameters<typeof groupRoadmap>[0];
    expect(groupRoadmap(rows).idea[0].voted).toBe(false);
  });
});

describe('mergeRoadmapVotes', () => {
  const baseView: RoadmapView = {
    idea: [{ id: 'a', votes: 10, title: 'A', sub: 's', tags: [], cat: 'builder', locked: false, beta: false, voted: false }],
    planned: [],
    dev: [{ id: 'b', votes: 20, title: 'B', sub: 's', tags: [], cat: 'live', locked: true, beta: true, voted: false }],
    shipped: [{ id: 'c', votes: 30, title: 'C', sub: 's', cat: 'builder', link: false }],
  };
  it('adds live counts to base votes and flags my votes', () => {
    const counts = new Map<string, number>([['a', 3], ['b', 7]]);
    const myVotes = new Set<string>(['a']);
    const { view, remaining } = mergeRoadmapVotes(baseView, counts, myVotes);
    expect(view.idea[0].votes).toBe(13);
    expect(view.idea[0].voted).toBe(true);
    expect(view.dev[0].votes).toBe(27);
    expect(view.dev[0].voted).toBe(false);
    expect(remaining).toBe(2);
  });
  it('leaves shipped cards untouched and remaining=3 with no votes', () => {
    const { view, remaining } = mergeRoadmapVotes(baseView, new Map(), new Set());
    expect(view.shipped[0].votes).toBe(30);
    expect(view.idea[0].votes).toBe(10);
    expect(remaining).toBe(3);
  });
});

describe('mapReport', () => {
  it('maps a row to the Mes-tickets shape', () => {
    const row: ReportRow = { id: 'abcd1234-0000-0000-0000-000000000000', type: 'bug', severity: 1, title: 'Boom', body: '', status: 'in_progress', created_at: '2026-07-14T10:00:00Z' };
    const r = mapReport(row);
    expect(r.shortId).toBe('#abcd');
    expect(r.title).toBe('Boom');
    expect(r.statusClass).toBe('tst--prog');
    expect(r.statusLabel).toBe('En cours');
    expect(r.meta.startsWith('Bug · ')).toBe(true);
  });
});
