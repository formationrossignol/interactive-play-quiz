import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { KpiRow } from "@/components/dashboard/KpiRow";
import { NewsModule } from "@/components/dashboard/NewsModule";
import { getCurrentUser } from "@/lib/auth";
import { computeDashboardStats, type DashboardStats } from "@/lib/dashboardStats";

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) return;
    let cancelled = false;
    computeDashboardStats(user.id).then((s) => { if (!cancelled) setStats(s); });
    return () => { cancelled = true; };
  }, []);

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

        <NewsModule />
      </div>
    </AppLayout>
  );
};

export default Dashboard;
