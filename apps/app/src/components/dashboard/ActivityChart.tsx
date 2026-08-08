import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useNavigate } from "react-router-dom";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart";
import type { ActivityPoint } from "@/lib/dashboardStats";
import { MaterialSymbol } from "@/components/MaterialSymbol";

const chartConfig = {
  sessions: { label: "Sessions", color: "var(--ap-brand-deep)" },
  participants: { label: "Participants", color: "var(--ap-poll)" },
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
          <span className="product-chart-eyebrow">Vue analytique</span>
          <h3>Activité sur 14 jours</h3>
          <p>Sessions lancées et participants uniques, par jour.</p>
        </div>
        <span className="product-chart-period"><MaterialSymbol name="date_range" size={16} /> 14 jours</span>
      </div>

      {hasActivity ? (
        <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
          <AreaChart data={data} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
            <defs>
              <linearGradient id="activitySessionsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-sessions)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-sessions)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="activityParticipantsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-participants)" stopOpacity={0.24} />
                <stop offset="95%" stopColor="var(--color-participants)" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="0" />
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
              dataKey="sessions"
              type="monotone"
              stroke="var(--color-sessions)"
              strokeWidth={3}
              fill="url(#activitySessionsFill)"
              dot={false}
              activeDot={{ r: 5, strokeWidth: 3, stroke: "var(--ap-card)" }}
            />
            <Area
              dataKey="participants"
              type="monotone"
              stroke="var(--color-participants)"
              strokeWidth={3}
              fill="url(#activityParticipantsFill)"
              dot={false}
              activeDot={{ r: 5, strokeWidth: 3, stroke: "var(--ap-card)" }}
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
