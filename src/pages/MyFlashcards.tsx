import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pagination } from "@/components/Pagination";
import { getCurrentUser } from "@/lib/auth";
import {
  deleteQuiz,
  getFavoriteFlashcardSets,
  getPublicFlashcardSets,
  getUserFlashcardSets,
  toggleFavorite,
  type SavedQuiz,
} from "@/lib/quizStorage";
import { toast } from "sonner";
import { Edit, LayoutGrid, List, Search, Star, Trash2 } from "lucide-react";
import { DeleteQuizDialog } from "@/components/DeleteQuizDialog";
import { t } from "@/lib/i18n";
import { useCollectionFilters } from "@/hooks/useCollectionFilters";

const VIEW_KEY = "view-mode-flashcards";

const triggerStyle = {
  fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: "14px",
  border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-sm)",
  background: "var(--ap-card)", color: "var(--ap-ink)", height: "42px",
};

const MyFlashcards = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [myFlashcards, setMyFlashcards] = useState<SavedQuiz[]>([]);
  const [favoriteFlashcards, setFavoriteFlashcards] = useState<SavedQuiz[]>([]);
  const [publicFlashcards, setPublicFlashcards] = useState<SavedQuiz[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [setToDelete, setSetToDelete] = useState<SavedQuiz | null>(null);
  const [activeTab, setActiveTab] = useState("my");
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => (localStorage.getItem(VIEW_KEY) as "grid" | "list") ?? "grid");

  const setView = (mode: "grid" | "list") => {
    setViewMode(mode);
    localStorage.setItem(VIEW_KEY, mode);
  };

  const loadFlashcards = useCallback(() => {
    if (!user) return;
    setMyFlashcards(getUserFlashcardSets(user.id));
    setFavoriteFlashcards(getFavoriteFlashcardSets(user.id));
    setPublicFlashcards(getPublicFlashcardSets());
  }, [user]);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    loadFlashcards();
  }, [user, navigate, loadFlashcards]);

  const myFilters = useCollectionFilters(myFlashcards);
  const favFilters = useCollectionFilters(favoriteFlashcards);
  const pubFilters = useCollectionFilters(publicFlashcards);
  const filtersFor = (tab: string) => tab === "favorites" ? favFilters : tab === "public" ? pubFilters : myFilters;

  const handleDeleteClick = (set: SavedQuiz) => { setSetToDelete(set); setDeleteDialogOpen(true); };
  const handleDeleteConfirm = () => {
    if (setToDelete && deleteQuiz(setToDelete.id)) { toast.success(t("flashcardDeleted")); loadFlashcards(); }
    setDeleteDialogOpen(false); setSetToDelete(null);
  };
  const handleToggleFavorite = (event: MouseEvent, cardSet: SavedQuiz) => {
    event.stopPropagation();
    const updated = toggleFavorite(cardSet.id);
    if (updated) { toast.success(updated.isFavorite ? t("addedToFavorites") : t("removedFromFavorites")); loadFlashcards(); }
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
            <SelectItem value="questions">Nb cartes</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => setView("grid")} style={toggleBtnStyle(viewMode === "grid")} title="Vue grille"><LayoutGrid style={{ width: 16, height: 16 }} /></button>
          <button onClick={() => setView("list")} style={toggleBtnStyle(viewMode === "list")} title="Vue liste"><List style={{ width: 16, height: 16 }} /></button>
        </div>
      </div>
    );
  };

  const renderCard = (cardSet: SavedQuiz, showActions = true) => (
    <div
      key={cardSet.id}
      className="ap-card ap-card--hover flex h-full cursor-pointer flex-col overflow-hidden"
      onClick={() => navigate(`/builder?type=flashcard&quizId=${cardSet.id}`)}
    >
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "10px" }}>
          <div style={{ flex: 1 }}>
            <h3 className="ap-h3" style={{ fontSize: "15px" }}>{cardSet.title}</h3>
            <p className="ap-muted" style={{ fontSize: "13px", marginTop: "2px" }}>{cardSet.description}</p>
          </div>
          <button onClick={(e) => handleToggleFavorite(e, cardSet)} style={{ color: cardSet.isFavorite ? "var(--ap-flash)" : "var(--ap-muted)", cursor: "pointer", padding: "4px", background: "none", border: "none" }}>
            <Star style={{ width: 16, height: 16, fill: cardSet.isFavorite ? "var(--ap-flash)" : "none" }} />
          </button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
          <span className="ap-pill" style={{ fontSize: "11px", padding: "3px 9px" }}>
            {cardSet.questions.length} {cardSet.questions.length > 1 ? t("cards") : t("card")}
          </span>
          {cardSet.isPublic && (
            <span className="ap-badge ap-badge--flash">{t("publicBadge")}</span>
          )}
          {cardSet.tags?.map((tag) => (
            <span key={tag} className="ap-pill" style={{ fontSize: "11px", padding: "3px 9px" }}>#{tag}</span>
          ))}
        </div>
        {showActions && (
          <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", paddingTop: "12px", borderTop: "2px solid var(--ap-line)" }}>
            <div style={{ display: "flex", gap: "4px" }}>
              <button onClick={(e) => { e.stopPropagation(); navigate(`/builder?type=flashcard&quizId=${cardSet.id}`); }} title={t("edit")} className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "6px 8px" }}><Edit style={{ width: 14, height: 14 }} /></button>
              <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(cardSet); }} title={t("delete")} className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "6px 8px", color: "var(--ap-quiz)" }}><Trash2 style={{ width: 14, height: 14 }} /></button>
            </div>
            <button className="ap-btn ap-btn--sm ap-btn--pill ap-btn--flash" onClick={(e) => { e.stopPropagation(); navigate(`/builder?type=flashcard&quizId=${cardSet.id}`); }}>
              {t("editSet")}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderRow = (cardSet: SavedQuiz, showActions = true) => (
    <div
      key={cardSet.id}
      className="flex items-center gap-4 cursor-pointer px-4 py-3 transition-colors"
      style={{ borderBottom: "2px solid var(--ap-line)" }}
      onClick={() => navigate(`/builder?type=flashcard&quizId=${cardSet.id}`)}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ap-paper-2)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div className="flex-1 min-w-0">
        <p className="ap-h3 truncate" style={{ fontSize: "14px", marginBottom: "2px" }}>{cardSet.title}</p>
        {cardSet.description && <p className="ap-muted truncate" style={{ fontSize: "12px" }}>{cardSet.description}</p>}
      </div>
      <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
        <span className="ap-pill" style={{ fontSize: "11px", padding: "2px 8px" }}>
          {cardSet.questions.length} {cardSet.questions.length > 1 ? t("cards") : t("card")}
        </span>
        {cardSet.isPublic && <span className="ap-badge ap-badge--flash" style={{ fontSize: "11px" }}>{t("publicBadge")}</span>}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <button onClick={(e) => handleToggleFavorite(e, cardSet)} className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "5px", color: cardSet.isFavorite ? "var(--ap-flash)" : "var(--ap-muted)" }}>
          <Star style={{ width: 14, height: 14, fill: cardSet.isFavorite ? "currentColor" : "none" }} />
        </button>
        {showActions && (
          <>
            <button onClick={(e) => { e.stopPropagation(); navigate(`/builder?type=flashcard&quizId=${cardSet.id}`); }} title={t("edit")} className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "5px" }}><Edit style={{ width: 14, height: 14 }} /></button>
            <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(cardSet); }} title={t("delete")} className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "5px", color: "var(--ap-quiz)" }}><Trash2 style={{ width: 14, height: 14 }} /></button>
          </>
        )}
        <button className="ap-btn ap-btn--sm ap-btn--pill ap-btn--flash" onClick={(e) => { e.stopPropagation(); navigate(`/builder?type=flashcard&quizId=${cardSet.id}`); }} style={{ fontSize: "12px", padding: "4px 12px" }}>
          {t("editSet")}
        </button>
      </div>
    </div>
  );

  const renderTabContent = (tab: string, allItems: SavedQuiz[], emptyKey: string, ctaKey?: string, showActions = true) => {
    const f = filtersFor(tab);
    if (allItems.length === 0) return (
      <div style={{ borderRadius: "var(--ap-r-lg)", border: "2px dashed var(--ap-line-2)", background: "var(--ap-paper-2)", padding: "48px 24px", textAlign: "center" }}>
        <p className="ap-muted" style={{ fontSize: "14px", marginBottom: ctaKey ? "16px" : 0 }}>{t(emptyKey as any)}</p>
        {ctaKey && <button className="ap-btn ap-btn--sm ap-btn--pill ap-btn--flash" onClick={() => navigate('/builder-start?type=flashcard')}>{t(ctaKey as any)}</button>}
      </div>
    );
    return (
      <>
        {renderFilters(tab)}
        {f.paginated.length === 0 ? (
          <p className="py-10 text-center text-sm" style={{ color: "var(--ap-muted)" }}>Aucun résultat pour cette recherche.</p>
        ) : viewMode === "grid" ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {f.paginated.map((s) => renderCard(s, showActions))}
          </div>
        ) : (
          <div className="ap-card" style={{ padding: 0, overflow: "hidden" }}>
            {f.paginated.map((s) => renderRow(s, showActions))}
          </div>
        )}
        <Pagination page={f.page} totalPages={f.totalPages} onPageChange={f.setPage} className="mt-8" />
      </>
    );
  };

  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--ap-paper)" }}>
      <Header subtitle={t("myFlashcards")} />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="ap-h2" style={{ fontSize: "26px" }}>{t("myFlashcards")}</h1>
            <p className="ap-muted" style={{ fontSize: "14px" }}>{t("myFlashcardsSubtitle")}</p>
          </div>
          <button className="ap-btn ap-btn--sm ap-btn--pill ap-btn--flash" onClick={() => navigate('/builder-start?type=flashcard')}>{t("createFlashcardSet")}</button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList style={{ background: "var(--ap-paper-2)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-sm)", padding: "4px" }}>
            <TabsTrigger value="my" style={{ borderRadius: "var(--ap-r-sm)", fontFamily: "var(--ap-font-display)", fontWeight: 600 }}>{`${t("myFlashcardsTab")} (${myFlashcards.length})`}</TabsTrigger>
            <TabsTrigger value="favorites" style={{ borderRadius: "var(--ap-r-sm)", fontFamily: "var(--ap-font-display)", fontWeight: 600 }}>{`${t("favoritesTab")} (${favoriteFlashcards.length})`}</TabsTrigger>
            <TabsTrigger value="public" style={{ borderRadius: "var(--ap-r-sm)", fontFamily: "var(--ap-font-display)", fontWeight: 600 }}>{`${t("publicFlashcardsTab")} (${publicFlashcards.length})`}</TabsTrigger>
          </TabsList>
          <TabsContent value="my">{renderTabContent("my", myFlashcards, "noFlashcardsSaved", "createFlashcardSet")}</TabsContent>
          <TabsContent value="favorites">{renderTabContent("favorites", favoriteFlashcards, "noFavoriteFlashcards", undefined, false)}</TabsContent>
          <TabsContent value="public">{renderTabContent("public", publicFlashcards, "noPublicFlashcards", undefined, false)}</TabsContent>
        </Tabs>
      </div>

      <DeleteQuizDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} onConfirm={handleDeleteConfirm} title={setToDelete?.title || ""} type="flashcard" />
    </div>
  );
};

export default MyFlashcards;
