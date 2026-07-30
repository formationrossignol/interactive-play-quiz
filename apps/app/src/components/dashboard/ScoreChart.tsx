import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { ScorePoint } from "@/lib/dashboardStats";

const chartConfig = {
  avgScore: { label: "Score moyen", color: "var(--ap-pres)" },
} satisfies ChartConfig;

const formatDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
};

export function ScoreChart({ data }: { data: ScorePoint[] }) {
  const hasScores = data.some((point) => point.avgScore !== null);

  return (
    <div className="ap-card" style={{ padding: "20px" }}>
      <h2 className="ap-h3" style={{ fontSize: "15px", marginBottom: "4px" }}>Score moyen (14 derniers jours)</h2>
      <p className="ap-muted" style={{ fontSize: "12px", marginBottom: "12px" }}>Moyenne des scores de vos sessions quiz, par jour.</p>

      {hasScores ? (
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
            <Line
              dataKey="avgScore"
              type="monotone"
              stroke="var(--color-avgScore)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--color-avgScore)", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
      ) : (
        <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p className="ap-muted" style={{ fontSize: "13px" }}>Pas encore de score sur les 14 derniers jours.</p>
        </div>
      )}
    </div>
  );
}
