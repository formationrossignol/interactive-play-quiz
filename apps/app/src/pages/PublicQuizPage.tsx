import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { MaterialSymbol } from "@/components/MaterialSymbol";
import { ContentCoverArtwork } from "@/components/content/ContentCardHeader";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { getContentBySourceAnyOwner } from "@/lib/content/contentRepo";
import { hasPurchasedQuiz, startQuizPurchase, waitForQuizPurchase } from "@/lib/quizMonetization";
import { setQuizPlayCache, type SavedQuiz } from "@/lib/quizStorage";
import { toast } from "sonner";

const money = (cents: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

export default function PublicQuizPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [quiz, setQuiz] = useState<SavedQuiz | null>(null);
  const [ownerId, setOwnerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [purchased, setPurchased] = useState(false);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    if (!quizId) return;
    let cancelled = false;
    (async () => {
      try {
        const row = await getContentBySourceAnyOwner("quiz", quizId);
        if (!row?.is_public) return;
        const value = row.data as unknown as SavedQuiz;
        if (cancelled) return;
        setQuiz(value);
        setOwnerId(row.user_id);
        const currentUserId = getCurrentUser()?.id;
        if (currentUserId && currentUserId !== row.user_id && value.monetization?.enabled) {
          const hasAccess = searchParams.get("purchase") === "success"
            ? await waitForQuizPurchase(quizId, currentUserId)
            : await hasPurchasedQuiz(quizId, currentUserId);
          if (!cancelled) setPurchased(hasAccess);
        }
      } catch {
        if (!cancelled) toast.error("Impossible de charger ce quiz public");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [quizId, searchParams]);

  useEffect(() => {
    if (searchParams.get("purchase") === "success") toast.success("Paiement confirmé. Le quiz est maintenant accessible.");
  }, [searchParams]);

  if (!quizId) return <Navigate to="/discover" replace />;
  const paid = Boolean(quiz?.monetization?.enabled);
  const mayLaunch = Boolean(quiz && (!paid || ownerId === user?.id || purchased));

  const launch = (solo: boolean) => {
    if (!quiz || !mayLaunch) return;
    setQuizPlayCache(`quiz-${quiz.id}`, quiz);
    localStorage.setItem("current-quiz", JSON.stringify(quiz));
    if (solo) sessionStorage.setItem(`quiz-solo-${quiz.id}`, "1");
    navigate(`/quiz/${quiz.id}`);
  };

  return (
    <AppLayout subtitle="Quiz public">
      <div className="product-page public-quiz-page">
        {loading ? (
          <div className="ap-card public-quiz-shell"><Skeleton className="h-72 w-full rounded-xl" /></div>
        ) : !quiz ? (
          <div className="product-empty-inline"><strong>Quiz introuvable</strong><span>Ce lien n’est plus public ou n’existe pas.</span></div>
        ) : (
          <>
            <PageHeader title={quiz.title} description={quiz.description || "Un quiz public créé sur Brivia."} />
            <section className="ap-card public-quiz-shell">
              <div className="public-quiz-cover" style={quiz.headerImage ? { backgroundImage: `url(${quiz.headerImage})` } : undefined}>
                {!quiz.headerImage && <ContentCoverArtwork type="quiz" />}
                <span className="ap-badge ap-badge--quiz">Quiz public</span>
              </div>
              <div className="public-quiz-content">
                <div className="public-quiz-meta">
                  <span><MaterialSymbol name="library_books" size={18} /> {quiz.questions.length} questions</span>
                  <span><MaterialSymbol name="schedule" size={18} /> {Math.max(1, Math.round(quiz.questions.reduce((sum, question) => sum + Number(question.timeLimit ?? 0), 0) / 60))} min</span>
                  <span><MaterialSymbol name="person" size={18} /> {quiz.creatorName || "Créateur Brivia"}</span>
                </div>
                {paid && <div className="public-quiz-price"><small>Accès permanent</small><strong>{money(quiz.monetization?.priceCents ?? 0)}</strong></div>}
                {mayLaunch ? (
                  <div className="public-quiz-actions">
                    <button className="ap-btn" onClick={() => launch(true)}><MaterialSymbol name="play_arrow" size={18} /> Jouer seul</button>
                    <button className="ap-btn ap-btn--ghost" onClick={() => launch(false)}><MaterialSymbol name="groups" size={18} /> Lancer en groupe</button>
                  </div>
                ) : !user ? (
                  <button className="ap-btn" onClick={() => navigate(`/auth?redirect=${encodeURIComponent(`/public/quiz/${quiz.id}`)}`)}><MaterialSymbol name="login" size={18} /> Se connecter pour acheter</button>
                ) : (
                  <button className="ap-btn" disabled={buying} onClick={async () => {
                    setBuying(true);
                    try { await startQuizPurchase(quiz.id); }
                    catch (error) { toast.error(error instanceof Error ? error.message : "Paiement indisponible"); setBuying(false); }
                  }}><MaterialSymbol name="paid" size={18} /> {buying ? "Préparation…" : `Acheter · ${money(quiz.monetization?.priceCents ?? 0)}`}</button>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
}
