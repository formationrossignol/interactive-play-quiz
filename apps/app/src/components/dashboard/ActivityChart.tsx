import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
        <h3>Activité sur 14 jours</h3>
        <p>Sessions lancées et participants uniques, par jour.</p>
      </div>

      {hasActivity ? (
        <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
          <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
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
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              dataKey="sessions"
              type="monotone"
              stroke="var(--color-sessions)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--color-sessions)", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
            <Line
              dataKey="participants"
              type="monotone"
              stroke="var(--color-participants)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--color-participants)", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
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
