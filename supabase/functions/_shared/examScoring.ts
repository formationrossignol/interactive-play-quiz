// Server-authoritative exam scoring. This is deliberately a separate
// algorithm from checkAnswerCorrect/calculateEarnedPoints in scoring.ts (the
// live-quiz per-question, speed-bonus scorer) — exams use a flat
// sum-of-points-if-correct with no time bonus, ported verbatim from the old
// client-side apps/app/src/lib/examStorage.ts's calculateScore so exam
// results don't shift for quizzes already in flight. Preserved as-is
// including its pre-existing gap: anything that isn't 'true-false' or
// 'short-answer' is compared with `answer === correctAnswer`, which doesn't
// correctly score ranking/matching/fill-blank-shaped answers (arrays/objects
// instead of scalars) — same behavior the client version had, not fixed here
// to keep this pass scoped to moving the computation server-side, not
// changing what it computes.
export interface ExamQuestionForScoring {
  id: string;
  type: string;
  correctAnswer?: unknown;
  points?: number;
}

export function calculateScore(
  answers: Record<string, number | string | null>,
  questions: ExamQuestionForScoring[],
  passingScore: number,
): { score: number; percentage: number; passed: boolean } {
  const totalPossible = questions.reduce((s, q) => s + (q.points ?? 100), 0);
  let earned = 0;

  for (const q of questions) {
    const answer = answers[q.id];
    if (answer === null || answer === undefined || answer === "") continue;

    let correct = false;
    if (q.type === "true-false") {
      correct = String(answer).toLowerCase() === String(q.correctAnswer).toLowerCase();
    } else if (q.type === "short-answer") {
      correct = String(answer).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
    } else {
      correct = answer === q.correctAnswer;
    }

    if (correct) earned += q.points ?? 100;
  }

  const percentage = totalPossible > 0 ? Math.round((earned / totalPossible) * 100) : 0;
  return { score: earned, percentage, passed: percentage >= passingScore };
}

/** Strips every correct-answer field from a question, for the public
 *  (exams.questions_public) snapshot ExamRoom renders from. Keeps
 *  everything else (id/type/question/answers/items/columns/scale/etc.) so
 *  rendering keeps working for every question shape, present or future. */
export function stripAnswerKey(question: Record<string, unknown>): Record<string, unknown> {
  const {
    correctAnswer: _correctAnswer,
    correctOrder: _correctOrder,
    correctMatches: _correctMatches,
    correctValue: _correctValue,
    blanks,
    ...rest
  } = question;
  if (Array.isArray(blanks)) {
    rest.blanks = blanks.map((b: { id?: string }) => ({ id: b?.id }));
  }
  return rest;
}

/** Per-question correction payload for the "score-correction" results view —
 *  same shape submit-answer's buildCorrectAnswerPayload returns for the live
 *  quiz, generalized to a whole question set instead of just the one just
 *  answered. */
export function buildCorrectionPayload(question: Record<string, unknown>) {
  return {
    id: question.id,
    correctAnswer: question.correctAnswer ?? null,
    correctValue: question.correctValue ?? null,
    correctOrder: question.correctOrder ?? null,
    correctMatches: question.correctMatches ?? null,
    blanks: question.blanks ?? null,
  };
}
