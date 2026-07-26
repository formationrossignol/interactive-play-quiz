import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, BarChart2, Minus, Sparkles, Target, Users } from "lucide-react";
import type { DashboardStats } from "@/lib/dashboardStats";
import { Skeleton } from "@/components/ui/skeleton";

interface Tile {
  icon: ReactNode;
  label: string;
  value: string | number;
  deltaPct: number | null;
  /** Where this KPI's detailed breakdown lives — REQ-DB-004. */
  onClick: () => void;
}

/** Small up/down/flat indicator — never color-only (REQ-COL-004): the arrow
 *  direction and the "vs 14 j précédents" caption carry the meaning too. */
function TrendBadge({ deltaPct }: { deltaPct: number | null }) {
  if (deltaPct === null) return <span className="ap-muted" style={{ fontSize: 11 }}>Pas de comparaison disponible</span>;
  const flat = deltaPct === 0;
  const positive = deltaPct > 0;
  const Icon = flat ? Minus : positive ? ArrowUp : ArrowDown;
  const color = flat ? "var(--ap-muted)" : positive ? "#15c08a" : "#ff5a4d";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 800, color }}>
      <Icon style={{ width: 11, height: 11 }} />
      {flat ? "stable" : `${positive ? "+" : ""}${deltaPct}%`}
      <span className="ap-muted" style={{ fontWeight: 700 }}>vs 14j préc.</span>
    </span>
  );
}

export function KpiRow({ stats }: { stats: DashboardStats | null }) {
  const navigate = useNavigate();

  if (!stats) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="ap-card" style={{ padding: 20 }}>
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="mt-2 h-3.5 w-28" />
              </div>
            </div>
            <Skeleton className="mt-4 h-3 w-32" />
          </div>
        ))}
      </div>
    );
  }

  const s = stats;

  const scoreDeltaPct = ((): number | null => {
    const { current, previous } = s.trends.avgScore;
    if (current === null || previous === null || previous === 0) return null;
    return Math.round(((current - previous) / previous) * 100);
  })();

  const scrollToChart = (id: string) => () => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const tiles: Tile[] = [
    {
      icon: <Sparkles style={{ width: 20, height: 20, color: "var(--ap-brand)" }} />,
      label: "Créations", value: s.totalCreations,
      deltaPct: s.trends.creations.deltaPct,
      onClick: scrollToChart("dashboard-creations-chart"),
    },
    {
      icon: <BarChart2 style={{ width: 20, height: 20, color: "var(--ap-quiz)" }} />,
      label: "Sessions totales", value: s.totalSessions,
      deltaPct: s.trends.sessions.deltaPct,
      onClick: scrollToChart("dashboard-activity-chart"),
    },
    {
      icon: <Users style={{ width: 20, height: 20, color: "var(--ap-poll)" }} />,
      label: "Participants totaux", value: s.totalParticipants,
      deltaPct: s.trends.participants.deltaPct,
      onClick: scrollToChart("dashboard-activity-chart"),
    },
    {
      icon: <Target style={{ width: 20, height: 20, color: "#f59e0b" }} />,
      label: "Score moyen (quiz)", value: s.avgScore != null ? `${s.avgScore} pts` : "-",
      deltaPct: scoreDeltaPct,
      onClick: () => navigate("/my-quizzes"),
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
      {tiles.map(({ icon, label, value, deltaPct, onClick }) => (
        <button
          key={label}
          type="button"
          onClick={onClick}
          className="ap-card"
          style={{
            padding: "20px", display: "flex", flexDirection: "column", gap: "10px",
            textAlign: "left", border: "var(--ap-border-w) solid var(--ap-line)", cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div className="ap-tile__icon" style={{ background: "var(--ap-paper-2)", boxShadow: "0 3px 0 var(--ap-line)", marginBottom: 0, width: 40, height: 40 }}>
              {icon}
            </div>
            <div>
              <div style={{ fontSize: "22px", fontWeight: 800, fontFamily: "var(--ap-font-display)", color: "var(--ap-ink)" }}>{value}</div>
              <div className="ap-muted" style={{ fontSize: "12px" }}>{label}</div>
            </div>
          </div>
          <TrendBadge deltaPct={deltaPct} />
        </button>
      ))}
    </div>
  );
}
