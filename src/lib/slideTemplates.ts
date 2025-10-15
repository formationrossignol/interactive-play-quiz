export interface SlideTemplate {
  id: string;
  name: string;
  description: string;
  slides: Array<{
    id: string;
    title: string;
    content: string;
    image?: string;
  }>;
}

export const SLIDE_TEMPLATES: SlideTemplate[] = [
  {
    id: "presentation-entreprise",
    name: "Présentation d'entreprise",
    description: "Modèle pour présenter votre entreprise",
    slides: [
      {
        id: "1",
        title: "Bienvenue",
        content: "Présentation de [Nom de votre entreprise]",
      },
      {
        id: "2",
        title: "Notre mission",
        content: "Décrivez votre mission et vos valeurs...",
      },
      {
        id: "3",
        title: "Nos services",
        content: "Listez vos principaux services...",
      },
      {
        id: "4",
        title: "Notre équipe",
        content: "Présentez votre équipe...",
      },
      {
        id: "5",
        title: "Contact",
        content: "Informations de contact...",
      },
    ],
  },
  {
    id: "formation",
    name: "Support de formation",
    description: "Modèle pour créer un support de formation",
    slides: [
      {
        id: "1",
        title: "Introduction",
        content: "Objectifs de la formation",
      },
      {
        id: "2",
        title: "Chapitre 1",
        content: "Premier concept clé...",
      },
      {
        id: "3",
        title: "Chapitre 2",
        content: "Deuxième concept clé...",
      },
      {
        id: "4",
        title: "Exercices pratiques",
        content: "Mise en pratique...",
      },
      {
        id: "5",
        title: "Conclusion",
        content: "Récapitulatif et ressources...",
      },
    ],
  },
  {
    id: "pitch-projet",
    name: "Pitch de projet",
    description: "Modèle pour pitcher un projet ou une idée",
    slides: [
      {
        id: "1",
        title: "Le problème",
        content: "Quel problème résolvons-nous ?",
      },
      {
        id: "2",
        title: "Notre solution",
        content: "Comment résolvons-nous ce problème ?",
      },
      {
        id: "3",
        title: "Le marché",
        content: "Taille et opportunités du marché...",
      },
      {
        id: "4",
        title: "Notre avantage",
        content: "Ce qui nous différencie...",
      },
      {
        id: "5",
        title: "L'équipe",
        content: "Qui sommes-nous ?",
      },
    ],
  },
];

export const getSlideTemplate = (id: string): SlideTemplate | undefined => {
  return SLIDE_TEMPLATES.find((template) => template.id === id);
};
