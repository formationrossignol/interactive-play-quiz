import { getUserQuizzes } from "./quizStorage";
import { getUserCourses } from "./courseStorage";
import { getHostExams } from "./examStorage";
import { readSessionHistory } from "./sessionState";
import { getPollResults } from "./pollResults";

export interface DashboardStats {
  totalCreations: number;
  totalSessions: number;
  totalParticipants: number;
  /** null when no quiz session has ever run — polls have no per-player score. */
  avgScore: number | null;
}

/** Aggregates KPIs for the Dashboard page. Total creations spans all 6
 *  content kinds; sessions/participants/avg-score are quiz+poll only —
 *  the only two kinds with session history in this codebase. */
export async function computeDashboardStats(userId: string): Promise<DashboardStats> {
  const items = getUserQuizzes(userId);
  const quizItems = items.filter((item) => item.type === "quiz");
  const pollItems = items.filter((item) => item.type === "poll");

  let totalSessions = 0;
  let totalParticipants = 0;
  let scoreSum = 0;
  let scoreCount = 0;

  for (const quiz of quizItems) {
    const runs = readSessionHistory(quiz.id);
    totalSessions += runs.length;
    for (const run of runs) {
      totalParticipants += run.players.length;
      for (const player of run.players) {
        scoreSum += player.score;
        scoreCount += 1;
      }
    }
  }

  for (const poll of pollItems) {
    const store = getPollResults(poll.id);
    if (!store) continue;
    totalSessions += store.sessions.length;
    totalParticipants += store.sessions.reduce((sum, session) => sum + session.totalParticipants, 0);
  }

  const [courses, exams] = await Promise.all([
    Promise.resolve(getUserCourses(userId)),
    getHostExams(userId),
  ]);

  return {
    totalCreations: items.length + courses.length + exams.length,
    totalSessions,
    totalParticipants,
    avgScore: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null,
  };
}

export interface CreationsByType {
  quiz: number;
  poll: number;
  flashcard: number;
  slide: number;
  /** Courses + exams — no dedicated accent token in the design system, so
   *  they fold into one bucket rather than inventing new theme colors. */
  other: number;
}

export interface ActivityPoint {
  /** yyyy-MM-dd, UTC — matches the ISO dates already stored on session runs. */
  date: string;
  sessions: number;
  participants: number;
}

export interface DashboardCharts {
  creationsByType: CreationsByType;
  activity: ActivityPoint[];
}

const ACTIVITY_WINDOW_DAYS = 14;

/** Chart data for the Dashboard page — kept separate from computeDashboardStats
 *  (different shape, different consumer) even though both walk the same
 *  storage; the KPI numbers must stay stable regardless of what the charts need. */
export async function computeDashboardCharts(userId: string): Promise<DashboardCharts> {
  const items = getUserQuizzes(userId);
  const quizItems = items.filter((item) => item.type === "quiz");
  const pollItems = items.filter((item) => item.type === "poll");

  const [courses, exams] = await Promise.all([
    Promise.resolve(getUserCourses(userId)),
    getHostExams(userId),
  ]);

  const creationsByType: CreationsByType = {
    quiz: quizItems.length,
    poll: pollItems.length,
    flashcard: items.filter((item) => item.type === "flashcard").length,
    slide: items.filter((item) => item.type === "slide").length,
    other: courses.length + exams.length,
  };

  const buckets = new Map<string, { sessions: number; participants: number }>();
  const today = new Date();
  for (let i = ACTIVITY_WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    buckets.set(d.toISOString().slice(0, 10), { sessions: 0, participants: 0 });
  }

  const bump = (isoDate: string, participants: number) => {
    const bucket = buckets.get(isoDate.slice(0, 10));
    if (!bucket) return; // outside the trailing window
    bucket.sessions += 1;
    bucket.participants += participants;
  };

  for (const quiz of quizItems) {
    for (const run of readSessionHistory(quiz.id)) {
      bump(run.date, run.players.length);
    }
  }
  for (const poll of pollItems) {
    const store = getPollResults(poll.id);
    if (!store) continue;
    for (const session of store.sessions) {
      bump(session.date, session.totalParticipants);
    }
  }

  const activity: ActivityPoint[] = Array.from(buckets.entries()).map(([date, counts]) => ({ date, ...counts }));

  return { creationsByType, activity };
}
