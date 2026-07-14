import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Header } from "@/components/Header";
import { Pagination } from "@/components/Pagination";
import { RatingStars } from "@/components/RatingStars";
import { getPublicQuizzes, rateQuiz } from "@/lib/quizStorage";
import { Search, Play, Clock, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

const QUIZ_CATEGORIES = [
  "Tous", "Culture Générale", "Science", "Histoire", "Géographie",
  "Sport", "Divertissement", "Technologie", "Arts", "Autre",
];

const PAGE_SIZE = 12;

const triggerStyle = {
  fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: "14px",
  border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-sm)",
  background: "var(--ap-card)", color: "var(--ap-ink)", height: "42px",
};

const DiscoverQuizzes = () => {
  const navigate = useNavigate();
  useSEO({
    title: "Découvrir les quiz",
    description: "Parcourez des centaines de quiz publics créés par la communauté Ludiq. Quiz de culture générale, science, histoire, géographie : rejoignez une partie en 5 secondes.",
    path: "/discover",
  });
  const user = getCurrentUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tous");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "quiz" | "poll">("all");
  const [page, setPage] = useState(1);

  const publicQuizzes = getPublicQuizzes().filter((q) => q.type === "quiz" || q.type === "poll");

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    publicQuizzes.forEach((q) => q.tags?.forEach((tag) => tags.add(tag)));
    return Array.from(tags);
  }, [publicQuizzes]);

  const filteredQuizzes = useMemo(() => publicQuizzes.filter((quiz) => {
    const q = searchQuery.toLowerCase();
    return (
      (!q || quiz.title.toLowerCase().includes(q) || quiz.description.toLowerCase().includes(q)) &&
      (selectedCategory === "Tous" || quiz.category === selectedCategory) &&
      (!selectedTag || quiz.tags?.includes(selectedTag)) &&
      (typeFilter === "all" || quiz.type === typeFilter)
    );
  }), [publicQuizzes, searchQuery, selectedCategory, selectedTag, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredQuizzes.length / PAGE_SIZE));
  const paginatedQuizzes = filteredQuizzes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [searchQuery, selectedCategory, selectedTag, typeFilter]);

  const playQuiz = (quizId: string) => {
    const quiz = publicQuizzes.find((q) => q.id === quizId);
    if (quiz) { localStorage.setItem("current-quiz", JSON.stringify(quiz)); navigate(`/quiz/${quizId}`); }
  };

  const handleRateQuiz = (quizId: string, rating: number) => {
    if (rateQuiz(quizId, rating)) { toast.success("Merci pour votre note !"); window.location.reload(); }
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <Header subtitle={t("discoverPublic")} />

      <div className="mx-auto max-w-7xl px-6 py-10">

        {/* Page header */}
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <span className="ap-badge ap-badge--brand" style={{ marginBottom: "16px", display: "inline-flex" }}>
            {t("discoverPublic")}
          </span>
          <h1 className="ap-h1" style={{ fontSize: "clamp(32px,5vw,48px)", marginBottom: "12px" }}>
            {t("discoverPublic")}
          </h1>
          <p className="ap-lead" style={{ fontSize: "16px" }}>
            Explorez les quiz et sondages publics
          </p>
        </div>

        {/* Filter bar */}
        <div
          className="ap-card"
          style={{ marginBottom: "28px", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px" }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {/* search */}
            <div style={{ position: "relative", flex: "1 1 220px", minWidth: 0 }}>
              <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "var(--ap-muted)", pointerEvents: "none" }} />
              <input
                placeholder="Rechercher un quiz..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%", padding: "10px 14px 10px 38px",
                  fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: "14px",
                  color: "var(--ap-ink)", background: "var(--ap-card)",
                  border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-sm)",
                  outline: "none", boxSizing: "border-box" as const,
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--ap-brand)"; e.currentTarget.style.boxShadow = "0 0 0 4px var(--ap-brand-soft)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--ap-line)"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>
            {/* category */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger style={{ ...triggerStyle, width: 200, flex: "0 0 auto" }}>
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent style={{ background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
                {QUIZ_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            {/* type */}
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as "all" | "quiz" | "poll")}>
              <SelectTrigger style={{ ...triggerStyle, width: 150, flex: "0 0 auto" }}>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent style={{ background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="quiz">Quiz</SelectItem>
                <SelectItem value="poll">Sondage</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* tag pills */}
          {allTags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
              <span className="ap-muted" style={{ fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>Tags :</span>
              <button
                className={selectedTag === null ? "ap-btn ap-btn--sm ap-btn--pill" : "ap-btn ap-btn--ghost ap-btn--sm ap-btn--pill"}
                style={{ fontSize: "12px", padding: "4px 12px" }}
                onClick={() => setSelectedTag(null)}
              >
                Tous
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  className={selectedTag === tag ? "ap-btn ap-btn--sm ap-btn--pill" : "ap-btn ap-btn--ghost ap-btn--sm ap-btn--pill"}
                  style={{ fontSize: "12px", padding: "4px 12px" }}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results count */}
        {filteredQuizzes.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
            <span className="ap-muted" style={{ fontSize: "13px" }}>
              {filteredQuizzes.length} résultat{filteredQuizzes.length > 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Cards grid */}
        {filteredQuizzes.length === 0 ? (
          <div style={{ borderRadius: "var(--ap-r-lg)", border: "2px dashed var(--ap-line-2)", background: "var(--ap-paper-2)", padding: "64px 24px", textAlign: "center" }}>
            <p className="ap-muted" style={{ fontSize: "16px" }}>Aucun résultat trouvé</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "20px", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {paginatedQuizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="ap-card ap-card--hover"
                style={{ display: "flex", flexDirection: "column", overflow: "hidden", padding: 0 }}
              >
                {/* header image */}
                {quiz.headerImage && (
                  <div style={{ height: 180, overflow: "hidden" }}>
                    <img
                      src={quiz.headerImage}
                      alt={quiz.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform .3s", display: "block" }}
                    />
                  </div>
                )}

                <div style={{ padding: "20px", display: "flex", flexDirection: "column", flex: 1, gap: "10px" }}>
                  {/* title + type badge */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <h3 className="ap-h3" style={{ fontSize: "16px", flex: 1, lineHeight: 1.3 }}>{quiz.title}</h3>
                    <span className={quiz.type === "poll" ? "ap-badge ap-badge--poll" : "ap-badge ap-badge--quiz"} style={{ flexShrink: 0 }}>
                      {quiz.type === "poll" ? "Sondage" : "Quiz"}
                    </span>
                  </div>

                  {/* description */}
                  {quiz.description && (
                    <p className="ap-muted" style={{ fontSize: "13px", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {quiz.description}
                    </p>
                  )}

                  {/* meta */}
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <span className="ap-muted" style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", fontWeight: 700 }}>
                      <Users style={{ width: 14, height: 14 }} />
                      {quiz.questions.length} Q
                    </span>
                    {quiz.type === "quiz" && (
                      <span className="ap-muted" style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", fontWeight: 700 }}>
                        <Clock style={{ width: 14, height: 14 }} />
                        {Math.round(quiz.questions.reduce((s: number, q: { timeLimit?: number }) => s + (q.timeLimit || 0), 0) / 60)}m
                      </span>
                    )}
                    {quiz.category && (
                      <span className="ap-pill" style={{ fontSize: "11px", padding: "3px 9px" }}>{quiz.category}</span>
                    )}
                  </div>

                  {/* tags */}
                  {quiz.tags && quiz.tags.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                      {quiz.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="ap-pill" style={{ fontSize: "11px", padding: "3px 9px" }}>#{tag}</span>
                      ))}
                    </div>
                  )}

                  {/* rating */}
                  {quiz.type === "quiz" && (
                    <div style={{ marginTop: "2px" }}>
                      <RatingStars
                        rating={quiz.rating || 0}
                        ratingCount={quiz.ratingCount}
                        onRate={(r) => handleRateQuiz(quiz.id, r)}
                        readonly={quiz.userId === user?.id}
                      />
                    </div>
                  )}

                  {/* CTA */}
                  <button
                    className={quiz.type === "poll" ? "ap-btn ap-btn--pill ap-btn--poll" : "ap-btn ap-btn--pill ap-btn--quiz"}
                    style={{ width: "100%", marginTop: "auto", gap: "8px" }}
                    onClick={() => playQuiz(quiz.id)}
                  >
                    <Play style={{ width: 14, height: 14 }} />
                    {quiz.type === "poll" ? "Répondre" : "Jouer"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-10" />
      </div>
    </div>
  );
};

export default DiscoverQuizzes;
