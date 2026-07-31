import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { ExplorerEmptyState } from "@/components/content/ExplorerEmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { listQuizAttempts, type QuizAttempt } from "@/lib/quizAttempts";
import { useSEO } from "@/hooks/useSEO";
import { PageHeader } from "@/components/ui/page-header";

export default function History() {
  const user = getCurrentUser();
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  useSEO({ title: "Historique", description: "Vos parties de quiz jouées en solo." });

  useEffect(() => {
    if (!user) return;
    listQuizAttempts(user.id)
      .then(setAttempts)
      .catch(() => setAttempts([]))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;

  return (
    <AppLayout subtitle="Historique">
      <div className="product-page product-page--compact">
        <PageHeader title="Historique" description="Vos parties de quiz jouées en solo." />

        <section className="ap-card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 20 }}>
              {[0, 1, 2].map((item) => (
                <div key={item} className="mb-3 flex items-center gap-3">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="mt-2 h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : attempts.length === 0 ? (
            <ExplorerEmptyState
              icon={<Trophy size={27} />}
              title="Aucune partie solo pour l'instant"
              body="Jouez un quiz public en solo pour le retrouver ici."
            />
          ) : (
            attempts.map((attempt) => (
              <div
                key={attempt.id}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderBottom: "var(--ap-border-w) solid var(--ap-line)" }}
              >
                <span
                  style={{ width: 40, height: 40, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: "var(--ap-r-md)", background: "var(--ap-brand-soft)", color: "var(--ap-brand)" }}
                >
                  <Trophy size={18} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 14.5 }}>{attempt.quizTitle}</strong>
                  <span className="ap-muted" style={{ fontSize: 12.5 }}>
                    {attempt.correctAnswers}/{attempt.totalQuestions} bonnes réponses · {new Date(attempt.playedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </div>
                <span className="ap-pill" style={{ flexShrink: 0, fontSize: 13 }}>{attempt.score} pts</span>
              </div>
            ))
          )}
        </section>
      </div>
    </AppLayout>
  );
}
