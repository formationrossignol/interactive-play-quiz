export interface FlashcardTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  cards: Array<{
    recto: string;
    verso: string;
    rectoImage?: string;
    versoImage?: string;
  }>;
}

export const flashcardTemplates: FlashcardTemplate[] = [
  {
    id: "vocabulary-english",
    name: "Vocabulaire Anglais - Niveau débutant",
    description: "20 mots anglais essentiels avec leur traduction",
    category: "Langues",
    cards: [
      { recto: "Hello", verso: "Bonjour" },
      { recto: "Goodbye", verso: "Au revoir" },
      { recto: "Thank you", verso: "Merci" },
      { recto: "Please", verso: "S'il vous plaît" },
      { recto: "Yes", verso: "Oui" },
      { recto: "No", verso: "Non" },
      { recto: "Water", verso: "Eau" },
      { recto: "Food", verso: "Nourriture" },
      { recto: "House", verso: "Maison" },
      { recto: "Car", verso: "Voiture" },
    ],
  },
  {
    id: "capitals-europe",
    name: "Capitales européennes",
    description: "Apprenez les capitales des pays européens",
    category: "Géographie",
    cards: [
      { recto: "France", verso: "Paris" },
      { recto: "Allemagne", verso: "Berlin" },
      { recto: "Italie", verso: "Rome" },
      { recto: "Espagne", verso: "Madrid" },
      { recto: "Portugal", verso: "Lisbonne" },
      { recto: "Royaume-Uni", verso: "Londres" },
      { recto: "Belgique", verso: "Bruxelles" },
      { recto: "Pays-Bas", verso: "Amsterdam" },
      { recto: "Suisse", verso: "Berne" },
      { recto: "Autriche", verso: "Vienne" },
    ],
  },
  {
    id: "math-formulas",
    name: "Formules mathématiques essentielles",
    description: "Les formules de base à connaître",
    category: "Mathématiques",
    cards: [
      { recto: "Aire d'un rectangle", verso: "Longueur × Largeur" },
      { recto: "Aire d'un cercle", verso: "π × r²" },
      { recto: "Périmètre d'un cercle", verso: "2 × π × r" },
      { recto: "Volume d'un cube", verso: "côté³" },
      { recto: "Théorème de Pythagore", verso: "a² + b² = c²" },
      { recto: "Aire d'un triangle", verso: "(base × hauteur) ÷ 2" },
    ],
  },
  {
    id: "programming-basics",
    name: "Concepts de programmation",
    description: "Termes clés pour débuter en programmation",
    category: "Informatique",
    cards: [
      { 
        recto: "Qu'est-ce qu'une variable ?", 
        verso: "Un espace de stockage nommé qui contient une valeur pouvant changer pendant l'exécution du programme" 
      },
      { 
        recto: "Qu'est-ce qu'une fonction ?", 
        verso: "Un bloc de code réutilisable qui effectue une tâche spécifique" 
      },
      { 
        recto: "Qu'est-ce qu'une boucle ?", 
        verso: "Une structure qui répète un bloc de code tant qu'une condition est vraie" 
      },
      { 
        recto: "Qu'est-ce qu'un tableau (array) ?", 
        verso: "Une structure de données qui stocke plusieurs valeurs dans une seule variable" 
      },
      { 
        recto: "Qu'est-ce qu'un objet ?", 
        verso: "Une structure de données qui regroupe des propriétés et des méthodes liées" 
      },
    ],
  },
  {
    id: "history-dates",
    name: "Dates historiques importantes",
    description: "Les grandes dates de l'histoire de France",
    category: "Histoire",
    cards: [
      { recto: "1789", verso: "Révolution française" },
      { recto: "1804", verso: "Napoléon empereur" },
      { recto: "1914-1918", verso: "Première Guerre mondiale" },
      { recto: "1939-1945", verso: "Seconde Guerre mondiale" },
      { recto: "1958", verso: "Début de la Ve République" },
      { recto: "1989", verso: "Chute du mur de Berlin" },
    ],
  },
];
