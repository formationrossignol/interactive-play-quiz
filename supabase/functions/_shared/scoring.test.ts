import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkAnswerCorrect, calculateEarnedPoints, type QuestionForScoring } from "./scoring.ts";

Deno.test("multiple-choice: correct when answer matches correctAnswer", () => {
  const q: QuestionForScoring = { type: "multiple-choice", correctAnswer: 2 };
  assertEquals(checkAnswerCorrect(q, 2), true);
  assertEquals(checkAnswerCorrect(q, 1), false);
});

Deno.test("true-false: normalizes string/boolean correctAnswer", () => {
  const q: QuestionForScoring = { type: "true-false", correctAnswer: "true" };
  assertEquals(checkAnswerCorrect(q, "true"), true);
  assertEquals(checkAnswerCorrect(q, "false"), false);
});

Deno.test("short-answer: case/whitespace insensitive", () => {
  const q: QuestionForScoring = { type: "short-answer", correctAnswer: "Paris" };
  assertEquals(checkAnswerCorrect(q, "  paris  "), true);
  assertEquals(checkAnswerCorrect(q, "Lyon"), false);
});

Deno.test("short-answer: non-string answer is never correct", () => {
  const q: QuestionForScoring = { type: "short-answer", correctAnswer: "Paris" };
  assertEquals(checkAnswerCorrect(q, 42), false);
});

Deno.test("slider: numeric comparison against correctValue", () => {
  const q: QuestionForScoring = { type: "slider", correctValue: 50 };
  assertEquals(checkAnswerCorrect(q, 50), true);
  assertEquals(checkAnswerCorrect(q, "50"), true);
  assertEquals(checkAnswerCorrect(q, 49), false);
});

Deno.test("slider: falls back to correctAnswer if correctValue absent", () => {
  const q: QuestionForScoring = { type: "slider", correctAnswer: 7 };
  assertEquals(checkAnswerCorrect(q, 7), true);
});

Deno.test("fill-blank: every blank must match case/whitespace insensitively", () => {
  const q: QuestionForScoring = {
    type: "fill-blank",
    blanks: [{ correctAnswer: "chat" }, { correctAnswer: "chien" }],
  };
  assertEquals(checkAnswerCorrect(q, JSON.stringify(["Chat", " chien "])), true);
  assertEquals(checkAnswerCorrect(q, JSON.stringify(["chat", "oiseau"])), false);
});

Deno.test("fill-blank: malformed JSON answer is never correct", () => {
  const q: QuestionForScoring = { type: "fill-blank", blanks: [{ correctAnswer: "chat" }] };
  assertEquals(checkAnswerCorrect(q, "not json"), false);
});

Deno.test("ranking: exact order required", () => {
  const q: QuestionForScoring = { type: "ranking", correctOrder: [2, 0, 1] };
  assertEquals(checkAnswerCorrect(q, JSON.stringify([2, 0, 1])), true);
  assertEquals(checkAnswerCorrect(q, JSON.stringify([0, 1, 2])), false);
});

Deno.test("ranking: wrong length is never correct", () => {
  const q: QuestionForScoring = { type: "ranking", correctOrder: [2, 0, 1] };
  assertEquals(checkAnswerCorrect(q, JSON.stringify([2, 0])), false);
});

Deno.test("matching: every pair must match", () => {
  const q: QuestionForScoring = {
    type: "matching",
    correctMatches: [{ leftId: "a", rightId: "x" }, { leftId: "b", rightId: "y" }],
  };
  assertEquals(checkAnswerCorrect(q, JSON.stringify({ a: "x", b: "y" })), true);
  assertEquals(checkAnswerCorrect(q, JSON.stringify({ a: "x", b: "z" })), false);
});

Deno.test("unsupported type throws an explicit error", () => {
  const q: QuestionForScoring = { type: "drag-drop" };
  let threw = false;
  try {
    checkAnswerCorrect(q, "anything");
  } catch (e) {
    threw = true;
    assertEquals((e as Error).message.includes("drag-drop"), true);
  }
  assertEquals(threw, true);
});

Deno.test("calculateEarnedPoints: full points at elapsed=0", () => {
  assertEquals(calculateEarnedPoints(100, 0, 30, true), 100);
});

Deno.test("calculateEarnedPoints: floor of 10% at elapsed=timeLimit", () => {
  assertEquals(calculateEarnedPoints(100, 30, 30, true), 10);
});

Deno.test("calculateEarnedPoints: floor of 10% when elapsed exceeds timeLimit (network latency)", () => {
  assertEquals(calculateEarnedPoints(100, 35, 30, true), 10);
});

Deno.test("calculateEarnedPoints: partial ratio between 0 and timeLimit", () => {
  // elapsed=15 of 30 → ratio 0.5 → 50 points (above the 10-point floor)
  assertEquals(calculateEarnedPoints(100, 15, 30, true), 50);
});

Deno.test("calculateEarnedPoints: zero when incorrect regardless of timing", () => {
  assertEquals(calculateEarnedPoints(100, 0, 30, false), 0);
});

Deno.test("calculateEarnedPoints: timeLimit of 0 doesn't produce NaN (malformed quiz data)", () => {
  // timeLimit clamped to a minimum of 1s; elapsed=0 relative to that gives a
  // full-points ratio — not NaN, and not incorrectly zeroed either.
  assertEquals(calculateEarnedPoints(100, 0, 0, true), 100);
});

Deno.test("calculateEarnedPoints: negative elapsed (clock skew) doesn't exceed full points", () => {
  assertEquals(calculateEarnedPoints(100, -5, 30, true), 100);
});

Deno.test("fill-blank: empty blanks array is never correct (not vacuously true)", () => {
  const q: QuestionForScoring = { type: "fill-blank", blanks: [] };
  assertEquals(checkAnswerCorrect(q, JSON.stringify([])), false);
});

Deno.test("matching: empty correctMatches array is never correct (not vacuously true)", () => {
  const q: QuestionForScoring = { type: "matching", correctMatches: [] };
  assertEquals(checkAnswerCorrect(q, JSON.stringify({})), false);
});
