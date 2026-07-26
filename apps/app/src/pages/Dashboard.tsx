import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { KpiRow } from "@/components/dashboard/KpiRow";
import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { CreationsByTypeChart } from "@/components/dashboard/CreationsByTypeChart";
import { NewsModule } from "@/components/dashboard/NewsModule";
import { RecentWorks } from "@/components/dashboard/RecentWorks";
import { getCurrentUser } from "@/lib/auth";
import { computeDashboardStats, computeDashboardCharts, type DashboardStats, type DashboardCharts } from "@/lib/dashboardStats";

const Dashboard = () => {
  const userId = getCurrentUser()?.id;
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [charts, setCharts] = useState<DashboardCharts | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    computeDashboardStats(userId).then((s) => { if (!cancelled) setStats(s); });
    computeDashboardCharts(userId).then((c) => { if (!cancelled) setCharts(c); });
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <AppLayout subtitle="Tableau de bord">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div style={{ marginBottom: "32px" }}>
          <h1 className="ap-h2" style={{ fontSize: "26px", marginBottom: "4px" }}>Tableau de bord</h1>
          <p className="ap-muted" style={{ fontSize: "14px" }}>Vue d'ensemble de vos créations et de l'actualité du produit.</p>
        </div>

        <div style={{ marginBottom: "32px" }}>
          <KpiRow stats={stats} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px", marginBottom: "32px" }}>
          <div id="dashboard-activity-chart">
            <ActivityChart data={charts?.activity ?? []} />
          </div>
          <div id="dashboard-creations-chart">
            <CreationsByTypeChart data={charts?.creationsByType ?? { quiz: 0, poll: 0, flashcard: 0, slide: 0, other: 0 }} />
          </div>
        </div>

        {userId && <RecentWorks userId={userId} />}

        <NewsModule />
      </div>
    </AppLayout>
  );
};

export default Dashboard;
