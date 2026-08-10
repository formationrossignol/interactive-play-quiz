import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CardSkeleton } from "@/components/ui/skeletons";
import { MaterialSymbol } from "@/components/MaterialSymbol";
import { ContentCoverArtwork } from "@/components/content/ContentCardHeader";
import { listRecentContent } from "@/lib/content/contentRepo";
import { getSearchResultRoute } from "@/lib/content/searchContent";
import type { ContentRow, ContentType } from "@/lib/content/types";

const RECENT_CONTENT_META: Record<ContentType, { label: string; color: string; background: string; icon: string }> = {
  quiz: { label: "Quiz", color: "var(--content-quiz-accent)", background: "var(--content-quiz-surface)", icon: "menu_book" },
  poll: { label: "Sondage", color: "var(--content-poll-accent)", background: "var(--content-poll-surface)", icon: "bar_chart" },
  flashcard: { label: "Flashcards", color: "var(--content-flashcard-accent)", background: "var(--content-flashcard-surface)", icon: "layers" },
  slide: { label: "Présentation", color: "var(--content-slide-accent)", background: "var(--content-slide-surface)", icon: "slideshow" },
  course: { label: "Cours", color: "var(--content-course-accent)", background: "var(--content-course-surface)", icon: "school" },
  exam: { label: "Examen", color: "var(--content-exam-accent)", background: "var(--content-exam-surface)", icon: "fact_check" },
};

const itemId = (row: ContentRow) => String((row.data?.id as string | undefined) ?? row.source_id ?? row.id);
const imageOf = (row: ContentRow) => {
  const value = row.data?.headerImage ?? row.data?.coverImage;
  return typeof value === "string" && value ? value : null;
};

export function RecentWorkCard({ row }: { row: ContentRow }) {
  const navigate = useNavigate();
  const meta = RECENT_CONTENT_META[row.type];
  const image = imageOf(row);
  const title = String(row.data?.title ?? "Sans titre");
  return (
    <button
      type="button"
      className="product-recent-item"
      onClick={() => navigate(getSearchResultRoute(row.type, itemId(row)))}
    >
      <span
        className="product-recent-item__media"
        style={{ color: meta.color, background: image ? "var(--ap-paper-2)" : meta.background }}
      >
        {!image && <ContentCoverArtwork type={row.type} />}
        {!image && <span className="product-recent-item__badge" style={{ color: meta.color, background: "var(--ap-card)" }}>{meta.label}</span>}
        {image
          ? <img src={image} alt="" className="h-full w-full object-cover" />
          : null}
      </span>
      <span className="product-recent-item__title">{title}</span>
      <span className="product-recent-item__meta">
        <span style={{ color: meta.color, fontWeight: 800 }}>{meta.label}</span>
        <span aria-hidden="true">·</span>
        {new Date(row.updated_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
      </span>
    </button>
  );
}

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
          onClick={() => navigate("/recent")}
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
              <MaterialSymbol name="add" size={17} /> Créer un quiz
            </button>
          </div>
        </div>
      ) : (
        <div className="product-recent-grid">
          {rows.map((row) => <RecentWorkCard key={row.id} row={row} />)}
        </div>
      )}
    </section>
  );
}
