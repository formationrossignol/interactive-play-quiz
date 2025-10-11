import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Save, Upload, HelpCircle, GripVertical, Settings, Menu, X, Home, BarChart3, User, LogOut, Zap, Play, Copy } from "lucide-react";
import { QuizPreview } from "./QuizPreview";
import { QuestionTypeSelector } from "./QuestionTypeSelector";
import { getCurrentUser, logout } from "@/lib/auth";
import { saveQuiz, updateQuiz, getQuizById } from "@/lib/quizStorage";
import { getPollTemplate } from "@/lib/pollTemplates";
import { getQuizTemplate } from "@/lib/quizTemplates";
import { THEMES } from "@/lib/themes";
import { toast } from "sonner";
import { getQuestionTypeLabel } from "@/lib/questionTypes";
import { t } from "@/lib/i18n";
import type { QuizQuestionType, PollQuestionType } from "@/lib/questionTypes";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable Question Item Component
const SortableQuestionItem = ({ question, index, onEdit, onDelete, onDuplicate }: any) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-2 p-3 bg-card border rounded-lg hover:shadow-sm transition-shadow"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{index + 1}. {question.question}</p>
        <p className="text-xs text-muted-foreground">{getQuestionTypeLabel(question.type)}</p>
      </div>
      <div className="flex gap-1">
        <Button 
          variant="ghost" 
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onDuplicate(index)}
          title="Dupliquer"
        >
          <Copy className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onEdit(index)}>
          {t('edit')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onDelete(index)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export const QuizBuilder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const quizType = (searchParams.get('type') || 'quiz') as 'quiz' | 'poll';
  const templateId = searchParams.get('templateId');
  const quizId = searchParams.get('quizId');
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
  const [theme, setTheme] = useState("default");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!user) {
      navigate("/auth");
    }
  }, [user, navigate]);

  // Load existing quiz for editing
  useEffect(() => {
    if (quizId) {
      const existingQuiz = getQuizById(quizId);
      if (existingQuiz) {
        setTitle(existingQuiz.title);
        setDescription(existingQuiz.description);
        setCategory(existingQuiz.category);
        setIsPublic(existingQuiz.isPublic);
        setSpeedBonus(existingQuiz.speedBonus);
        setTransitionTime(existingQuiz.transitionTime);
        setTags(existingQuiz.tags || []);
        setHeaderImage(existingQuiz.headerImage || "");
        setTheme(existingQuiz.theme || "default");
        setQuestions(existingQuiz.questions.map((q, index) => ({
          id: q.id || Date.now().toString() + index,
          ...q
        })));
        toast.success("Quiz chargé pour édition");
      }
    }
  }, [quizId]);

  // Load template
  useEffect(() => {
    if (templateId && !quizId) {
      if (isPoll) {
        const template = getPollTemplate(templateId);
        if (template) {
          setTitle(template.name);
          setDescription(template.description);
          setCategory(template.category);
          
          const templateQuestions = template.questions.map((q, index) => ({
            id: Date.now().toString() + index,
            ...q
          }));
          
          setQuestions(templateQuestions);
          toast.success(t('templateLoaded'));
        }
      } else {
        const template = getQuizTemplate(templateId);
        if (template) {
          setTitle(template.name);
          setDescription(template.description);
          setCategory(template.category);
          
          const templateQuestions = template.questions.map((q, index) => ({
            id: Date.now().toString() + index,
            ...q
          }));
          
          setQuestions(templateQuestions);
          toast.success(t('templateLoaded'));
        }
      }
    }
  }, [templateId, isPoll, quizId]);

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
        case 'nps-scale':
          return { ...base, minLabel: "Pas du tout probable", maxLabel: "Extrêmement probable" };
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
        case 'slider':
          return { ...base, min: 0, max: 100, step: 1, correctValue: 50, minLabel: "", maxLabel: "" };
        default:
          return { ...base, answers: ['', '', '', ''], correctAnswer: 0 };
      }
    }
  }

  const getAvailableQuestionTypes = (): (QuizQuestionType | PollQuestionType)[] => {
    if (isPoll) {
      return ['single-choice', 'multiple-choice', 'likert-scale', 'frequency-scale', 'star-rating', 'ranking', 'open-text', 'nps-scale'];
    }
    return ['multiple-choice', 'true-false', 'short-answer', 'ranking', 'matching', 'fill-blank', 'slider'];
  };

  const handleAddQuestion = () => {
    if (!currentQuestion.question?.trim()) {
      toast.error(t('questionRequired'));
      return;
    }

    const newQuestion = {
      id: editingIndex !== null ? questions[editingIndex].id : Date.now().toString(),
      ...currentQuestion,
    };

    if (editingIndex !== null) {
      const updated = [...questions];
      updated[editingIndex] = newQuestion;
      setQuestions(updated);
      setEditingIndex(null);
      toast.success(t('questionEdited'));
    } else {
      setQuestions([...questions, newQuestion]);
      toast.success(t('questionAdded'));
    }

    setCurrentQuestion(getDefaultQuestion());
  };

  const handleEditQuestion = (index: number) => {
    setCurrentQuestion(questions[index]);
    setEditingIndex(index);
  };

  const handleDeleteQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
    toast.success(t('questionDeleted'));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setQuestions((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSaveQuiz = () => {
    if (!title.trim()) {
      toast.error(t('titleRequired'));
      return;
    }

    if (questions.length === 0) {
      toast.error(t('oneQuestionRequired'));
      return;
    }

    try {
      const quizData = {
        title,
        description,
        questions,
        isPublic: isPoll ? false : isPublic,
        isFavorite: false,
        tags,
        speedBonus: isPoll ? false : speedBonus,
        transitionTime,
        category,
        type: quizType,
        headerImage,
        theme,
      };

      if (quizId) {
        // Update existing quiz
        updateQuiz(quizId, quizData);
        toast.success(isPoll ? "Sondage mis à jour" : "Quiz mis à jour");
      } else {
        // Create new quiz
        saveQuiz(quizData);
        toast.success(isPoll ? t('pollSaved') : t('quizSaved'));
      }

      navigate(isPoll ? '/my-polls' : '/my-quizzes');
    } catch (error) {
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  const handlePreviewQuiz = () => {
    if (questions.length === 0) {
      toast.error("Ajoutez au moins une question pour prévisualiser");
      return;
    }
    // Save temporary quiz data for preview
    const tempQuiz = {
      id: 'preview-' + Date.now(),
      title: title || (isPoll ? "Mon Sondage" : "Mon Quiz"),
      description,
      questions,
      type: quizType,
      headerImage,
      theme,
    };
    localStorage.setItem(`quiz-${tempQuiz.id}`, JSON.stringify(tempQuiz));
    navigate(`/quiz/${tempQuiz.id}`);
  };

  const handleDuplicateQuestion = (index: number) => {
    const questionToDuplicate = questions[index];
    const duplicatedQuestion = {
      ...questionToDuplicate,
      id: Date.now().toString(),
    };
    const newQuestions = [...questions];
    newQuestions.splice(index + 1, 0, duplicatedQuestion);
    setQuestions(newQuestions);
    toast.success("Question dupliquée");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setHeaderImage(reader.result as string);
        toast.success(t('imageAdded'));
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

  const renderQuestionForm = () => {
    switch (currentQuestion.type) {
      case 'multiple-choice':
      case 'single-choice':
        return (
          <div className="space-y-4">
            <div>
              <Label>{t('question')}</Label>
              <Input
                value={currentQuestion.question}
                onChange={(e) => setCurrentQuestion({ ...currentQuestion, question: e.target.value })}
                placeholder={t('questionPlaceholder')}
                className="mt-2"
              />
            </div>
            <div>
              <Label>{t('answers')}</Label>
              {currentQuestion.answers.map((answer: string, i: number) => (
                <div key={i} className="flex gap-2 mt-2">
                  <Input
                    value={answer}
                    onChange={(e) => {
                      const newAnswers = [...currentQuestion.answers];
                      newAnswers[i] = e.target.value;
                      setCurrentQuestion({ ...currentQuestion, answers: newAnswers });
                    }}
                    placeholder={`${t('answer')} ${i + 1}`}
                  />
                  {!isPoll && (
                    <Button
                      variant={currentQuestion.correctAnswer === i ? "default" : "outline"}
                      onClick={() => setCurrentQuestion({ ...currentQuestion, correctAnswer: i })}
                    >
                      {currentQuestion.correctAnswer === i ? "✓" : "○"}
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {!isPoll && (
              <>
                <div>
                  <Label>{t('timeLimit')}</Label>
                  <Input
                    type="number"
                    value={currentQuestion.timeLimit}
                    onChange={(e) => setCurrentQuestion({ ...currentQuestion, timeLimit: parseInt(e.target.value) })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>{t('points')}</Label>
                  <Input
                    type="number"
                    value={currentQuestion.points}
                    onChange={(e) => setCurrentQuestion({ ...currentQuestion, points: parseInt(e.target.value) })}
                    className="mt-2"
                  />
                </div>
              </>
            )}
          </div>
        );

      case 'true-false':
        return (
          <div className="space-y-4">
            <div>
              <Label>{t('question')}</Label>
              <Input
                value={currentQuestion.question}
                onChange={(e) => setCurrentQuestion({ ...currentQuestion, question: e.target.value })}
                placeholder={t('questionPlaceholder')}
                className="mt-2"
              />
            </div>
            <div>
              <Label>{t('correctAnswer')}</Label>
              <Select
                value={currentQuestion.correctAnswer}
                onValueChange={(value) => setCurrentQuestion({ ...currentQuestion, correctAnswer: value })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="true">{t('true')}</SelectItem>
                  <SelectItem value="false">{t('false')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('timeLimit')}</Label>
              <Input
                type="number"
                value={currentQuestion.timeLimit}
                onChange={(e) => setCurrentQuestion({ ...currentQuestion, timeLimit: parseInt(e.target.value) })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>{t('points')}</Label>
              <Input
                type="number"
                value={currentQuestion.points}
                onChange={(e) => setCurrentQuestion({ ...currentQuestion, points: parseInt(e.target.value) })}
                className="mt-2"
              />
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <div>
              <Label>{t('question')}</Label>
              <Input
                value={currentQuestion.question}
                onChange={(e) => setCurrentQuestion({ ...currentQuestion, question: e.target.value })}
                placeholder={t('questionPlaceholder')}
                className="mt-2"
              />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isPoll ? t('pollTitle') : t('quizTitle')}
              className="max-w-md font-medium"
            />
          </div>
          <div className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  {t('settings')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t('settings')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>{t('category')}</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        <SelectItem value="Culture Générale">{t('generalCulture')}</SelectItem>
                        <SelectItem value="Science">{t('science')}</SelectItem>
                        <SelectItem value="Histoire">{t('history')}</SelectItem>
                        <SelectItem value="Géographie">{t('geography')}</SelectItem>
                        <SelectItem value="Sport">{t('sports')}</SelectItem>
                        <SelectItem value="Divertissement">{t('entertainment')}</SelectItem>
                        <SelectItem value="Technologie">{t('technology')}</SelectItem>
                        <SelectItem value="Arts">{t('arts')}</SelectItem>
                        <SelectItem value="Autre">{t('other')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>{t('description')}</Label>
                    <Textarea
                      placeholder={t('descriptionPlaceholder')}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>{t('headerImage')}</Label>
                    {headerImage && (
                      <div className="relative w-full h-32 rounded-lg overflow-hidden mt-2 mb-2">
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
                      <Button variant="outline" size="sm" asChild className="w-full mt-2">
                        <span>
                          <Upload className="w-4 h-4 mr-2" />
                          {headerImage ? t('changeImage') : t('addImage')}
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
                    <Label>{t('tags')}</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        placeholder={t('addTag')}
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTag();
                          }
                        }}
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
                          className="cursor-pointer"
                          onClick={() => setTags(tags.filter(t => t !== tag))}
                        >
                          {tag} ×
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {!isPoll && (
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Label className="cursor-pointer">{t('public')}</Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button className="text-muted-foreground hover:text-foreground">
                                <HelpCircle className="w-4 h-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">{t('publicTooltip')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                    </div>
                  )}

                  {!isPoll && (
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Label className="cursor-pointer">{t('speedBonus')}</Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button className="text-muted-foreground hover:text-foreground">
                                <HelpCircle className="w-4 h-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">{t('speedBonusTooltip')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Switch checked={speedBonus} onCheckedChange={setSpeedBonus} />
                    </div>
                  )}

                  {!isPoll && (
                    <div>
                      <Label>{t('transitionTime')}</Label>
                      <Input
                        type="number"
                        min="3"
                        max="10"
                        value={transitionTime}
                        onChange={(e) => setTransitionTime(parseInt(e.target.value) || 5)}
                        className="mt-2"
                      />
                    </div>
                  )}

                  <div>
                    <Label>Thème visuel</Label>
                    <Select value={theme} onValueChange={setTheme}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        {THEMES.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {/* Theme Preview */}
                    <div className="mt-4 p-4 rounded-lg border overflow-hidden">
                      <p className="text-xs text-muted-foreground mb-2">Aperçu du thème :</p>
                      <div 
                        className="h-32 rounded-md flex items-center justify-center"
                        style={{
                          background: THEMES.find(t => t.id === theme)?.background || 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)) 100%)'
                        }}
                      >
                        <span className="text-white font-bold text-lg drop-shadow-lg">
                          {THEMES.find(t => t.id === theme)?.name}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button 
              variant="outline"
              onClick={handlePreviewQuiz}
              disabled={questions.length === 0}
            >
              <Play className="w-4 h-4 mr-2" />
              Lancer
            </Button>
            <Button onClick={handleSaveQuiz}>
              <Save className="w-4 h-4 mr-2" />
              {t('save')}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Navigation */}
        <div className={`${sidebarOpen ? 'w-64' : 'w-0'} border-r bg-card overflow-hidden transition-all duration-200`}>
          <div className="p-4 h-full flex flex-col">
            {/* Logo */}
            <div className="flex items-center gap-2 mb-8 px-2">
              <Zap className="w-8 h-8 text-primary" />
              <span className="font-bold text-xl text-foreground">QuizMaster</span>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => navigate('/')}
              >
                <Home className="w-5 h-5 mr-3" />
                {t('home')}
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => navigate('/my-quizzes')}
              >
                <BarChart3 className="w-5 h-5 mr-3" />
                {t('myQuizzes')}
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => navigate('/my-polls')}
              >
                <BarChart3 className="w-5 h-5 mr-3" />
                {t('myPolls')}
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => navigate('/profile')}
              >
                <User className="w-5 h-5 mr-3" />
                {t('profile')}
              </Button>
            </nav>

            {/* Logout Button */}
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => {
                logout();
                navigate('/auth');
              }}
            >
              <LogOut className="w-5 h-5 mr-3" />
              {t('logout')}
            </Button>
          </div>
        </div>

        {/* Center - Questions List + Preview */}
        <div className="flex-1 flex overflow-hidden">
          {/* Questions List */}
          <div className="w-80 border-r bg-muted/30 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">{t('questions')} ({questions.length})</h3>
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={questions.map(q => q.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {questions.map((question, index) => (
                     <SortableQuestionItem
                      key={question.id}
                      question={question}
                      index={index}
                      onEdit={(idx: number) => {
                        handleEditQuestion(idx);
                        setSelectedQuestionIndex(idx);
                      }}
                      onDelete={handleDeleteQuestion}
                      onDuplicate={handleDuplicateQuestion}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            {questions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">{t('noQuestions')}</p>
            )}
          </div>

          {/* Preview */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto">
              {selectedQuestionIndex !== null && questions[selectedQuestionIndex] ? (
                <QuizPreview
                  title={title || (isPoll ? "Mon Sondage" : "Mon Quiz") }
                  description={description}
                  category={category}
                  headerImage={headerImage}
                  questions={[questions[selectedQuestionIndex]]}
                  isPoll={isPoll}
                  theme={theme}
                />
              ) : (
                <QuizPreview
                  title={title || (isPoll ? "Mon Sondage" : "Mon Quiz") }
                  description={description}
                  category={category}
                  headerImage={headerImage}
                  questions={questions}
                  isPoll={isPoll}
                  theme={theme}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Add Question */}
        <div className="w-96 border-l bg-card overflow-y-auto p-4">
          <h3 className="font-semibold text-foreground mb-4">
            {editingIndex !== null ? t('editQuestion') : t('addQuestion')}
          </h3>
          
          <Tabs defaultValue="type" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="type">Type</TabsTrigger>
              <TabsTrigger value="content">{t('content')}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="type" className="mt-4">
              <QuestionTypeSelector
                questionTypes={getAvailableQuestionTypes()}
                selectedType={currentQuestion.type}
                onSelectType={(type) => setCurrentQuestion(getDefaultQuestion(type))}
              />
            </TabsContent>
            
            <TabsContent value="content" className="mt-4">
              {renderQuestionForm()}
              
              <div className="flex gap-2 mt-6">
                <Button onClick={handleAddQuestion} className="flex-1">
                  {editingIndex !== null ? t('updateQuestion') : t('addQuestion')}
                </Button>
                {editingIndex !== null && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCurrentQuestion(getDefaultQuestion());
                      setEditingIndex(null);
                    }}
                  >
                    {t('cancel')}
                  </Button>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};
