import type { ContentRow, ContentType } from './types';

export interface ContentDisplay {
  id: string;
  type: ContentType;
  title: string;
  description: string;
  tags: string[];
  category: string;
  isFavorite: boolean;
  isPublic: boolean;
  rating: number;
  deletedAt: string | null;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
  data: Record<string, unknown>;
}

const asString = (v: unknown): string => (typeof v === 'string' ? v : '');
const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : [];

export function toDisplay(row: ContentRow): ContentDisplay {
  const d = row.data ?? {};
  return {
    id: row.id,
    type: row.type,
    title: asString(d.title),
    description: asString(d.description),
    tags: asStringArray(d.tags),
    category: asString(d.category),
    isFavorite: !!d.isFavorite,
    isPublic: row.is_public,
    rating: typeof d.rating === 'number' ? d.rating : 0,
    deletedAt: typeof d.deletedAt === 'string' ? d.deletedAt : null,
    folderId: row.folder_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    data: row.data,
  };
}

export const filterActive = (items: ContentDisplay[]) => items.filter((i) => !i.deletedAt);
export const filterTrashed = (items: ContentDisplay[]) => items.filter((i) => i.deletedAt);
export const filterFavorites = (items: ContentDisplay[]) =>
  items.filter((i) => i.isFavorite && !i.deletedAt);
export const filterByFolder = (items: ContentDisplay[], folderId: string | null) =>
  items.filter((i) => i.folderId === folderId);

export type SortOption = 'newest' | 'oldest' | 'az';

export function applySearchSort(
  items: ContentDisplay[],
  opts: { search?: string; category?: string; sort?: SortOption }
): ContentDisplay[] {
  let result = [...items];

  const search = opts.search?.trim().toLowerCase();
  if (search) {
    result = result.filter((i) => {
      const inTitle = i.title.toLowerCase().includes(search);
      const inDesc = i.description.toLowerCase().includes(search);
      const inTags = i.tags.some((t) => t.toLowerCase().includes(search));
      return inTitle || inDesc || inTags;
    });
  }

  if (opts.category && opts.category !== 'Tous') {
    result = result.filter((i) => i.category === opts.category);
  }

  const sort = opts.sort ?? 'newest';
  result.sort((a, b) => {
    if (sort === 'az') return a.title.localeCompare(b.title, 'fr');
    if (sort === 'oldest') return a.createdAt.localeCompare(b.createdAt);
    return b.createdAt.localeCompare(a.createdAt); // newest
  });

  return result;
}
