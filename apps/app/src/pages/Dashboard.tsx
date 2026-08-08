import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { KpiRow } from "@/components/dashboard/KpiRow";
import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { CreationsByTypeChart } from "@/components/dashboard/CreationsByTypeChart";
import { ScoreChart } from "@/components/dashboard/ScoreChart";
import { NewsModule } from "@/components/dashboard/NewsModule";
import { RecentWorks } from "@/components/dashboard/RecentWorks";
import { NeedsAttentionModule } from "@/components/dashboard/NeedsAttentionModule";
import { MaterialSymbol } from "@/components/MaterialSymbol";
import { getCurrentUser } from "@/lib/auth";
import { computeDashboardStats, computeDashboardCharts, type DashboardStats, type DashboardCharts } from "@/lib/dashboardStats";

/** Inline retry state for a dashboard section whose fetch failed — mirrors H5pPlayer's error/retry pattern, MaterialSymbol icons to match the rest of the dashboard. */
function DashboardSectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="product-section-error">
      <div>
      <MaterialSymbol name="warning" size={24} style={{ margin: "0 auto 8px" }} />
      <p style={{ fontWeight: 700, fontSize: 14 }}>{message}</p>
      <button
        type="button"
        className="ap-btn ap-btn--ghost ap-btn--sm"
        onClick={onRetry}
        style={{ marginTop: 12 }}
      >
        <MaterialSymbol name="refresh" size={14} /> Réessayer
      </button>
      </div>
    </div>
  );
}

const Dashboard = () => {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const userId = currentUser?.id;
  const firstName = currentUser?.username?.trim().split(/\s+/)[0];
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [charts, setCharts] = useState<DashboardCharts | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [chartsError, setChartsError] = useState(false);
  const [statsReloadKey, setStatsReloadKey] = useState(0);
  const [chartsReloadKey, setChartsReloadKey] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setStatsError(false);
    computeDashboardStats(userId)
      .then((s) => { if (!cancelled) setStats(s); })
      .catch(() => { if (!cancelled) setStatsError(true); });
    return () => { cancelled = true; };
  }, [userId, statsReloadKey]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setChartsError(false);
    computeDashboardCharts(userId)
      .then((c) => { if (!cancelled) setCharts(c); })
      .catch(() => { if (!cancelled) setChartsError(true); });
    return () => { cancelled = true; };
  }, [userId, chartsReloadKey]);

  if (!currentUser) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <AppLayout subtitle="Tableau de bord">
      <div className="product-page product-dashboard">
        <header className="product-dashboard__hero">
          <div className="product-dashboard__hero-main">
            <div className="product-page-heading__breadcrumb" aria-label="Brivia, tableau de bord">
              <MaterialSymbol name="home" size={15} />
              <span>Brivia</span>
              <MaterialSymbol name="chevron_right" size={15} />
              <strong>Dashboard</strong>
            </div>
            <h1>{firstName ? `Bonjour ${firstName}` : "Votre espace de travail"}</h1>
            <p>Pilotez vos contenus, lancez une activité et suivez les résultats depuis un seul espace.</p>
          </div>
          <div className="product-quick-actions" aria-label="Actions rapides">
            <button className="product-quick-action" type="button" onClick={() => navigate("/builder-start?type=quiz")}>
              <MaterialSymbol name="add" size={18} />
              Créer un quiz
            </button>
            <button className="product-quick-action" type="button" onClick={() => navigate("/builder-start?type=poll")}>
              <MaterialSymbol name="poll" size={18} />
              Sondage
            </button>
            <button className="product-quick-action" type="button" onClick={() => navigate("/course-builder")}>
              <MaterialSymbol name="school" size={18} />
              Cours
            </button>
            <button className="product-quick-action" type="button" onClick={() => navigate("/exam-builder")}>
              <MaterialSymbol name="assignment" size={18} />
              Examen
            </button>
          </div>
        </header>

        {userId && <NeedsAttentionModule userId={userId} />}

        <section aria-labelledby="dashboard-overview-title">
          <div className="product-section-heading">
            <div>
              <h2 id="dashboard-overview-title">Vue d’ensemble</h2>
              <p>Vos indicateurs cumulés et leur évolution sur les 14 derniers jours.</p>
            </div>
          </div>
          {statsError ? (
            <DashboardSectionError
              message="Impossible de charger vos statistiques."
              onRetry={() => setStatsReloadKey((key) => key + 1)}
            />
          ) : (
            <KpiRow stats={stats} charts={charts} />
          )}
        </section>

        <section className="product-dashboard__performance" aria-labelledby="dashboard-performance-title">
          <div className="product-section-heading">
            <div>
              <h2 id="dashboard-performance-title">Activité et performance</h2>
              <p>Comprenez ce qui est utilisé et comment vos participants progressent.</p>
            </div>
          </div>
          {chartsError ? (
            <DashboardSectionError
              message="Impossible de charger vos graphiques d'activité."
              onRetry={() => setChartsReloadKey((key) => key + 1)}
            />
          ) : (
            <div className="product-analytics-grid">
              <div id="dashboard-activity-chart">
                <ActivityChart data={charts?.activity ?? []} hasCreations={(stats?.totalCreations ?? 0) > 0} />
              </div>
              <div id="dashboard-score-chart">
                <ScoreChart data={charts?.scoreByDay ?? []} />
              </div>
              <div id="dashboard-creations-chart">
                <CreationsByTypeChart data={charts?.creationsByType ?? { quiz: 0, poll: 0, flashcard: 0, slide: 0, other: 0 }} />
              </div>
            </div>
          )}
        </section>

        <div className="product-dashboard__lower">
          {userId && <RecentWorks userId={userId} />}
          <NewsModule />
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
