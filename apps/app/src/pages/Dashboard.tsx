import { useEffect, useState } from "react";
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
    <div
      role="alert"
      className="ap-card"
      style={{ padding: 24, textAlign: "center", color: "var(--ap-danger-deep)" }}
    >
      <MaterialSymbol name="warning" size={24} style={{ margin: "0 auto 8px" }} />
      <p style={{ fontWeight: 700, fontSize: 14 }}>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        style={{
          display: "inline-flex", alignItems: "center", gap: 7, marginTop: 12,
          padding: "8px 14px", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-sm)",
          background: "var(--ap-card)", color: "var(--ap-ink)", cursor: "pointer", fontWeight: 800, fontSize: 13,
        }}
      >
        <MaterialSymbol name="refresh" size={14} /> Réessayer
      </button>
    </div>
  );
}

const Dashboard = () => {
  const userId = getCurrentUser()?.id;
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

  return (
    <AppLayout subtitle="Tableau de bord">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div style={{ marginBottom: "32px" }}>
          <h1 className="ap-h2" style={{ fontSize: "26px", marginBottom: "4px" }}>Tableau de bord</h1>
          <p className="ap-muted" style={{ fontSize: "14px" }}>Vue d'ensemble de vos créations et de l'actualité du produit.</p>
        </div>

        {userId && <NeedsAttentionModule userId={userId} />}

        <div style={{ marginBottom: "32px" }}>
          {statsError ? (
            <DashboardSectionError
              message="Impossible de charger vos statistiques."
              onRetry={() => setStatsReloadKey((key) => key + 1)}
            />
          ) : (
            <KpiRow stats={stats} />
          )}
        </div>

        {chartsError ? (
          <div style={{ marginBottom: "32px" }}>
            <DashboardSectionError
              message="Impossible de charger vos graphiques d'activité."
              onRetry={() => setChartsReloadKey((key) => key + 1)}
            />
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px", marginBottom: "32px" }}>
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

        {userId && <RecentWorks userId={userId} />}

        <NewsModule />
      </div>
    </AppLayout>
  );
};

export default Dashboard;
