import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Pagination } from "@/components/Pagination";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuestionBankQuestionForm } from "@/components/QuestionBankQuestionForm";
import { createDefaultQuizQuestion } from "@/lib/questionDefaults";
import { getUserQuizzes } from "@/lib/quizStorage";
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
import { Copy, Edit, Plus, Search, Trash2, ExternalLink, LayoutGrid, List } from "lucide-react";
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

const DIFFICULTY_BADGE: Record<QuestionDifficulty, string> = {
  easy: "ap-badge--pres",
  medium: "ap-badge--flash",
  hard: "ap-badge--quiz",
};

const PAGE_SIZE = 12;
const VIEW_KEY = "view-mode-question-bank";

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontFamily: "var(--ap-font-body)",
  fontWeight: 700,
  fontSize: "14px",
  color: "var(--ap-ink)",
  background: "var(--ap-card)",
  border: "2px solid var(--ap-line)",
  borderRadius: "var(--ap-r-sm)",
  padding: "10px 14px",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color .12s, box-shadow .12s",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 800,
  fontSize: "11px",
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  color: "var(--ap-muted)",
  marginBottom: "7px",
  fontFamily: "var(--ap-font-body)",
};

const QuestionBank = () => {
  const navigate = useNavigate();
  const user = useMemo(() => getCurrentUser(), []);
  const [items, setItems] = useState<QuestionBankItem[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<{
    id: string;
    quizId: string;
    quizTitle: string;
    position: number;
    type: QuizQuestionType;
    question: any;
  }[]>([]);

  /* ---- dialog ---- */
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<QuestionBankItem | null>(null);
  const [questionType, setQuestionType] = useState<QuizQuestionType>("multiple-choice");
  const [currentQuestion, setCurrentQuestion] = useState<any>(createDefaultQuizQuestion());
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>("medium");
  const [tagsInput, setTagsInput] = useState("");
  const [description, setDescription] = useState("");

  /* ---- view mode (partagé par les deux sections, comme Mes Quiz) ---- */
  const [viewMode, setViewMode] = useState<"grid" | "list">(
    () => (localStorage.getItem(VIEW_KEY) as "grid" | "list") ?? "grid"
  );
  const setView = (mode: "grid" | "list") => {
    setViewMode(mode);
    localStorage.setItem(VIEW_KEY, mode);
  };

  /* ---- bank filters ---- */
  const [bankSearch, setBankSearch] = useState("");
  const [bankTypeFilter, setBankTypeFilter] = useState("all");
  const [bankDiffFilter, setBankDiffFilter] = useState("all");
  const [bankPage, setBankPage] = useState(1);

  /* ---- quiz questions filters ---- */
  const [qqSearch, setQqSearch] = useState("");
  const [qqPage, setQqPage] = useState(1);

  const refreshItems = () => {
    if (!user) return;
    setItems(getQuestionBankForUser(user.id));
    const quizzes = getUserQuizzes(user.id).filter((quiz) => quiz.type !== "flashcard");
    const aggregated = quizzes.flatMap((quiz) =>
      Array.isArray(quiz.questions)
        ? quiz.questions.map((question, index) => ({
            id: `${quiz.id}-${index}`,
            quizId: quiz.id,
            quizTitle: quiz.title || t("untitledQuiz"),
            position: index + 1,
            type: (question?.type as QuizQuestionType) ?? "multiple-choice",
            question,
          }))
        : []
    );
    setQuizQuestions(aggregated);
  };

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    refreshItems();
  }, [user, navigate]);

  /* ---- filtered bank ---- */
  const filteredBank = useMemo(() => {
    const q = bankSearch.toLowerCase();
    return items.filter((item) => {
      const matchSearch = !q || item.title.toLowerCase().includes(q) || (item.topic ?? "").toLowerCase().includes(q) || (item.tags ?? []).some((tg) => tg.toLowerCase().includes(q));
      const matchType = bankTypeFilter === "all" || item.question?.type === bankTypeFilter;
      const matchDiff = bankDiffFilter === "all" || item.difficulty === bankDiffFilter;
      return matchSearch && matchType && matchDiff;
    });
  }, [items, bankSearch, bankTypeFilter, bankDiffFilter]);

  const bankTotalPages = Math.max(1, Math.ceil(filteredBank.length / PAGE_SIZE));
  const bankPaginated = filteredBank.slice((bankPage - 1) * PAGE_SIZE, bankPage * PAGE_SIZE);
  useEffect(() => { setBankPage(1); }, [bankSearch, bankTypeFilter, bankDiffFilter]);

  /* ---- filtered quiz questions ---- */
  const filteredQQ = useMemo(() => {
    const q = qqSearch.toLowerCase();
    return !q ? quizQuestions : quizQuestions.filter((item) => {
      const text = item.question?.question || item.question?.prompt || item.question?.title || "";
      return text.toLowerCase().includes(q) || item.quizTitle.toLowerCase().includes(q);
    });
  }, [quizQuestions, qqSearch]);

  const qqTotalPages = Math.max(1, Math.ceil(filteredQQ.length / PAGE_SIZE));
  const qqPaginated = filteredQQ.slice((qqPage - 1) * PAGE_SIZE, qqPage * PAGE_SIZE);
  useEffect(() => { setQqPage(1); }, [qqSearch]);

  /* ---- form helpers ---- */
  const resetForm = () => {
    setEditingItem(null);
    setQuestionType("multiple-choice");
    setCurrentQuestion(createDefaultQuizQuestion());
    setTitle(""); setTopic(""); setDifficulty("medium"); setTagsInput(""); setDescription("");
  };

  const openCreateDialog = () => { resetForm(); setDialogOpen(true); };
  const openEditDialog = (item: QuestionBankItem) => {
    setEditingItem(item);
    const typedQuestion = sanitizeQuestionForBank(item.question);
    setQuestionType(typedQuestion.type as QuizQuestionType);
    setCurrentQuestion(typedQuestion);
    setTitle(item.title); setTopic(item.topic || "");
    setDifficulty(item.difficulty || "medium");
    setTagsInput(item.tags?.join(", ") || "");
    setDescription(item.question?.explanation || item.question?.description || "");
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!user) { toast.error(t("authRequired")); return; }
    if (!title.trim()) { toast.error(t("questionTitleRequired")); return; }
    if (!currentQuestion.question?.trim()) { toast.error(t("questionRequired")); return; }
    const payload = {
      title: title.trim(), topic: topic.trim() || undefined, difficulty,
      tags: tagsInput.split(",").map((tag) => tag.trim()).filter(Boolean),
      question: { ...sanitizeQuestionForBank(currentQuestion), type: questionType, explanation: description.trim() || undefined },
    };
    try {
      if (editingItem) { updateQuestionBankItem(editingItem.id, payload); toast.success(t("questionBankUpdated")); }
      else { addQuestionToBank(payload); toast.success(t("questionBankAdded")); }
      setDialogOpen(false); resetForm(); refreshItems();
    } catch { toast.error(t("questionBankSaveError")); }
  };

  const handleDelete = (item: QuestionBankItem) => {
    if (deleteQuestionBankItem(item.id)) { toast.success(t("questionBankDeleted")); refreshItems(); }
  };
  const handleDuplicate = (item: QuestionBankItem) => {
    if (duplicateQuestionBankItem(item.id)) { toast.success(t("questionBankDuplicated")); refreshItems(); }
  };
  const handleTypeChange = (value: QuizQuestionType) => {
    setQuestionType(value);
    setCurrentQuestion(createDefaultQuizQuestion(value));
  };

  /* ---- shared UI helpers ---- */
  const focusInput = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = "var(--ap-brand)";
    e.currentTarget.style.boxShadow = "0 0 0 4px var(--ap-brand-soft)";
  };
  const blurInput = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = "var(--ap-line)";
    e.currentTarget.style.boxShadow = "none";
  };

  const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px",
    background: active ? "var(--ap-brand-soft)" : "transparent",
    color: active ? "var(--ap-brand)" : "var(--ap-muted)",
    border: `2px solid ${active ? "var(--ap-brand)" : "var(--ap-line)"}`,
    borderRadius: "var(--ap-r-sm)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  });

  const ViewToggle = () => (
    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
      <button onClick={() => setView("grid")} style={toggleBtnStyle(viewMode === "grid")} title="Vue grille"><LayoutGrid className="w-4 h-4" /></button>
      <button onClick={() => setView("list")} style={toggleBtnStyle(viewMode === "list")} title="Vue liste"><List className="w-4 h-4" /></button>
    </div>
  );

  const FilterRow = ({
    search, onSearch, typeFilter, onTypeFilter, diffFilter, onDiffFilter, showDiff = true,
  }: {
    search: string; onSearch: (v: string) => void;
    typeFilter?: string; onTypeFilter?: (v: string) => void;
    diffFilter?: string; onDiffFilter?: (v: string) => void;
    showDiff?: boolean;
  }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "24px" }}>
      {/* search */}
      <div style={{ position: "relative", flex: "1 1 220px", minWidth: 0 }}>
        <Search
          style={{
            position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
            width: 16, height: 16, color: "var(--ap-muted)", pointerEvents: "none",
          }}
        />
        <input
          style={{ ...inputStyle, paddingLeft: "38px" }}
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          onFocus={focusInput}
          onBlur={blurInput}
        />
      </div>
      {/* type */}
      {onTypeFilter && (
        <Select value={typeFilter} onValueChange={onTypeFilter}>
          <SelectTrigger
            style={{
              flex: "0 0 auto",
              width: 180,
              fontFamily: "var(--ap-font-body)",
              fontWeight: 700,
              fontSize: "14px",
              border: "2px solid var(--ap-line)",
              borderRadius: "var(--ap-r-sm)",
              background: "var(--ap-card)",
              color: "var(--ap-ink)",
              height: "42px",
            }}
          >
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent style={{ background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
            <SelectItem value="all">Tous les types</SelectItem>
            {QUESTION_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{t(o.label as any)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {/* difficulty */}
      {showDiff && onDiffFilter && (
        <Select value={diffFilter} onValueChange={onDiffFilter}>
          <SelectTrigger
            style={{
              flex: "0 0 auto",
              width: 160,
              fontFamily: "var(--ap-font-body)",
              fontWeight: 700,
              fontSize: "14px",
              border: "2px solid var(--ap-line)",
              borderRadius: "var(--ap-r-sm)",
              background: "var(--ap-card)",
              color: "var(--ap-ink)",
              height: "42px",
            }}
          >
            <SelectValue placeholder="Difficulté" />
          </SelectTrigger>
          <SelectContent style={{ background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
            <SelectItem value="all">Toutes</SelectItem>
            {DIFFICULTY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{t(o.label as any)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <ViewToggle />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh" }}>
      <Header subtitle={t("questionBank")} />

      <div className="mx-auto max-w-6xl px-6 py-10">

        {/* ── Page header ── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "36px" }}>
          <div>
            <h1 className="ap-h2" style={{ fontSize: "28px", marginBottom: "6px" }}>{t("questionBank")}</h1>
            <p className="ap-muted" style={{ fontSize: "14px" }}>{t("questionBankSubtitle")}</p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button className="ap-btn ap-btn--ghost ap-btn--sm" onClick={() => navigate("/builder?type=quiz")}>
              <ExternalLink className="h-4 w-4" />
              {t("openQuizBuilder")}
            </button>
            <button className="ap-btn ap-btn--sm ap-btn--pill" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              {t("addQuestionToBank")}
            </button>
          </div>
        </div>

        {/* ── Bank section ── */}
        <section style={{ marginBottom: "56px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "20px" }}>
            <h2 className="ap-h3">{t("questionBank")}</h2>
            <span className="ap-badge ap-badge--brand">{filteredBank.length}</span>
          </div>

          <FilterRow
            search={bankSearch} onSearch={setBankSearch}
            typeFilter={bankTypeFilter} onTypeFilter={setBankTypeFilter}
            diffFilter={bankDiffFilter} onDiffFilter={setBankDiffFilter}
          />

          {filteredBank.length === 0 ? (
            <div
              style={{
                borderRadius: "var(--ap-r-lg)", border: "2px dashed var(--ap-line-2)",
                background: "var(--ap-paper-2)", padding: "48px 24px", textAlign: "center",
              }}
            >
              <p className="ap-muted" style={{ marginBottom: "16px", fontSize: "14px" }}>
                {items.length === 0 ? t("questionBankEmptyManage") : "Aucun résultat pour cette recherche."}
              </p>
              {items.length === 0 && (
                <button className="ap-btn ap-btn--sm ap-btn--pill" onClick={openCreateDialog}>
                  {t("addFirstQuestion")}
                </button>
              )}
            </div>
          ) : viewMode === "list" ? (
            <>
              <div className="ap-card" style={{ padding: 0, overflow: "hidden" }}>
                {bankPaginated.map((item, idx) => {
                  const typeLabel = QUESTION_TYPE_OPTIONS.find((o) => o.value === item.question?.type)?.label;
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px",
                        borderTop: idx > 0 ? "2px solid var(--ap-line)" : "none",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 className="ap-h3" style={{ fontSize: "15px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</h3>
                        <p className="ap-muted" style={{ fontSize: "12.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                          {item.question?.question || t("noQuestionText")}
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {typeLabel && <span className="ap-badge ap-badge--brand">{t(typeLabel as any)}</span>}
                        {item.difficulty && (
                          <span className={`ap-badge ${DIFFICULTY_BADGE[item.difficulty]}`}>
                            {t(DIFFICULTY_OPTIONS.find((o) => o.value === item.difficulty)?.label as any)}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                        <button className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "7px 10px" }} onClick={() => handleDuplicate(item)} title={t("duplicate")}>
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "7px 10px" }} onClick={() => openEditDialog(item)} title={t("edit")}>
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "7px 10px", color: "var(--ap-quiz)" }} onClick={() => handleDelete(item)} title={t("delete")}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Pagination page={bankPage} totalPages={bankTotalPages} onPageChange={setBankPage} className="mt-8" />
            </>
          ) : (
            <>
              <div style={{ display: "grid", gap: "18px", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
                {bankPaginated.map((item) => {
                  const typeLabel = QUESTION_TYPE_OPTIONS.find((o) => o.value === item.question?.type)?.label;
                  return (
                    <div key={item.id} className="ap-card ap-card--hover" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {/* header */}
                      <div>
                        <h3 className="ap-h3" style={{ fontSize: "16px", marginBottom: "4px" }}>{item.title}</h3>
                        {item.topic && <p className="ap-muted" style={{ fontSize: "12px" }}>{item.topic}</p>}
                      </div>
                      {/* question text */}
                      <p className="ap-muted" style={{ fontSize: "13px", lineHeight: 1.45, flex: 1 }}>
                        {item.question?.question || t("noQuestionText")}
                      </p>
                      {/* badges */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {typeLabel && (
                          <span className="ap-badge ap-badge--brand">{t(typeLabel as any)}</span>
                        )}
                        {item.difficulty && (
                          <span className={`ap-badge ${DIFFICULTY_BADGE[item.difficulty]}`}>
                            {t(DIFFICULTY_OPTIONS.find((o) => o.value === item.difficulty)?.label as any)}
                          </span>
                        )}
                        {(item.tags ?? []).map((tag) => (
                          <span key={tag} className="ap-pill" style={{ fontSize: "11px", padding: "3px 9px" }}>
                            #{tag}
                          </span>
                        ))}
                      </div>
                      {/* actions */}
                      <div
                        style={{
                          display: "flex", alignItems: "center", gap: "4px",
                          paddingTop: "12px", borderTop: "2px solid var(--ap-line)",
                        }}
                      >
                        <button
                          className="ap-btn ap-btn--ghost ap-btn--sm"
                          style={{ padding: "7px 10px" }}
                          onClick={() => handleDuplicate(item)}
                          title={t("duplicate")}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="ap-btn ap-btn--ghost ap-btn--sm"
                          style={{ padding: "7px 10px" }}
                          onClick={() => openEditDialog(item)}
                          title={t("edit")}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="ap-btn ap-btn--ghost ap-btn--sm"
                          style={{ padding: "7px 10px", color: "var(--ap-quiz)" }}
                          onClick={() => handleDelete(item)}
                          title={t("delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Pagination page={bankPage} totalPages={bankTotalPages} onPageChange={setBankPage} className="mt-8" />
            </>
          )}
        </section>

        {/* ── Quiz questions section ── */}
        <section>
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "8px" }}>
            <h2 className="ap-h3">{t("myQuizQuestions")}</h2>
            <span className="ap-badge ap-badge--quiz">{filteredQQ.length}</span>
          </div>
          <p className="ap-muted" style={{ fontSize: "13.5px", marginBottom: "20px" }}>{t("myQuizQuestionsDescription")}</p>

          <FilterRow
            search={qqSearch} onSearch={setQqSearch}
            showDiff={false}
          />

          {filteredQQ.length === 0 ? (
            <div
              style={{
                borderRadius: "var(--ap-r-lg)", border: "2px dashed var(--ap-line-2)",
                background: "var(--ap-paper-2)", padding: "48px 24px", textAlign: "center",
              }}
            >
              <p className="ap-muted" style={{ fontSize: "14px", marginBottom: "16px" }}>
                {quizQuestions.length === 0 ? t("myQuizQuestionsEmpty") : "Aucun résultat."}
              </p>
              {quizQuestions.length === 0 && (
                <button className="ap-btn ap-btn--ghost ap-btn--sm ap-btn--pill" onClick={() => navigate("/builder?type=quiz")}>
                  {t("createQuiz")}
                </button>
              )}
            </div>
          ) : viewMode === "list" ? (
            <>
              <div className="ap-card" style={{ padding: 0, overflow: "hidden" }}>
                {qqPaginated.map((item, idx) => {
                  const typeLabel = QUESTION_TYPE_OPTIONS.find((o) => o.value === item.type)?.label;
                  const questionText = item.question?.question?.trim() || item.question?.prompt?.trim() || item.question?.title?.trim() || t("noQuestionText");
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px",
                        borderTop: idx > 0 ? "2px solid var(--ap-line)" : "none",
                      }}
                    >
                      <span className="ap-pill" style={{ fontSize: "11px", padding: "3px 9px", flexShrink: 0 }}>#{item.position}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 className="ap-h3" style={{ fontSize: "14.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{questionText}</h3>
                        <p className="ap-muted" style={{ fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                          {item.quizTitle}
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                        {typeLabel && <span className="ap-badge ap-badge--poll">{t(typeLabel as any)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <Pagination page={qqPage} totalPages={qqTotalPages} onPageChange={setQqPage} className="mt-8" />
            </>
          ) : (
            <>
              <div style={{ display: "grid", gap: "18px", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
                {qqPaginated.map((item) => {
                  const typeLabel = QUESTION_TYPE_OPTIONS.find((o) => o.value === item.type)?.label;
                  const questionText = item.question?.question?.trim() || item.question?.prompt?.trim() || item.question?.title?.trim() || t("noQuestionText");
                  return (
                    <div key={item.id} className="ap-card ap-card--hover" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                        <span className="ap-pill" style={{ fontSize: "11px", padding: "3px 9px" }}>#{item.position}</span>
                        <span
                          className="ap-pill"
                          style={{ fontSize: "11px", padding: "3px 9px", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                          title={item.quizTitle}
                        >
                          {item.quizTitle}
                        </span>
                      </div>
                      <h3 className="ap-h3" style={{ fontSize: "15px", lineHeight: 1.35 }}>{questionText}</h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "auto" }}>
                        {typeLabel && <span className="ap-badge ap-badge--poll">{t(typeLabel as any)}</span>}
                        <span className="ap-badge ap-badge--pres">{t("fromQuiz")}</span>
                      </div>
                      {item.question?.description && (
                        <p className="ap-muted" style={{ fontSize: "12px", lineHeight: 1.4 }}>{item.question.description}</p>
                      )}
                    </div>
                  );
                })}
              </div>
              <Pagination page={qqPage} totalPages={qqTotalPages} onPageChange={setQqPage} className="mt-8" />
            </>
          )}
        </section>
      </div>

      {/* ── Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-w-3xl"
          style={{
            background: "var(--ap-card)",
            border: "2px solid var(--ap-line)",
            borderRadius: "var(--ap-r-xl)",
            boxShadow: "var(--ap-shadow-card)",
          }}
        >
          <DialogHeader>
            <DialogTitle
              style={{ fontFamily: "var(--ap-font-display)", fontWeight: 600, fontSize: "20px", color: "var(--ap-ink)" }}
            >
              {editingItem ? t("editBankQuestion") : t("addQuestionToBank")}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[72vh] pr-4">
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", paddingBottom: "8px" }}>
              <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "1fr 1fr" }}>
                <div>
                  <label style={labelStyle}>{t("questionTitle")}</label>
                  <input
                    style={inputStyle}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onFocus={focusInput} onBlur={blurInput}
                  />
                </div>
                <div>
                  <label style={labelStyle}>{t("questionTopic")}</label>
                  <input
                    style={inputStyle}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onFocus={focusInput} onBlur={blurInput}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "1fr 1fr" }}>
                <div>
                  <label style={labelStyle}>{t("questionType")}</label>
                  <Select value={questionType} onValueChange={(v: QuizQuestionType) => handleTypeChange(v)}>
                    <SelectTrigger style={{ marginTop: "8px", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-sm)", background: "var(--ap-card)", fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: "14px" }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent style={{ background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
                      {QUESTION_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{t(o.label as any)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label style={labelStyle}>{t("questionDifficulty")}</label>
                  <Select value={difficulty} onValueChange={(v: QuestionDifficulty) => setDifficulty(v)}>
                    <SelectTrigger style={{ marginTop: "8px", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-sm)", background: "var(--ap-card)", fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: "14px" }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent style={{ background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
                      {DIFFICULTY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{t(o.label as any)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>{t("questionTags")}</label>
                <input
                  style={inputStyle}
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder={t("questionTagsHelper")}
                  onFocus={focusInput} onBlur={blurInput}
                />
              </div>

              <div>
                <label style={labelStyle}>{t("questionNotes")}</label>
                <textarea
                  style={{ ...inputStyle, resize: "vertical", minHeight: "80px", lineHeight: 1.4 }}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("questionNotesHelper")}
                  onFocus={focusInput} onBlur={blurInput}
                />
              </div>

              <QuestionBankQuestionForm question={currentQuestion} onChange={setCurrentQuestion} />
            </div>
          </ScrollArea>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "16px", borderTop: "2px solid var(--ap-line)" }}>
            <button className="ap-btn ap-btn--ghost ap-btn--sm ap-btn--pill" onClick={() => setDialogOpen(false)}>
              {t("cancel")}
            </button>
            <button className="ap-btn ap-btn--sm ap-btn--pill" onClick={handleSave}>
              {t("save")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuestionBank;
