import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { ScorePoint } from "@/lib/dashboardStats";
import { MaterialSymbol } from "@/components/MaterialSymbol";

const chartConfig = {
  avgScore: { label: "Score moyen", color: "var(--ap-brand)" },
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
          <h3>Score moyen</h3>
          <p>Résultats des sessions quiz sur 14 jours.</p>
        </div>
        {latestScore !== null && <strong className="product-chart-value">{latestScore}<small> pts</small></strong>}
      </div>

      {hasScores ? (
        <ChartContainer config={chartConfig} className="aspect-auto h-[210px] w-full">
          <BarChart data={data} margin={{ left: 0, right: 8, top: 12, bottom: 0 }} barCategoryGap="38%">
            <CartesianGrid vertical={false} strokeDasharray="0" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDay}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
            />
            <YAxis domain={[0, 100]} allowDecimals={false} tickLine={false} axisLine={false} width={28} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => formatDay(payload[0]?.payload.date)} />} />
            <Bar
              dataKey="avgScore"
              fill="var(--color-avgScore)"
              radius={[5, 5, 0, 0]}
              maxBarSize={22}
              isAnimationActive={false}
            />
          </BarChart>
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
