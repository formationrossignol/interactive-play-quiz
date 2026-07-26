import { supabase } from '@/lib/supabase';
import { CONTENT_TYPES, type ContentType } from './types';
import { fuzzyScore } from './fuzzyMatch';

export interface SearchResult {
  rowId: string;
  itemId: string;
  type: ContentType;
  title: string;
}

interface SearchRow {
  id: string;
  type: string;
  data: Record<string, unknown> | null;
}

/** Drop trashed rows, cap at 8, shape rows for display. Pure — no I/O. */
export function mapSearchRows(rows: SearchRow[]): SearchResult[] {
  return rows
    .filter((row) => !row.data?.deletedAt)
    .slice(0, 8)
    .map((row) => ({
      rowId: row.id,
      itemId: String((row.data?.id as string | undefined) ?? row.id),
      type: row.type as ContentType,
      title: String(row.data?.title ?? ''),
    }));
}

/** Each content type's existing editor route (mirrors MyQuizzes/MyPolls/MyFlashcards/
 *  MySlides' `editRoute` configs and MyCourses/MyExams' inline navigate() targets). */
export function getSearchResultRoute(type: ContentType, id: string): string {
  switch (type) {
    case 'quiz':
      return `/builder?type=quiz&quizId=${id}`;
    case 'poll':
      return `/builder?type=poll&quizId=${id}`;
    case 'flashcard':
      return `/builder?type=flashcard&quizId=${id}`;
    case 'slide':
      return `/presentation-editor?id=${id}`;
    case 'course':
      return `/course-builder?courseId=${id}`;
    case 'exam':
      return `/exam-builder?examId=${id}`;
  }
}

/** Search the current user's content across all types by title (case-insensitive substring). */
export async function searchContent(userId: string, query: string): Promise<SearchResult[]> {
  const { data, error } = await supabase
    .from('content')
    .select('id,type,data')
    .eq('user_id', userId)
    .in('type', CONTENT_TYPES as unknown as string[])
    .ilike('data->>title', `%${query}%`)
    .order('updated_at', { ascending: false })
    // Buffer above the 8-result display cap: mapSearchRows() drops trashed rows client-side
    // (deletedAt lives in JSONB, not a real column), so a wider fetch avoids trash crowding
    // out live matches.
    .limit(50);
  if (error) throw error;
  const exact = mapSearchRows((data ?? []) as SearchRow[]);
  if (exact.length > 0) return exact;
  return fuzzySearchContent(userId, query);
}

/** REQ-SRC-005 fallback — only runs when the exact substring search finds
 *  nothing, so the common case pays no extra cost. Fetches a bounded set of
 *  the user's most-recent content (no server-side text filter, since a typo
 *  wouldn't survive one) and ranks it client-side by edit distance. */
async function fuzzySearchContent(userId: string, query: string): Promise<SearchResult[]> {
  const { data, error } = await supabase
    .from('content')
    .select('id,type,data')
    .eq('user_id', userId)
    .in('type', CONTENT_TYPES as unknown as string[])
    .order('updated_at', { ascending: false })
    .limit(150);
  if (error) throw error;

  return ((data ?? []) as SearchRow[])
    .filter((row) => !row.data?.deletedAt)
    .map((row) => ({ row, score: fuzzyScore(query, String(row.data?.title ?? '')) }))
    .filter((r): r is { row: SearchRow; score: number } => r.score !== null)
    .sort((a, b) => a.score - b.score)
    .slice(0, 8)
    .map(({ row }) => ({
      rowId: row.id,
      itemId: String((row.data?.id as string | undefined) ?? row.id),
      type: row.type as ContentType,
      title: String(row.data?.title ?? ''),
    }));
}
