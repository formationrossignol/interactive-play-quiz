import { ProductGlyph } from "@/components/ProductGlyph";
import styles from "./CompetitorComparison.module.css";

type Availability = "included" | "partial" | "absent";

interface ComparisonCell {
  availability: Availability;
  label: string;
}

interface ComparisonRow {
  feature: string;
  brivia: ComparisonCell;
  kahoot: ComparisonCell;
  mentimeter: ComparisonCell;
  wooclap: ComparisonCell;
}

interface Product {
  id: "brivia" | "kahoot" | "mentimeter" | "wooclap";
  name: string;
  note: string;
}

export type CompetitorComparisonContent = {
  ariaLabel: string;
  featuresHeader: string;
  legendAriaLabel: string;
  legendIncluded: string;
  legendPartial: string;
  legendAbsent: string;
  disclaimerIntro: string;
  disclaimerAnd: string;
  disclaimerReports: string;
  disclaimerAnd2: string;
  products: Product[];
  rows: ComparisonRow[];
};

function AvailabilityIcon({ availability }: { availability: Availability }) {
  if (availability === "included") {
    return <ProductGlyph name="check" />;
  }
  if (availability === "partial") {
    return <ProductGlyph name="partial" />;
  }
  return <ProductGlyph name="minus" />;
}

export function CompetitorComparison({ content }: { content: CompetitorComparisonContent }) {
  const { products, rows } = content;

  return (
    <div className={styles.comparison}>
      <div
        className={styles.scroller}
        role="region"
        aria-label={content.ariaLabel}
        tabIndex={0}
      >
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.featureHead} scope="col">
                {content.featuresHeader}
              </th>
              {products.map((product) => (
                <th
                  key={product.id}
                  className={product.id === "brivia" ? styles.briviaHead : styles.productHead}
                  scope="col"
                >
                  <span className={styles.productName}>{product.name}</span>
                  <span className={styles.productNote}>{product.note}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.feature}>
                <th className={styles.featureCell} scope="row">
                  {row.feature}
                </th>
                {products.map((product) => {
                  const cell = row[product.id];
                  return (
                    <td
                      key={product.id}
                      className={[
                        styles.valueCell,
                        styles[cell.availability],
                        product.id === "brivia" ? styles.briviaCell : "",
                      ].join(" ")}
                    >
                      <span className={styles.value}>
                        <AvailabilityIcon availability={cell.availability} />
                        <span>{cell.label}</span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.legend} aria-label={content.legendAriaLabel}>
        <span><ProductGlyph name="check" /> {content.legendIncluded}</span>
        <span><ProductGlyph name="partial" /> {content.legendPartial}</span>
        <span><ProductGlyph name="minus" /> {content.legendAbsent}</span>
      </div>

      <p className={styles.disclaimer}>
        {content.disclaimerIntro}
        <a href="https://kahoot.com/features/how-it-works/" target="_blank" rel="noreferrer">Kahoot!</a>,{" "}
        <a href="https://www.mentimeter.com/features" target="_blank" rel="noreferrer">Mentimeter</a>,{" "}
        <a href="https://www.wooclap.com/en/features/" target="_blank" rel="noreferrer">Wooclap</a> {content.disclaimerAnd}
        <a href="https://support.kahoot.com/hc/en-us/articles/360035547493" target="_blank" rel="noreferrer">{content.disclaimerReports}</a>,{" "}
        <a href="https://help.mentimeter.com/en/articles/410566-export-results-to-excel" target="_blank" rel="noreferrer">exports</a> {content.disclaimerAnd2}
        <a href="https://www.wooclap.com/en/wooflash/" target="_blank" rel="noreferrer">Wooflash</a>.
      </p>
    </div>
  );
}
