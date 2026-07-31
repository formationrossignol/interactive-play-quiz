import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { CreationsByType } from "@/lib/dashboardStats";
import { MaterialSymbol } from "@/components/MaterialSymbol";

const chartConfig = {
  quiz: { label: "Quiz", color: "var(--ap-quiz)" },
  poll: { label: "Sondages", color: "var(--ap-poll)" },
  flashcard: { label: "Flashcards", color: "var(--ap-flash)" },
  slide: { label: "Slides", color: "var(--ap-pres)" },
  other: { label: "Cours + examens", color: "var(--ap-muted)" },
} satisfies ChartConfig;

export function CreationsByTypeChart({ data }: { data: CreationsByType }) {
  const rows = (Object.keys(chartConfig) as Array<keyof CreationsByType>).map((key) => ({
    type: key,
    label: chartConfig[key].label,
    count: data[key],
  }));
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="product-analytics-card">
      <div className="product-analytics-card__header">
        <h3>Bibliothèque</h3>
        <p>Répartition de vos {total} création{total > 1 ? "s" : ""} par format.</p>
      </div>

      {total > 0 ? (
        <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
          <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 0 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="label"
              tickLine={false}
              axisLine={false}
              width={92}
            />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Bar dataKey="count" radius={4} isAnimationActive={false}>
              {rows.map((row) => (
                <Cell key={row.type} fill={`var(--color-${row.type})`} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      ) : (
        <div className="product-empty-inline" style={{ minHeight: 220 }}>
          <div>
            <MaterialSymbol name="category" size={25} />
            <strong>Bibliothèque vide</strong>
            <span style={{ fontSize: 12 }}>Vos contenus seront regroupés ici par format.</span>
          </div>
        </div>
      )}
    </div>
  );
}
