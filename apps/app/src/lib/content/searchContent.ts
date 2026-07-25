import { supabase } from '@/lib/supabase';
import { CONTENT_TYPES, type ContentType } from './types';

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
    .limit(30);
  if (error) throw error;
  return mapSearchRows((data ?? []) as SearchRow[]);
}
