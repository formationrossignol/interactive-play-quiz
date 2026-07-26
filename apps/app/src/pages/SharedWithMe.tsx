import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  GraduationCap,
  Layers3,
  ListChecks,
  Pencil,
  Presentation,
  Share2,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { listSharedWithMe, type SharedContentRow } from "@/lib/sharing/sharingRepo";
import type { ContentType } from "@/lib/content/types";

const TYPE_META: Record<ContentType, { label: string; icon: typeof GraduationCap; color: string }> = {
  quiz: { label: "Quiz", icon: ListChecks, color: "var(--ap-quiz)" },
  poll: { label: "Sondage", icon: BarChart3, color: "var(--ap-poll)" },
  flashcard: { label: "Flashcards", icon: Layers3, color: "var(--ap-flash-deep)" },
  slide: { label: "Slides", icon: Presentation, color: "var(--ap-pres)" },
  course: { label: "Cours", icon: GraduationCap, color: "var(--ap-brand)" },
  exam: { label: "Examen", icon: ListChecks, color: "var(--ap-quiz)" },
};

const destinationFor = (row: SharedContentRow) => {
  const sourceId = row.source_id ?? row.id;
  if (row.type === "course") {
    return row.access_level === "editor"
      ? `/course-builder?courseId=${row.id}`
      : `/course/${sourceId}`;
  }
  if (row.type === "slide") return `/presentation-editor?id=${row.id}`;
  if (row.type === "quiz" || row.type === "poll" || row.type === "flashcard") {
    return `/builder?type=${row.type}&quizId=${row.id}`;
  }
  return "/my-exams";
};

const SharedWithMe = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [sharedContent, setSharedContent] = useState<SharedContentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    listSharedWithMe(user.id)
      .then(setSharedContent)
      .finally(() => setLoading(false));
  }, [user?.id]);

  return (
    <AppLayout subtitle={t("navSharedWithMe")}>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div style={{ marginBottom: "32px" }}>
          <h1 className="ap-h2" style={{ fontSize: "26px", marginBottom: "4px" }}>{t("navSharedWithMe")}</h1>
          <p className="ap-muted" style={{ fontSize: "14px" }}>{t("sharedWithMeSubtitle")}</p>
        </div>

        {!loading && sharedContent.length === 0 && (
          <p className="ap-muted" style={{ fontSize: 14 }}>{t("sharedWithMeEmpty")}</p>
        )}

        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
          {sharedContent.map((row) => {
            const title = typeof row.data?.title === "string" ? row.data.title : "";
            const description = typeof row.data?.description === "string" ? row.data.description : "";
            const meta = TYPE_META[row.type];
            const Icon = meta.icon;
            return (
              <div
                key={row.id}
                className="ap-card ap-card--hover cursor-pointer p-5"
                onClick={() => navigate(destinationFor(row))}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <Icon style={{ width: 28, height: 28, color: meta.color }} />
                  <span
                    className="ap-pill"
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, padding: "4px 9px" }}
                  >
                    {row.access_level === "editor"
                      ? <Pencil style={{ width: 12, height: 12 }} />
                      : <Share2 style={{ width: 12, height: 12 }} />}
                    {row.access_level === "editor" ? "Peut modifier" : "Lecture seule"}
                  </span>
                </div>
                <span className="ap-muted" style={{ display: "block", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>
                  {meta.label}
                </span>
                <h3 className="ap-h3 line-clamp-2" style={{ fontSize: 15 }}>{title}</h3>
                {description && <p className="ap-muted mt-1 text-sm line-clamp-2">{description}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default SharedWithMe;
