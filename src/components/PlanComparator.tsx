import { Fragment } from "react";
import { Check, Minus } from "lucide-react";

export interface ComparatorPlan {
  name: string;
  accent: string;
  highlight?: boolean;
  cta: string;
  onClick: () => void | Promise<void>;
}

type CellValue = string | boolean;
type Row = { label: string; values: [CellValue, CellValue, CellValue] };
type Category = { title: string; rows: Row[] };

/** Grounded in src/lib/plans.ts (CONTENT_CAPS, AUDIENCE_CAP, ADVANCED_QUIZ_TYPES)
 *  and the Pro-plan feature copy in i18n — no invented figures. */
const CATEGORIES: Category[] = [
  {
    title: "Contenu",
    rows: [
      { label: "Quiz, sondages, flashcards, présentations, examens", values: ["5 max", "Illimité", "Illimité"] },
      { label: "Cours", values: ["1", "Illimité", "Illimité"] },
    ],
  },
  {
    title: "Sessions en direct",
    rows: [
      { label: "Participants simultanés par session", values: ["20", "200", "Illimité"] },
      { label: "Types de questions avancés (classement, association, texte à trous, curseur)", values: [false, true, true] },
    ],
  },
  {
    title: "Analyse & export",
    rows: [
      { label: "Rapports de performance", values: ["Basique", "Détaillés", "Détaillés"] },
      { label: "Export des résultats", values: [false, true, true] },
    ],
  },
  {
    title: "Sécurité & organisation",
    rows: [
      { label: "Single Sign-On (SSO)", values: [false, false, true] },
      { label: "Marque blanche & templates personnalisés", values: [false, false, true] },
      { label: "Success manager dédié & formations", values: [false, false, true] },
    ],
  },
];

const Cell = ({ value, accent }: { value: CellValue; accent: string }) => {
  if (typeof value === "string") return <span className="ap-compare__value">{value}</span>;
  return value ? (
    <Check className="ap-compare__icon" style={{ color: `var(${accent})` }} />
  ) : (
    <Minus className="ap-compare__icon ap-compare__icon--no" />
  );
};

/** Full feature-by-feature comparator below the pricing cards — same three
 *  plans, same CTAs, just laid out for side-by-side scanning (à la
 *  Mentimeter's /plans page). */
export const PlanComparator = ({ plans }: { plans: ComparatorPlan[] }) => {
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
          {CATEGORIES.map((cat) => (
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
