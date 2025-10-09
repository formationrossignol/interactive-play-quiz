import type { QuizQuestion } from "./questionTypes";

export interface QuizTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  questions: Partial<QuizQuestion>[];
}

export const QUIZ_TEMPLATES: QuizTemplate[] = [
  {
    id: "culture-generale",
    name: "Culture générale",
    description: "Quiz de connaissances générales",
    icon: "🌍",
    category: "Culture",
    questions: [
      {
        type: "multiple-choice",
        question: "Quelle est la capitale de la France ?",
        answers: ["Paris", "Lyon", "Marseille", "Toulouse"],
        correctAnswer: 0,
        points: 100,
        timeLimit: 20
      },
      {
        type: "true-false",
        question: "La Terre est plate",
        correctAnswer: "false",
        answers: ["True", "False"],
        points: 100,
        timeLimit: 15
      },
      {
        type: "slider",
        question: "En quelle année a eu lieu la Révolution française ?",
        min: 1700,
        max: 1900,
        step: 1,
        correctValue: 1789,
        points: 100,
        timeLimit: 30
      }
    ]
  },
  {
    id: "sciences",
    name: "Sciences et technologie",
    description: "Testez vos connaissances scientifiques",
    icon: "🔬",
    category: "Sciences",
    questions: [
      {
        type: "multiple-choice",
        question: "Quel est le symbole chimique de l'or ?",
        answers: ["Au", "Ag", "Fe", "Cu"],
        correctAnswer: 0,
        points: 100,
        timeLimit: 20
      },
      {
        type: "slider",
        question: "À quelle température l'eau bout-elle (en °C) ?",
        min: 0,
        max: 200,
        step: 1,
        correctValue: 100,
        points: 100,
        timeLimit: 25
      }
    ]
  },
  {
    id: "histoire",
    name: "Histoire",
    description: "Voyage dans le temps",
    icon: "📜",
    category: "Histoire",
    questions: [
      {
        type: "ranking",
        question: "Classez ces événements par ordre chronologique",
        items: ["Révolution française", "Première Guerre mondiale", "Chute du mur de Berlin", "Renaissance"],
        correctOrder: [3, 0, 1, 2],
        points: 150,
        timeLimit: 45
      },
      {
        type: "slider",
        question: "En quelle année est tombé le mur de Berlin ?",
        min: 1980,
        max: 2000,
        step: 1,
        correctValue: 1989,
        points: 100,
        timeLimit: 30
      }
    ]
  },
  {
    id: "geographie",
    name: "Géographie",
    description: "Explorez le monde",
    icon: "🗺️",
    category: "Géographie",
    questions: [
      {
        type: "multiple-choice",
        question: "Quel est le plus grand océan du monde ?",
        answers: ["Océan Pacifique", "Océan Atlantique", "Océan Indien", "Océan Arctique"],
        correctAnswer: 0,
        points: 100,
        timeLimit: 20
      },
      {
        type: "matching",
        question: "Associez les pays à leurs capitales",
        leftColumn: [
          { id: "1", text: "France" },
          { id: "2", text: "Italie" },
          { id: "3", text: "Espagne" },
          { id: "4", text: "Allemagne" }
        ],
        rightColumn: [
          { id: "a", text: "Paris" },
          { id: "b", text: "Rome" },
          { id: "c", text: "Madrid" },
          { id: "d", text: "Berlin" }
        ],
        correctMatches: [
          { leftId: "1", rightId: "a" },
          { leftId: "2", rightId: "b" },
          { leftId: "3", rightId: "c" },
          { leftId: "4", rightId: "d" }
        ],
        points: 150,
        timeLimit: 40
      }
    ]
  }
];

export const getQuizTemplate = (id: string): QuizTemplate | undefined => {
  return QUIZ_TEMPLATES.find(t => t.id === id);
};

export const getQuizTemplatesByCategory = (category?: string): QuizTemplate[] => {
  if (!category) return QUIZ_TEMPLATES;
  return QUIZ_TEMPLATES.filter(t => t.category === category);
};
