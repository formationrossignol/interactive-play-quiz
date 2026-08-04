import { Fragment } from "react";
import { Check, Minus } from "lucide-react";

export interface ComparatorPlan {
  name: string;
  accent: string;
  highlight?: boolean;
  cta: string;
  onClick: () => void | Promise<void>;
}

export type CellValue = string | boolean;
export type ComparatorRow = { label: string; values: [CellValue, CellValue, CellValue] };
export type ComparatorCategory = { title: string; rows: ComparatorRow[] };

const Cell = ({ value, accent }: { value: CellValue; accent: string }) => {
  if (typeof value === "string") return <span className="ap-compare__value">{value}</span>;
  return value ? (
    <Check className="ap-compare__icon" style={{ color: `var(${accent})` }} />
  ) : (
    <Minus className="ap-compare__icon ap-compare__icon--no" />
  );
};

export const PlanComparator = ({ plans, categories }: { plans: ComparatorPlan[]; categories: ComparatorCategory[] }) => {
  return (
    <div className="ap-compare-wrap">
      <table className="ap-compare">
        <thead>
          <tr>
            <th className="ap-compare__labelcol" />
            {plans.map((p) => (
              <th key={p.name} className={p.highlight ? "is-highlight" : undefined}>
                <div className="ap-compare__plan">
                  <span className="ap-compare__planname" style={{ color: `var(${p.accent})` }}>{p.name}</span>
                  <button
                    type="button"
                    className={p.highlight ? "ap-btn ap-btn--sm ap-btn--pill" : "ap-btn ap-btn--ghost ap-btn--sm ap-btn--pill"}
                    onClick={p.onClick}
                  >
                    {p.cta}
                  </button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => (
            <Fragment key={cat.title}>
              <tr className="ap-compare__category">
                <td colSpan={plans.length + 1}>{cat.title}</td>
              </tr>
              {cat.rows.map((row) => (
                <tr key={row.label}>
                  <td className="ap-compare__labelcol">{row.label}</td>
                  {row.values.map((value, i) => (
                    <td key={plans[i]?.name ?? i} className={plans[i]?.highlight ? "is-highlight" : undefined}>
                      <Cell value={value} accent={plans[i]?.accent ?? "--ap-brand"} />
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};
