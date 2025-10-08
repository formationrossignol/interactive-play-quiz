export type Language = 'en' | 'fr';

export const translations = {
  en: {
    // Navigation & Common
    quizMaster: "QuizMaster",
    quizBuilder: "Quiz Builder",
    pollBuilder: "Poll Builder",
    myQuizzes: "My Quizzes",
    myPolls: "My Polls",
    profile: "Profile",
    logout: "Logout",
    login: "Login",
    back: "Back",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    home: "Home",
    
    // Hero Section
    heroTitle: "Create",
    heroInteractive: "Interactive",
    heroQuizzes: "Quizzes",
    heroDescription: "Engage your audience with real-time multiplayer quizzes featuring QR code joining, live leaderboards, multiple question types, and beautiful animations.",
    
    // Create Section
    createQuiz: "Create a Quiz",
    createQuizDesc: "Design engaging quizzes with multiple question types and speed bonuses",
    newQuiz: "New Quiz",
    createPoll: "Create a Poll",
    createPollDesc: "Create surveys to gather feedback and opinions",
    newPoll: "New Poll",
    
    // Join Section
    joinTitle: "Join a Quiz or Poll",
    joinDesc: "Enter the game code to participate",
    enterCode: "Enter game code",
    join: "Join",
    
    // Discover
    discover: "Discover",
    discoverPublic: "Discover Public Quizzes",
    
    // Quiz Builder
    settings: "Settings",
    quizTitle: "Quiz Title",
    pollTitle: "Poll Title",
    myQuiz: "My awesome quiz",
    myPoll: "My poll",
    category: "Category",
    description: "Description",
    descriptionPlaceholder: "Describe your quiz or poll...",
    headerImage: "Header Image",
    changeImage: "Change image",
    addImage: "Add image",
    tags: "Tags",
    addTag: "Add a tag...",
    public: "Public",
    publicTooltip: "Make the quiz/poll visible in the Discover section",
    speedBonus: "Speed Bonus",
    speedBonusTooltip: "Players earn bonus points by answering questions quickly",
    transitionTime: "Transition Time (seconds)",
    
    // Question Types
    questionType: "Question Type",
    question: "Question",
    yourQuestion: "Your question...",
    questionPlaceholder: "Enter your question here...",
    answers: "Answers",
    answer: "Answer",
    addAnswer: "Add answer",
    addItem: "Add item",
    timeSeconds: "Time (seconds)",
    timeLimit: "Time Limit",
    points: "Points",
    correctAnswer: "Correct Answer",
    addQuestion: "Add question",
    editQuestion: "Edit question",
    updateQuestion: "Update Question",
    questions: "Questions",
    noQuestions: "No questions yet",
    content: "Content",
    true: "True",
    false: "False",
    createQuizFromTemplateDesc: "Start with a pre-designed template",
    
    // Question Type Labels
    multipleChoice: "Multiple Choice",
    trueFalse: "True/False",
    shortAnswer: "Short Answer",
    ranking: "Ranking",
    matching: "Matching",
    fillBlank: "Fill in the Blank",
    singleChoice: "Single Choice",
    likertScale: "Likert Scale",
    frequencyScale: "Frequency Scale",
    starRating: "Star Rating",
    openText: "Open Text",
    
    // Templates
    pollTemplates: "Poll Templates",
    pollTemplatesDesc: "Start quickly with a pre-filled template",
    
    // Question Bank
    questionBank: "Question Bank",
    
    // Profile
    myProfile: "My Profile",
    manageInfo: "Manage your personal information",
    quizzesCreated: "Quizzes Created",
    publicQuizzes: "Public Quizzes",
    profileInfo: "Profile Information",
    username: "Username",
    email: "Email",
    emailReadonly: "Email cannot be changed",
    saveChanges: "Save changes",
    accountActions: "Account Actions",
    preferences: "Preferences",
    theme: "Theme",
    lightMode: "Light",
    darkMode: "Dark",
    language: "Language",
    
    // Categories
    generalCulture: "General Culture",
    science: "Science",
    history: "History",
    geography: "Geography",
    sports: "Sports",
    entertainment: "Entertainment",
    technology: "Technology",
    arts: "Arts",
    other: "Other",
    
    // Messages
    questionAdded: "Question added",
    questionEdited: "Question edited",
    questionDeleted: "Question deleted",
    quizSaved: "Quiz saved successfully",
    pollSaved: "Poll saved successfully",
    profileUpdated: "Profile updated successfully",
    imageAdded: "Image added",
    templateLoaded: "Template loaded",
    usernameRequired: "Username cannot be empty",
    titleRequired: "Please enter a title",
    questionRequired: "Please enter a question",
    oneQuestionRequired: "Please add at least one question",
    
    // Poll Templates
    trainingFeedback: "Training/Workshop Feedback",
    teamEngagement: "Team Engagement / Work Climate",
    projectPrep: "Project Preparation / Needs Assessment",
    productFeedback: "Product/Service Feedback",
    icebreaker: "Icebreaker / Fun Poll",
    pulseSurvey: "Continuous Evaluation (Pulse Survey)",
    
    // QuizBuilderStart
    createNewPoll: "Create a New Poll",
    createNewQuiz: "Create a New Quiz",
    choosePollStart: "Choose how you want to start your poll",
    chooseQuizStart: "Choose how you want to start your quiz",
    fromScratch: "From Scratch",
    createPollFromScratchDesc: "Start with a blank canvas and build your own custom poll",
    createQuizFromScratchDesc: "Start with a blank canvas and build your own custom quiz",
    startFromScratch: "Start from Scratch",
    fromTemplate: "From Template",
    createPollFromTemplateDesc: "Choose from pre-made templates to get started quickly",
    browseTemplates: "Browse Templates",
    
    // QuizPreview
    livePreview: "Live Preview",
    untitled: "Untitled",
    noDescription: "No description",
    noQuestionText: "No question text",
    noQuestionsYet: "No questions added yet",
  },
  fr: {
    // Navigation & Common
    quizMaster: "QuizMaster",
    quizBuilder: "Quiz Builder",
    pollBuilder: "Sondage Builder",
    myQuizzes: "Mes Quiz",
    myPolls: "Mes Sondages",
    profile: "Profil",
    logout: "Déconnexion",
    login: "Connexion",
    back: "Retour",
    save: "Enregistrer",
    cancel: "Annuler",
    delete: "Supprimer",
    edit: "Modifier",
    home: "Accueil",
    
    // Hero Section
    heroTitle: "Créez des",
    heroInteractive: "Quiz Interactifs",
    heroQuizzes: "",
    heroDescription: "Engagez votre audience avec des quiz multijoueurs en temps réel : QR code, classements en direct, types de questions variés et animations superbes.",
    
    // Create Section
    createQuiz: "Créer un Quiz",
    createQuizDesc: "Concevez des quiz engageants avec plusieurs types de questions et bonus de vitesse",
    newQuiz: "Nouveau Quiz",
    createPoll: "Créer un Sondage",
    createPollDesc: "Créez des sondages pour recueillir des avis et opinions",
    newPoll: "Nouveau Sondage",
    
    // Join Section
    joinTitle: "Rejoindre un Quiz ou Sondage",
    joinDesc: "Entrez le code pour participer",
    enterCode: "Entrez le code",
    join: "Rejoindre",
    
    // Discover
    discover: "Découvrir",
    discoverPublic: "Découvrir les Quiz Publics",
    
    // Quiz Builder
    settings: "Paramètres",
    quizTitle: "Titre du quiz",
    pollTitle: "Titre du sondage",
    myQuiz: "Mon super quiz",
    myPoll: "Mon sondage",
    category: "Catégorie",
    description: "Description",
    descriptionPlaceholder: "Décrivez votre quiz ou sondage...",
    headerImage: "Image d'en-tête",
    changeImage: "Changer l'image",
    addImage: "Ajouter une image",
    tags: "Tags",
    addTag: "Ajouter un tag...",
    public: "Public",
    publicTooltip: "Rendre le quiz/sondage visible dans la section Découvrir",
    speedBonus: "Bonus de vitesse",
    speedBonusTooltip: "Les joueurs gagnent des points bonus en répondant rapidement aux questions",
    transitionTime: "Temps de transition (secondes)",
    
    // Question Types
    questionType: "Type de question",
    question: "Question",
    yourQuestion: "Votre question...",
    questionPlaceholder: "Saisissez votre question ici...",
    answers: "Réponses",
    answer: "Réponse",
    addAnswer: "Ajouter une réponse",
    addItem: "Ajouter un élément",
    timeSeconds: "Temps (secondes)",
    timeLimit: "Temps imparti",
    points: "Points",
    correctAnswer: "Réponse correcte",
    addQuestion: "Ajouter la question",
    editQuestion: "Modifier la question",
    updateQuestion: "Mettre à jour la question",
    questions: "Questions",
    noQuestions: "Aucune question",
    content: "Contenu",
    true: "Vrai",
    false: "Faux",
    createQuizFromTemplateDesc: "Commencer avec un modèle pré-conçu",
    
    // Question Type Labels
    multipleChoice: "Choix multiple",
    trueFalse: "Vrai/Faux",
    shortAnswer: "Réponse courte",
    ranking: "Classement",
    matching: "Association",
    fillBlank: "Remplir les blancs",
    singleChoice: "Choix unique",
    likertScale: "Échelle de Likert",
    frequencyScale: "Échelle de fréquence",
    starRating: "Évaluation par étoiles",
    openText: "Texte libre",
    
    // Templates
    pollTemplates: "Templates de Sondages",
    pollTemplatesDesc: "Démarrez rapidement avec un modèle pré-rempli",
    
    // Question Bank
    questionBank: "Banque de Questions",
    
    // Profile
    myProfile: "Mon Profil",
    manageInfo: "Gérez vos informations personnelles",
    quizzesCreated: "Quiz Créés",
    publicQuizzes: "Quiz Publics",
    profileInfo: "Informations du Profil",
    username: "Nom d'utilisateur",
    email: "Email",
    emailReadonly: "L'email ne peut pas être modifié",
    saveChanges: "Enregistrer les modifications",
    accountActions: "Actions du compte",
    preferences: "Préférences",
    theme: "Thème",
    lightMode: "Clair",
    darkMode: "Sombre",
    language: "Langue",
    
    // Categories
    generalCulture: "Culture Générale",
    science: "Science",
    history: "Histoire",
    geography: "Géographie",
    sports: "Sport",
    entertainment: "Divertissement",
    technology: "Technologie",
    arts: "Arts",
    other: "Autre",
    
    // Messages
    questionAdded: "Question ajoutée",
    questionEdited: "Question modifiée",
    questionDeleted: "Question supprimée",
    quizSaved: "Quiz enregistré avec succès",
    pollSaved: "Sondage enregistré avec succès",
    profileUpdated: "Profil mis à jour avec succès",
    imageAdded: "Image ajoutée",
    templateLoaded: "Template chargé",
    usernameRequired: "Le nom d'utilisateur ne peut pas être vide",
    titleRequired: "Veuillez saisir un titre",
    questionRequired: "Veuillez saisir une question",
    oneQuestionRequired: "Veuillez ajouter au moins une question",
    
    // Poll Templates
    trainingFeedback: "Satisfaction formation / atelier",
    teamEngagement: "Engagement d'équipe / climat de travail",
    projectPrep: "Préparation d'un projet / recueil de besoins",
    productFeedback: "Feedback produit / service",
    icebreaker: "Icebreaker / sondage ludique",
    pulseSurvey: "Évaluation continue (pulse survey)",
    
    // QuizBuilderStart
    createNewPoll: "Créer un Nouveau Sondage",
    createNewQuiz: "Créer un Nouveau Quiz",
    choosePollStart: "Choisissez comment vous souhaitez commencer votre sondage",
    chooseQuizStart: "Choisissez comment vous souhaitez commencer votre quiz",
    fromScratch: "Depuis zéro",
    createPollFromScratchDesc: "Commencez avec une page blanche et créez votre propre sondage",
    createQuizFromScratchDesc: "Commencez avec une page blanche et créez votre propre quiz",
    startFromScratch: "Commencer depuis zéro",
    fromTemplate: "Depuis un template",
    createPollFromTemplateDesc: "Choisissez parmi des modèles pré-faits pour démarrer rapidement",
    browseTemplates: "Parcourir les templates",
    
    // QuizPreview
    livePreview: "Aperçu en direct",
    untitled: "Sans titre",
    noDescription: "Aucune description",
    noQuestionText: "Aucun texte de question",
    noQuestionsYet: "Aucune question ajoutée",
  }
};

const LANGUAGE_STORAGE_KEY = 'quiz_language';

export const getLanguage = (): Language => {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return (stored as Language) || 'en';
};

export const setLanguage = (language: Language) => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
};

export const t = (key: keyof typeof translations.en): string => {
  const language = getLanguage();
  return translations[language][key] || translations.en[key] || key;
};
