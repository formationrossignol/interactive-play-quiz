import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pagination } from "@/components/Pagination";
import { getCurrentUser } from "@/lib/auth";
import {
  deleteQuiz,
  getFavoriteQuizzes,
  getPublicQuizzes,
  getUserQuizzes,
  toggleFavorite,
  type SavedQuiz,
} from "@/lib/quizStorage";
import { DeleteQuizDialog } from "@/components/DeleteQuizDialog";
import { toast } from "sonner";
import { Edit, Play, Search, Star, Trash2 } from "lucide-react";
import { t } from "@/lib/i18n";
import { useCollectionFilters } from "@/hooks/useCollectionFilters";

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pollToDelete, setPollToDelete] = useState<SavedQuiz | null>(null);
  const [activeTab, setActiveTab] = useState("my");

  const loadPolls = useCallback(() => {
    if (!user) return;
    const all = getUserQuizzes(user.id);
    const pub = getPublicQuizzes();
    const fav = getFavoriteQuizzes(user.id);
    setMyPolls(all.filter((q) => q.type === "poll"));
    setPublicPolls(pub.filter((q) => q.type === "poll"));
    setFavoritePolls(fav.filter((q) => q.type === "poll"));
  }, [user]);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    loadPolls();
  }, [user, navigate, loadPolls]);

  const myFilters = useCollectionFilters(myPolls);
  const favFilters = useCollectionFilters(favoritePolls);
  const pubFilters = useCollectionFilters(publicPolls);
  const filtersFor = (tab: string) => tab === "favorites" ? favFilters : tab === "public" ? pubFilters : myFilters;

  const handleDeleteClick = (poll: SavedQuiz) => { setPollToDelete(poll); setDeleteDialogOpen(true); };
  const handleDeleteConfirm = () => {
    if (pollToDelete && deleteQuiz(pollToDelete.id)) { toast.success(t("pollDeleted")); loadPolls(); }
    setDeleteDialogOpen(false); setPollToDelete(null);
  };
  const handleToggleFavorite = (event: MouseEvent, poll: SavedQuiz) => {
    event.stopPropagation();
    const updated = toggleFavorite(poll.id);
    if (updated) { toast.success(updated.isFavorite ? t("addedToFavorites") : t("removedFromFavorites")); loadPolls(); }
  };
  const handleLaunchPoll = (poll: SavedQuiz) => {
    localStorage.setItem(`poll-${poll.id}`, JSON.stringify(poll));
    navigate(`/quiz/${poll.id}`);
  };
  const handleEditPoll = (event: MouseEvent, pollId: string) => {
    event.stopPropagation();
    navigate(`/builder?type=poll&quizId=${pollId}`);
  };

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
          <button onClick={(e) => handleToggleFavorite(e, poll)} style={{ color: poll.isFavorite ? "var(--ap-flash)" : "var(--ap-muted)", cursor: "pointer", padding: "4px", background: "none", border: "none" }}>
            <Star style={{ width: 16, height: 16, fill: poll.isFavorite ? "var(--ap-flash)" : "none" }} />
          </button>
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
          <div style={{ display: "flex", gap: "4px" }}>
            {showActions && (
              <>
                <button onClick={(e) => handleEditPoll(e, poll.id)} title={t("edit")} className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "6px 8px" }}><Edit style={{ width: 14, height: 14 }} /></button>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(poll); }} title={t("delete")} className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "6px 8px", color: "var(--ap-quiz)" }}><Trash2 style={{ width: 14, height: 14 }} /></button>
              </>
            )}
          </div>
          <button className="ap-btn ap-btn--sm ap-btn--pill ap-btn--poll" onClick={(e) => { e.stopPropagation(); handleLaunchPoll(poll); }} style={{ gap: "6px" }}>
            <Play style={{ width: 13, height: 13 }} />{t("launchPoll")}
          </button>
        </div>
      </div>
    </div>
  );

  const renderTabContent = (tab: string, allItems: SavedQuiz[], emptyKey: string, ctaKey?: string, showActions = true) => {
    const f = filtersFor(tab);
    if (allItems.length === 0) return (
      <div style={{ borderRadius: "var(--ap-r-lg)", border: "2px dashed var(--ap-line-2)", background: "var(--ap-paper-2)", padding: "48px 24px", textAlign: "center" }}>
        <p className="ap-muted" style={{ fontSize: "14px", marginBottom: ctaKey ? "16px" : 0 }}>{t(emptyKey as any)}</p>
        {ctaKey && <button className="ap-btn ap-btn--sm ap-btn--pill ap-btn--poll" onClick={() => navigate('/builder-start?type=poll')}>{t(ctaKey as any)}</button>}
      </div>
    );
    return (
      <>
        {renderFilters(tab)}
        {f.paginated.length === 0 ? (
          <p className="py-10 text-center text-sm ap-muted">Aucun résultat pour cette recherche.</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {f.paginated.map((p) => renderPollCard(p, showActions))}
          </div>
        )}
        <Pagination page={f.page} totalPages={f.totalPages} onPageChange={f.setPage} className="mt-8" />
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
            <h1 className="ap-h2" style={{ fontSize: "26px" }}>{t("myPolls")}</h1>
            <p className="ap-muted" style={{ fontSize: "14px" }}>{t("myPollsSubtitle")}</p>
          </div>
          <button className="ap-btn ap-btn--sm ap-btn--pill ap-btn--poll" onClick={() => navigate('/builder-start?type=poll')}>{t("createPollCta")}</button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList style={{ background: "var(--ap-paper-2)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-sm)", padding: "4px" }}>
            <TabsTrigger value="my" style={{ borderRadius: "var(--ap-r-sm)", fontFamily: "var(--ap-font-display)", fontWeight: 600 }}>{`${t("myPollsTab")} (${myPolls.length})`}</TabsTrigger>
            <TabsTrigger value="favorites" style={{ borderRadius: "var(--ap-r-sm)", fontFamily: "var(--ap-font-display)", fontWeight: 600 }}>{`${t("favoritesTab")} (${favoritePolls.length})`}</TabsTrigger>
            <TabsTrigger value="public" style={{ borderRadius: "var(--ap-r-sm)", fontFamily: "var(--ap-font-display)", fontWeight: 600 }}>{`${t("publicPollsTab")} (${publicPolls.length})`}</TabsTrigger>
          </TabsList>
          <TabsContent value="my">{renderTabContent("my", myPolls, "noPollsSaved", "createPollCta")}</TabsContent>
          <TabsContent value="favorites">{renderTabContent("favorites", favoritePolls, "noFavoritePolls")}</TabsContent>
          <TabsContent value="public">{renderTabContent("public", publicPolls, "noPublicPolls", undefined, false)}</TabsContent>
        </Tabs>
      </div>

      <DeleteQuizDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} onConfirm={handleDeleteConfirm} title={pollToDelete?.title || ""} type="poll" />
    </div>
  );
};

export default MyPolls;
