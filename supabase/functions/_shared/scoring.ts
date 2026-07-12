export interface QuestionForScoring {
  type: string;
  correctAnswer?: unknown;
  correctValue?: unknown;
  correctOrder?: number[];
  correctMatches?: { leftId: string; rightId: string }[];
  blanks?: { correctAnswer: string }[];
}

/** Ported from src/components/PlayerView.tsx's client-side correction logic
 *  (audit findings C-1/H-6 — this used to run in the browser against an
 *  answer key the player could read; it now runs server-side against
 *  session_quiz_answers, which the player never receives). */
export function checkAnswerCorrect(question: QuestionForScoring, answer: unknown): boolean {
  switch (question.type) {
    case "multiple-choice":
    case "single-choice":
      return answer === question.correctAnswer;

    case "true-false":
      return (answer === "true") === (question.correctAnswer === true || question.correctAnswer === "true");

    case "short-answer":
      return (
        typeof answer === "string" &&
        typeof question.correctAnswer === "string" &&
        answer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim()
      );

    case "slider": {
      const expected = question.correctValue ?? question.correctAnswer;
      return Number(answer) === Number(expected);
    }

    case "fill-blank": {
      try {
        const submitted: string[] = JSON.parse(String(answer));
        return (question.blanks ?? []).every(
          (b, i) => submitted[i]?.toLowerCase().trim() === String(b.correctAnswer).toLowerCase().trim()
        );
      } catch {
        return false;
      }
    }

    case "ranking": {
      try {
        const submitted: number[] = JSON.parse(String(answer));
        const target = question.correctOrder ?? [];
        return target.length > 0 && submitted.length === target.length && submitted.every((v, i) => v === target[i]);
      } catch {
        return false;
      }
    }

    case "matching": {
      try {
        const submitted: Record<string, string> = JSON.parse(String(answer));
        return (question.correctMatches ?? []).every((m) => submitted[m.leftId] === m.rightId);
      } catch {
        return false;
      }
    }

    default:
      throw new Error(`Unsupported question type for server-side scoring: ${question.type}`);
  }
}

/** Speed bonus based on a server-measured elapsed time, never the client's
 *  own timer (which is forgeable). Ratio clamped to [0, 1] before applying
 *  the existing 10%-of-base floor, so a network-latency-delayed submission
 *  just past timeLimit still gets the same floor a same-instant submission
 *  would (matches the pre-existing client behavior in PlayerView.tsx). */
export function calculateEarnedPoints(
  basePoints: number,
  elapsedSeconds: number,
  timeLimitSeconds: number,
  correct: boolean
): number {
  if (!correct) return 0;
  const ratio = Math.min(1, Math.max(0, 1 - elapsedSeconds / timeLimitSeconds));
  return Math.max(Math.round(basePoints * ratio), Math.round(basePoints * 0.1));
}
