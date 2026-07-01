import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pagination } from "@/components/Pagination";
import { getCurrentUser } from "@/lib/auth";
import {
  deleteQuiz,
  duplicateQuiz,
  getFavoriteQuizzes,
  getPublicQuizzes,
  getTrashedItems,
  getUserQuizzes,
  permanentlyDeleteQuiz,
  purgeExpiredTrash,
  restoreFromTrash,
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
import { ItemContextMenu } from "@/components/ItemContextMenu";
import { TrashView } from "@/components/TrashView";
import { DeleteQuizDialog } from "@/components/DeleteQuizDialog";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { BarChart2, ChevronRight, FolderPlus, LayoutGrid, List, Play, Search, Star, Trash2 } from "lucide-react";
import { t } from "@/lib/i18n";
import { useCollectionFilters } from "@/hooks/useCollectionFilters";
import { hasPollResults } from "@/lib/pollResults";

const VIEW_KEY = "view-mode-polls";

const triggerStyle = {
  fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: "14px",
  border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-sm)",
  background: "var(--ap-card)", color: "var(--ap-ink)", height: "42px",
};

const MyPolls = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [myPolls, setMyPolls] = useState<SavedQuiz[]>([]);
  const [favoritePolls, setFavoritePolls] = useState<SavedQuiz[]>([]);
  const [publicPolls, setPublicPolls] = useState<SavedQuiz[]>([]);
  const [trashedPolls, setTrashedPolls] = useState<SavedQuiz[]>([]);
  const [permDeleteTarget, setPermDeleteTarget] = useState<SavedQuiz | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("my");
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => (localStorage.getItem(VIEW_KEY) as "grid" | "list") ?? "grid");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);

  const setView = (mode: "grid" | "list") => {
    setViewMode(mode);
    localStorage.setItem(VIEW_KEY, mode);
  };

  const loadPolls = useCallback(() => {
    if (!user) return;
    purgeExpiredTrash(user.id);
    const all = getUserQuizzes(user.id);
    const pub = getPublicQuizzes();
    const fav = getFavoriteQuizzes(user.id);
    setMyPolls(all.filter((q) => q.type === "poll"));
    setPublicPolls(pub.filter((q) => q.type === "poll"));
    setFavoritePolls(fav.filter((q) => q.type === "poll"));
    setTrashedPolls(getTrashedItems(user.id, "poll"));
    setFolders(getFolders(user.id, "poll"));
  }, [user]);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    loadPolls();
  }, [user, navigate, loadPolls]);

  const myFilters = useCollectionFilters(myPolls);
  const favFilters = useCollectionFilters(favoritePolls);
  const pubFilters = useCollectionFilters(publicPolls);
  const filtersFor = (tab: string) => tab === "favorites" ? favFilters : tab === "public" ? pubFilters : myFilters;

  const handleTrash = (id: string) => {
    if (deleteQuiz(id)) { toast.success("Mis à la corbeille"); loadPolls(); }
  };

  const handlePermDeleteClick = (poll: SavedQuiz) => { setPermDeleteTarget(poll); setDeleteDialogOpen(true); };
  const handlePermDeleteConfirm = () => {
    if (permDeleteTarget && permanentlyDeleteQuiz(permDeleteTarget.id)) {
      toast.success("Supprimé définitivement");
      loadPolls();
    }
    setDeleteDialogOpen(false);
    setPermDeleteTarget(null);
  };

  const handleRestore = (id: string) => {
    if (restoreFromTrash(id)) { toast.success("Restauré"); loadPolls(); }
  };

  const handleToggleFavorite = (poll: SavedQuiz) => {
    const updated = toggleFavorite(poll.id);
    if (updated) { toast.success(updated.isFavorite ? t("addedToFavorites") : t("removedFromFavorites")); loadPolls(); }
  };

  const handleLaunchPoll = (poll: SavedQuiz) => {
    localStorage.setItem(`poll-${poll.id}`, JSON.stringify(poll));
    navigate(`/quiz/${poll.id}`);
  };

  const handleEditPoll = (pollId: string) => navigate(`/builder?type=poll&quizId=${pollId}`);

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (!name || !user) return;
    createFolder(name, user.id, "poll");
    setNewFolderName("");
    setShowNewFolderInput(false);
    loadPolls();
    toast.success(`Dossier "${name}" créé`);
  };

  const handleRenameFolder = (id: string, name: string) => { renameFolder(id, name); loadPolls(); };

  const handleDeleteFolder = (id: string) => {
    const folder = folders.find((f) => f.id === id);
    deleteFolder(id);
    if (currentFolderId === id) setCurrentFolderId(null);
    loadPolls();
    if (folder) toast.success(`Dossier "${folder.name}" supprimé`);
  };

  const handleMoveToFolder = (pollId: string, folderId: string | null) => {
    moveToFolder(pollId, folderId);
    loadPolls();
  };

  const handleDuplicatePoll = (id: string) => {
    const copy = duplicateQuiz(id);
    if (copy) { toast.success(`"${copy.title}" créé`); loadPolls(); }
  };

  const handleShare = (poll: SavedQuiz) => {
    const url = `${window.location.origin}/quiz/${poll.id}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Lien copié !"),
      () => toast.error("Impossible de copier le lien"),
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && folders.some((f) => f.id === over.id)) {
      moveToFolder(String(active.id), String(over.id));
      loadPolls();
      toast.success("Déplacé dans le dossier");
    }
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
        <div style={{ position: "relative", flex: "1 1 200px" }}>
          <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "var(--ap-muted)", pointerEvents: "none" }} />
          <input
            placeholder="Rechercher..."
            value={f.search}
            onChange={(e) => f.setSearch(e.target.value)}
            style={{ width: "100%", paddingLeft: "38px", padding: "10px 14px 10px 38px", fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: "14px", color: "var(--ap-ink)", background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-sm)", outline: "none", boxSizing: "border-box" as const }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--ap-brand)"; e.currentTarget.style.boxShadow = "0 0 0 4px var(--ap-brand-soft)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--ap-line)"; e.currentTarget.style.boxShadow = "none"; }}
          />
        </div>
        <Select value={f.category} onValueChange={f.setCategory}>
          <SelectTrigger className="w-[160px]" style={triggerStyle}><SelectValue placeholder="Catégorie" /></SelectTrigger>
          <SelectContent style={{ background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
            {f.categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={f.sort} onValueChange={(v) => f.setSort(v as any)}>
          <SelectTrigger className="w-[150px]" style={triggerStyle}><SelectValue placeholder="Trier" /></SelectTrigger>
          <SelectContent style={{ background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
            <SelectItem value="newest">Plus récent</SelectItem>
            <SelectItem value="oldest">Plus ancien</SelectItem>
            <SelectItem value="az">A → Z</SelectItem>
            <SelectItem value="questions">Nb questions</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => setView("grid")} style={toggleBtnStyle(viewMode === "grid")} title="Vue grille"><LayoutGrid style={{ width: 16, height: 16 }} /></button>
          <button onClick={() => setView("list")} style={toggleBtnStyle(viewMode === "list")} title="Vue liste"><List style={{ width: 16, height: 16 }} /></button>
        </div>
      </div>
    );
  };

  const renderPollCard = (poll: SavedQuiz, showActions = true) => (
    <div
      key={poll.id}
      className="ap-card ap-card--hover flex h-full cursor-pointer flex-col overflow-hidden"
      onClick={() => navigate(`/builder?type=poll&quizId=${poll.id}`)}
    >
      {poll.headerImage && (
        <div style={{ height: 160, overflow: "hidden", margin: "-24px -24px 16px" }}>
          <img src={poll.headerImage} alt={poll.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "10px" }}>
          <div style={{ flex: 1 }}>
            <h3 className="ap-h3" style={{ fontSize: "15px" }}>{poll.title}</h3>
            <p className="ap-muted" style={{ fontSize: "13px", marginTop: "2px" }}>{poll.description}</p>
          </div>
          {showActions && (
            <button
              onClick={(e) => { e.stopPropagation(); handleToggleFavorite(poll); }}
              style={{ color: poll.isFavorite ? "var(--ap-flash)" : "var(--ap-muted)", cursor: "pointer", padding: "4px", background: "none", border: "none" }}
            >
              <Star style={{ width: 16, height: 16, fill: poll.isFavorite ? "var(--ap-flash)" : "none" }} />
            </button>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
          <span className="ap-pill" style={{ fontSize: "11px", padding: "3px 9px" }}>
            {poll.questions.length} {poll.questions.length > 1 ? t("questions") : t("question")}
          </span>
          {poll.tags?.map((tag) => (
            <span key={tag} className="ap-pill" style={{ fontSize: "11px", padding: "3px 9px" }}>#{tag}</span>
          ))}
        </div>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", paddingTop: "12px", borderTop: "2px solid var(--ap-line)" }}>
          {showActions ? (
            <ItemContextMenu
              item={poll}
              folders={folders}
              onEdit={() => handleEditPoll(poll.id)}
              onDuplicate={() => handleDuplicatePoll(poll.id)}
              onToggleFavorite={() => handleToggleFavorite(poll)}
              onMoveToFolder={(fid) => handleMoveToFolder(poll.id, fid)}
              onShare={() => handleShare(poll)}
              onTrash={() => handleTrash(poll.id)}
            />
          ) : <span />}
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            {hasPollResults(poll.id) && (
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/poll-results/${poll.id}`); }}
                className="ap-btn ap-btn--ghost ap-btn--sm"
                style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: "4px" }}
              >
                <BarChart2 style={{ width: 13, height: 13 }} />
                Résultats
              </button>
            )}
            <button className="ap-btn ap-btn--sm ap-btn--pill ap-btn--poll" onClick={(e) => { e.stopPropagation(); handleLaunchPoll(poll); }} style={{ gap: "6px" }}>
              <Play style={{ width: 13, height: 13 }} />{t("launchPoll")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPollRow = (poll: SavedQuiz, showActions = true) => (
    <div
      key={poll.id}
      className="flex items-center gap-4 cursor-pointer px-4 py-3 transition-colors"
      style={{ borderBottom: "2px solid var(--ap-line)" }}
      onClick={() => navigate(`/builder?type=poll&quizId=${poll.id}`)}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ap-paper-2)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div className="flex-1 min-w-0">
        <p className="ap-h3 truncate" style={{ fontSize: "14px", marginBottom: "2px" }}>{poll.title}</p>
        {poll.description && <p className="ap-muted truncate" style={{ fontSize: "12px" }}>{poll.description}</p>}
      </div>
      <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
        <span className="ap-pill" style={{ fontSize: "11px", padding: "2px 8px" }}>
          {poll.questions.length} {poll.questions.length > 1 ? t("questions") : t("question")}
        </span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        {showActions && (
          <ItemContextMenu
            item={poll}
            folders={folders}
            onEdit={() => handleEditPoll(poll.id)}
            onDuplicate={() => handleDuplicatePoll(poll.id)}
            onToggleFavorite={() => handleToggleFavorite(poll)}
            onMoveToFolder={(fid) => handleMoveToFolder(poll.id, fid)}
            onShare={() => handleShare(poll)}
            onTrash={() => handleTrash(poll.id)}
          />
        )}
        {hasPollResults(poll.id) && (
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/poll-results/${poll.id}`); }}
            className="ap-btn ap-btn--ghost ap-btn--sm"
            style={{ padding: "5px 8px", display: "flex", alignItems: "center", gap: "3px", fontSize: "12px" }}
          >
            <BarChart2 style={{ width: 13, height: 13 }} />
            <span className="hidden sm:inline">Résultats</span>
          </button>
        )}
        <button className="ap-btn ap-btn--sm ap-btn--pill ap-btn--poll" onClick={(e) => { e.stopPropagation(); handleLaunchPoll(poll); }} style={{ fontSize: "12px", padding: "4px 12px", display: "flex", alignItems: "center", gap: "4px" }}>
          <Play style={{ width: 12, height: 12 }} />{t("launchPoll")}
        </button>
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
        {ctaKey && <button className="ap-btn ap-btn--sm ap-btn--pill" onClick={() => navigate('/builder-start?type=poll')}>{t(ctaKey as any)}</button>}
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
                itemCount={getFolderItemCount(folder.id, user!.id, "poll")}
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
            {currentFolderId ? "Aucun sondage dans ce dossier." : "Aucun résultat pour cette recherche."}
          </p>
        ) : viewMode === "grid" ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {folderItems.map((p) => renderPollCard(p, showActions))}
          </div>
        ) : (
          <div className="ap-card" style={{ padding: 0, overflow: "hidden" }}>
            {folderItems.map((p) => renderPollRow(p, showActions))}
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
    <div style={{ minHeight: "100vh", background: "var(--ap-paper)" }}>
      <Header subtitle={t("myPolls")} />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="ap-h2" style={{ fontSize: "26px" }}>
              {currentFolderId
                ? <span className="flex items-center gap-2 flex-wrap">
                    <button className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "2px 0", fontWeight: 600, fontSize: "inherit" }} onClick={() => setCurrentFolderId(null)}>{t("myPolls")}</button>
                    <ChevronRight className="h-5 w-5" style={{ color: "var(--ap-muted)" }} />
                    {folders.find((f) => f.id === currentFolderId)?.name ?? "Dossier"}
                  </span>
                : t("myPolls")
              }
            </h1>
            <p className="ap-muted" style={{ fontSize: "14px" }}>{t("myPollsSubtitle")}</p>
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
            <button className="ap-btn ap-btn--sm ap-btn--pill ap-btn--poll" onClick={() => navigate('/builder-start?type=poll')}>{t("createPollCta")}</button>
          </div>
        </div>

        <DndContext onDragEnd={handleDragEnd}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList style={{ background: "var(--ap-paper-2)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-sm)", padding: "4px" }}>
              <TabsTrigger value="my" style={{ borderRadius: "var(--ap-r-sm)", fontFamily: "var(--ap-font-display)", fontWeight: 600 }}>{`${t("myPollsTab")} (${myPolls.length})`}</TabsTrigger>
              <TabsTrigger value="favorites" style={{ borderRadius: "var(--ap-r-sm)", fontFamily: "var(--ap-font-display)", fontWeight: 600 }}>{`${t("favoritesTab")} (${favoritePolls.length})`}</TabsTrigger>
              <TabsTrigger value="public" style={{ borderRadius: "var(--ap-r-sm)", fontFamily: "var(--ap-font-display)", fontWeight: 600 }}>{`${t("publicPollsTab")} (${publicPolls.length})`}</TabsTrigger>
              <TabsTrigger value="trash" style={{ borderRadius: "var(--ap-r-sm)", fontFamily: "var(--ap-font-display)", fontWeight: 600 }} className="flex items-center gap-1.5">
                <Trash2 className="h-3.5 w-3.5" />
                {`Corbeille${trashedPolls.length > 0 ? ` (${trashedPolls.length})` : ""}`}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="my">{renderTabContent("my", myPolls, "noPollsSaved", "createPollCta")}</TabsContent>
            <TabsContent value="favorites">{renderTabContent("favorites", favoritePolls, "noFavoritePolls")}</TabsContent>
            <TabsContent value="public">{renderTabContent("public", publicPolls, "noPublicPolls", undefined, false)}</TabsContent>
            <TabsContent value="trash">
              <TrashView
                items={trashedPolls}
                viewMode={viewMode}
                onRestore={handleRestore}
                onPermanentDelete={handlePermDeleteClick}
              />
            </TabsContent>
          </Tabs>
        </DndContext>
      </div>

      <DeleteQuizDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handlePermDeleteConfirm}
        title={permDeleteTarget?.title || ""}
        type="poll"
      />
    </div>
  );
};

export default MyPolls;
