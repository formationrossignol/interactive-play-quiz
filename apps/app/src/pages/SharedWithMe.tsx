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
  Compass,
  Link2,
  Users,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { listSharedWithMe, type SharedContentRow } from "@/lib/sharing/sharingRepo";
import type { ContentType } from "@/lib/content/types";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorerEmptyState } from "@/components/content/ExplorerEmptyState";

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

const SharedEmptyState = ({ onDiscover }: { onDiscover: () => void }) => (
  <div style={{ display: "grid", gap: 18 }}>
    <ExplorerEmptyState
      icon={<Share2 size={27} />}
      title="Aucun contenu partagé pour le moment"
      body="Les créations que vos collègues et formateurs partageront avec vous seront regroupées ici."
      action={(
        <button className="ap-btn ap-btn--sm" onClick={onDiscover}>
          <Compass size={15} /> Découvrir les contenus publics
        </button>
      )}
    />
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
      {[
        { icon: Users, title: "Collaborez", body: "Un propriétaire peut vous donner un accès en lecture ou en modification." },
        { icon: Link2, title: "Retrouvez tout ici", body: "Les quiz, sondages, slides, cours et examens partagés sont centralisés." },
        { icon: Pencil, title: "Travaillez ensemble", body: "Les contenus modifiables s’ouvrent directement dans leur éditeur." },
      ].map(({ icon: Icon, title, body }) => (
        <div key={title} className="ap-card" style={{ padding: 18 }}>
          <span style={{ width: 36, height: 36, display: "grid", placeItems: "center", marginBottom: 12, borderRadius: "var(--ap-r-md)", background: "var(--ap-brand-soft)", color: "var(--ap-brand)" }}>
            <Icon size={18} />
          </span>
          <strong style={{ display: "block", marginBottom: 5, fontFamily: "var(--ap-font-display)", fontSize: 15 }}>{title}</strong>
          <p className="ap-muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{body}</p>
        </div>
      ))}
    </div>
  </div>
);

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
      <div className="product-page">
        <PageHeader title={t("navSharedWithMe")} description={t("sharedWithMeSubtitle")} />

        {!loading && sharedContent.length === 0 && <SharedEmptyState onDiscover={() => navigate("/discover")} />}

        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", marginTop: loading || sharedContent.length > 0 ? 0 : 18 }}>
          {loading && [0, 1, 2, 3].map((item) => (
            <div key={item} className="ap-card p-5">
              <div className="mb-5 flex items-center justify-between">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-7 w-24 rounded-full" />
              </div>
              <Skeleton className="mb-3 h-3 w-16" />
              <Skeleton className="mb-2 h-5 w-4/5" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
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
