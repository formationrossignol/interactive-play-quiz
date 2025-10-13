import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { QuestionBankQuestionForm } from "@/components/QuestionBankQuestionForm";
import { createDefaultQuizQuestion } from "@/lib/questionDefaults";
import {
  addQuestionToBank,
  deleteQuestionBankItem,
  duplicateQuestionBankItem,
  getQuestionBankForUser,
  sanitizeQuestionForBank,
  updateQuestionBankItem,
  type QuestionBankItem,
  type QuestionDifficulty,
} from "@/lib/questionBank";
import { getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { toast } from "sonner";
import { Copy, Edit, Plus, Trash2 } from "lucide-react";
import type { QuizQuestionType } from "@/lib/questionTypes";

const QUESTION_TYPE_OPTIONS: { value: QuizQuestionType; label: string }[] = [
  { value: "multiple-choice", label: "multipleChoice" },
  { value: "true-false", label: "trueFalse" },
  { value: "short-answer", label: "shortAnswer" },
  { value: "ranking", label: "ranking" },
  { value: "matching", label: "matching" },
  { value: "fill-blank", label: "fillBlank" },
  { value: "slider", label: "slider" },
];

const DIFFICULTY_OPTIONS: { value: QuestionDifficulty; label: string }[] = [
  { value: "easy", label: "difficultyEasy" },
  { value: "medium", label: "difficultyMedium" },
  { value: "hard", label: "difficultyHard" },
];

const QuestionBank = () => {
  const navigate = useNavigate();
  const user = useMemo(() => getCurrentUser(), []);
  const [items, setItems] = useState<QuestionBankItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<QuestionBankItem | null>(null);
  const [questionType, setQuestionType] = useState<QuizQuestionType>("multiple-choice");
  const [currentQuestion, setCurrentQuestion] = useState<any>(createDefaultQuizQuestion());
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>("medium");
  const [tagsInput, setTagsInput] = useState("");
  const [description, setDescription] = useState("");

  const refreshItems = () => {
    if (!user) return;
    setItems(getQuestionBankForUser(user.id));
  };

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    refreshItems();
  }, [user, navigate]);

  const resetForm = () => {
    setEditingItem(null);
    setQuestionType("multiple-choice");
    setCurrentQuestion(createDefaultQuizQuestion());
    setTitle("");
    setTopic("");
    setDifficulty("medium");
    setTagsInput("");
    setDescription("");
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (item: QuestionBankItem) => {
    setEditingItem(item);
    const typedQuestion = sanitizeQuestionForBank(item.question);
    setQuestionType(typedQuestion.type as QuizQuestionType);
    setCurrentQuestion(typedQuestion);
    setTitle(item.title);
    setTopic(item.topic || "");
    setDifficulty(item.difficulty || "medium");
    setTagsInput(item.tags?.join(", ") || "");
    setDescription(item.question?.explanation || item.question?.description || "");
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!user) {
      toast.error(t("authRequired"));
      return;
    }

    if (!title.trim()) {
      toast.error(t("questionTitleRequired"));
      return;
    }

    if (!currentQuestion.question?.trim()) {
      toast.error(t("questionRequired"));
      return;
    }

    const payload = {
      title: title.trim(),
      topic: topic.trim() || undefined,
      difficulty,
      tags: tagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      question: {
        ...sanitizeQuestionForBank(currentQuestion),
        type: questionType,
        explanation: description.trim() || undefined,
      },
    };

    try {
      if (editingItem) {
        updateQuestionBankItem(editingItem.id, payload);
        toast.success(t("questionBankUpdated"));
      } else {
        addQuestionToBank(payload);
        toast.success(t("questionBankAdded"));
      }
      setDialogOpen(false);
      resetForm();
      refreshItems();
    } catch (error) {
      toast.error(t("questionBankSaveError"));
    }
  };

  const handleDelete = (item: QuestionBankItem) => {
    if (deleteQuestionBankItem(item.id)) {
      toast.success(t("questionBankDeleted"));
      refreshItems();
    }
  };

  const handleDuplicate = (item: QuestionBankItem) => {
    const duplicated = duplicateQuestionBankItem(item.id);
    if (duplicated) {
      toast.success(t("questionBankDuplicated"));
      refreshItems();
    }
  };

  const handleTypeChange = (value: QuizQuestionType) => {
    setQuestionType(value);
    setCurrentQuestion(createDefaultQuizQuestion(value));
  };

  const renderTags = (item: QuestionBankItem) => {
    if (!item.tags || item.tags.length === 0) {
      return null;
    }

    return (
      <div className="flex flex-wrap gap-2">
        {item.tags.map((tag) => (
          <Badge key={tag} variant="outline" className="rounded-full">
            #{tag}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Header subtitle={t("questionBank")} />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("questionBank")}</h1>
            <p className="text-muted-foreground">{t("questionBankSubtitle")}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate("/builder?type=quiz")}>
              {t("openQuizBuilder")}
            </Button>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              {t("addQuestionToBank")}
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-border/60 bg-muted/20 p-10 text-center">
              <p className="text-sm text-muted-foreground">{t("questionBankEmptyManage")}</p>
              <Button className="mt-4" onClick={openCreateDialog}>
                {t("addFirstQuestion")}
              </Button>
            </div>
          ) : (
            items.map((item) => (
              <Card key={item.id} className="flex h-full flex-col border-border/60 bg-card/80">
                <CardHeader>
                  <CardTitle className="text-xl text-foreground">{item.title}</CardTitle>
                  {item.topic && <p className="text-sm text-muted-foreground">{item.topic}</p>}
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {item.question.question || t("noQuestionText")}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {(() => {
                      const typeLabelKey = QUESTION_TYPE_OPTIONS.find((option) => option.value === item.question.type)?.label;
                      return typeLabelKey ? (
                        <Badge variant="secondary" className="rounded-full">
                          {t(typeLabelKey)}
                        </Badge>
                      ) : null;
                    })()}
                    {(() => {
                      if (!item.difficulty) return null;
                      const difficultyLabel = DIFFICULTY_OPTIONS.find((option) => option.value === item.difficulty)?.label;
                      return difficultyLabel ? (
                        <Badge variant="outline" className="rounded-full">
                          {t(difficultyLabel)}
                        </Badge>
                      ) : null;
                    })()}
                  </div>
                  {renderTags(item)}
                </CardContent>
                <CardFooter className="flex items-center justify-between gap-2 border-t border-border/40 pt-4">
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleDuplicate(item)} title={t("duplicate")}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} title={t("edit")}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item)} title={t("delete")}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div />
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? t("editBankQuestion") : t("addQuestionToBank")}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[75vh] pr-4">
            <div className="space-y-6 py-2">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>{t("questionTitle")}</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-2" />
                </div>
                <div>
                  <Label>{t("questionTopic")}</Label>
                  <Input value={topic} onChange={(e) => setTopic(e.target.value)} className="mt-2" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>{t("questionType")}</Label>
                  <Select value={questionType} onValueChange={(value: QuizQuestionType) => handleTypeChange(value)}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {QUESTION_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {t(option.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("questionDifficulty")}</Label>
                  <Select value={difficulty} onValueChange={(value: QuestionDifficulty) => setDifficulty(value)}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {DIFFICULTY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {t(option.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>{t("questionTags")}</Label>
                <Input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder={t("questionTagsHelper")}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>{t("questionNotes")}</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("questionNotesHelper")}
                  className="mt-2"
                />
              </div>
              <QuestionBankQuestionForm question={currentQuestion} onChange={setCurrentQuestion} />
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleSave}>{t("save")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuestionBank;
