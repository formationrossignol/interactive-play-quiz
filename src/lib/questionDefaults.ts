import type { QuizQuestionType } from "@/lib/questionTypes";

export const createDefaultQuizQuestion = (type: QuizQuestionType = "multiple-choice") => {
  const base = {
    type,
    question: "",
    timeLimit: 30,
    points: 100,
    image: "",
  } as any;

  switch (type) {
    case "multiple-choice":
      return { ...base, answers: ["", "", "", ""], correctAnswer: 0 };
    case "true-false":
      return { ...base, answers: ["Vrai", "Faux"], correctAnswer: "true" };
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
      return { ...base, answers: ["", "", "", ""], correctAnswer: 0 };
  }
};
