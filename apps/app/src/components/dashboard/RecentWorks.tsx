import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CardSkeleton } from "@/components/ui/skeletons";
import { MaterialSymbol } from "@/components/MaterialSymbol";
import { listRecentContent } from "@/lib/content/contentRepo";
import { getSearchResultRoute } from "@/lib/content/searchContent";
import type { ContentRow, ContentType } from "@/lib/content/types";

const META: Record<ContentType, { label: string; color: string; icon: string }> = {
  quiz: { label: "Quiz", color: "var(--ap-quiz)", icon: "menu_book" },
  poll: { label: "Sondage", color: "var(--ap-poll)", icon: "bar_chart" },
  flashcard: { label: "Flashcards", color: "var(--ap-flash)", icon: "layers" },
  slide: { label: "Présentation", color: "var(--ap-pres)", icon: "slideshow" },
  course: { label: "Cours", color: "var(--ap-pres)", icon: "school" },
  exam: { label: "Examen", color: "var(--ap-brand)", icon: "fact_check" },
};

const itemId = (row: ContentRow) => String((row.data?.id as string | undefined) ?? row.source_id ?? row.id);
const imageOf = (row: ContentRow) => {
  const value = row.data?.headerImage ?? row.data?.coverImage;
  return typeof value === "string" && value ? value : null;
};

function RecentWorksSkeleton() {
  return (
    <div className="product-recent-grid">
      {Array.from({ length: 4 }, (_, index) => (
        <CardSkeleton key={index} withAction={false} mediaClassName="h-[132px] w-full rounded-xl" />
      ))}
    </div>
  );
}

export function RecentWorks({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listRecentContent(userId)
      .then((recent) => { if (!cancelled) setRows(recent); })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <section
      className="product-panel"
      aria-labelledby="recent-works-title"
    >
      <div className="product-section-heading">
        <div>
          <h2 id="recent-works-title">Travaux récents</h2>
          <p>Reprenez là où vous vous êtes arrêté.</p>
        </div>
        <button
          type="button"
          className="ap-btn ap-btn--ghost ap-btn--sm ap-btn--pill"
          onClick={() => navigate("/my-quizzes")}
        >
          Voir tout <MaterialSymbol name="arrow_forward" size={16} />
        </button>
      </div>

      {loading ? <RecentWorksSkeleton /> : rows.length === 0 ? (
        <div className="product-empty-inline">
          <div>
            <MaterialSymbol name="edit_square" size={25} />
            <strong>Créez votre premier contenu</strong>
            <span style={{ display: "block", maxWidth: 420, fontSize: 12 }}>
              Démarrez avec un quiz, un sondage ou un cours. Votre travail récent apparaîtra ici.
            </span>
            <button
              type="button"
              className="ap-btn ap-btn--sm"
              style={{ marginTop: 14 }}
              onClick={() => navigate("/builder-start?type=quiz")}
            >
              Créer un quiz
            </button>
          </div>
        </div>
      ) : (
        <div className="product-recent-grid">
          {rows.map((row) => {
            const meta = META[row.type];
            const image = imageOf(row);
            const title = String(row.data?.title ?? "Sans titre");
            return (
              <button
                type="button"
                key={row.id}
                className="product-recent-item"
                onClick={() => navigate(getSearchResultRoute(row.type, itemId(row)))}
              >
                <span
                  className="product-recent-item__media"
                  style={{
                    background: image
                      ? "var(--ap-paper-2)"
                      : `color-mix(in srgb, ${meta.color} 13%, var(--ap-paper-2))`,
                  }}
                >
                  {image
                    ? <img src={image} alt="" className="h-full w-full object-cover" />
                    : <MaterialSymbol name={meta.icon} size={36} style={{ color: meta.color, opacity: .82 }} />}
                </span>
                <span className="product-recent-item__title">{title}</span>
                <span className="product-recent-item__meta">
                  <span style={{ color: meta.color, fontWeight: 800 }}>{meta.label}</span>
                  <span aria-hidden="true">·</span>
                  {new Date(row.updated_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
