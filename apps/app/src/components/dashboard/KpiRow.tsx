import type { ReactNode } from "react";
import { BarChart2, Sparkles, Target, Users } from "lucide-react";
import type { DashboardStats } from "@/lib/dashboardStats";

interface Tile {
  icon: ReactNode;
  label: string;
  value: string | number;
}

export function KpiRow({ stats }: { stats: DashboardStats | null }) {
  const s = stats ?? { totalCreations: 0, totalSessions: 0, totalParticipants: 0, avgScore: null };

  const tiles: Tile[] = [
    { icon: <Sparkles style={{ width: 20, height: 20, color: "var(--ap-brand)" }} />, label: "Créations", value: s.totalCreations },
    { icon: <BarChart2 style={{ width: 20, height: 20, color: "var(--ap-quiz)" }} />, label: "Sessions totales", value: s.totalSessions },
    { icon: <Users style={{ width: 20, height: 20, color: "var(--ap-poll)" }} />, label: "Participants totaux", value: s.totalParticipants },
    { icon: <Target style={{ width: 20, height: 20, color: "#f59e0b" }} />, label: "Score moyen (quiz)", value: s.avgScore != null ? `${s.avgScore} pts` : "-" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "16px" }}>
      {tiles.map(({ icon, label, value }) => (
        <div key={label} className="ap-card" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "14px" }}>
          <div className="ap-tile__icon" style={{ background: "var(--ap-paper-2)", boxShadow: "0 3px 0 var(--ap-line)", marginBottom: 0, width: 40, height: 40 }}>
            {icon}
          </div>
          <div>
            <div style={{ fontSize: "22px", fontWeight: 800, fontFamily: "var(--ap-font-display)", color: "var(--ap-ink)" }}>{value}</div>
            <div className="ap-muted" style={{ fontSize: "12px" }}>{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
