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
    <div className="product-page product-page--medium">
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

      <div className="product-page-heading">
        <div>
          <h1>Reporting SCORM</h1>
          <p>{lesson?.title ?? "Leçon en cours de chargement"}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-6">
          <div className="product-metric-grid product-metric-grid--wide">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
          <TableSkeleton rows={5} cols={5} />
        </div>
      ) : (
        <>
          <div className="product-metric-grid product-metric-grid--wide">
            <StatCard icon={<Users className="h-4 w-4" />} label="Apprenants" value={String(stats?.totalLearners ?? 0)} />
            <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Taux de complétion" value={stats?.completionRate != null ? `${stats.completionRate}%` : "-"} />
            <StatCard icon={<Trophy className="h-4 w-4" />} label="Score moyen" value={stats?.avgScore != null ? String(stats.avgScore) : "-"} />
            <StatCard icon={<Clock3 className="h-4 w-4" />} label="Temps moyen" value={stats?.avgTimeMinutes != null ? `${Math.round(stats.avgTimeMinutes)} min` : "-"} />
          </div>

          <div className="product-data-table-wrap">
          <table className="product-data-table">
            <thead>
              <tr>
                <th>Apprenant</th>
                <th>Statut</th>
                <th>Score</th>
                <th>Tentatives</th>
                <th>Dernier accès</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 16, color: "var(--ap-muted)" }}>Aucun apprenant n'a encore commencé cette leçon.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.user_id}>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{r.user_id}</td>
                  <td>{STATUS_LABEL[r.lesson_status ?? r.completion_status ?? ""] ?? "-"}</td>
                  <td>{r.score_raw ?? "-"}</td>
                  <td>{r.attempt_count}</td>
                  <td>{new Date(r.updated_at).toLocaleString("fr")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
    </AppLayout>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="product-metric">
      <div className="product-metric__icon">{icon}</div>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </div>
  );
}
