import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus,
  Trash2,
  Save,
  Upload,
  HelpCircle,
  GripVertical,
  Settings,
  ChevronLeft,
  ChevronRight,
  Play,
  Copy,
  Home,
  BookOpen,
  BarChart3,
  CheckSquare,
  ToggleLeft,
  FileText,
  ArrowUpDown,
  Shuffle,
  Square,
  List,
  Star,
  MessageSquare,
  Library,
  Database,
} from "lucide-react";
import { QuizPreview } from "./QuizPreview";
import { QuestionTypeSelector } from "./QuestionTypeSelector";
import { Header } from "./Header";
import { getCurrentUser } from "@/lib/auth";
import { saveQuiz, updateQuiz, getQuizById } from "@/lib/quizStorage";
import { getPollTemplate } from "@/lib/pollTemplates";
import { getQuizTemplate } from "@/lib/quizTemplates";
import { DEFAULT_THEME_ID, THEMES, type Theme } from "@/lib/themes";
import { hexToRgba } from "@/lib/color";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import type { QuizQuestionType, PollQuestionType } from "@/lib/questionTypes";
import type { PollTemplate } from "@/lib/pollTemplates";
import type { QuizTemplate } from "@/lib/quizTemplates";
import { PollTemplateSelectorEnhanced } from "./PollTemplateSelectorEnhanced";
import { QuizTemplateSelectorEnhanced } from "./QuizTemplateSelectorEnhanced";
import { FlashcardEditor } from "./FlashcardEditor";
import { FlashcardPreview } from "./FlashcardPreview";
import { cn } from "@/lib/utils";
import { createDefaultQuizQuestion } from "@/lib/questionDefaults";
import { getQuestionBankForUser, type QuestionBankItem, type QuestionDifficulty } from "@/lib/questionBank";
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

const questionTypeIconMap: Partial<Record<QuizQuestionType | PollQuestionType, any>> = {
  'multiple-choice': CheckSquare,
  'true-false': ToggleLeft,
  'short-answer': FileText,
  'ranking': ArrowUpDown,
  'matching': Shuffle,
  'fill-blank': Square,
  'drag-drop': Shuffle,
  'hotspot': CheckSquare,
  'slider': ArrowUpDown,
  'single-choice': List,
  'likert-scale': BarChart3,
  'frequency-scale': BarChart3,
  'star-rating': Star,
  'open-text': MessageSquare,
  'nps-scale': BarChart3,
};

const questionTypeColorMap: Partial<Record<QuizQuestionType | PollQuestionType, string>> = {
  'multiple-choice': 'bg-blue-100 text-blue-700',
  'true-false': 'bg-emerald-100 text-emerald-700',
  'short-answer': 'bg-purple-100 text-purple-700',
  'ranking': 'bg-orange-100 text-orange-700',
  'matching': 'bg-pink-100 text-pink-700',
  'fill-blank': 'bg-indigo-100 text-indigo-700',
  'drag-drop': 'bg-teal-100 text-teal-700',
  'hotspot': 'bg-sky-100 text-sky-700',
  'slider': 'bg-cyan-100 text-cyan-700',
  'single-choice': 'bg-cyan-100 text-cyan-700',
  'likert-scale': 'bg-amber-100 text-amber-700',
  'frequency-scale': 'bg-lime-100 text-lime-700',
  'star-rating': 'bg-yellow-100 text-yellow-700',
  'open-text': 'bg-rose-100 text-rose-700',
  'nps-scale': 'bg-emerald-100 text-emerald-700',
};

const questionTypeTranslationKeyMap: Partial<Record<QuizQuestionType, string>> = {
  'multiple-choice': 'multipleChoice',
  'true-false': 'trueFalse',
  'short-answer': 'shortAnswer',
  'ranking': 'ranking',
  'matching': 'matching',
  'fill-blank': 'fillBlank',
  'slider': 'slider',
};

const difficultyTranslationKeyMap: Record<QuestionDifficulty, string> = {
  easy: 'difficultyEasy',
  medium: 'difficultyMedium',
  hard: 'difficultyHard',
};

// Sortable Question Item Component
const SortableQuestionItem = ({ question, index, onEdit, onDelete, onDuplicate, isActive }: any) => {
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

  const Icon = questionTypeIconMap[question.type as QuizQuestionType | PollQuestionType] || CheckSquare;
  const iconColors = questionTypeColorMap[question.type as QuizQuestionType | PollQuestionType] || 'bg-primary/10 text-primary';
  
  const displayText = question.type === 'flashcard' 
    ? (question.recto?.trim() || 'Flashcard vide')
    : (question.question?.trim() || t('noQuestionText'));

  return (
    <div ref={setNodeRef} style={style} className="group relative w-full">
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-2xl border-2 bg-gradient-to-br from-background via-muted/40 to-background/80 p-4 transition-all duration-200 cursor-pointer",
          isActive
            ? "border-primary shadow-[0_18px_30px_-20px_rgba(30,64,175,0.6)]"
            : "border-transparent hover:border-primary/40 hover:shadow-[0_12px_30px_-22px_rgba(30,64,175,0.4)]"
        )}
        onClick={() => onEdit(index)}
      >
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.24),rgba(255,255,255,0.05))]" aria-hidden />
        <div className="relative flex min-h-[4.75rem] flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                {...attributes}
                {...listeners}
                onClick={(e) => e.stopPropagation()}
                className="rounded-full border border-border/40 bg-background/80 p-2 text-muted-foreground shadow-sm transition-colors hover:text-foreground cursor-grab active:cursor-grabbing"
                title={t('dragToReorder')}
              >
                <GripVertical className="w-3.5 h-3.5" />
              </button>
              <span className="rounded-full bg-background/80 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground shadow-sm">
                #{index + 1}
              </span>
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl shadow-sm", iconColors)}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full bg-background/70 opacity-0 shadow-sm backdrop-blur group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate(index);
                }}
                title={t('duplicate')}
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full bg-background/70 opacity-0 shadow-sm backdrop-blur group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(index);
                }}
                title={t('delete')}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="pr-2">
            <p className="text-sm font-semibold text-foreground/90 line-clamp-2">
              {displayText}
            </p>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-3 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20" aria-hidden />
      </div>
    </div>
  );
};

const getThemeOverlay = (theme?: Theme) => {
  if (!theme) {
    return "linear-gradient(135deg, rgba(0,0,0,0.45), rgba(0,0,0,0.6))";
  }

  const startColor = hexToRgba(theme.palette[0], 0.55);
  const endColor = hexToRgba(theme.palette[theme.palette.length - 1], 0.65);

  return `linear-gradient(135deg, ${startColor}, ${endColor})`;
};

const ThemePaletteChips = ({ theme }: { theme: Theme }) => (
  <span className="flex items-center gap-1.5">
    {theme.palette.map((color, index) => (
      <span
        key={`${theme.id}-palette-${index}`}
        className="h-3 w-3 rounded-full border border-black/10 shadow-sm dark:border-white/15"
        style={{ backgroundColor: color }}
      />
    ))}
  </span>
);

const ThemePreviewPanel = ({ theme }: { theme?: Theme }) => {
  if (!theme) {
    return (
      <div className="flex h-36 items-center justify-center rounded-2xl bg-muted/20 text-sm text-muted-foreground">
        Sélectionnez un thème pour prévisualiser le rendu visuel
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative h-36 w-full overflow-hidden rounded-2xl border border-border/70">
        <img
          src={theme.imageUrl}
          alt={theme.imageDescription}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0" aria-hidden style={{ background: getThemeOverlay(theme) }} />
        <div className="absolute inset-0 flex flex-col justify-end gap-1 p-4 text-white drop-shadow-md">
          <span className="text-base font-semibold tracking-wide">{theme.name}</span>
          <span className="text-xs font-medium text-white/85">{theme.imageDescription}</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <ThemePaletteChips theme={theme} />
        <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
          Palette
        </span>
      </div>
    </div>
  );
};

const FONT_OPTIONS: { value: string; label: string; stack: string; tagline: string }[] = [
  {
    value: "inter",
    label: "Inter",
    stack: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    tagline: "Moderne et très lisible",
  },
  {
    value: "poppins",
    label: "Poppins",
    stack: '"Poppins", "Inter", sans-serif',
    tagline: "Arrondie et chaleureuse",
  },
  {
    value: "space-grotesk",
    label: "Space Grotesk",
    stack: '"Space Grotesk", "Inter", sans-serif',
    tagline: "Typographie géométrique",
  },
  {
    value: "playfair",
    label: "Playfair Display",
    stack: '"Playfair Display", "Times New Roman", serif',
    tagline: "Élégance éditoriale",
  },
  {
    value: "merriweather",
    label: "Merriweather",
    stack: '"Merriweather", "Georgia", serif',
    tagline: "Classique et sérieuse",
  },
];

const ThemeSelectionDropdown = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) => {
  const selectedTheme = THEMES.find((themeOption) => themeOption.id === value);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-auto min-h-12 items-center justify-between rounded-xl border border-border/60 bg-background px-3 py-3 text-left">
        <SelectValue aria-hidden className="sr-only" />
        <div className="flex flex-1 items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              {selectedTheme?.name ?? t('selectTheme')}
            </p>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {selectedTheme?.imageDescription ?? t('selectThemeDescription')}
            </p>
          </div>
          {selectedTheme && (
            <div className="flex shrink-0 items-center gap-1 rounded-full border border-border/40 bg-muted/30 px-3 py-1">
              <ThemePaletteChips theme={selectedTheme} />
            </div>
          )}
        </div>
      </SelectTrigger>
      <SelectContent className="bg-popover z-50 max-h-[320px]">
        {THEMES.map((themeOption) => (
          <SelectItem key={themeOption.id} value={themeOption.id} className="py-2">
            <div className="flex items-center gap-3">
              <div className="h-12 w-20 shrink-0 overflow-hidden rounded-xl border border-border/60">
                <img
                  src={themeOption.imageUrl}
                  alt={themeOption.imageDescription}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{themeOption.name}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{themeOption.imageDescription}</p>
                <div className="mt-2">
                  <ThemePaletteChips theme={themeOption} />
                </div>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export const QuizBuilder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const quizType = (searchParams.get('type') || 'quiz') as 'quiz' | 'poll' | 'flashcard';
  const templateId = searchParams.get('templateId');
  const quizId = searchParams.get('quizId');
  const user = getCurrentUser();
  
  const isPoll = quizType === 'poll';
  const isFlashcard = quizType === 'flashcard';

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
  const [theme, setTheme] = useState<string>(DEFAULT_THEME_ID);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [questionEditorOpen, setQuestionEditorOpen] = useState(true);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(templateId);
  const activeTheme = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  const [previewFont, setPreviewFont] = useState<string>(FONT_OPTIONS[0].value);
  const activeFont = FONT_OPTIONS.find((option) => option.value === previewFont) ?? FONT_OPTIONS[0];
  const [questionBankItems, setQuestionBankItems] = useState<QuestionBankItem[]>([]);
  const [questionBankDialogOpen, setQuestionBankDialogOpen] = useState(false);
  const [shouldBlockNavigation, setShouldBlockNavigation] = useState(true);

  const sidebarTogglePositionStyle = useMemo(
    () => ({ top: 'calc(var(--app-header-height, 0px) + 3rem)' }),
    []
  );

  const confirmLeaveBuilder = useCallback(() => {
    if (!shouldBlockNavigation) {
      return true;
    }

    return window.confirm(t('confirmLeaveBuilder'));
  }, [shouldBlockNavigation]);

  const handleNavigateAway = useCallback((path: string, onBeforeNavigate?: () => void) => {
    if (!confirmLeaveBuilder()) {
      return;
    }

    setShouldBlockNavigation(false);
    onBeforeNavigate?.();
    navigate(path);
  }, [confirmLeaveBuilder, navigate]);

  useEffect(() => {
    if (!shouldBlockNavigation) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = t('confirmLeaveBuilder');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [shouldBlockNavigation]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const sidebarNavigationItems = useMemo(() => ([
    {
      label: t('home'),
      icon: Home,
      action: () => handleNavigateAway('/'),
      requiresAuth: false,
    },
    {
      label: t('myQuizzes'),
      icon: BookOpen,
      action: () => handleNavigateAway('/my-quizzes'),
      requiresAuth: true,
    },
    {
      label: t('myPolls'),
      icon: BarChart3,
      action: () => handleNavigateAway('/my-polls'),
      requiresAuth: true,
    },
    {
      label: t('myFlashcards'),
      icon: Library,
      action: () => handleNavigateAway('/my-flashcards'),
      requiresAuth: true,
    },
    {
      label: t('questionBank'),
      icon: Database,
      action: () => handleNavigateAway('/question-bank'),
      requiresAuth: true,
    },
  ]), [handleNavigateAway]);

  function applyTemplate(template: PollTemplate | QuizTemplate) {
    setTitle(template.name);
    setDescription(template.description);
    setCategory(template.category);
    const templateQuestions = template.questions.map((question, index) => ({
      id: `${template.id}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      ...question,
      image: question.image || '',
    }));
    setQuestions(templateQuestions as any[]);
    setSelectedQuestionIndex(templateQuestions.length > 0 ? 0 : null);
    setEditingIndex(null);
    setCurrentQuestion(getDefaultQuestion());
    setTags([]);
    setTemplateDialogOpen(false);
    setActiveTemplateId(template.id);
    toast.success(t('templateLoaded'));
  }

  useEffect(() => {
    if (!user) {
      setShouldBlockNavigation(false);
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
        const existingTheme = existingQuiz.theme && THEMES.some(t => t.id === existingQuiz.theme)
          ? existingQuiz.theme
          : DEFAULT_THEME_ID;
        setTheme(existingTheme);
        const existingFont = existingQuiz.font && FONT_OPTIONS.some(option => option.value === existingQuiz.font)
          ? existingQuiz.font
          : FONT_OPTIONS[0].value;
        setPreviewFont(existingFont);
        setQuestions(existingQuiz.questions.map((q, index) => ({
          id: q.id || Date.now().toString() + index,
          ...q,
          image: q.image || '',
        })));
        setSelectedQuestionIndex(existingQuiz.questions.length > 0 ? 0 : null);
        setActiveTemplateId(null);
        setTemplateDialogOpen(false);
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
          applyTemplate(template);
        }
      } else {
        const template = getQuizTemplate(templateId);
        if (template) {
          applyTemplate(template);
        }
      }
    }
  }, [templateId, isPoll, quizId]);

  useEffect(() => {
    if (user) {
      setQuestionBankItems(getQuestionBankForUser(user.id));
    } else {
      setQuestionBankItems([]);
    }
  }, [user]);


  function getDefaultQuestion(type?: QuizQuestionType | PollQuestionType): any {
    if (isFlashcard) {
      return {
        type: 'flashcard',
        recto: '',
        verso: '',
        rectoImage: '',
        versoImage: '',
      };
    }
    
    if (isPoll) {
      const pollType = type || 'single-choice';

      const base = {
        type: pollType,
        question: '',
        image: '',
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
      const quizType = (type as QuizQuestionType) || 'multiple-choice';
      return createDefaultQuizQuestion(quizType);
    }
  }

  const getAvailableQuestionTypes = (): (QuizQuestionType | PollQuestionType)[] => {
    if (isPoll) {
      return ['single-choice', 'multiple-choice', 'likert-scale', 'frequency-scale', 'star-rating', 'ranking', 'open-text', 'nps-scale'];
    }
    return ['multiple-choice', 'true-false', 'short-answer', 'ranking', 'matching', 'fill-blank', 'slider'];
  };

  const handleAddQuestion = () => {
    if (isFlashcard) {
      if (!currentQuestion.recto?.trim() || !currentQuestion.verso?.trim()) {
        toast.error("Le recto et le verso sont requis");
        return;
      }
    } else if (!currentQuestion.question?.trim()) {
      toast.error(t('questionRequired'));
      return;
    }

    const isEditing = editingIndex !== null;

    const newQuestion = {
      id: isEditing ? questions[editingIndex as number].id : Date.now().toString(),
      ...currentQuestion,
      image: currentQuestion.image || '',
    };

    if (isEditing) {
      const updated = [...questions];
      updated[editingIndex as number] = newQuestion;
      setQuestions(updated);
      setSelectedQuestionIndex(editingIndex as number);
      setEditingIndex(null);
      toast.success(t('questionEdited'));
    } else {
      const updated = [...questions, newQuestion];
      setQuestions(updated);
      setSelectedQuestionIndex(updated.length - 1);
      toast.success(t('questionAdded'));
    }

    setCurrentQuestion(getDefaultQuestion(currentQuestion.type));
  };

  const handleEditQuestion = (index: number) => {
    setCurrentQuestion({ image: '', ...questions[index] });
    setEditingIndex(index);
    setSelectedQuestionIndex(index);
    setQuestionEditorOpen(true);
  };

  const handleDeleteQuestion = (index: number) => {
    const updatedQuestions = questions.filter((_, i) => i !== index);
    setQuestions(updatedQuestions);
    setSelectedQuestionIndex((prev) => {
      if (prev === null) {
        return prev;
      }
      if (prev === index) {
        if (updatedQuestions.length === 0) {
          return null;
        }
        return Math.min(index, updatedQuestions.length - 1);
      }
      if (prev > index) {
        return prev - 1;
      }
      return prev;
    });
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

  const refreshQuestionBank = () => {
    if (user) {
      setQuestionBankItems(getQuestionBankForUser(user.id));
    }
  };

  const handleImportFromQuestionBank = (item: QuestionBankItem) => {
    const newQuestion = {
      ...item.question,
      id: `${item.id}-${Date.now()}`,
    };

    const updated = [...questions, newQuestion];
    setQuestions(updated);
    setSelectedQuestionIndex(updated.length - 1);
    setEditingIndex(null);
    setCurrentQuestion(getDefaultQuestion(newQuestion.type));
    setQuestionBankDialogOpen(false);
    toast.success(t('questionImported'));
  };

  useEffect(() => {
    if (questionBankDialogOpen) {
      refreshQuestionBank();
    }
  }, [questionBankDialogOpen]);

  const getQuestionTypeName = (type: QuizQuestionType) => {
    const translationKey = questionTypeTranslationKeyMap[type];
    return translationKey ? t(translationKey) : type;
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
        font: previewFont,
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

      if (isFlashcard) {
        setShouldBlockNavigation(false);
        navigate('/my-flashcards');
      } else {
        setShouldBlockNavigation(false);
        navigate(isPoll ? '/my-polls' : '/my-quizzes');
      }
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
      font: previewFont,
    };
    localStorage.setItem(`quiz-${tempQuiz.id}`, JSON.stringify(tempQuiz));
    setShouldBlockNavigation(false);
    navigate(`/quiz/${tempQuiz.id}`);
  };

  const handleDuplicateQuestion = (index: number) => {
    const questionToDuplicate = questions[index];
    const duplicatedQuestion = {
      ...questionToDuplicate,
      id: Date.now().toString(),
      image: questionToDuplicate.image || '',
    };
    const newQuestions = [...questions];
    newQuestions.splice(index + 1, 0, duplicatedQuestion);
    setQuestions(newQuestions);
    setSelectedQuestionIndex(index + 1);
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

  const handleCurrentQuestionImageChange = (file: File | null) => {
    if (!file) {
      setCurrentQuestion((prev: any) => ({ ...prev, image: '' }));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setCurrentQuestion((prev: any) => ({ ...prev, image: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const renderQuestionImageField = () => (
    <div>
      <Label>{t('questionImage')}</Label>
      {currentQuestion.image && (
        <div className="relative mt-2 overflow-hidden rounded-lg border bg-muted/40">
          <img
            src={currentQuestion.image}
            alt={currentQuestion.question || t('question')}
            className="h-40 w-full object-cover"
          />
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-2 bg-black/60 text-white hover:bg-black/80"
            onClick={() => handleCurrentQuestionImageChange(null)}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">{t('removeImage')}</span>
          </Button>
        </div>
      )}
      <label htmlFor="question-image" className="mt-2 block">
        <Button variant="outline" size="sm" asChild className="w-full">
          <span className="flex items-center justify-center gap-2">
            <Upload className="h-4 w-4" />
            {currentQuestion.image ? t('changeImage') : t('addImage')}
          </span>
        </Button>
      </label>
      <input
        id="question-image"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] || null;
          handleCurrentQuestionImageChange(file);
          event.target.value = '';
        }}
      />
    </div>
  );

  const renderQuestionForm = () => {
    if (isFlashcard) {
      return (
        <FlashcardEditor
          flashcard={currentQuestion}
          onChange={(updated) => setCurrentQuestion(updated)}
        />
      );
    }

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
            {renderQuestionImageField()}
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
            {renderQuestionImageField()}
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
            {renderQuestionImageField()}
          </div>
        );
    }
  };

  const builderToolbar = (
    <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" title={t('settings')}>
            <Settings className="w-5 h-5" />
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
                <p className="mt-1 text-xs text-muted-foreground">
                  Personnalisez l'ambiance graphique de votre activité.
                </p>
                <div className="mt-3 space-y-3">
                  <ThemeSelectionDropdown value={theme} onChange={setTheme} />
                  <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                    <ThemePreviewPanel theme={activeTheme} />
                  </div>
                </div>
              </div>

              <div>
                <Label>Police d'écriture</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choisissez la typographie utilisée dans l'aperçu et par vos participants.
                </p>
                <Select value={previewFont} onValueChange={setPreviewFont}>
                  <SelectTrigger className="mt-2" style={{ fontFamily: activeFont.stack }}>
                    <SelectValue placeholder="Sélectionner une police" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {FONT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="py-2">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold" style={{ fontFamily: option.stack }}>
                            {option.label}
                          </span>
                          <span className="text-xs text-muted-foreground" style={{ fontFamily: option.stack }}>
                            {option.tagline}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div
                  className="mt-3 rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground"
                  style={{ fontFamily: activeFont.stack }}
                >
                  <p className="text-base font-semibold text-foreground">
                    {title?.trim() || (isPoll ? "Mon Sondage" : "Mon Quiz")}
                  </p>
                  <p className="mt-1">
                    {description?.trim() || "Aperçu de la police sélectionnée pour vos questions."}
                  </p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Button
          variant="outline"
          size="icon"
          onClick={handlePreviewQuiz}
          disabled={questions.length === 0}
          title={t('launchPreview')}
        >
          <Play className="w-5 h-5" />
        </Button>
        <Button onClick={handleSaveQuiz} size="icon" title={t('save')}>
          <Save className="w-5 h-5" />
        </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with integrated toolbar */}
      <Header
        subtitle={isFlashcard ? "Créateur de Flashcards" : (isPoll ? t('pollBuilder') : t('quizBuilder'))}
        toolbar={builderToolbar}
        toolbarPlacement="main"
        showNavigation={false}
        alignLeft
        actionStyle="icons-only"
      />
      {/* Main Content */}
      <div className="relative flex-1 flex overflow-hidden">
        {/* Left Sidebar - Navigation */}
        <div
          className={`${sidebarOpen ? 'w-72 border-r bg-card' : 'w-0'} overflow-hidden transition-all duration-200`}
        >
          <div className="flex h-full flex-col overflow-y-auto">
            <div className="border-b border-border/60 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('builderMenu')}
              </p>
              <nav className="space-y-2">
                {sidebarNavigationItems
                  .filter((item) => (item.requiresAuth ? Boolean(user) : true))
                  .map((item) => {
                    const Icon = item.icon;
                    return (
                      <Button
                        key={item.label}
                        variant="ghost"
                        size="sm"
                        onClick={item.action}
                        className="w-full justify-start gap-2 rounded-lg text-sm text-foreground/80 transition-colors hover:bg-muted/40 hover:text-foreground"
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Button>
                    );
                  })}
              </nav>
            </div>
            <div className="flex-1 space-y-6 p-4">
              <div>
                <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Thèmes</p>
                <div className="space-y-3">
                  <ThemeSelectionDropdown value={theme} onChange={setTheme} />
                  <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                    <ThemePreviewPanel theme={activeTheme} />
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Templates</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setTemplateDialogOpen(true)}
                >
                  {t('changeTemplate')}
                </Button>
                {activeTemplateId && (
                  <div className="mt-3 rounded-lg border bg-muted/40 p-3 text-sm">
                    <p className="font-medium text-foreground">{t('currentTemplate')}</p>
                    <p className="text-muted-foreground">
                      {(isPoll ? getPollTemplate(activeTemplateId) : getQuizTemplate(activeTemplateId))?.name || t('customTemplate')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <Button
          variant="secondary"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title={sidebarOpen ? t('hideThemes') : t('showThemes')}
          aria-label={sidebarOpen ? t('hideThemes') : t('showThemes')}
          className={cn(
            "absolute z-20 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm transition-all hover:text-foreground",
            sidebarOpen ? "left-[288px]" : "left-6"
          )}
          style={sidebarTogglePositionStyle}
        >
          {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>

        {/* Center - Questions List + Preview */}
        <div className="flex-1 flex overflow-hidden">
          {/* Questions List */}
          <div className="w-80 border-r bg-muted/30 overflow-y-auto p-4">
            <div className="mb-4 space-y-3">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isPoll ? t('pollTitle') : t('quizTitle')}
                className="font-medium"
              />
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">
                  {isFlashcard ? "Cartes" : "Questions"}
                </h3>
              </div>
            </div>

            {/* Nouvelle question/carte button */}
            <Button
              onClick={() => {
                setCurrentQuestion(getDefaultQuestion());
                setEditingIndex(null);
                setQuestionEditorOpen(true);
              }}
              className="w-full mb-4"
              variant="outline"
            >
              <Plus className="w-4 h-4 mr-2" />
              {isFlashcard ? "Nouvelle carte" : "Nouvelle question"}
            </Button>

            {!isPoll && !isFlashcard && user && (
              <Button
                onClick={() => setQuestionBankDialogOpen(true)}
                className="w-full mb-4"
                variant="ghost"
              >
                <Library className="w-4 h-4 mr-2" />
                {t('importFromQuestionBank')}
              </Button>
            )}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={questions.map(q => q.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3 pr-1">
                  {questions.map((question, index) => (
                     <SortableQuestionItem
                      key={question.id}
                      question={question}
                      index={index}
                      onEdit={(idx: number) => {
                        handleEditQuestion(idx);
                      }}
                      onDelete={handleDeleteQuestion}
                      onDuplicate={handleDuplicateQuestion}
                      isActive={selectedQuestionIndex === index}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            {questions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t(isFlashcard ? 'noFlashcards' : 'noQuestions')}
              </p>
            )}
          </div>

          {/* Preview */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto p-0">
              {isFlashcard && selectedQuestionIndex !== null && questions[selectedQuestionIndex] ? (
                <FlashcardPreview
                  flashcard={questions[selectedQuestionIndex]}
                  theme={activeTheme}
                />
              ) : isFlashcard ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  {t('selectFlashcardToPreview')}
                </div>
              ) : (
                <QuizPreview
                  title={title || (isPoll ? "Mon Sondage" : "Mon Quiz") }
                  description={description}
                  category={category}
                  headerImage={headerImage}
                  questions={questions}
                  isPoll={isPoll}
                  theme={theme}
                  selectedQuestionIndex={selectedQuestionIndex}
                  fontFamily={activeFont.stack}
                />
              )}
            </div>
          </div>
      </div>

      {/* Right Sidebar - Add Question */}
      <div
        className={`${questionEditorOpen ? 'w-96 border-l bg-card' : 'w-0'} transition-all duration-200 overflow-y-auto`}
      >
          <div
            className={`h-full transition-opacity duration-200 ${questionEditorOpen ? 'p-4 opacity-100' : 'p-0 opacity-0 pointer-events-none'}`}
            aria-hidden={!questionEditorOpen}
          >
            <h3 className="font-semibold text-foreground mb-4">
              {isFlashcard 
                ? (editingIndex !== null ? "Modifier la carte" : "Ajouter une carte")
                : (editingIndex !== null ? t('editQuestion') : t('addQuestion'))
              }
            </h3>

            {isFlashcard ? (
              <div className="mt-4">
                {renderQuestionForm()}
                <div className="flex gap-2 mt-6">
                  <Button onClick={handleAddQuestion} className="flex-1">
                    {editingIndex !== null ? "Modifier" : "Ajouter"}
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
              </div>
            ) : (
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
            )}
        </div>
      </div>

      <Button
        variant="secondary"
        size="icon"
        onClick={() => setQuestionEditorOpen(!questionEditorOpen)}
        title={questionEditorOpen ? t('hideQuestionEditor') : t('showQuestionEditor')}
        aria-label={questionEditorOpen ? t('hideQuestionEditor') : t('showQuestionEditor')}
        className={cn(
          "absolute z-20 h-9 w-9 translate-x-1/2 -translate-y-1/2 rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm transition-all hover:text-foreground",
          questionEditorOpen ? "right-[384px]" : "right-6"
        )}
        style={sidebarTogglePositionStyle}
      >
        {questionEditorOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>
    </div>

      <Dialog open={questionBankDialogOpen} onOpenChange={setQuestionBankDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t('importFromQuestionBank')}</DialogTitle>
            <DialogDescription>{t('questionBankImportDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {questionBankItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-6 text-center">
                <p className="text-sm text-muted-foreground">{t('questionBankEmpty')}</p>
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => {
                    handleNavigateAway('/question-bank', () => setQuestionBankDialogOpen(false));
                  }}
                >
                  {t('manageQuestionBank')}
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {questionBankItems.map((item) => (
                  <Card key={item.id} className="flex h-full flex-col border-border/60 bg-card">
                    <CardHeader>
                      <CardTitle className="text-lg text-foreground">{item.title}</CardTitle>
                      {item.topic && (
                        <CardDescription className="text-muted-foreground">{item.topic}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col gap-4">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{t('question')}</p>
                        <p className="mt-1 text-sm text-foreground line-clamp-3">
                          {item.question.question?.trim() || t('noQuestionText')}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="rounded-full">
                          {getQuestionTypeName(item.question.type as QuizQuestionType)}
                        </Badge>
                        {item.topic && (
                          <Badge variant="outline" className="rounded-full">
                            {item.topic}
                          </Badge>
                        )}
                        {item.difficulty && (
                          <Badge variant="outline" className="rounded-full">
                            {t(difficultyTranslationKeyMap[item.difficulty])}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-auto flex justify-end">
                        <Button onClick={() => handleImportFromQuestionBank(item)}>{t('importQuestion')}</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t('changeTemplate')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isPoll ? (
              <PollTemplateSelectorEnhanced
                selectedTemplateId={activeTemplateId}
                onSelectTemplate={applyTemplate}
              />
            ) : (
              <QuizTemplateSelectorEnhanced
                selectedTemplateId={activeTemplateId}
                onSelectTemplate={applyTemplate}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
