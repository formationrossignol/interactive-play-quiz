import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildCorrectionPayload, calculateScore, stripAnswerKey } from "./examScoring.ts";

Deno.test("calculateScore: sums points for correct answers, ignores unanswered", () => {
  const questions = [
    { id: "a", type: "multiple-choice", correctAnswer: 1, points: 100 },
    { id: "b", type: "true-false", correctAnswer: "true", points: 50 },
    { id: "c", type: "short-answer", correctAnswer: "Paris", points: 50 },
  ];
  const answers = { a: 1, b: "true", c: "  paris " };
  const result = calculateScore(answers, questions, 70);
  assertEquals(result.score, 200);
  assertEquals(result.percentage, 100);
  assertEquals(result.passed, true);
});

Deno.test("calculateScore: unanswered question earns nothing and doesn't crash", () => {
  const questions = [
    { id: "a", type: "multiple-choice", correctAnswer: 1, points: 100 },
    { id: "b", type: "multiple-choice", correctAnswer: 0, points: 100 },
  ];
  const result = calculateScore({ a: 1, b: null }, questions, 70);
  assertEquals(result.score, 100);
  assertEquals(result.percentage, 50);
  assertEquals(result.passed, false);
});

Deno.test("calculateScore: percentage is 0 when there are no questions", () => {
  const result = calculateScore({}, [], 70);
  assertEquals(result.score, 0);
  assertEquals(result.percentage, 0);
  assertEquals(result.passed, false);
});

Deno.test("stripAnswerKey: removes correct-answer fields, keeps everything else", () => {
  const q = {
    id: "a", type: "multiple-choice", question: "2+2?", answers: ["3", "4"], correctAnswer: 1, points: 100,
  };
  const stripped = stripAnswerKey(q);
  assertEquals(stripped.correctAnswer, undefined);
  assertEquals(stripped.answers, ["3", "4"]);
  assertEquals(stripped.question, "2+2?");
});

Deno.test("stripAnswerKey: fill-blank keeps blank ids, drops correctAnswer/acceptableAnswers", () => {
  const q = {
    id: "a", type: "fill-blank", text: "{{blank}}",
    blanks: [{ id: "b1", correctAnswer: "Paris", acceptableAnswers: ["paris"] }],
  };
  const stripped = stripAnswerKey(q);
  assertEquals(stripped.blanks, [{ id: "b1" }]);
});

Deno.test("buildCorrectionPayload: exposes only correction fields plus id", () => {
  const q = { id: "a", type: "multiple-choice", question: "2+2?", answers: ["3", "4"], correctAnswer: 1 };
  const payload = buildCorrectionPayload(q);
  assertEquals(payload, { id: "a", correctAnswer: 1, correctValue: null, correctOrder: null, correctMatches: null, blanks: null });
});
