import type { PollQuestion } from "./questionTypes";

export interface PollTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  questions: Partial<PollQuestion>[];
}

export const POLL_TEMPLATES: PollTemplate[] = [
  {
    id: "satisfaction-formation",
    name: "Satisfaction formation / atelier",
    description: "Mesurer la qualité perçue et les acquis",
    icon: "📚",
    category: "Formation",
    questions: [
      {
        type: "star-rating",
        question: "Comment évaluez-vous la clarté des explications ?",
        maxStars: 5
      },
      {
        type: "single-choice",
        question: "Le contenu était-il adapté à vos besoins ?",
        answers: ["Oui", "Non", "Partiellement"]
      },
      {
        type: "open-text",
        question: "Quel concept retenez-vous le plus ?",
        maxLength: 500
      },
      {
        type: "likert-scale",
        question: "Recommanderiez-vous cette formation ?",
        scale: ["Certainement pas", "Probablement pas", "Neutre", "Probablement", "Certainement"]
      }
    ]
  },
  {
    id: "engagement-equipe",
    name: "Engagement d'équipe / climat de travail",
    description: "Sonder la motivation et la collaboration",
    icon: "👥",
    category: "Équipe",
    questions: [
      {
        type: "likert-scale",
        question: "Je comprends clairement les objectifs de mon équipe",
        scale: ["Tout à fait d'accord", "D'accord", "Neutre", "Pas d'accord", "Pas du tout d'accord"]
      },
      {
        type: "single-choice",
        question: "J'ai suffisamment d'opportunités pour m'exprimer",
        answers: ["Oui", "Non", "Parfois"]
      },
      {
        type: "open-text",
        question: "Quel est le principal frein à votre efficacité ?",
        maxLength: 500
      },
      {
        type: "frequency-scale",
        question: "À quelle fréquence participez-vous aux décisions d'équipe ?",
        scale: ["Jamais", "Rarement", "Parfois", "Souvent", "Toujours"]
      }
    ]
  },
  {
    id: "preparation-projet",
    name: "Préparation d'un projet / recueil de besoins",
    description: "Collecter attentes et priorités avant de démarrer",
    icon: "🚀",
    category: "Projet",
    questions: [
      {
        type: "multiple-choice",
        question: "Quelles sont vos attentes principales pour ce projet ?",
        answers: ["Innovation", "Efficacité", "Collaboration", "Qualité", "Délais"],
        allowMultiple: true
      },
      {
        type: "ranking",
        question: "Classez ces fonctionnalités par priorité",
        items: ["Interface utilisateur", "Performance", "Sécurité", "Documentation", "Support"]
      },
      {
        type: "open-text",
        question: "Quels risques potentiels voyez-vous ?",
        maxLength: 500
      },
      {
        type: "star-rating",
        question: "Quel est votre niveau de confiance pour la réussite du projet ?",
        maxStars: 5
      }
    ]
  },
  {
    id: "feedback-produit",
    name: "Feedback produit / service",
    description: "Évaluer l'expérience utilisateur",
    icon: "⭐",
    category: "Produit",
    questions: [
      {
        type: "star-rating",
        question: "Quelle est votre satisfaction globale ?",
        maxStars: 5
      },
      {
        type: "single-choice",
        question: "Quelle fonctionnalité utilisez-vous le plus ?",
        answers: ["Dashboard", "Rapports", "Notifications", "Intégrations", "Autre"]
      },
      {
        type: "open-text",
        question: "Si vous pouviez changer une chose, ce serait quoi ?",
        maxLength: 500
      },
      {
        type: "likert-scale",
        question: "Je recommanderais ce produit à un collègue",
        scale: ["Tout à fait d'accord", "D'accord", "Neutre", "Pas d'accord", "Pas du tout d'accord"]
      }
    ]
  },
  {
    id: "icebreaker",
    name: "Icebreaker / sondage ludique",
    description: "Briser la glace, engager une audience",
    icon: "🎉",
    category: "Animation",
    questions: [
      {
        type: "single-choice",
        question: "Si vous étiez un super-héros, lequel seriez-vous ?",
        answers: ["Superman", "Wonder Woman", "Batman", "Spider-Man", "Iron Man", "Black Panther"]
      },
      {
        type: "single-choice",
        question: "Café ou thé pour commencer la journée ?",
        answers: ["☕ Café", "🍵 Thé", "🥤 Autre", "💧 Eau"]
      },
      {
        type: "open-text",
        question: "Partagez un emoji qui reflète votre humeur actuelle",
        maxLength: 50
      },
      {
        type: "multiple-choice",
        question: "Quelles sont vos passions ? (plusieurs réponses possibles)",
        answers: ["Sport", "Musique", "Lecture", "Voyage", "Cuisine", "Technologie"],
        allowMultiple: true
      }
    ]
  },
  {
    id: "pulse-survey",
    name: "Évaluation continue (pulse survey)",
    description: "Prendre régulièrement la température",
    icon: "📊",
    category: "Suivi",
    questions: [
      {
        type: "star-rating",
        question: "Cette semaine, quel est votre niveau d'énergie ?",
        maxStars: 10
      },
      {
        type: "single-choice",
        question: "J'ai les moyens nécessaires pour bien travailler",
        answers: ["Oui", "Non", "Partiellement"]
      },
      {
        type: "open-text",
        question: "Une chose qui pourrait améliorer mon quotidien ?",
        maxLength: 300
      },
      {
        type: "frequency-scale",
        question: "À quelle fréquence vous sentez-vous surchargé ?",
        scale: ["Jamais", "Rarement", "Parfois", "Souvent", "Toujours"]
      }
    ]
  }
];

export const getPollTemplate = (id: string): PollTemplate | undefined => {
  return POLL_TEMPLATES.find(t => t.id === id);
};

export const getPollTemplatesByCategory = (category?: string): PollTemplate[] => {
  if (!category) return POLL_TEMPLATES;
  return POLL_TEMPLATES.filter(t => t.category === category);
};
