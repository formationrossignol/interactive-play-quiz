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
import { Plus, Trash2, Save, ChevronUp, ChevronDown, Upload, HelpCircle } from "lucide-react";
import { QuestionBank } from "./QuestionBank";
import { PollTemplateSelectorEnhanced } from "./PollTemplateSelectorEnhanced";
import { Header } from "./Header";
import { getCurrentUser } from "@/lib/auth";
import { saveQuiz } from "@/lib/quizStorage";
import { toast } from "sonner";
import { getQuestionTypeLabel, getQuestionTypeDescription } from "@/lib/questionTypes";
import { t } from "@/lib/i18n";
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
      toast.error(t('questionRequired'));
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
    toast.success(t('templateLoaded'));
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
      const saved = saveQuiz({
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
      });

      toast.success(isPoll ? t('pollSaved') : t('quizSaved'));
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

  return (
    <div className="min-h-screen bg-background">
      <Header subtitle={isPoll ? t('pollBuilder') : t('quizBuilder')} />

      {/* Main Content with Sidebar Layout */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid lg:grid-cols-[300px_1fr] gap-6">
          {/* Left Sidebar - Options */}
          <div className="space-y-6">
            {/* Quiz/Poll Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-foreground">{t('settings')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>{isPoll ? t('pollTitle') : t('quizTitle')}</Label>
                  <Input
                    placeholder={isPoll ? t('myPoll') : t('myQuiz')}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-2"
                  />
                </div>

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
              </CardContent>
            </Card>

            {/* Templates for Polls */}
            {isPoll && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-foreground">{t('pollTemplates')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowQuestionBank(!showQuestionBank)}
                  >
                    {showQuestionBank ? <ChevronUp /> : <ChevronDown />}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Question Bank for Quiz */}
            {!isPoll && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-foreground">{t('questionBank')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowQuestionBank(!showQuestionBank)}
                  >
                    {showQuestionBank ? <ChevronUp /> : <ChevronDown />}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Center - Questions */}
          <div className="space-y-6">
            {/* Templates Expanded (only for polls) */}
            {isPoll && showQuestionBank && (
              <PollTemplateSelectorEnhanced
                selectedTemplateId={selectedTemplate}
                onSelectTemplate={handleSelectTemplate}
              />
            )}

            {/* Question Bank Expanded (only for quiz) */}
            {!isPoll && showQuestionBank && (
              <Card>
                <CardContent className="p-6">
                  <QuestionBank onSelectQuestion={handleSelectFromBank} />
                </CardContent>
              </Card>
            )}

            {/* Question Editor */}
            <Card>
              <CardHeader>
                <CardTitle className="text-foreground">
                  {editingIndex !== null ? t('editQuestion') : t('addQuestion')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="mb-4 block">{t('questionType')}</Label>
                  <Select
                    value={currentQuestion.type}
                    onValueChange={(value) => {
                      setCurrentQuestion(getDefaultQuestion(value as any));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
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
                  <Label>{t('question')}</Label>
                  <Input
                    placeholder={t('yourQuestion')}
                    value={currentQuestion.question || ''}
                    onChange={(e) => setCurrentQuestion({ ...currentQuestion, question: e.target.value })}
                    className="mt-2"
                  />
                </div>

                {/* Question type specific fields */}
                {(currentQuestion.type === 'multiple-choice' || currentQuestion.type === 'single-choice') && (
                  <div className="space-y-3">
                    <Label>{t('answers')}</Label>
                    {currentQuestion.answers?.map((answer: string, idx: number) => (
                      <div key={idx} className="flex gap-2">
                        <Input
                          placeholder={`${t('answer')} ${idx + 1}`}
                          value={answer}
                          onChange={(e) => {
                            const newAnswers = [...currentQuestion.answers];
                            newAnswers[idx] = e.target.value;
                            setCurrentQuestion({ ...currentQuestion, answers: newAnswers });
                          }}
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
                      {t('addAnswer')}
                    </Button>
                  </div>
                )}

                {currentQuestion.type === 'likert-scale' && (
                  <div>
                    <Label>Échelle de Likert</Label>
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
                        />
                      ))}
                    </div>
                  </div>
                )}

                {currentQuestion.type === 'frequency-scale' && (
                  <div>
                    <Label>Échelle de fréquence</Label>
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
                        />
                      ))}
                    </div>
                  </div>
                )}

                {currentQuestion.type === 'star-rating' && (
                  <div>
                    <Label>Nombre d'étoiles</Label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={currentQuestion.maxStars || 5}
                      onChange={(e) => setCurrentQuestion({ ...currentQuestion, maxStars: parseInt(e.target.value) || 5 })}
                      className="mt-2"
                    />
                  </div>
                )}

                {currentQuestion.type === 'open-text' && (
                  <div>
                    <Label>Longueur maximale</Label>
                    <Input
                      type="number"
                      value={currentQuestion.maxLength || 500}
                      onChange={(e) => setCurrentQuestion({ ...currentQuestion, maxLength: parseInt(e.target.value) || 500 })}
                      className="mt-2"
                    />
                  </div>
                )}

                {currentQuestion.type === 'ranking' && (
                  <div className="space-y-3">
                    <Label>Éléments à classer</Label>
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
                      {t('addItem')}
                    </Button>
                  </div>
                )}

                {/* Time and Points (only for quiz) */}
                {!isPoll && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t('timeSeconds')}</Label>
                      <Input
                        type="number"
                        value={currentQuestion.timeLimit}
                        onChange={(e) =>
                          setCurrentQuestion({ ...currentQuestion, timeLimit: parseInt(e.target.value) || 30 })
                        }
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label>{t('points')}</Label>
                      <Input
                        type="number"
                        value={currentQuestion.points}
                        onChange={(e) =>
                          setCurrentQuestion({ ...currentQuestion, points: parseInt(e.target.value) || 100 })
                        }
                        className="mt-2"
                      />
                    </div>
                  </div>
                )}

                <Button onClick={handleAddQuestion} variant="default" className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  {editingIndex !== null ? t('editQuestion') : t('addQuestion')}
                </Button>
              </CardContent>
            </Card>

            {/* Questions List */}
            {questions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-foreground">{t('questions')} ({questions.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {questions.map((question, index) => (
                      <div key={question.id} className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                        <div className="flex-1">
                          <p className="text-foreground font-medium">{index + 1}. {question.question}</p>
                          <p className="text-muted-foreground text-sm">{getQuestionTypeLabel(question.type)}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEditQuestion(index)}>
                            {t('edit')}
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

            {/* Save Button */}
            <div className="flex justify-end">
              <Button
                onClick={handleSaveQuiz}
                disabled={!title || questions.length === 0}
                variant="default"
                size="lg"
                className="text-lg"
              >
                <Save className="w-5 h-5 mr-2" />
                {t('save')} {isPoll ? t('myPoll') : t('myQuiz')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
