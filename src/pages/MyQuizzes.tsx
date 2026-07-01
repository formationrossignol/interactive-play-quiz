import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pagination } from "@/components/Pagination";
import { RatingStars } from "@/components/RatingStars";
import { getCurrentUser } from "@/lib/auth";
import {
  deleteQuiz,
  duplicateQuiz,
  getFavoriteQuizzes,
  getPublicQuizzes,
  getUserQuizzes,
  rateQuiz,
  toggleFavorite,
  type SavedQuiz,
} from "@/lib/quizStorage";
import {
  createFolder,
  deleteFolder,
  getFolderItemCount,
  getFolders,
  moveToFolder,
  renameFolder,
  type Folder,
} from "@/lib/folderStorage";
import { FolderCard } from "@/components/FolderCard";
import { MoveToFolderMenu } from "@/components/MoveToFolderMenu";
import { DeleteQuizDialog } from "@/components/DeleteQuizDialog";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { ChevronRight, Copy, Edit, FolderPlus, LayoutGrid, List, Play, Search, Star, Trash2, FolderInput } from "lucide-react";
import { t } from "@/lib/i18n";
import { useCollectionFilters } from "@/hooks/useCollectionFilters";

const VIEW_KEY = "view-mode-quizzes";

const MyQuizzes = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [myQuizzes, setMyQuizzes] = useState<SavedQuiz[]>([]);
  const [favoriteQuizzes, setFavoriteQuizzes] = useState<SavedQuiz[]>([]);
  const [publicQuizzes, setPublicQuizzes] = useState<SavedQuiz[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState<SavedQuiz | null>(null);
  const [activeTab, setActiveTab] = useState("my");
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => (localStorage.getItem(VIEW_KEY) as "grid" | "list") ?? "grid");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [moveMenuOpenId, setMoveMenuOpenId] = useState<string | null>(null);
  const moveMenuRef = useRef<HTMLDivElement>(null);

  const setView = (mode: "grid" | "list") => {
    setViewMode(mode);
    localStorage.setItem(VIEW_KEY, mode);
  };

  const loadQuizzes = useCallback(() => {
    if (!user) return;
    const userQuizzes = getUserQuizzes(user.id);
    const publicQuizzesData = getPublicQuizzes();
    const favorite = getFavoriteQuizzes(user.id);
    setMyQuizzes(userQuizzes.filter((q) => q.type === "quiz"));
    setPublicQuizzes(publicQuizzesData.filter((q) => q.type === "quiz"));
    setFavoriteQuizzes(favorite.filter((q) => q.type === "quiz"));
    setFolders(getFolders(user.id, "quiz"));
  }, [user]);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    loadQuizzes();
  }, [user, navigate, loadQuizzes]);

  useEffect(() => {
    const handler = (e: globalThis.MouseEvent) => {
      if (moveMenuRef.current && !moveMenuRef.current.contains(e.target as Node)) {
        setMoveMenuOpenId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const myFilters = useCollectionFilters(myQuizzes);
  const favFilters = useCollectionFilters(favoriteQuizzes);
  const pubFilters = useCollectionFilters(publicQuizzes);

  const filtersFor = (tab: string) =>
    tab === "favorites" ? favFilters : tab === "public" ? pubFilters : myFilters;

  const handleDeleteClick = (quiz: SavedQuiz) => { setQuizToDelete(quiz); setDeleteDialogOpen(true); };
  const handleDeleteConfirm = () => {
    if (quizToDelete && deleteQuiz(quizToDelete.id)) { toast.success(t("quizDeleted")); loadQuizzes(); }
    setDeleteDialogOpen(false); setQuizToDelete(null);
  };
  const handleToggleFavorite = (event: MouseEvent, quiz: SavedQuiz) => {
    event.stopPropagation();
    const updated = toggleFavorite(quiz.id);
    if (updated) { toast.success(updated.isFavorite ? t("addedToFavorites") : t("removedFromFavorites")); loadQuizzes(); }
  };
  const handlePlayQuiz = (quiz: SavedQuiz) => {
    localStorage.setItem(`quiz-${quiz.id}`, JSON.stringify(quiz));
    navigate(`/quiz/${quiz.id}`);
  };
  const handleEditQuiz = (event: MouseEvent, quizId: string) => {
    event.stopPropagation();
    navigate(`/builder?type=quiz&quizId=${quizId}`);
  };
  const handleRateQuiz = (quizId: string, rating: number) => {
    if (rateQuiz(quizId, rating)) { toast.success("Merci pour votre note !"); loadQuizzes(); }
  };

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (!name || !user) return;
    createFolder(name, user.id, "quiz");
    setNewFolderName("");
    setShowNewFolderInput(false);
    loadQuizzes();
    toast.success(`Dossier "${name}" créé`);
  };

  const handleRenameFolder = (id: string, name: string) => {
    renameFolder(id, name);
    loadQuizzes();
  };

  const handleDeleteFolder = (id: string) => {
    const folder = folders.find((f) => f.id === id);
    deleteFolder(id);
    if (currentFolderId === id) setCurrentFolderId(null);
    loadQuizzes();
    if (folder) toast.success(`Dossier "${folder.name}" supprimé`);
  };

  const handleMoveToFolder = (quizId: string, folderId: string | null) => {
    moveToFolder(quizId, folderId);
    loadQuizzes();
    setMoveMenuOpenId(null);
  };

  const handleDuplicateQuiz = (e: MouseEvent, id: string) => {
    e.stopPropagation();
    const copy = duplicateQuiz(id);
    if (copy) { toast.success(`"${copy.title}" créé`); loadQuizzes(); }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && folders.some((f) => f.id === over.id)) {
      moveToFolder(String(active.id), String(over.id));
      loadQuizzes();
      toast.success("Déplacé dans le dossier");
    }
  };

  const triggerStyle = {
    fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: "14px",
    border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-sm)",
    background: "var(--ap-card)", color: "var(--ap-ink)", height: "42px",
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

  const renderFilters = (tab: string) => {
    const f = filtersFor(tab);
    return (
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--ap-muted)" }} />
          <input
            placeholder="Rechercher..."
            value={f.search}
            onChange={(e) => f.setSearch(e.target.value)}
            style={{
              width: "100%", paddingLeft: "38px", padding: "10px 14px 10px 38px",
              fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: "14px",
              color: "var(--ap-ink)", background: "var(--ap-card)",
              border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-sm)",
              outline: "none", boxSizing: "border-box" as const,
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--ap-brand)"; e.currentTarget.style.boxShadow = "0 0 0 4px var(--ap-brand-soft)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--ap-line)"; e.currentTarget.style.boxShadow = "none"; }}
          />
        </div>
        <Select value={f.category} onValueChange={f.setCategory}>
          <SelectTrigger className="w-[160px]" style={triggerStyle}>
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent style={{ background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
            {f.categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={f.sort} onValueChange={(v) => f.setSort(v as any)}>
          <SelectTrigger className="w-[150px]" style={triggerStyle}>
            <SelectValue placeholder="Trier" />
          </SelectTrigger>
          <SelectContent style={{ background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
            <SelectItem value="newest">Plus récent</SelectItem>
            <SelectItem value="oldest">Plus ancien</SelectItem>
            <SelectItem value="az">A → Z</SelectItem>
            <SelectItem value="questions">Nb questions</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => setView("grid")} style={toggleBtnStyle(viewMode === "grid")} title="Vue grille"><LayoutGrid className="w-4 h-4" /></button>
          <button onClick={() => setView("list")} style={toggleBtnStyle(viewMode === "list")} title="Vue liste"><List className="w-4 h-4" /></button>
        </div>
      </div>
    );
  };

  const renderQuizCard = (quiz: SavedQuiz, showActions = true) => (
    <div
      key={quiz.id}
      className="ap-card ap-card--hover flex h-full cursor-pointer flex-col overflow-hidden"
      onClick={() => navigate(`/builder?type=quiz&quizId=${quiz.id}`)}
    >
      {quiz.headerImage && (
        <div className="relative h-40 w-full overflow-hidden">
          <img src={quiz.headerImage} alt={quiz.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="ap-h3" style={{ fontSize: "15px" }}>{quiz.title}</h3>
            <p className="ap-muted mt-0.5 text-sm line-clamp-2">{quiz.description}</p>
          </div>
          <button onClick={(e) => handleToggleFavorite(e, quiz)} className="text-amber-400 hover:text-amber-500 transition-colors cursor-pointer p-1">
            <Star className={`h-4 w-4 ${quiz.isFavorite ? "fill-amber-400" : ""}`} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <Badge variant="outline" className={`rounded-full text-xs ${quiz.isPublic ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500"}`}>
            {quiz.isPublic ? t("publicBadge") : t("privateBadge")}
          </Badge>
          <span className="ap-pill" style={{ fontSize: "11px", padding: "3px 9px" }}>
            {quiz.questions.length} {quiz.questions.length > 1 ? t("questions") : t("question")}
          </span>
          {quiz.tags?.map((tag) => (
            <span key={tag} className="ap-pill" style={{ fontSize: "11px", padding: "3px 9px" }}>#{tag}</span>
          ))}
        </div>
        {quiz.isPublic && (
          <div className="border-t border-slate-100 pt-3 mb-3">
            <RatingStars rating={quiz.rating || 0} ratingCount={quiz.ratingCount} onRate={(r) => handleRateQuiz(quiz.id, r)} readonly={quiz.userId === user?.id} />
          </div>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3" style={{ borderTop: "2px solid var(--ap-line)" }}>
          <div className="flex gap-1">
            {showActions && (
              <>
                <button onClick={(e) => handleEditQuiz(e, quiz.id)} title={t("edit")} className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "6px 8px" }}><Edit className="h-3.5 w-3.5" /></button>
                <button onClick={(e) => handleDuplicateQuiz(e, quiz.id)} title="Dupliquer" className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "6px 8px" }}><Copy className="h-3.5 w-3.5" /></button>
                {folders.length > 0 && (
                  <div className="relative" ref={moveMenuOpenId === quiz.id ? moveMenuRef : undefined}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMoveMenuOpenId(moveMenuOpenId === quiz.id ? null : quiz.id); }}
                      title="Déplacer vers"
                      className="ap-btn ap-btn--ghost ap-btn--sm"
                      style={{ padding: "6px 8px" }}
                    >
                      <FolderInput className="h-3.5 w-3.5" />
                    </button>
                    {moveMenuOpenId === quiz.id && (
                      <MoveToFolderMenu
                        folders={folders}
                        currentFolderId={quiz.folderId}
                        onMove={(fid) => handleMoveToFolder(quiz.id, fid)}
                      />
                    )}
                  </div>
                )}
                <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(quiz); }} title={t("delete")} className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "6px 8px", color: "var(--ap-quiz)" }}><Trash2 className="h-3.5 w-3.5" /></button>
              </>
            )}
          </div>
          <Button size="sm" onClick={(e) => { e.stopPropagation(); handlePlayQuiz(quiz); }} className="ap-btn ap-btn--sm ap-btn--pill ap-btn--quiz gap-1.5 px-4">
            <Play className="h-3.5 w-3.5" />{t("playQuiz")}
          </Button>
        </div>
      </div>
    </div>
  );

  const renderQuizRow = (quiz: SavedQuiz, showActions = true) => (
    <div
      key={quiz.id}
      className="flex items-center gap-4 cursor-pointer px-4 py-3 transition-colors"
      style={{ borderBottom: "2px solid var(--ap-line)" }}
      onClick={() => navigate(`/builder?type=quiz&quizId=${quiz.id}`)}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ap-paper-2)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {quiz.headerImage && (
        <img src={quiz.headerImage} alt={quiz.title} className="w-12 h-12 rounded object-cover flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="ap-h3 truncate" style={{ fontSize: "14px", marginBottom: "2px" }}>{quiz.title}</p>
        {quiz.description && <p className="ap-muted truncate" style={{ fontSize: "12px" }}>{quiz.description}</p>}
      </div>
      <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
        <Badge variant="outline" className={`rounded-full text-xs ${quiz.isPublic ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500"}`}>
          {quiz.isPublic ? t("publicBadge") : t("privateBadge")}
        </Badge>
        <span className="ap-pill" style={{ fontSize: "11px", padding: "2px 8px" }}>
          {quiz.questions.length} {quiz.questions.length > 1 ? t("questions") : t("question")}
        </span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <button onClick={(e) => handleToggleFavorite(e, quiz)} className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "5px", color: quiz.isFavorite ? "var(--ap-flash)" : "var(--ap-muted)" }}>
          <Star className={`h-3.5 w-3.5 ${quiz.isFavorite ? "fill-current" : ""}`} />
        </button>
        {showActions && (
          <>
            <button onClick={(e) => handleEditQuiz(e, quiz.id)} title={t("edit")} className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "5px" }}><Edit className="h-3.5 w-3.5" /></button>
            <button onClick={(e) => handleDuplicateQuiz(e, quiz.id)} title="Dupliquer" className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "5px" }}><Copy className="h-3.5 w-3.5" /></button>
            {folders.length > 0 && (
              <div className="relative" ref={moveMenuOpenId === quiz.id ? moveMenuRef : undefined}>
                <button
                  onClick={(e) => { e.stopPropagation(); setMoveMenuOpenId(moveMenuOpenId === quiz.id ? null : quiz.id); }}
                  title="Déplacer vers"
                  className="ap-btn ap-btn--ghost ap-btn--sm"
                  style={{ padding: "5px" }}
                >
                  <FolderInput className="h-3.5 w-3.5" />
                </button>
                {moveMenuOpenId === quiz.id && (
                  <MoveToFolderMenu
                    folders={folders}
                    currentFolderId={quiz.folderId}
                    onMove={(fid) => handleMoveToFolder(quiz.id, fid)}
                  />
                )}
              </div>
            )}
            <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(quiz); }} title={t("delete")} className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "5px", color: "var(--ap-quiz)" }}><Trash2 className="h-3.5 w-3.5" /></button>
          </>
        )}
        <Button size="sm" onClick={(e) => { e.stopPropagation(); handlePlayQuiz(quiz); }} className="ap-btn ap-btn--sm ap-btn--pill ap-btn--quiz gap-1 px-3" style={{ fontSize: "12px" }}>
          <Play className="h-3 w-3" />{t("playQuiz")}
        </Button>
      </div>
    </div>
  );

  const renderTabContent = (tab: string, allItems: SavedQuiz[], emptyKey: string, ctaKey?: string, showActions = true) => {
    const isMyTab = tab === "my";
    const folderItems = isMyTab && currentFolderId
      ? allItems.filter((q) => q.folderId === currentFolderId)
      : isMyTab
      ? allItems.filter((q) => !q.folderId)
      : allItems;

    const f = filtersFor(tab);
    const rootFolders = isMyTab && !currentFolderId ? folders : [];

    if (allItems.length === 0 && rootFolders.length === 0) return (
      <div style={{ borderRadius: "var(--ap-r-lg)", border: "2px dashed var(--ap-line-2)", background: "var(--ap-paper-2)", padding: "48px 24px", textAlign: "center" }}>
        <p className="ap-muted" style={{ fontSize: "14px", marginBottom: ctaKey ? "16px" : 0 }}>{t(emptyKey as any)}</p>
        {ctaKey && <button className="ap-btn ap-btn--sm ap-btn--pill" onClick={() => navigate('/builder-start?type=quiz')}>{t(ctaKey as any)}</button>}
      </div>
    );

    return (
      <>
        {renderFilters(tab)}
        {rootFolders.length > 0 && (
          <div
            className={viewMode === "grid" ? "grid gap-4 md:grid-cols-3 lg:grid-cols-4 mb-6" : "ap-card mb-6"}
            style={viewMode === "list" ? { padding: 0, overflow: "hidden" } : {}}
          >
            {rootFolders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                itemCount={getFolderItemCount(folder.id, user!.id, "quiz")}
                viewMode={viewMode}
                onClick={() => setCurrentFolderId(folder.id)}
                onRename={handleRenameFolder}
                onDelete={handleDeleteFolder}
              />
            ))}
          </div>
        )}
        {folderItems.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            {currentFolderId ? "Aucun quiz dans ce dossier." : "Aucun résultat pour cette recherche."}
          </p>
        ) : viewMode === "grid" ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {folderItems.map((q) => renderQuizCard(q, showActions))}
          </div>
        ) : (
          <div className="ap-card" style={{ padding: 0, overflow: "hidden" }}>
            {folderItems.map((q) => renderQuizRow(q, showActions))}
          </div>
        )}
        <Pagination
          page={f.page}
          totalPages={Math.max(1, Math.ceil(folderItems.length / 12))}
          onPageChange={f.setPage}
          className="mt-8"
        />
      </>
    );
  };

  if (!user) return null;

  return (
    <div className="min-h-screen ">
      <Header subtitle={t("myQuizzes")} />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="ap-h2" style={{ fontSize: "26px" }}>
              {currentFolderId
                ? <span className="flex items-center gap-2 flex-wrap">
                    <button className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "2px 0", fontWeight: 600, fontSize: "inherit" }} onClick={() => setCurrentFolderId(null)}>{t("myQuizzes")}</button>
                    <ChevronRight className="h-5 w-5" style={{ color: "var(--ap-muted)" }} />
                    {folders.find((f) => f.id === currentFolderId)?.name ?? "Dossier"}
                  </span>
                : t("myQuizzes")
              }
            </h1>
            <p className="ap-muted" style={{ fontSize: "14px" }}>{t("myQuizzesSubtitle")}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {showNewFolderInput ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') { setShowNewFolderInput(false); setNewFolderName(""); } }}
                  placeholder="Nom du dossier"
                  className="ap-input"
                  style={{ width: '180px', height: '38px', padding: '6px 12px' }}
                />
                <button className="ap-btn ap-btn--sm ap-btn--pill" onClick={handleCreateFolder}>Créer</button>
                <button className="ap-btn ap-btn--sm ap-btn--pill ap-btn--ghost" onClick={() => { setShowNewFolderInput(false); setNewFolderName(""); }}>Annuler</button>
              </div>
            ) : (
              <button className="ap-btn ap-btn--sm ap-btn--pill ap-btn--ghost" onClick={() => setShowNewFolderInput(true)} style={{ gap: '6px', display: 'flex', alignItems: 'center' }}>
                <FolderPlus className="h-4 w-4" /> Nouveau dossier
              </button>
            )}
            <button className="ap-btn ap-btn--sm ap-btn--pill ap-btn--quiz" onClick={() => navigate('/builder-start?type=quiz')}>{t("createQuizCta")}</button>
          </div>
        </div>

        <DndContext onDragEnd={handleDragEnd}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="my">{`${t("myQuizzesTab")} (${myQuizzes.length})`}</TabsTrigger>
              <TabsTrigger value="favorites">{`${t("favoritesTab")} (${favoriteQuizzes.length})`}</TabsTrigger>
              <TabsTrigger value="public">{`${t("publicQuizzesTab")} (${publicQuizzes.length})`}</TabsTrigger>
            </TabsList>
            <TabsContent value="my">{renderTabContent("my", myQuizzes, "noQuizzesSaved", "createQuizCta")}</TabsContent>
            <TabsContent value="favorites">{renderTabContent("favorites", favoriteQuizzes, "noFavoriteQuizzes", undefined, favoriteQuizzes.some((q) => q.userId === user.id))}</TabsContent>
            <TabsContent value="public">{renderTabContent("public", publicQuizzes, "noPublicQuizzes", undefined, false)}</TabsContent>
          </Tabs>
        </DndContext>
      </div>

      <DeleteQuizDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} onConfirm={handleDeleteConfirm} title={quizToDelete?.title || ""} type="quiz" />
    </div>
  );
};

export default MyQuizzes;
