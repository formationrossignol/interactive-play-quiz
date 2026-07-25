import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { CreationsByType } from "@/lib/dashboardStats";

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
    <div className="ap-card" style={{ padding: "20px" }}>
      <h3 className="ap-h3" style={{ fontSize: "15px", marginBottom: "4px" }}>Créations par type</h3>
      <p className="ap-muted" style={{ fontSize: "12px", marginBottom: "12px" }}>Répartition de vos {total} création{total > 1 ? "s" : ""}.</p>

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
            <Bar dataKey="count" radius={4}>
              {rows.map((row) => (
                <Cell key={row.type} fill={`var(--color-${row.type})`} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      ) : (
        <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p className="ap-muted" style={{ fontSize: "13px" }}>Aucune création pour le moment.</p>
        </div>
      )}
    </div>
  );
}
