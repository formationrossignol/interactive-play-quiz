import type { DashboardCharts, DashboardStats } from "@/lib/dashboardStats";
import { Skeleton } from "@/components/ui/skeleton";
import { MaterialSymbol } from "@/components/MaterialSymbol";

interface Tile {
  iconName: string;
  iconColor: string;
  tone: "warning" | "primary" | "secondary" | "success";
  label: string;
  value: string | number;
  deltaPct: number | null;
  /** Shown instead of TrendBadge when deltaPct is null and the value itself
   *  needs explaining (e.g. a bare "-" reads as broken, not "no data yet"). */
  emptyHint?: string;
  /** Last N days of raw values behind this tile, oldest first — undefined
   *  when no daily series exists for this metric (e.g. Créations). */
  spark?: number[];
  sparkColor: string;
  /** MaterialPro's two large data widgets use different integrated chart
   *  shapes and solid surfaces; the remaining metrics stay compact. */
  featured?: "primary" | "secondary";
  sparkVariant?: "line" | "bars";
  /** Where this KPI's detailed breakdown lives — REQ-DB-004. */
  onClick: () => void;
}

/** Minimal inline trend line — decorative, not a chart: no axes, no
 *  tooltip. Drawn from raw values only when there are at least 2 points,
 *  otherwise a flat/empty series would render as a meaningless dot or line. */
function Sparkline({ values, color, variant = "line" }: { values: number[]; color: string; variant?: "line" | "bars" }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 64;
  const h = 24;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - 2 - ((v - min) / span) * (h - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  if (variant === "bars") {
    const barWidth = Math.max(2.5, w / values.length - 3);
    return (
      <svg className="product-kpi__spark product-kpi__spark--bars" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
        {values.map((value, index) => {
          const barHeight = 4 + ((value - min) / span) * (h - 6);
          return <rect key={index} x={(index / values.length) * w + 1} y={h - barHeight} width={barWidth} height={barHeight} rx={barWidth / 2} fill={color} />;
        })}
      </svg>
    );
  }
  return (
    <svg className="product-kpi__spark product-kpi__spark--line" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline className="product-kpi__spark-path" points={points.join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" pathLength="1" />
    </svg>
  );
}

/** Small up/down/flat indicator — never color-only (REQ-COL-004): the arrow
 *  direction and the "vs 14 j précédents" caption carry the meaning too.
 *  Renders nothing without a baseline: repeating "no comparison available"
 *  identically across all 4 tiles was noise, not information. */
function TrendBadge({ deltaPct, hero = false }: { deltaPct: number | null; hero?: boolean }) {
  if (deltaPct === null) return null;
  const flat = deltaPct === 0;
  const positive = deltaPct > 0;
  const symbolName = flat ? "remove" : positive ? "arrow_drop_up" : "arrow_drop_down";
  const color = hero ? "var(--product-kpi-hero-contrast, #fff)" : flat ? "var(--ap-muted)" : positive ? "#15c08a" : "#ff5a4d";
  const chipBg = hero ? "var(--product-kpi-hero-chip, rgba(255, 255, 255, .2))" : `color-mix(in srgb, ${color} 14%, transparent)`;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      <span
        style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          fontSize: 10.5, fontWeight: 760, color,
          background: chipBg,
          borderRadius: "var(--ap-r-sm)", padding: "3px 7px",
        }}
      >
        <MaterialSymbol name={symbolName} size={flat ? 11 : 16} style={{ margin: flat ? 0 : "0 -3px" }} />
        {flat ? "stable" : `${positive ? "+" : ""}${deltaPct}%`}
      </span>
      <span className="ap-muted" style={{ fontWeight: 620, fontSize: 10.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        vs 14 j préc.
      </span>
    </span>
  );
}

export function KpiRow({ stats, charts }: { stats: DashboardStats | null; charts: DashboardCharts | null }) {
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

  // Décoratives : dérivées de la même série que les graphiques du bas, pas
  // de nouvel appel réseau. Aucune série quotidienne pour les créations —
  // creationsByType est une répartition par type, pas dans le temps.
  const sessionsSpark = charts?.activity.map((a) => a.sessions);
  const participantsSpark = charts?.activity.map((a) => a.participants);
  const scoreSpark = charts?.scoreByDay
    .filter((p) => p.avgScore !== null)
    .map((p) => p.avgScore as number);

  const tiles: Tile[] = [
    {
      iconName: "dns", iconColor: "var(--ap-brand)",
      tone: "primary",
      label: "Sessions totales", value: s.totalSessions,
      deltaPct: s.trends.sessions.deltaPct,
      spark: sessionsSpark,
      sparkColor: "var(--ap-brand)",
      featured: "primary",
      sparkVariant: "bars",
      onClick: scrollToChart("dashboard-activity-chart"),
    },
    {
      iconName: "bar_chart", iconColor: "var(--ap-brand)",
      tone: "secondary",
      label: "Participants totaux", value: s.totalParticipants,
      deltaPct: s.trends.participants.deltaPct,
      spark: participantsSpark,
      sparkColor: "var(--ap-muted)",
      featured: "secondary",
      sparkVariant: "bars",
      onClick: scrollToChart("dashboard-activity-chart"),
    },
    {
      iconName: "analytics", iconColor: "var(--ap-brand)",
      tone: "warning",
      label: "Score moyen (quiz)", value: s.avgScore != null ? `${s.avgScore} pts` : "-",
      deltaPct: scoreDeltaPct,
      emptyHint: s.avgScore == null ? "Pas encore de score" : undefined,
      spark: scoreSpark,
      sparkColor: "var(--ap-brand)",
      sparkVariant: "bars",
      onClick: scrollToChart("dashboard-score-chart"),
    },
    {
      iconName: "category", iconColor: "var(--ap-brand)",
      tone: "success",
      label: "Créations", value: s.totalCreations,
      deltaPct: s.trends.creations.deltaPct,
      sparkColor: "var(--ap-brand)",
      onClick: scrollToChart("dashboard-creations-chart"),
    },
  ];

  return (
    <div className="product-kpis">
      {tiles.map(({ iconName, iconColor, tone, label, value, deltaPct, emptyHint, spark, sparkColor, featured, sparkVariant, onClick }) => {
        const hero = Boolean(featured);
        return (
          <button
            key={label}
            type="button"
            onClick={onClick}
            data-tone={tone}
            data-featured={featured || undefined}
            className={`product-kpi${hero ? " product-kpi--hero product-kpi--featured" : ""}`}
            aria-label={`${label} : ${value}. Afficher le détail`}
          >
            <div className="product-kpi__top">
              <span className="product-kpi__icon" style={hero ? undefined : { color: iconColor }}>
                <MaterialSymbol name={iconName} size={20} />
              </span>
              <span className="product-kpi__copy">
                <span className="product-kpi__label">{label}</span>
                <span className="product-kpi__period">14 derniers jours</span>
              </span>
            </div>
            <span className="product-kpi__bottom">
              <span className="product-kpi__value">{value}</span>
              <span className="product-kpi__trend">
                {deltaPct !== null
                  ? <TrendBadge deltaPct={deltaPct} hero={hero} />
                  : emptyHint && <span className="ap-muted" style={{ fontSize: 10.5 }}>{emptyHint}</span>}
                {spark && <Sparkline values={spark} color={sparkColor} variant={sparkVariant} />}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
