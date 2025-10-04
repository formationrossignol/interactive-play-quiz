import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Trash2, Save, ChevronUp, ChevronDown, Upload, HelpCircle, Zap, User } from "lucide-react";
import { QuestionBank } from "./QuestionBank";
import { PollTemplateSelector } from "./PollTemplateSelector";
import { getCurrentUser } from "@/lib/auth";
import { saveQuiz } from "@/lib/quizStorage";
import { toast } from "sonner";
import { getQuestionTypeLabel, getQuestionTypeDescription } from "@/lib/questionTypes";
import type { QuizQuestionType, PollQuestionType } from "@/lib/questionTypes";
import type { PollTemplate } from "@/lib/pollTemplates";

export const QuizBuilder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const quizType = (searchParams.get('type') || 'quiz') as 'quiz' | 'poll';
  const user = getCurrentUser();
  
  const isPoll = quizType === 'poll';

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<any>(getDefaultQuestion());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [speedBonus, setSpeedBonus] = useState(true);
  const [transitionTime, setTransitionTime] = useState(5);
  const [category, setCategory] = useState("Autre");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [headerImage, setHeaderImage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showQuestionBank, setShowQuestionBank] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
    }
  }, [user, navigate]);

  function getDefaultQuestion(type?: QuizQuestionType | PollQuestionType): any {
    if (isPoll) {
      const pollType = type || 'single-choice';
      
      const base = {
        type: pollType,
        question: '',
      };

      switch (pollType) {
        case 'single-choice':
        case 'multiple-choice':
          return { ...base, answers: ['', '', '', ''], allowMultiple: pollType === 'multiple-choice' };
        case 'likert-scale':
          return { ...base, scale: ["Tout à fait d'accord", "D'accord", "Neutre", "Pas d'accord", "Pas du tout d'accord"] };
        case 'frequency-scale':
          return { ...base, scale: ["Jamais", "Rarement", "Parfois", "Souvent", "Toujours"] };
        case 'star-rating':
          return { ...base, maxStars: 5 };
        case 'ranking':
          return { ...base, items: ['', '', '', ''] };
        case 'open-text':
          return { ...base, maxLength: 500 };
        default:
          return { ...base, answers: ['', '', '', ''] };
      }
    } else {
      const quizType = type || 'multiple-choice';
      
      const base = {
        type: quizType,
        question: '',
        timeLimit: 30,
        points: 100,
      };

      switch (quizType) {
        case 'multiple-choice':
          return { ...base, answers: ['', '', '', ''], correctAnswer: 0 };
        case 'true-false':
          return { ...base, answers: ['Vrai', 'Faux'], correctAnswer: 'true' };
        case 'short-answer':
          return { ...base, correctAnswer: '', acceptableAnswers: [] };
        case 'ranking':
          return { ...base, items: ['', '', '', ''], correctOrder: [0, 1, 2, 3] };
        case 'matching':
          return {
            ...base,
            leftColumn: [{ id: '1', text: '' }, { id: '2', text: '' }],
            rightColumn: [{ id: 'a', text: '' }, { id: 'b', text: '' }],
            correctMatches: [{ leftId: '1', rightId: 'a' }, { leftId: '2', rightId: 'b' }]
          };
        case 'fill-blank':
          return { ...base, text: '', blanks: [{ id: '1', correctAnswer: '', acceptableAnswers: [] }] };
        default:
          return { ...base, answers: ['', '', '', ''], correctAnswer: 0 };
      }
    }
  }

  const getAvailableQuestionTypes = (): (QuizQuestionType | PollQuestionType)[] => {
    if (isPoll) {
      return ['single-choice', 'multiple-choice', 'likert-scale', 'frequency-scale', 'star-rating', 'ranking', 'open-text'];
    }
    return ['multiple-choice', 'true-false', 'short-answer', 'ranking', 'matching', 'fill-blank'];
  };

  const handleAddQuestion = () => {
    if (!currentQuestion.question?.trim()) {
      toast.error("Veuillez saisir une question");
      return;
    }

    const newQuestion = {
      id: Date.now().toString(),
      ...currentQuestion,
    };

    if (editingIndex !== null) {
      const updated = [...questions];
      updated[editingIndex] = newQuestion;
      setQuestions(updated);
      setEditingIndex(null);
      toast.success("Question modifiée");
    } else {
      setQuestions([...questions, newQuestion]);
      toast.success("Question ajoutée");
    }

    setCurrentQuestion(getDefaultQuestion());
  };

  const handleEditQuestion = (index: number) => {
    setCurrentQuestion(questions[index]);
    setEditingIndex(index);
  };

  const handleDeleteQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
    toast.success("Question supprimée");
  };

  const handleSelectFromBank = (question: any) => {
    setQuestions([...questions, { ...question, id: Date.now().toString() }]);
    toast.success("Question ajoutée depuis la banque");
  };

  const handleSelectTemplate = (template: PollTemplate) => {
    if (selectedTemplate === template.id) {
      setSelectedTemplate(null);
      return;
    }

    setSelectedTemplate(template.id);
    setTitle(template.name);
    setDescription(template.description);
    setCategory(template.category);
    
    const templateQuestions = template.questions.map((q, index) => ({
      id: Date.now().toString() + index,
      ...q
    }));
    
    setQuestions(templateQuestions);
    toast.success(`Template "${template.name}" chargé`);
  };

  const handleSaveQuiz = () => {
    if (!title.trim()) {
      toast.error("Veuillez saisir un titre");
      return;
    }

    if (questions.length === 0) {
      toast.error("Veuillez ajouter au moins une question");
      return;
    }

    try {
      const saved = saveQuiz({
        title,
        description,
        questions,
        isPublic,
        isFavorite: false,
        tags,
        speedBonus: isPoll ? false : speedBonus,
        transitionTime,
        category,
        type: quizType,
        headerImage,
      });

      toast.success(`${isPoll ? 'Sondage' : 'Quiz'} enregistré avec succès`);
      navigate(isPoll ? '/my-polls' : '/my-quizzes');
    } catch (error) {
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setHeaderImage(reader.result as string);
        toast.success("Image ajoutée");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Navigation */}
      <nav className="p-6 border-b border-white/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate('/')}
          >
            <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">QuizMaster</h1>
            <div className="h-6 w-px bg-white/20" />
            <div>
              <h1 className="text-2xl font-bold text-white">{isPoll ? 'Sondage Builder' : 'Quiz Builder'}</h1>
              <p className="text-white/60 text-sm">{isPoll ? 'Créez votre sondage' : 'Créez votre quiz'}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {user && (
              <Button 
                variant="outline" 
                onClick={() => navigate('/profile')}
                className="flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">{user.username}</span>
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">
        <div className="space-y-6">
          {/* Templates (only for polls) */}
          {isPoll && (
            <PollTemplateSelector
              selectedTemplateId={selectedTemplate}
              onSelectTemplate={handleSelectTemplate}
            />
          )}

          {/* Quiz/Poll Settings */}
          <Card className="bg-white/10 backdrop-blur-lg border-white/20">
            <CardHeader>
              <CardTitle className="text-white">Paramètres</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-white">Titre du {isPoll ? 'sondage' : 'quiz'}</Label>
                  <Input
                    placeholder={isPoll ? "Mon sondage" : "Mon super quiz"}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                  />
                </div>
                <div>
                  <Label className="text-white">Catégorie</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Culture Générale">Culture Générale</SelectItem>
                      <SelectItem value="Science">Science</SelectItem>
                      <SelectItem value="Histoire">Histoire</SelectItem>
                      <SelectItem value="Géographie">Géographie</SelectItem>
                      <SelectItem value="Sport">Sport</SelectItem>
                      <SelectItem value="Divertissement">Divertissement</SelectItem>
                      <SelectItem value="Technologie">Technologie</SelectItem>
                      <SelectItem value="Arts">Arts</SelectItem>
                      <SelectItem value="Autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-white">Description</Label>
                <Textarea
                  placeholder="Décrivez votre quiz ou sondage..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                />
              </div>

              <div>
                <Label className="text-white">Image d'en-tête</Label>
                {headerImage && (
                  <div className="relative w-full h-48 rounded-lg overflow-hidden mt-2 mb-2">
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

              <div>
                <Label className="text-white">Tags</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Ajouter un tag..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                  />
                  <Button variant="outline" onClick={handleAddTag}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="cursor-pointer bg-white/20"
                      onClick={() => setTags(tags.filter(t => t !== tag))}
                    >
                      {tag} ×
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Label className="text-white">Public</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="text-white/60 hover:text-white">
                            <HelpCircle className="w-4 h-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">Rendre le {isPoll ? 'sondage' : 'quiz'} visible dans la section "Découvrir"</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                </div>
                {!isPoll && (
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Label className="text-white">Bonus de vitesse</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button className="text-white/60 hover:text-white">
                              <HelpCircle className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Les joueurs gagnent des points bonus en répondant rapidement aux questions</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Switch checked={speedBonus} onCheckedChange={setSpeedBonus} />
                  </div>
                )}
                {!isPoll && (
                  <div>
                    <Label className="text-white">Temps de transition (secondes)</Label>
                    <Input
                      type="number"
                      min="3"
                      max="10"
                      value={transitionTime}
                      onChange={(e) => setTransitionTime(parseInt(e.target.value) || 5)}
                      className="bg-white/10 border-white/20 text-white"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Question Editor */}
          <Card className="bg-white/10 backdrop-blur-lg border-white/20">
            <CardHeader>
              <CardTitle className="text-white">
                {editingIndex !== null ? 'Modifier la question' : 'Ajouter une question'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-white mb-4 block">Type de question</Label>
                <Select
                  value={currentQuestion.type}
                  onValueChange={(value) => {
                    setCurrentQuestion(getDefaultQuestion(value as any));
                  }}
                >
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableQuestionTypes().map((type) => (
                      <SelectItem key={type} value={type}>
                        <div className="flex flex-col">
                          <span>{getQuestionTypeLabel(type)}</span>
                          <span className="text-xs text-muted-foreground">{getQuestionTypeDescription(type)}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-white">Question</Label>
                <Input
                  placeholder="Votre question..."
                  value={currentQuestion.question || ''}
                  onChange={(e) => setCurrentQuestion({ ...currentQuestion, question: e.target.value })}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                />
              </div>

              {/* Question type specific fields */}
              {(currentQuestion.type === 'multiple-choice' || currentQuestion.type === 'single-choice') && (
                <div className="space-y-3">
                  <Label className="text-white">Réponses</Label>
                  {currentQuestion.answers?.map((answer: string, idx: number) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        placeholder={`Réponse ${idx + 1}`}
                        value={answer}
                        onChange={(e) => {
                          const newAnswers = [...currentQuestion.answers];
                          newAnswers[idx] = e.target.value;
                          setCurrentQuestion({ ...currentQuestion, answers: newAnswers });
                        }}
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                      />
                      {!isPoll && (
                        <Button
                          variant={currentQuestion.correctAnswer === idx ? 'default' : 'outline'}
                          onClick={() => setCurrentQuestion({ ...currentQuestion, correctAnswer: idx })}
                        >
                          {currentQuestion.correctAnswer === idx ? '✓' : '○'}
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() => setCurrentQuestion({
                      ...currentQuestion,
                      answers: [...(currentQuestion.answers || []), '']
                    })}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter une réponse
                  </Button>
                </div>
              )}

              {currentQuestion.type === 'likert-scale' && (
                <div>
                  <Label className="text-white">Échelle</Label>
                  <div className="space-y-2 mt-2">
                    {currentQuestion.scale?.map((item: string, idx: number) => (
                      <Input
                        key={idx}
                        value={item}
                        onChange={(e) => {
                          const newScale = [...currentQuestion.scale];
                          newScale[idx] = e.target.value;
                          setCurrentQuestion({ ...currentQuestion, scale: newScale });
                        }}
                        className="bg-white/10 border-white/20 text-white"
                      />
                    ))}
                  </div>
                </div>
              )}

              {currentQuestion.type === 'frequency-scale' && (
                <div>
                  <Label className="text-white">Échelle de fréquence</Label>
                  <div className="space-y-2 mt-2">
                    {currentQuestion.scale?.map((item: string, idx: number) => (
                      <Input
                        key={idx}
                        value={item}
                        onChange={(e) => {
                          const newScale = [...currentQuestion.scale];
                          newScale[idx] = e.target.value;
                          setCurrentQuestion({ ...currentQuestion, scale: newScale });
                        }}
                        className="bg-white/10 border-white/20 text-white"
                      />
                    ))}
                  </div>
                </div>
              )}

              {currentQuestion.type === 'star-rating' && (
                <div>
                  <Label className="text-white">Nombre d'étoiles</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={currentQuestion.maxStars || 5}
                    onChange={(e) => setCurrentQuestion({ ...currentQuestion, maxStars: parseInt(e.target.value) || 5 })}
                    className="bg-white/10 border-white/20 text-white"
                  />
                </div>
              )}

              {currentQuestion.type === 'open-text' && (
                <div>
                  <Label className="text-white">Longueur maximale</Label>
                  <Input
                    type="number"
                    value={currentQuestion.maxLength || 500}
                    onChange={(e) => setCurrentQuestion({ ...currentQuestion, maxLength: parseInt(e.target.value) || 500 })}
                    className="bg-white/10 border-white/20 text-white"
                  />
                </div>
              )}

              {currentQuestion.type === 'ranking' && (
                <div className="space-y-3">
                  <Label className="text-white">Éléments à classer</Label>
                  {currentQuestion.items?.map((item: string, idx: number) => (
                    <Input
                      key={idx}
                      placeholder={`Élément ${idx + 1}`}
                      value={item}
                      onChange={(e) => {
                        const newItems = [...currentQuestion.items];
                        newItems[idx] = e.target.value;
                        setCurrentQuestion({ ...currentQuestion, items: newItems });
                      }}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                    />
                  ))}
                  <Button
                    variant="outline"
                    onClick={() => setCurrentQuestion({
                      ...currentQuestion,
                      items: [...(currentQuestion.items || []), '']
                    })}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter un élément
                  </Button>
                </div>
              )}

              {/* Time and Points (only for quiz) */}
              {!isPoll && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white">Temps (secondes)</Label>
                    <Input
                      type="number"
                      value={currentQuestion.timeLimit}
                      onChange={(e) =>
                        setCurrentQuestion({ ...currentQuestion, timeLimit: parseInt(e.target.value) || 30 })
                      }
                      className="bg-white/10 border-white/20 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Points</Label>
                    <Input
                      type="number"
                      value={currentQuestion.points}
                      onChange={(e) =>
                        setCurrentQuestion({ ...currentQuestion, points: parseInt(e.target.value) || 100 })
                      }
                      className="bg-white/10 border-white/20 text-white"
                    />
                  </div>
                </div>
              )}

              <Button onClick={handleAddQuestion} variant="hero" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                {editingIndex !== null ? 'Modifier la question' : 'Ajouter la question'}
              </Button>
            </CardContent>
          </Card>

          {/* Questions List */}
          {questions.length > 0 && (
            <Card className="bg-white/10 backdrop-blur-lg border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Questions ({questions.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {questions.map((question, index) => (
                    <div key={question.id} className="flex items-center gap-3 p-4 bg-white/5 rounded-lg">
                      <div className="flex-1">
                        <p className="text-white font-medium">{index + 1}. {question.question}</p>
                        <p className="text-white/60 text-sm">{getQuestionTypeLabel(question.type)}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEditQuestion(index)}>
                          Modifier
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteQuestion(index)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Question Bank (only for quiz) */}
          {!isPoll && (
            <Card className="bg-white/10 backdrop-blur-lg border-white/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">Banque de Questions</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowQuestionBank(!showQuestionBank)}
                  >
                    {showQuestionBank ? <ChevronUp /> : <ChevronDown />}
                  </Button>
                </div>
              </CardHeader>
              {showQuestionBank && (
                <CardContent>
                  <QuestionBank onSelectQuestion={handleSelectFromBank} />
                </CardContent>
              )}
            </Card>
          )}

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSaveQuiz}
              disabled={!title || questions.length === 0}
              variant="hero"
              size="lg"
              className="text-lg"
            >
              <Save className="w-5 h-5 mr-2" />
              Enregistrer le {isPoll ? 'Sondage' : 'Quiz'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
