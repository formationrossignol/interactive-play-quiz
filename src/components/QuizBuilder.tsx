import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Trash2, Clock, Users, Play, Save, BookMarked, Star, Globe, HelpCircle, Upload, Image } from "lucide-react";
import { QuestionBank, SavedQuestion } from "./QuestionBank";
import { QRCodeGenerator } from "./QRCodeGenerator";
import { getCurrentUser } from "@/lib/auth";
import { saveQuiz } from "@/lib/quizStorage";
import { toast } from "sonner";
import { getQuestionTypeLabel } from "@/lib/questionTypes";
import type { QuizQuestionType, PollQuestionType } from "@/lib/questionTypes";

interface Question {
  id: string;
  type: QuizQuestionType | PollQuestionType;
  question: string;
  answers: string[];
  correctAnswer?: number | string;
  timeLimit?: number;
  points?: number;
  scale?: string[];
  maxStars?: number;
  leftColumn?: { id: string; text: string }[];
  rightColumn?: { id: string; text: string }[];
  correctMatches?: { leftId: string; rightId: string }[];
  text?: string;
  blanks?: { id: string; correctAnswer: string }[];
  maxLength?: number;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  settings: {
    showLeaderboard: boolean;
    timePerQuestion: number;
    showAnswersAfterEach: boolean;
  };
}

export const QuizBuilder = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [searchParams] = useSearchParams();
  
  useEffect(() => {
    if (!user) {
      navigate("/auth");
    }
  }, [user, navigate]);

  const initialType = (searchParams.get('type') as 'quiz' | 'poll') || 'quiz';
  
  const [quiz, setQuiz] = useState<Quiz>({
    id: '',
    title: '',
    description: '',
    questions: [],
    settings: {
      showLeaderboard: true,
      timePerQuestion: 30,
      showAnswersAfterEach: true
    }
  });
  
  const [isPublic, setIsPublic] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [speedBonus, setSpeedBonus] = useState(true);
  const [transitionTime, setTransitionTime] = useState(5);
  const [category, setCategory] = useState('Autre');
  const [quizType, setQuizType] = useState<'quiz' | 'poll'>(initialType);
  const [headerImage, setHeaderImage] = useState<string>('');

  const getDefaultQuestion = (): Partial<Question> => {
    if (quizType === 'poll') {
      return {
        type: 'single-choice' as PollQuestionType,
        question: '',
        answers: ['', '', '', ''],
        timeLimit: 30,
      };
    }
    return {
      type: 'multiple-choice' as QuizQuestionType,
      question: '',
      answers: ['', '', '', ''],
      correctAnswer: 0,
      timeLimit: 30,
      points: 100
    };
  };

  const [currentQuestion, setCurrentQuestion] = useState<Partial<Question>>(getDefaultQuestion());

  const [gameCode, setGameCode] = useState<string>('');
  const [showQRCode, setShowQRCode] = useState(false);
  const [showQuestionBank, setShowQuestionBank] = useState(false);

  const generateGameCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const addQuestion = () => {
    if (currentQuestion.question && currentQuestion.answers?.some(a => a.trim())) {
      const newQuestion: Question = {
        id: Date.now().toString(),
        ...currentQuestion as Question
      };
      
      setQuiz(prev => ({
        ...prev,
        questions: [...prev.questions, newQuestion]
      }));

      // Save to question bank
      const savedQuestion: SavedQuestion = {
        ...newQuestion,
        createdAt: new Date().toISOString()
      };
      const bank = JSON.parse(localStorage.getItem('questionBank') || '[]');
      bank.push(savedQuestion);
      localStorage.setItem('questionBank', JSON.stringify(bank));

      // Reset form
      setCurrentQuestion(getDefaultQuestion());
      
      toast.success("Question ajoutée");
    }
  };

  const addQuestionFromBank = (question: SavedQuestion) => {
    const newQuestion: Question = {
      id: Date.now().toString(),
      type: question.type,
      question: question.question,
      answers: question.answers,
      correctAnswer: question.correctAnswer,
      timeLimit: question.timeLimit,
      points: question.points
    };

    setQuiz(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion]
    }));

    toast.success("Question ajoutée depuis la banque");
  };

  const saveDraft = () => {
    if (!quiz.title) {
      toast.error("Veuillez entrer un titre pour le quiz");
      return;
    }
    localStorage.setItem('quizDraft', JSON.stringify(quiz));
    toast.success("Brouillon sauvegardé");
  };

  const startQuiz = () => {
    if (!quiz.title || quiz.questions.length === 0) {
      toast.error("Veuillez ajouter un titre et au moins une question");
      return;
    }
    
    if (!user) {
      toast.error("Vous devez être connecté");
      navigate("/auth");
      return;
    }

    const code = generateGameCode();
    setGameCode(code);
    
    // Save quiz to storage
    const quizWithId = { ...quiz, id: code };
    localStorage.setItem(`quiz-${code}`, JSON.stringify(quizWithId));
    
    // Save to user's quizzes
    try {
      saveQuiz({
        title: quiz.title,
        description: quiz.description,
        questions: quiz.questions,
        isPublic,
        isFavorite,
        tags,
        speedBonus,
        transitionTime,
        category,
        type: quizType,
        headerImage
      });
    } catch (error) {
      console.error("Error saving quiz:", error);
    }
    
    setShowQRCode(true);
    toast.success(`Quiz créé avec le code: ${code}`);
  };

  const goToQuiz = () => {
    navigate(`/quiz/${gameCode}`);
  };

  const removeQuestion = (questionId: string) => {
    setQuiz(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== questionId)
    }));
  };

  const getQuestionTypeColor = (type: Question['type']) => {
    const colors: Record<string, string> = {
      'multiple-choice': 'bg-gradient-primary',
      'single-choice': 'bg-gradient-primary',
      'true-false': 'bg-gradient-secondary',
      'short-answer': 'bg-gradient-success',
      'ranking': 'bg-warning',
      'matching': 'bg-purple-500',
      'fill-blank': 'bg-blue-500',
      'drag-drop': 'bg-green-500',
      'hotspot': 'bg-red-500',
      'likert-scale': 'bg-indigo-500',
      'frequency-scale': 'bg-teal-500',
      'star-rating': 'bg-yellow-500',
      'open-text': 'bg-gray-500',
    };
    return colors[type] || 'bg-gradient-primary';
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setHeaderImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getAvailableQuestionTypes = (): (QuizQuestionType | PollQuestionType)[] => {
    if (quizType === 'poll') {
      return ['single-choice', 'multiple-choice', 'likert-scale', 'frequency-scale', 'star-rating', 'ranking', 'open-text'];
    }
    return ['multiple-choice', 'true-false', 'short-answer', 'ranking', 'matching', 'fill-blank'];
  };

  if (showQRCode && gameCode) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">Quiz Créé!</h1>
            <p className="text-muted-foreground">Partagez ce code ou ce QR code avec vos participants</p>
          </div>
          
          <QRCodeGenerator 
            gameCode={gameCode}
            joinUrl={`${window.location.origin}/join/${gameCode}`}
          />
          
          <div className="flex gap-3 mt-6">
            <Button variant="outline" size="lg" onClick={() => setShowQRCode(false)} className="flex-1">
              Modifier le Quiz
            </Button>
            <Button variant="hero" size="lg" onClick={goToQuiz} className="flex-1">
              <Play className="w-4 h-4 mr-2" />
              Lancer le Quiz
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Navigation - Same as Index */}
      <nav className="p-6 border-b border-white/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate('/')}
          >
            <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
              <Play className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">QuizMaster</h1>
              <p className="text-white/60 text-sm">Interactive Quiz Platform</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                <Users className="w-4 h-4 text-white" />
                <span className="text-white text-sm">{user.username}</span>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Quiz Builder</h1>
            <p className="text-white/80">Create engaging quizzes with multiple question types</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="lg" onClick={() => setShowQuestionBank(!showQuestionBank)}>
              <BookMarked className="w-4 h-4 mr-2" />
              {showQuestionBank ? 'Masquer' : 'Banque'}
            </Button>
            <Button variant="outline" size="lg" onClick={saveDraft}>
              <Save className="w-4 h-4 mr-2" />
              Sauvegarder
            </Button>
            <Button variant="hero" size="lg" onClick={startQuiz}>
              <Play className="w-4 h-4 mr-2" />
              Créer Quiz
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Question Bank */}
          {showQuestionBank && (
            <div className="lg:col-span-3 mb-6">
              <QuestionBank onSelectQuestion={addQuestionFromBank} />
            </div>
          )}
          {/* Quiz Settings */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Quiz Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="quiz-title">Quiz Title</Label>
                  <Input
                    id="quiz-title"
                    placeholder="Enter quiz title"
                    value={quiz.title}
                    onChange={(e) => setQuiz(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="quiz-description">Description</Label>
                  <Textarea
                    id="quiz-description"
                    placeholder="Brief description of your quiz"
                    value={quiz.description}
                    onChange={(e) => setQuiz(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="header-image">Image d'en-tête</Label>
                  <div className="mt-2 space-y-2">
                    {headerImage && (
                      <div className="relative w-full h-32 rounded-lg overflow-hidden">
                        <img src={headerImage} alt="Header" className="w-full h-full object-cover" />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2 bg-black/50 hover:bg-black/70"
                          onClick={() => setHeaderImage('')}
                        >
                          <Trash2 className="w-4 h-4 text-white" />
                        </Button>
                      </div>
                    )}
                    <label htmlFor="header-image">
                      <Button variant="outline" size="sm" asChild className="w-full">
                        <span>
                          <Upload className="w-4 h-4 mr-2" />
                          {headerImage ? 'Changer l\'image' : 'Ajouter une image'}
                        </span>
                      </Button>
                    </label>
                    <input
                      id="header-image"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="time-per-question">Default Time (seconds)</Label>
                  <Input
                    id="time-per-question"
                    type="number"
                    min="5"
                    max="120"
                    value={quiz.settings.timePerQuestion}
                    onChange={(e) => setQuiz(prev => ({
                      ...prev,
                      settings: { ...prev.settings, timePerQuestion: parseInt(e.target.value) }
                    }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="is-public" className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Quiz Public
                  </Label>
                  <Switch
                    id="is-public"
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="is-favorite" className="flex items-center gap-2">
                    <Star className="w-4 h-4" />
                    Favori
                  </Label>
                  <Switch
                    id="is-favorite"
                    checked={isFavorite}
                    onCheckedChange={setIsFavorite}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="speed-bonus" className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Bonus de vitesse
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="w-4 h-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Plus un joueur répond rapidement, plus il gagne de points. Le bonus est calculé en fonction du temps restant et de la valeur en points de la question.</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Switch
                    id="speed-bonus"
                    checked={speedBonus}
                    onCheckedChange={setSpeedBonus}
                  />
                </div>
                <div>
                  <Label htmlFor="transition-time">Temps de transition (secondes)</Label>
                  <Input
                    id="transition-time"
                    type="number"
                    min="3"
                    max="10"
                    value={transitionTime}
                    onChange={(e) => setTransitionTime(parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="quiz-type">Type</Label>
                  <select
                    id="quiz-type"
                    value={quizType}
                    onChange={(e) => setQuizType(e.target.value as 'quiz' | 'poll')}
                    className="w-full mt-2 bg-background border border-input rounded-md px-3 py-2 text-sm"
                  >
                    <option value="quiz">Quiz</option>
                    <option value="poll">Sondage</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="category">Catégorie</Label>
                  <select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full mt-2 bg-background border border-input rounded-md px-3 py-2 text-sm"
                  >
                    <option value="Culture Générale">Culture Générale</option>
                    <option value="Science">Science</option>
                    <option value="Histoire">Histoire</option>
                    <option value="Géographie">Géographie</option>
                    <option value="Sport">Sport</option>
                    <option value="Divertissement">Divertissement</option>
                    <option value="Technologie">Technologie</option>
                    <option value="Arts">Arts</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="tags">Tags</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="tags"
                      placeholder="Ajouter un tag..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && tagInput.trim()) {
                          e.preventDefault();
                          if (!tags.includes(tagInput.trim())) {
                            setTags([...tags, tagInput.trim()]);
                            setTagInput('');
                          }
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (tagInput.trim() && !tags.includes(tagInput.trim())) {
                          setTags([...tags, tagInput.trim()]);
                          setTagInput('');
                        }
                      }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => setTags(tags.filter(t => t !== tag))}
                      >
                        {tag} ×
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Question List */}
            <Card>
              <CardHeader>
                <CardTitle>Questions ({quiz.questions.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {quiz.questions.map((question, index) => (
                    <div key={question.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${getQuestionTypeColor(question.type)}`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{question.question}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {getQuestionTypeLabel(question.type)}
                          </Badge>
                          <div className="flex items-center text-xs text-muted-foreground">
                            <Clock className="w-3 h-3 mr-1" />
                            {question.timeLimit}s
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeQuestion(question.id)}
                        className="text-danger hover:text-danger"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {quiz.questions.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No questions added yet</p>
                      <p className="text-sm">Create your first question →</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Question Builder */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Plus className="w-5 h-5 mr-2" />
                  Add New Question
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Question Type Selector */}
                <div>
                  <Label>Question Type</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                    {getAvailableQuestionTypes().map((type) => (
                      <Button
                        key={type}
                        variant={currentQuestion.type === type ? "default" : "outline"}
                        className="h-auto p-3 flex flex-col items-center text-xs"
                        onClick={() => setCurrentQuestion(prev => ({ ...prev, type, answers: type === 'multiple-choice' || type === 'single-choice' ? ['', '', '', ''] : [] }))}
                      >
                        <div className={`w-8 h-8 rounded-full mb-2 flex items-center justify-center text-white text-[10px] font-bold ${getQuestionTypeColor(type)}`}>
                          {type.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="text-[10px] text-center leading-tight">{getQuestionTypeLabel(type)}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Question Text */}
                <div>
                  <Label htmlFor="question-text">Question</Label>
                  <Textarea
                    id="question-text"
                    placeholder="Enter your question here..."
                    value={currentQuestion.question}
                    onChange={(e) => setCurrentQuestion(prev => ({ ...prev, question: e.target.value }))}
                    className="mt-2"
                  />
                </div>

                {/* Answer Options */}
                {(currentQuestion.type === 'multiple-choice' || currentQuestion.type === 'single-choice') && (
                  <div>
                    <Label>Answer Options</Label>
                    <div className="space-y-2 mt-2">
                      {currentQuestion.answers?.map((answer, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="correct-answer"
                            checked={currentQuestion.correctAnswer === index}
                            onChange={() => setCurrentQuestion(prev => ({ ...prev, correctAnswer: index }))}
                            className="text-primary"
                          />
                          <Input
                            placeholder={`Option ${index + 1}`}
                            value={answer}
                            onChange={(e) => {
                              const newAnswers = [...(currentQuestion.answers || [])];
                              newAnswers[index] = e.target.value;
                              setCurrentQuestion(prev => ({ ...prev, answers: newAnswers }));
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {currentQuestion.type === 'true-false' && (
                  <div>
                    <Label>Correct Answer</Label>
                    <div className="flex gap-4 mt-2">
                      <Button
                        variant={currentQuestion.correctAnswer === 'true' ? "success" : "outline"}
                        onClick={() => setCurrentQuestion(prev => ({ ...prev, correctAnswer: 'true', answers: ['True', 'False'] }))}
                      >
                        True
                      </Button>
                      <Button
                        variant={currentQuestion.correctAnswer === 'false' ? "success" : "outline"}
                        onClick={() => setCurrentQuestion(prev => ({ ...prev, correctAnswer: 'false', answers: ['True', 'False'] }))}
                      >
                        False
                      </Button>
                    </div>
                  </div>
                )}

                {currentQuestion.type === 'likert-scale' && (
                  <div>
                    <Label>Échelle de Likert</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Échelle par défaut : Tout à fait d'accord → Pas du tout d'accord
                    </p>
                    <Input
                      placeholder="Personnaliser l'échelle (séparée par des virgules)"
                      onChange={(e) => {
                        const scale = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                        setCurrentQuestion(prev => ({ ...prev, scale: scale.length > 0 ? scale : ["Tout à fait d'accord", "D'accord", "Neutre", "Pas d'accord", "Pas du tout d'accord"] }));
                      }}
                    />
                  </div>
                )}

                {currentQuestion.type === 'frequency-scale' && (
                  <div>
                    <Label>Échelle de Fréquence</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Échelle par défaut : Jamais → Toujours
                    </p>
                    <Input
                      placeholder="Personnaliser l'échelle (séparée par des virgules)"
                      onChange={(e) => {
                        const scale = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                        setCurrentQuestion(prev => ({ ...prev, scale: scale.length > 0 ? scale : ["Jamais", "Rarement", "Parfois", "Souvent", "Toujours"] }));
                      }}
                    />
                  </div>
                )}

                {currentQuestion.type === 'star-rating' && (
                  <div>
                    <Label htmlFor="max-stars">Nombre d'étoiles maximum</Label>
                    <Input
                      id="max-stars"
                      type="number"
                      min="3"
                      max="10"
                      value={currentQuestion.maxStars || 5}
                      onChange={(e) => setCurrentQuestion(prev => ({ ...prev, maxStars: parseInt(e.target.value) }))}
                    />
                  </div>
                )}

                {currentQuestion.type === 'open-text' && (
                  <div>
                    <Label htmlFor="max-length">Longueur maximale (optionnel)</Label>
                    <Input
                      id="max-length"
                      type="number"
                      min="10"
                      max="1000"
                      placeholder="Ex: 500"
                      value={currentQuestion.maxLength || ''}
                      onChange={(e) => setCurrentQuestion(prev => ({ ...prev, maxLength: e.target.value ? parseInt(e.target.value) : undefined }))}
                    />
                  </div>
                )}

                {/* Question Settings */}
                {quizType === 'quiz' && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="time-limit">Time Limit (seconds)</Label>
                      <Input
                        id="time-limit"
                        type="number"
                        min="5"
                        max="120"
                        value={currentQuestion.timeLimit || 30}
                        onChange={(e) => setCurrentQuestion(prev => ({ ...prev, timeLimit: parseInt(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="points">Points</Label>
                      <Input
                        id="points"
                        type="number"
                        min="10"
                        max="1000"
                        step="10"
                        value={currentQuestion.points || 100}
                        onChange={(e) => setCurrentQuestion(prev => ({ ...prev, points: parseInt(e.target.value) }))}
                      />
                    </div>
                  </div>
                )}

                {quizType === 'poll' && (
                  <div>
                    <Label htmlFor="time-limit-poll">Temps de réponse (optionnel, en secondes)</Label>
                    <Input
                      id="time-limit-poll"
                      type="number"
                      min="5"
                      max="120"
                      placeholder="Pas de limite"
                      value={currentQuestion.timeLimit || ''}
                      onChange={(e) => setCurrentQuestion(prev => ({ ...prev, timeLimit: e.target.value ? parseInt(e.target.value) : undefined }))}
                    />
                  </div>
                )}

                <Button 
                  onClick={addQuestion}
                  variant="default"
                  size="lg"
                  className="w-full"
                  disabled={!currentQuestion.question || !currentQuestion.answers?.some(a => a.trim())}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Question
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};