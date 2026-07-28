import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BarChart2, BookOpen, ClipboardCheck, GraduationCap, Layers, Presentation } from "lucide-react";
import { CardSkeleton } from "@/components/ui/skeletons";
import { listRecentContent } from "@/lib/content/contentRepo";
import { getSearchResultRoute } from "@/lib/content/searchContent";
import type { ContentRow, ContentType } from "@/lib/content/types";

const META: Record<ContentType, { label: string; color: string; icon: typeof BookOpen }> = {
  quiz: { label: "Quiz", color: "var(--ap-quiz)", icon: BookOpen },
  poll: { label: "Sondage", color: "var(--ap-poll)", icon: BarChart2 },
  flashcard: { label: "Flashcards", color: "var(--ap-flash)", icon: Layers },
  slide: { label: "Présentation", color: "var(--ap-pres)", icon: Presentation },
  course: { label: "Cours", color: "var(--ap-pres)", icon: GraduationCap },
  exam: { label: "Examen", color: "var(--ap-brand)", icon: ClipboardCheck },
};

const itemId = (row: ContentRow) => String((row.data?.id as string | undefined) ?? row.source_id ?? row.id);
const imageOf = (row: ContentRow) => {
  const value = row.data?.headerImage ?? row.data?.coverImage;
  return typeof value === "string" && value ? value : null;
};

function RecentWorksSkeleton() {
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <CardSkeleton key={index} withAction={false} mediaClassName="h-36 w-full rounded-xl" />
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

  if (!loading && rows.length === 0) return null;

  return (
    <section
      className="ap-card"
      style={{ padding: "26px 28px", marginBottom: 32, boxShadow: "0 5px 0 var(--ap-line)" }}
      aria-labelledby="recent-works-title"
    >
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 id="recent-works-title" className="ap-h3" style={{ fontSize: 20 }}>Vos travaux récents</h2>
          <p className="ap-muted mt-1" style={{ fontSize: 13 }}>Reprenez là où vous vous êtes arrêté.</p>
        </div>
        <button
          type="button"
          className="ap-btn ap-btn--ghost ap-btn--sm ap-btn--pill"
          onClick={() => navigate("/my-quizzes")}
        >
          Voir tout <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {loading ? <RecentWorksSkeleton /> : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {rows.map((row) => {
            const meta = META[row.type];
            const Icon = meta.icon;
            const image = imageOf(row);
            const title = String(row.data?.title ?? "Sans titre");
            return (
              <button
                type="button"
                key={row.id}
                className="group min-w-0 border-0 bg-transparent p-0 text-left"
                onClick={() => navigate(getSearchResultRoute(row.type, itemId(row)))}
              >
                <span
                  className="relative flex h-36 w-full items-center justify-center overflow-hidden rounded-xl transition-transform group-hover:-translate-y-0.5"
                  style={{
                    border: "var(--ap-border-w) solid var(--ap-line)",
                    background: image
                      ? "var(--ap-paper-2)"
                      : `color-mix(in srgb, ${meta.color} 13%, var(--ap-paper-2))`,
                  }}
                >
                  {image
                    ? <img src={image} alt="" className="h-full w-full object-cover" />
                    : <Icon className="h-9 w-9" style={{ color: meta.color, opacity: .82 }} aria-hidden="true" />}
                </span>
                <span className="mt-3 block truncate font-bold" style={{ fontFamily: "var(--ap-font-display)", fontSize: 14.5 }}>
                  {title}
                </span>
                <span className="ap-muted mt-1 flex items-center gap-2 text-xs">
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
