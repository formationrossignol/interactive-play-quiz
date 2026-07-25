import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart";
import type { ActivityPoint } from "@/lib/dashboardStats";

const chartConfig = {
  sessions: { label: "Sessions", color: "var(--ap-quiz)" },
  participants: { label: "Participants", color: "var(--ap-poll)" },
} satisfies ChartConfig;

const formatDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
};

export function ActivityChart({ data }: { data: ActivityPoint[] }) {
  const hasActivity = data.some((point) => point.sessions > 0 || point.participants > 0);

  return (
    <div className="ap-card" style={{ padding: "20px" }}>
      <h3 className="ap-h3" style={{ fontSize: "15px", marginBottom: "4px" }}>Activité (14 derniers jours)</h3>
      <p className="ap-muted" style={{ fontSize: "12px", marginBottom: "12px" }}>Sessions lancées et participants, par jour.</p>

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
            />
            <Line
              dataKey="participants"
              type="monotone"
              stroke="var(--color-participants)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--color-participants)", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ChartContainer>
      ) : (
        <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p className="ap-muted" style={{ fontSize: "13px" }}>Pas encore de session sur les 14 derniers jours.</p>
        </div>
      )}
    </div>
  );
}
