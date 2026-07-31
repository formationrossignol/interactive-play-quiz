import type { ReactNode } from "react";
import type { DashboardStats } from "@/lib/dashboardStats";
import { Skeleton } from "@/components/ui/skeleton";
import { MaterialSymbol } from "@/components/MaterialSymbol";

interface Tile {
  icon: ReactNode;
  label: string;
  value: string | number;
  deltaPct: number | null;
  /** Shown instead of TrendBadge when deltaPct is null and the value itself
   *  needs explaining (e.g. a bare "-" reads as broken, not "no data yet"). */
  emptyHint?: string;
  /** Where this KPI's detailed breakdown lives — REQ-DB-004. */
  onClick: () => void;
}

/** Small up/down/flat indicator — never color-only (REQ-COL-004): the arrow
 *  direction and the "vs 14 j précédents" caption carry the meaning too.
 *  Renders nothing without a baseline: repeating "no comparison available"
 *  identically across all 4 tiles was noise, not information. */
function TrendBadge({ deltaPct }: { deltaPct: number | null }) {
  if (deltaPct === null) return null;
  const flat = deltaPct === 0;
  const positive = deltaPct > 0;
  const symbolName = flat ? "remove" : positive ? "arrow_upward" : "arrow_downward";
  const color = flat ? "var(--ap-muted)" : positive ? "#15c08a" : "#ff5a4d";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 760, color }}>
      <MaterialSymbol name={symbolName} size={11} />
      {flat ? "stable" : `${positive ? "+" : ""}${deltaPct}%`}
      <span className="ap-muted" style={{ fontWeight: 620 }}>vs 14 j préc.</span>
    </span>
  );
}

export function KpiRow({ stats }: { stats: DashboardStats | null }) {
  if (!stats) {
    return (
      <div className="product-kpis" aria-label="Chargement des indicateurs">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="product-kpi">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
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
      icon: <MaterialSymbol name="auto_awesome" size={20} style={{ color: "var(--ap-brand)" }} />,
      label: "Créations", value: s.totalCreations,
      deltaPct: s.trends.creations.deltaPct,
      onClick: scrollToChart("dashboard-creations-chart"),
    },
    {
      icon: <MaterialSymbol name="bar_chart" size={20} style={{ color: "var(--ap-brand-deep)" }} />,
      label: "Sessions totales", value: s.totalSessions,
      deltaPct: s.trends.sessions.deltaPct,
      onClick: scrollToChart("dashboard-activity-chart"),
    },
    {
      icon: <MaterialSymbol name="group" size={20} style={{ color: "var(--ap-poll)" }} />,
      label: "Participants totaux", value: s.totalParticipants,
      deltaPct: s.trends.participants.deltaPct,
      onClick: scrollToChart("dashboard-activity-chart"),
    },
    {
      icon: <MaterialSymbol name="target" size={20} style={{ color: "#f59e0b" }} />,
      label: "Score moyen (quiz)", value: s.avgScore != null ? `${s.avgScore} pts` : "-",
      deltaPct: scoreDeltaPct,
      emptyHint: s.avgScore == null ? "Pas encore de score" : undefined,
      onClick: scrollToChart("dashboard-score-chart"),
    },
  ];

  return (
    <div className="product-kpis">
      {tiles.map(({ icon, label, value, deltaPct, emptyHint, onClick }) => (
        <button
          key={label}
          type="button"
          onClick={onClick}
          className="product-kpi"
          aria-label={`${label} : ${value}. Afficher le détail`}
        >
          <div>
            <div className="product-kpi__top">
              <span className="product-kpi__icon">
              {icon}
              </span>
              <span className="product-kpi__label">{label}</span>
            </div>
            <span className="product-kpi__value">{value}</span>
          </div>
          <span className="product-kpi__trend">
            {deltaPct !== null
              ? <TrendBadge deltaPct={deltaPct} />
              : emptyHint && <span className="ap-muted" style={{ fontSize: 10.5 }}>{emptyHint}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
