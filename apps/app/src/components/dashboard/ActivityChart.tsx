import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useNavigate } from "react-router-dom";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart";
import type { ActivityPoint } from "@/lib/dashboardStats";
import { MaterialSymbol } from "@/components/MaterialSymbol";

const chartConfig = {
  sessions: { label: "Sessions", color: "var(--mp-chart-primary)" },
  participants: { label: "Participants", color: "var(--mp-chart-secondary)" },
} satisfies ChartConfig;

const formatDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
};

export function ActivityChart({ data, hasCreations }: { data: ActivityPoint[]; hasCreations: boolean }) {
  const navigate = useNavigate();
  const hasActivity = data.some((point) => point.sessions > 0 || point.participants > 0);

  return (
    <div className="product-analytics-card">
      <div className="product-analytics-card__header">
        <div>
          <h3>Activité sur 14 jours</h3>
          <p>Sessions lancées et participants uniques, par jour.</p>
        </div>
        <span className="product-chart-period"><MaterialSymbol name="date_range" size={16} /> 14 jours</span>
      </div>

      {hasActivity ? (
        <ChartContainer config={chartConfig} className="aspect-auto h-[230px] w-full">
          <AreaChart data={data} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
            <defs>
              <linearGradient id="activitySessionsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-sessions)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--color-sessions)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="activityParticipantsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-participants)" stopOpacity={0.14} />
                <stop offset="100%" stopColor="var(--color-participants)" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="5 7" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDay}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
            />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => formatDay(payload[0]?.payload.date)} />} />
            <ChartLegend content={<ChartLegendContent verticalAlign="top" className="justify-start" />} verticalAlign="top" />
            <Area
              type="monotone"
              dataKey="sessions"
              stroke="var(--color-sessions)"
              strokeWidth={3}
              fill="url(#activitySessionsFill)"
              activeDot={{ r: 4, strokeWidth: 2 }}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="participants"
              stroke="var(--color-participants)"
              strokeWidth={3}
              fill="url(#activityParticipantsFill)"
              activeDot={{ r: 4, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
      ) : (
        <div className="product-empty-inline" style={{ minHeight: 220 }}>
          <div>
          <MaterialSymbol name="monitoring" size={25} />
          <strong>Aucune activité récente</strong>
          <span style={{ display: "block", fontSize: 12 }}>Les sessions et participants apparaîtront ici.</span>
          {hasCreations && (
            <button
              type="button"
              className="ap-btn ap-btn--sm"
              style={{ marginTop: 12 }}
              onClick={() => navigate("/my-quizzes")}
            >
              Lancer une session
            </button>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
