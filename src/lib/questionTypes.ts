// Types de questions pour les quiz
export type QuizQuestionType = 
  | 'multiple-choice'  // Choix unique (QCM)
  | 'true-false'       // Vrai/Faux
  | 'short-answer'     // Réponse courte
  | 'ranking'          // Classement par priorité
  | 'matching'         // Association / appariement
  | 'fill-blank'       // Remplir les blancs
  | 'drag-drop'        // Glisser-déposer
  | 'hotspot'          // Zones cliquables
  | 'slider';          // Curseur

// Types de questions pour les sondages
export type PollQuestionType = 
  | 'single-choice'    // Choix unique
  | 'multiple-choice'  // Choix multiples
  | 'likert-scale'     // Échelle de Likert
  | 'frequency-scale'  // Échelle de fréquence
  | 'star-rating'      // Évaluation par étoiles
  | 'ranking'          // Classement / Priorisation
  | 'open-text'        // Question ouverte (texte)
  | 'nps-scale';       // Échelle NPS

export interface BaseQuestion {
  id: string;
  question: string;
  timeLimit?: number;
  points?: number;
  image?: string;
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'multiple-choice' | 'single-choice';
  answers: string[];
  correctAnswer?: number;  // Optional for polls
  allowMultiple?: boolean; // For poll multiple-choice
}

export interface TrueFalseQuestion extends BaseQuestion {
  type: 'true-false';
  correctAnswer: 'true' | 'false';
  answers: ['True', 'False'];
}

export interface ShortAnswerQuestion extends BaseQuestion {
  type: 'short-answer';
  correctAnswer?: string;
  acceptableAnswers?: string[];
}

export interface RankingQuestion extends BaseQuestion {
  type: 'ranking';
  items: string[];
  correctOrder?: number[];  // Optional for polls
}

export interface MatchingQuestion extends BaseQuestion {
  type: 'matching';
  leftColumn: { id: string; text: string }[];
  rightColumn: { id: string; text: string }[];
  correctMatches: { leftId: string; rightId: string }[];
}

export interface FillBlankQuestion extends BaseQuestion {
  type: 'fill-blank';
  text: string;  // Texte avec des placeholders {{blank}}
  blanks: { id: string; correctAnswer: string; acceptableAnswers?: string[] }[];
}

export interface DragDropQuestion extends BaseQuestion {
  type: 'drag-drop';
  backgroundImage: string;
  zones: { id: string; x: number; y: number; width: number; height: number; label: string }[];
  items: { id: string; text: string; correctZoneId: string }[];
}

export interface HotspotQuestion extends BaseQuestion {
  type: 'hotspot';
  image: string;
  hotspots: { id: string; x: number; y: number; radius: number; isCorrect: boolean }[];
}

export interface LikertScaleQuestion extends BaseQuestion {
  type: 'likert-scale';
  scale: string[];  // e.g., ["Tout à fait d'accord", "D'accord", "Neutre", "Pas d'accord", "Pas du tout d'accord"]
}

export interface FrequencyScaleQuestion extends BaseQuestion {
  type: 'frequency-scale';
  scale: string[];  // e.g., ["Jamais", "Rarement", "Parfois", "Souvent", "Toujours"]
}

export interface StarRatingQuestion extends BaseQuestion {
  type: 'star-rating';
  maxStars: number;  // e.g., 5
}

export interface OpenTextQuestion extends BaseQuestion {
  type: 'open-text';
  maxLength?: number;
  minLength?: number;
}

export interface NPSScaleQuestion extends BaseQuestion {
  type: 'nps-scale';
  minLabel?: string;
  maxLabel?: string;
}

export interface SliderQuestion extends BaseQuestion {
  type: 'slider';
  min: number;
  max: number;
  step: number;
  minLabel?: string;
  maxLabel?: string;
  correctValue?: number;
}

export type QuizQuestion =
  | MultipleChoiceQuestion
  | TrueFalseQuestion
  | ShortAnswerQuestion
  | RankingQuestion
  | MatchingQuestion
  | FillBlankQuestion
  | DragDropQuestion
  | HotspotQuestion
  | SliderQuestion;

export type PollQuestion = 
  | MultipleChoiceQuestion
  | RankingQuestion
  | LikertScaleQuestion
  | FrequencyScaleQuestion
  | StarRatingQuestion
  | OpenTextQuestion
  | NPSScaleQuestion;

export type Question = QuizQuestion | PollQuestion;

export const getQuestionTypeLabel = (type: QuizQuestionType | PollQuestionType): string => {
  const labels: Record<QuizQuestionType | PollQuestionType, string> = {
    // Quiz types
    'multiple-choice': 'Choix Multiple',
    'true-false': 'Vrai/Faux',
    'short-answer': 'Réponse Courte',
    'ranking': 'Classement',
    'matching': 'Appariement',
    'fill-blank': 'Remplir les Blancs',
    'drag-drop': 'Glisser-Déposer',
    'hotspot': 'Zones Cliquables',
    'slider': 'Curseur',
    // Poll types
    'single-choice': 'Choix Unique',
    'likert-scale': 'Échelle de Likert',
    'frequency-scale': 'Échelle de Fréquence',
    'star-rating': 'Notation par Étoiles',
    'open-text': 'Question Ouverte',
    'nps-scale': 'Échelle NPS',
  };
  return labels[type] || type;
};

export const getQuestionTypeDescription = (type: QuizQuestionType | PollQuestionType): string => {
  const descriptions: Record<QuizQuestionType | PollQuestionType, string> = {
    // Quiz types
    'multiple-choice': 'Une seule réponse correcte parmi plusieurs options',
    'true-false': 'Question avec réponse Vrai ou Faux',
    'short-answer': 'Réponse textuelle courte',
    'ranking': 'Hiérarchiser des options par ordre d\'importance',
    'matching': 'Relier des éléments entre deux colonnes',
    'fill-blank': 'Phrase à trous à compléter',
    'drag-drop': 'Glisser-déposer des éléments dans la bonne zone',
    'hotspot': 'Cliquer sur la bonne partie d\'une image',
    'slider': 'Réponse par déplacement de curseur',
    // Poll types
    'single-choice': 'Une seule réponse possible parmi plusieurs',
    'likert-scale': 'Échelle d\'accord (Tout à fait d\'accord → Pas du tout)',
    'frequency-scale': 'Échelle de fréquence (Jamais → Toujours)',
    'star-rating': 'Évaluation par étoiles (1 à 5)',
    'open-text': 'Réponse libre en texte',
    'nps-scale': 'Échelle de recommandation 0-10',
  };
  return descriptions[type] || '';
};
