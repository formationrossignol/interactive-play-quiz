import type { QuizQuestionType, EditableQuestion } from "@/lib/questionTypes";

export const createDefaultQuizQuestion = (type: QuizQuestionType = "multiple-choice") => {
  const base = {
    type,
    question: "",
    timeLimit: 30,
    points: 100,
    image: "",
  } as EditableQuestion;

  switch (type) {
    case "multiple-choice":
      // -1: no answer selected — matches the toggle's own "click again to
      // clear" sentinel (QuizBuilder.tsx). A fresh question must never ship
      // with a silently pre-checked correct answer.
      return { ...base, answers: ["", "", "", ""], correctAnswer: -1 };
    case "true-false":
      // Unset until the host explicitly picks Vrai or Faux — same reasoning.
      return { ...base, answers: ["Vrai", "Faux"], correctAnswer: undefined };
    case "short-answer":
      return { ...base, correctAnswer: "", acceptableAnswers: [] };
    case "ranking":
      return { ...base, items: ["", "", "", ""], correctOrder: [0, 1, 2, 3] };
    case "matching":
      return {
        ...base,
        leftColumn: [
          { id: "1", text: "" },
          { id: "2", text: "" },
        ],
        rightColumn: [
          { id: "a", text: "" },
          { id: "b", text: "" },
        ],
        correctMatches: [
          { leftId: "1", rightId: "a" },
          { leftId: "2", rightId: "b" },
        ],
      };
    case "fill-blank":
      return {
        ...base,
        text: "",
        blanks: [{ id: "1", correctAnswer: "", acceptableAnswers: [] }],
      };
    case "slider":
      return {
        ...base,
        min: 0,
        max: 100,
        step: 1,
        correctValue: 50,
        minLabel: "",
        maxLabel: "",
      };
    default:
      return { ...base, answers: ["", "", "", ""], correctAnswer: -1 };
  }
};
