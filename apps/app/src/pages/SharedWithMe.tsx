import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { listSharedWithMe } from "@/lib/sharing/sharingRepo";
import type { ContentRow } from "@/lib/content/types";

const SharedWithMe = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [courses, setCourses] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    listSharedWithMe(user.id)
      .then(setCourses)
      .finally(() => setLoading(false));
  }, [user?.id]);

  return (
    <AppLayout subtitle={t("navSharedWithMe")}>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div style={{ marginBottom: "32px" }}>
          <h1 className="ap-h2" style={{ fontSize: "26px", marginBottom: "4px" }}>{t("navSharedWithMe")}</h1>
          <p className="ap-muted" style={{ fontSize: "14px" }}>{t("sharedWithMeSubtitle")}</p>
        </div>

        {!loading && courses.length === 0 && (
          <p className="ap-muted" style={{ fontSize: 14 }}>{t("sharedWithMeEmpty")}</p>
        )}

        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
          {courses.map((row) => {
            const title = typeof row.data?.title === "string" ? row.data.title : "";
            const description = typeof row.data?.description === "string" ? row.data.description : "";
            const sourceId = row.source_id ?? row.id;
            return (
              <div
                key={row.id}
                className="ap-card ap-card--hover cursor-pointer p-5"
                onClick={() => navigate(`/course/${sourceId}`)}
              >
                <GraduationCap style={{ width: 28, height: 28, color: "var(--ap-pres)", marginBottom: 8 }} />
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
