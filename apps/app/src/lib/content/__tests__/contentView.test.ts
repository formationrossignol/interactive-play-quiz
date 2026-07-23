import { describe, it, expect } from 'vitest';
import type { ContentRow } from '../types';
import {
  toDisplay,
  filterActive,
  filterTrashed,
  filterFavorites,
  filterByFolder,
  applySearchSort,
  type ContentDisplay,
} from '../contentView';

const row = (over: Partial<ContentRow> & { data?: Record<string, unknown> }): ContentRow => ({
  id: 'id',
  user_id: 'u',
  type: 'quiz',
  folder_id: null,
  data: {},
  is_public: false,
  is_open: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
});

const display = (over: Partial<ContentDisplay>): ContentDisplay => ({
  id: 'id',
  type: 'quiz',
  title: '',
  description: '',
  tags: [],
  category: '',
  isFavorite: false,
  isPublic: false,
  rating: 0,
  deletedAt: null,
  folderId: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  data: {},
  ...over,
});

describe('toDisplay', () => {
  it('mappe un quiz complet depuis data', () => {
    const r = row({
      id: 'q1',
      type: 'quiz',
      folder_id: 'f1',
      is_public: true,
      data: {
        title: 'Mon quiz',
        description: 'desc',
        tags: ['a', 'b'],
        category: 'Histoire',
        isFavorite: true,
        rating: 4,
      },
    });
    const d = toDisplay(r);
    expect(d).toMatchObject({
      id: 'q1',
      type: 'quiz',
      title: 'Mon quiz',
      description: 'desc',
      tags: ['a', 'b'],
      category: 'Histoire',
      isFavorite: true,
      isPublic: true,
      rating: 4,
      deletedAt: null,
      folderId: 'f1',
    });
    expect(d.data).toBe(r.data);
  });

  it('applique les fallbacks défensifs pour un exam (sans tags/category)', () => {
    const r = row({ type: 'exam', data: { title: 'Exam final', description: 'ex' } });
    const d = toDisplay(r);
    expect(d.title).toBe('Exam final');
    expect(d.tags).toEqual([]);
    expect(d.category).toBe('');
    expect(d.isFavorite).toBe(false);
    expect(d.rating).toBe(0);
    expect(d.deletedAt).toBeNull();
  });

  it('title/description vides si absents ou mauvais type', () => {
    const d = toDisplay(row({ data: { title: 42 } }));
    expect(d.title).toBe('');
    expect(d.description).toBe('');
  });

  it('ignore un tags[] contenant des non-strings', () => {
    const d = toDisplay(row({ data: { tags: ['ok', 3] } }));
    expect(d.tags).toEqual([]);
  });

  it('privilégie les colonnes pour isPublic/folderId/timestamps', () => {
    const r = row({
      is_public: true,
      folder_id: 'col',
      created_at: 'C',
      updated_at: 'U',
      data: { isPublic: false, folderId: 'blob' },
    });
    const d = toDisplay(r);
    expect(d.isPublic).toBe(true);
    expect(d.folderId).toBe('col');
    expect(d.createdAt).toBe('C');
    expect(d.updatedAt).toBe('U');
  });

  it('lit deletedAt depuis data', () => {
    const d = toDisplay(row({ data: { deletedAt: '2026-05-05T00:00:00Z' } }));
    expect(d.deletedAt).toBe('2026-05-05T00:00:00Z');
  });
});

describe('filters', () => {
  const items = [
    display({ id: 'a', isFavorite: true }),
    display({ id: 'b', deletedAt: '2026-02-02T00:00:00Z' }),
    display({ id: 'c', isFavorite: true, deletedAt: '2026-02-02T00:00:00Z' }),
    display({ id: 'd', folderId: 'f1' }),
  ];

  it('filterActive exclut les corbeille', () => {
    expect(filterActive(items).map((i) => i.id)).toEqual(['a', 'd']);
  });
  it('filterTrashed ne garde que les corbeille', () => {
    expect(filterTrashed(items).map((i) => i.id)).toEqual(['b', 'c']);
  });
  it('filterFavorites: favoris non supprimés', () => {
    expect(filterFavorites(items).map((i) => i.id)).toEqual(['a']);
  });
  it('filterByFolder par id et par racine (null)', () => {
    expect(filterByFolder(items, 'f1').map((i) => i.id)).toEqual(['d']);
    expect(filterByFolder(items, null).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('applySearchSort', () => {
  const items = [
    display({ id: 'a', title: 'Beta', description: 'sur les volcans', category: 'Sciences', createdAt: '2026-03-01' }),
    display({ id: 'b', title: 'Alpha', tags: ['volcan'], category: 'Histoire', createdAt: '2026-01-01' }),
    display({ id: 'c', title: 'Gamma', category: 'Sciences', createdAt: '2026-02-01' }),
  ];

  it('recherche insensible à la casse sur titre', () => {
    expect(applySearchSort(items, { search: 'alph' }).map((i) => i.id)).toEqual(['b']);
  });
  it('recherche sur description', () => {
    expect(applySearchSort(items, { search: 'VOLCANS' }).map((i) => i.id)).toEqual(['a']);
  });
  it('recherche sur tags', () => {
    expect(applySearchSort(items, { search: 'volcan' }).map((i) => i.id).sort()).toEqual(['a', 'b']);
  });
  it('recherche vide = pas de filtre', () => {
    expect(applySearchSort(items, { search: '' })).toHaveLength(3);
  });
  it('filtre par catégorie, Tous = pas de filtre', () => {
    expect(applySearchSort(items, { category: 'Sciences' }).map((i) => i.id).sort()).toEqual(['a', 'c']);
    expect(applySearchSort(items, { category: 'Tous' })).toHaveLength(3);
  });
  it('tri newest (défaut) = createdAt desc', () => {
    expect(applySearchSort(items, {}).map((i) => i.id)).toEqual(['a', 'c', 'b']);
  });
  it('tri oldest = createdAt asc', () => {
    expect(applySearchSort(items, { sort: 'oldest' }).map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });
  it('tri az = titre localeCompare', () => {
    expect(applySearchSort(items, { sort: 'az' }).map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });
  it('ne mute pas le tableau source', () => {
    const before = items.map((i) => i.id);
    applySearchSort(items, { sort: 'az' });
    expect(items.map((i) => i.id)).toEqual(before);
  });
});
