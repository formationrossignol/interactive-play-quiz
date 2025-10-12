import { useState, useEffect } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  ChevronDown,
  Check,
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
import { cn } from "@/lib/utils";
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

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <span className="w-5 text-xs font-semibold text-muted-foreground text-right">{index + 1}</span>
      <div
        className={`group flex w-full min-h-[4.25rem] items-center justify-between gap-3 rounded-xl border-2 px-3 py-3 transition-all cursor-pointer ${
          isActive ? 'border-primary bg-primary/10 shadow-sm' : 'border-transparent bg-muted/40 hover:border-primary/40 hover:bg-muted/60'
        }`}
        onClick={() => onEdit(index)}
      >
        <div className="flex flex-1 items-center gap-3 min-w-0">
          <button
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
            title={t('dragToReorder')}
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconColors}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate text-foreground">
              {question.question?.trim() || t('noQuestionText')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(index);
            }}
            title="Dupliquer"
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(index);
            }}
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
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

const ThemeOptionPill = ({
  theme,
  showChevron = false,
  isActive = false,
}: {
  theme: Theme;
  showChevron?: boolean;
  isActive?: boolean;
}) => (
  <span
    className={cn(
      "flex w-full items-center gap-3 rounded-full border border-border/60 bg-background/80 px-2 py-2 shadow-sm backdrop-blur transition-colors",
      isActive && "border-primary/60 bg-primary/10 ring-1 ring-primary/40"
    )}
  >
    <span className="relative flex h-12 w-20 shrink-0 overflow-hidden rounded-full border border-border/60">
      <img
        src={theme.imageUrl}
        alt={theme.imageDescription}
        className="h-full w-full object-cover"
        loading="lazy"
      />
      <span className="absolute inset-0" aria-hidden style={{ background: getThemeOverlay(theme) }} />
      {isActive && (
        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
          <Check className="h-3 w-3" />
        </span>
      )}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-semibold text-foreground">{theme.name}</span>
      <span className="block text-xs text-muted-foreground line-clamp-1">{theme.imageDescription}</span>
    </span>
    <span className="flex items-center gap-2">
      <ThemePaletteChips theme={theme} />
      {showChevron && <ChevronDown className="h-4 w-4 text-muted-foreground" />}
    </span>
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

const ThemeSelectionList = ({
  value,
  onChange,
  columns = 1,
}: {
  value: string;
  onChange: (id: string) => void;
  columns?: 1 | 2;
}) => (
  <div className={cn("grid gap-3", columns === 2 ? "sm:grid-cols-2" : "grid-cols-1")}>
    {THEMES.map((themeOption) => {
      const isActive = themeOption.id === value;
      return (
        <button
          type="button"
          key={themeOption.id}
          onClick={() => onChange(themeOption.id)}
          aria-pressed={isActive}
          className={cn(
            "group block w-full rounded-[2rem] text-left transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            isActive ? "ring-2 ring-primary/40" : "hover:-translate-y-1"
          )}
        >
          <ThemeOptionPill theme={themeOption} isActive={isActive} />
        </button>
      );
    })}
  </div>
);

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
  const [theme, setTheme] = useState<string>(DEFAULT_THEME_ID);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [questionEditorOpen, setQuestionEditorOpen] = useState(true);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(templateId);
  const activeTheme = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  const [previewFont, setPreviewFont] = useState<string>(FONT_OPTIONS[0].value);
  const activeFont = FONT_OPTIONS.find((option) => option.value === previewFont) ?? FONT_OPTIONS[0];

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const sidebarNavigationItems = [
    {
      label: t('home'),
      icon: Home,
      action: () => navigate('/'),
      requiresAuth: false,
    },
    {
      label: t('myQuizzes'),
      icon: BookOpen,
      action: () => navigate('/my-quizzes'),
      requiresAuth: true,
    },
    {
      label: t('myPolls'),
      icon: BarChart3,
      action: () => navigate('/my-polls'),
      requiresAuth: true,
    },
  ];

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

  function getDefaultQuestion(type?: QuizQuestionType | PollQuestionType): any {
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
      const quizType = type || 'multiple-choice';

      const base = {
        type: quizType,
        question: '',
        timeLimit: 30,
        points: 100,
        image: '',
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
      font: previewFont,
    };
    localStorage.setItem(`quiz-${tempQuiz.id}`, JSON.stringify(tempQuiz));
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
    <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex w-full flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex w-full items-center gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isPoll ? t('pollTitle') : t('quizTitle')}
            className="font-medium sm:max-w-md flex-1"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
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
                  <ThemeSelectionList value={theme} onChange={setTheme} columns={2} />
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
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with integrated toolbar */}
      <Header
        subtitle={isPoll ? t('pollBuilder') : t('quizBuilder')}
        toolbar={builderToolbar}
        toolbarPlacement="main"
        showNavigation={false}
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
                  <ThemeSelectionList value={theme} onChange={setTheme} />
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
            "absolute top-1/2 z-20 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm transition-all hover:text-foreground",
            sidebarOpen ? "left-[288px]" : "left-6"
          )}
        >
          {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>

        {/* Center - Questions List + Preview */}
        <div className="flex-1 flex overflow-hidden">
          {/* Questions List */}
          <div className="w-80 border-r bg-muted/30 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Questions</h3>
            </div>
            
            {/* Nouvelle question button */}
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
              Nouvelle question
            </Button>

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
              <p className="text-sm text-muted-foreground text-center py-8">{t('noQuestions')}</p>
            )}
          </div>

          {/* Preview */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto p-0">
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

      <Button
        variant="secondary"
        size="icon"
        onClick={() => setQuestionEditorOpen(!questionEditorOpen)}
        title={questionEditorOpen ? t('hideQuestionEditor') : t('showQuestionEditor')}
        aria-label={questionEditorOpen ? t('hideQuestionEditor') : t('showQuestionEditor')}
        className={cn(
          "absolute top-1/2 z-20 h-9 w-9 translate-x-1/2 -translate-y-1/2 rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm transition-all hover:text-foreground",
          questionEditorOpen ? "right-[384px]" : "right-6"
        )}
      >
        {questionEditorOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>
    </div>

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
