import { Cell, Label, Pie, PieChart } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { CreationsByType } from "@/lib/dashboardStats";
import { MaterialSymbol } from "@/components/MaterialSymbol";

const chartConfig = {
  quiz: { label: "Quiz", color: "var(--mp-chart-primary)" },
  poll: { label: "Sondages", color: "var(--mp-chart-secondary)" },
  flashcard: { label: "Flashcards", color: "var(--mp-chart-positive)" },
  slide: { label: "Slides", color: "var(--mp-chart-axis)" },
  other: { label: "Cours + examens", color: "var(--mp-chart-grid)" },
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
        <div>
          <h3>Bibliothèque</h3>
          <p>Répartition de vos créations par format.</p>
        </div>
        <span className="product-chart-period"><MaterialSymbol name="donut_small" size={16} /> Formats</span>
      </div>

      {total > 0 ? (
        <div className="product-donut-layout">
          <ChartContainer config={chartConfig} className="aspect-square h-[210px] w-full max-w-[240px]">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="label" />} />
              <Pie data={rows} dataKey="count" nameKey="label" innerRadius={64} outerRadius={88} paddingAngle={3} strokeWidth={0} isAnimationActive={false}>
                <Label
                  content={({ viewBox }) => {
                    if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null;
                    return (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) - 6} className="product-donut-total">{total}</tspan>
                        <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 17} className="product-donut-label">créations</tspan>
                      </text>
                    );
                  }}
                />
              {rows.map((row) => (
                <Cell key={row.type} fill={`var(--color-${row.type})`} />
              ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="product-chart-breakdown">
            {rows.map((row) => (
              <div key={row.type} className="product-chart-breakdown__item">
                <span className="product-chart-breakdown__dot" style={{ background: `var(--color-${row.type})` }} />
                <span>{row.label}</span>
                <strong>{row.count}</strong>
              </div>
            ))}
          </div>
        </div>
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
