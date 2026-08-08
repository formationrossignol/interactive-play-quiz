import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { ScorePoint } from "@/lib/dashboardStats";
import { MaterialSymbol } from "@/components/MaterialSymbol";

const chartConfig = {
  avgScore: { label: "Score moyen", color: "var(--ap-pres)" },
} satisfies ChartConfig;

const formatDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
};

export function ScoreChart({ data }: { data: ScorePoint[] }) {
  const hasScores = data.some((point) => point.avgScore !== null);
  const latestScore = [...data].reverse().find((point) => point.avgScore !== null)?.avgScore ?? null;

  return (
    <div className="product-analytics-card">
      <div className="product-analytics-card__header">
        <div>
          <span className="product-chart-eyebrow">Performance</span>
          <h3>Score moyen</h3>
          <p>Résultats des sessions quiz sur 14 jours.</p>
        </div>
        {latestScore !== null && <strong className="product-chart-value">{latestScore}<small> pts</small></strong>}
      </div>

      {hasScores ? (
        <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
          <AreaChart data={data} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
            <defs>
              <linearGradient id="scoreAverageFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-avgScore)" stopOpacity={0.28} />
                <stop offset="95%" stopColor="var(--color-avgScore)" stopOpacity={0.02} />
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
            <Area
              dataKey="avgScore"
              type="monotone"
              stroke="var(--color-avgScore)"
              strokeWidth={3}
              fill="url(#scoreAverageFill)"
              dot={false}
              activeDot={{ r: 5, strokeWidth: 3, stroke: "var(--ap-card)" }}
              connectNulls
            />
          </AreaChart>
        </ChartContainer>
      ) : (
        <div className="product-empty-inline" style={{ minHeight: 220 }}>
          <div>
            <MaterialSymbol name="target" size={25} />
            <strong>Aucun score récent</strong>
            <span style={{ fontSize: 12 }}>Les résultats apparaîtront après une première session.</span>
          </div>
        </div>
      )}
    </div>
  );
}
