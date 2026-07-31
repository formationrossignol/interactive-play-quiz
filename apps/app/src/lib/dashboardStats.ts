import { getUserQuizzes } from "./quizStorage";
import { readSessionHistory } from "./sessionState";
import { getPollResults } from "./pollResults";
import { listContent } from "./content/contentRepo";
import { toDisplay, filterActive } from "./content/contentView";
import { CONTENT_TYPES, type ContentType } from "./content/types";

/** Trailing window used for both the "recent" half of a KPI trend and the
 *  Activity chart — one number so the two stay comparable. */
const TREND_WINDOW_DAYS = 14;

/** Every non-trashed creation across all 6 content kinds, read from the same
 *  Supabase `content` table ContentExplorer/MyQuizzes read from — quiz/poll
 *  session history stays on the legacy per-quiz localStorage store below
 *  (readSessionHistory/getPollResults key off the legacy id), but creation
 *  counts must never again drift from what the content browser actually shows. */
async function fetchActiveContent(userId: string) {
  const rows = await Promise.all(CONTENT_TYPES.map((type) => listContent(userId, type)));
  return filterActive(rows.flat().map(toDisplay));
}

export interface PeriodDelta {
  /** Count in the trailing TREND_WINDOW_DAYS days. */
  current: number;
  /** Count in the TREND_WINDOW_DAYS days before that. */
  previous: number;
  /** Percentage change, rounded. Null when `previous` is 0 — a percentage
   *  off a zero baseline isn't a meaningful number to show. */
  deltaPct: number | null;
}

function computeDelta(current: number, previous: number): PeriodDelta {
  const deltaPct = previous === 0 ? null : Math.round(((current - previous) / previous) * 100);
  return { current, previous, deltaPct };
}

/** current-window / previous-window boundaries, most-recent-first. */
function windowBounds(now: number) {
  const dayMs = 24 * 60 * 60 * 1000;
  const currentStart = now - TREND_WINDOW_DAYS * dayMs;
  const previousStart = now - 2 * TREND_WINDOW_DAYS * dayMs;
  return { now, currentStart, previousStart };
}

function bucketOf(iso: string, bounds: ReturnType<typeof windowBounds>): "current" | "previous" | "outside" {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "outside";
  if (t > bounds.now) return "outside";
  if (t >= bounds.currentStart) return "current";
  if (t >= bounds.previousStart) return "previous";
  return "outside";
}

export interface DashboardStats {
  totalCreations: number;
  totalSessions: number;
  totalParticipants: number;
  /** null when no quiz session has ever run — polls have no per-player score. */
  avgScore: number | null;
  /** Trailing 14 days vs the 14 days before — same window as the Activity chart. */
  trends: {
    creations: PeriodDelta;
    sessions: PeriodDelta;
    participants: PeriodDelta;
    /** Average score computed only from sessions inside each window; null
     *  halves when that window has no scored (quiz) sessions. */
    avgScore: { current: number | null; previous: number | null };
  };
}

/** Aggregates KPIs for the Dashboard page. Total creations spans all 6
 *  content kinds; sessions/participants/avg-score are quiz+poll only —
 *  the only two kinds with session history in this codebase. */
export async function computeDashboardStats(userId: string): Promise<DashboardStats> {
  const items = getUserQuizzes(userId);
  const quizItems = items.filter((item) => item.type === "quiz");
  const pollItems = items.filter((item) => item.type === "poll");
  const bounds = windowBounds(Date.now());

  let totalSessions = 0;
  let totalParticipants = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  let sessionsCurrent = 0, sessionsPrevious = 0;
  let participantsCurrent = 0, participantsPrevious = 0;
  let scoreSumCurrent = 0, scoreCountCurrent = 0;
  let scoreSumPrevious = 0, scoreCountPrevious = 0;

  for (const quiz of quizItems) {
    const runs = readSessionHistory(quiz.id);
    totalSessions += runs.length;
    for (const run of runs) {
      totalParticipants += run.players.length;
      for (const player of run.players) {
        scoreSum += player.score;
        scoreCount += 1;
      }

      const bucket = bucketOf(run.date, bounds);
      if (bucket === "outside") continue;
      if (bucket === "current") { sessionsCurrent += 1; participantsCurrent += run.players.length; }
      else { sessionsPrevious += 1; participantsPrevious += run.players.length; }
      for (const player of run.players) {
        if (bucket === "current") { scoreSumCurrent += player.score; scoreCountCurrent += 1; }
        else { scoreSumPrevious += player.score; scoreCountPrevious += 1; }
      }
    }
  }

  for (const poll of pollItems) {
    const store = getPollResults(poll.id);
    if (!store) continue;
    totalSessions += store.sessions.length;
    totalParticipants += store.sessions.reduce((sum, session) => sum + session.totalParticipants, 0);
    for (const session of store.sessions) {
      const bucket = bucketOf(session.date, bounds);
      if (bucket === "outside") continue;
      if (bucket === "current") { sessionsCurrent += 1; participantsCurrent += session.totalParticipants; }
      else { sessionsPrevious += 1; participantsPrevious += session.totalParticipants; }
    }
  }

  const activeContent = await fetchActiveContent(userId);

  let creationsCurrent = 0, creationsPrevious = 0;
  for (const content of activeContent) {
    const bucket = bucketOf(content.createdAt, bounds);
    if (bucket === "current") creationsCurrent += 1;
    else if (bucket === "previous") creationsPrevious += 1;
  }

  return {
    totalCreations: activeContent.length,
    totalSessions,
    totalParticipants,
    avgScore: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null,
    trends: {
      creations: computeDelta(creationsCurrent, creationsPrevious),
      sessions: computeDelta(sessionsCurrent, sessionsPrevious),
      participants: computeDelta(participantsCurrent, participantsPrevious),
      avgScore: {
        current: scoreCountCurrent > 0 ? Math.round(scoreSumCurrent / scoreCountCurrent) : null,
        previous: scoreCountPrevious > 0 ? Math.round(scoreSumPrevious / scoreCountPrevious) : null,
      },
    },
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

export interface ScorePoint {
  /** yyyy-MM-dd, UTC. */
  date: string;
  /** null when no quiz session ran that day — distinct from a real 0 score. */
  avgScore: number | null;
}

export interface DashboardCharts {
  creationsByType: CreationsByType;
  activity: ActivityPoint[];
  scoreByDay: ScorePoint[];
}

const ACTIVITY_WINDOW_DAYS = TREND_WINDOW_DAYS;

/** Chart data for the Dashboard page — kept separate from computeDashboardStats
 *  (different shape, different consumer) even though both walk the same
 *  storage; the KPI numbers must stay stable regardless of what the charts need. */
export async function computeDashboardCharts(userId: string): Promise<DashboardCharts> {
  const items = getUserQuizzes(userId);
  const quizItems = items.filter((item) => item.type === "quiz");
  const pollItems = items.filter((item) => item.type === "poll");

  const activeContent = await fetchActiveContent(userId);
  const countByType = (type: ContentType) => activeContent.filter((c) => c.type === type).length;
  const creationsByType: CreationsByType = {
    quiz: countByType("quiz"),
    poll: countByType("poll"),
    flashcard: countByType("flashcard"),
    slide: countByType("slide"),
    other: countByType("course") + countByType("exam"),
  };

  const buckets = new Map<string, { sessions: number; participants: number }>();
  const scoreBuckets = new Map<string, { sum: number; count: number }>();
  const today = new Date();
  for (let i = ACTIVITY_WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { sessions: 0, participants: 0 });
    scoreBuckets.set(key, { sum: 0, count: 0 });
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
      const scoreBucket = scoreBuckets.get(run.date.slice(0, 10));
      if (!scoreBucket) continue; // outside the trailing window
      for (const player of run.players) {
        scoreBucket.sum += player.score;
        scoreBucket.count += 1;
      }
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
  const scoreByDay: ScorePoint[] = Array.from(scoreBuckets.entries()).map(([date, { sum, count }]) => ({
    date,
    avgScore: count > 0 ? Math.round(sum / count) : null,
  }));

  return { creationsByType, activity, scoreByDay };
}
