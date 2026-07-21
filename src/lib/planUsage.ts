import { getUserQuizzes } from './quizStorage';
import { getHostExams } from './examStorage';
import { getUserCourses } from './courseStorage';
import { CONTENT_CAPS, type ContentKind, type Plan } from './plans';

export interface ContentUsage {
  used: number;
  cap: number | null;
}

const QUIZ_STORAGE_KINDS: ContentKind[] = ['quiz', 'poll', 'flashcard', 'slide'];

/** Usage for all 6 content kinds, for the given user under the given plan. */
export async function getContentUsage(userId: string, plan: Plan): Promise<Record<ContentKind, ContentUsage>> {
  const quizzes = getUserQuizzes(userId);
  const caps = CONTENT_CAPS[plan];

  const usage = {} as Record<ContentKind, ContentUsage>;
  for (const kind of QUIZ_STORAGE_KINDS) {
    usage[kind] = { used: quizzes.filter((q) => q.type === kind).length, cap: caps[kind] };
  }
  usage.exam = { used: (await getHostExams(userId)).length, cap: caps.exam };
  usage.course = { used: getUserCourses(userId).length, cap: caps.course };
  return usage;
}
