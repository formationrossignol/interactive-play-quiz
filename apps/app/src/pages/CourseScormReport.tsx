import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Trophy, Users, Clock3, CheckCircle2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/ui/skeletons/TableSkeleton";
import { getCourseById, type Lesson } from "@/lib/courseStorage";
import { getScormTrackingForCourse, computeScormStats, type ScormStats, type ScormTrackingRow } from "@/lib/scormTracking";
import { showError } from "@/lib/errorTaxonomy";

const STATUS_LABEL: Record<string, string> = {
  passed: "Réussi", completed: "Terminé", failed: "Échoué",
  incomplete: "En cours", "not attempted": "Non commencé", browsed: "Consulté",
};

export default function CourseScormReport() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [stats, setStats] = useState<ScormStats | null>(null);
  const [rows, setRows] = useState<ScormTrackingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courseId || !lessonId) return;
    const course = getCourseById(courseId);
    const found = course?.modules.flatMap((m) => m.lessons).find((l) => l.id === lessonId) ?? null;
    setLesson(found);

    Promise.all([
      computeScormStats(courseId, lessonId),
      getScormTrackingForCourse(courseId, lessonId),
    ])
      .then(([s, r]) => { setStats(s); setRows(r); })
      .catch((err) => showError(err))
      .finally(() => setLoading(false));
  }, [courseId, lessonId]);

  return (
    <AppLayout subtitle="Reporting SCORM">
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
      <Breadcrumb
        onHome={() => { window.location.href = "/"; }}
        items={[
          { label: "Mes cours", onClick: () => navigate("/my-courses") },
          { label: "Reporting SCORM" },
        ]}
      />
      <button
        onClick={() => navigate(`/course-builder?courseId=${courseId}`)}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: "16px 0", background: "none", border: "none", cursor: "pointer", fontWeight: 700, color: "var(--ap-brand)" }}
      >
        <ChevronLeft className="h-4 w-4" /> Retour à l'éditeur
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>
        Reporting SCORM — {lesson?.title ?? "…"}
      </h1>

      {loading ? (
        <div className="flex flex-col gap-6">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
          <TableSkeleton rows={5} cols={5} />
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
            <StatCard icon={<Users className="h-4 w-4" />} label="Apprenants" value={String(stats?.totalLearners ?? 0)} />
            <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Taux de complétion" value={stats?.completionRate != null ? `${stats.completionRate}%` : "—"} />
            <StatCard icon={<Trophy className="h-4 w-4" />} label="Score moyen" value={stats?.avgScore != null ? String(stats.avgScore) : "—"} />
            <StatCard icon={<Clock3 className="h-4 w-4" />} label="Temps moyen" value={stats?.avgTimeMinutes != null ? `${Math.round(stats.avgTimeMinutes)} min` : "—"} />
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "2px solid var(--ap-line)" }}>
                <th style={{ padding: "8px 12px" }}>Apprenant</th>
                <th style={{ padding: "8px 12px" }}>Statut</th>
                <th style={{ padding: "8px 12px" }}>Score</th>
                <th style={{ padding: "8px 12px" }}>Tentatives</th>
                <th style={{ padding: "8px 12px" }}>Dernier accès</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 16, color: "var(--ap-muted)" }}>Aucun apprenant n'a encore commencé cette leçon.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.user_id} style={{ borderBottom: "1px solid var(--ap-line)" }}>
                  <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 12 }}>{r.user_id}</td>
                  <td style={{ padding: "8px 12px" }}>{STATUS_LABEL[r.lesson_status ?? r.completion_status ?? ""] ?? "—"}</td>
                  <td style={{ padding: "8px 12px" }}>{r.score_raw ?? "—"}</td>
                  <td style={{ padding: "8px 12px" }}>{r.attempt_count}</td>
                  <td style={{ padding: "8px 12px" }}>{new Date(r.updated_at).toLocaleString("fr")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
    </AppLayout>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-md)", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ap-muted)", fontSize: 12, fontWeight: 700 }}>{icon}{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  );
}
