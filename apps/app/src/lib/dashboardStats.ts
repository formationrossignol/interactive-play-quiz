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
