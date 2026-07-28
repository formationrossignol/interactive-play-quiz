import { Check, CircleDotDashed, Minus } from "lucide-react";
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

const PRODUCTS = [
  { id: "brivia", name: "Brivia", note: "Tout-en-un" },
  { id: "kahoot", name: "Kahoot!", note: "Gamification" },
  { id: "mentimeter", name: "Mentimeter", note: "Présentation" },
  { id: "wooclap", name: "Wooclap", note: "Pédagogie active" },
] as const;

const ROWS: ComparisonRow[] = [
  {
    feature: "Quiz live et classement",
    brivia: { availability: "included", label: "Inclus" },
    kahoot: { availability: "included", label: "Inclus" },
    mentimeter: { availability: "included", label: "Quiz compétition" },
    wooclap: { availability: "included", label: "Mode compétition" },
  },
  {
    feature: "Sondages et nuages de mots",
    brivia: { availability: "included", label: "Inclus" },
    kahoot: { availability: "included", label: "Inclus" },
    mentimeter: { availability: "included", label: "Inclus" },
    wooclap: { availability: "included", label: "Inclus" },
  },
  {
    feature: "Présentations interactives",
    brivia: { availability: "included", label: "Éditeur intégré" },
    kahoot: { availability: "included", label: "Slides et imports" },
    mentimeter: { availability: "included", label: "Cœur du produit" },
    wooclap: { availability: "included", label: "Slides et intégrations" },
  },
  {
    feature: "Flashcards",
    brivia: { availability: "included", label: "Format natif" },
    kahoot: { availability: "included", label: "Mode étude" },
    mentimeter: { availability: "absent", label: "Pas de format dédié" },
    wooclap: { availability: "partial", label: "Via Wooflash" },
  },
  {
    feature: "Examens dédiés",
    brivia: { availability: "included", label: "Accès, seuil et surveillance" },
    kahoot: { availability: "partial", label: "Devoirs et rapports" },
    mentimeter: { availability: "partial", label: "Sessions auto-rythmées" },
    wooclap: { availability: "partial", label: "Évaluation et Wooflash" },
  },
  {
    feature: "Parcours et cours structurés",
    brivia: { availability: "included", label: "Créateur de cours" },
    kahoot: { availability: "included", label: "Courses" },
    mentimeter: { availability: "absent", label: "Pas de parcours dédié" },
    wooclap: { availability: "partial", label: "Via Wooflash" },
  },
  {
    feature: "Réactions et échanges live",
    brivia: { availability: "included", label: "Emoji et chat configurables" },
    kahoot: { availability: "partial", label: "Réactions et feedback" },
    mentimeter: { availability: "partial", label: "Q&A anonyme" },
    wooclap: { availability: "partial", label: "Message wall" },
  },
  {
    feature: "Accès participant",
    brivia: { availability: "included", label: "QR ou code, sans compte" },
    kahoot: { availability: "included", label: "QR ou PIN, sans compte" },
    mentimeter: { availability: "included", label: "QR ou code" },
    wooclap: { availability: "included", label: "QR ou code" },
  },
  {
    feature: "Exports de résultats",
    brivia: { availability: "included", label: "PDF, XLSX, CSV et JSON" },
    kahoot: { availability: "partial", label: "XLSX ou Google Drive" },
    mentimeter: { availability: "partial", label: "XLSX, PDF et images" },
    wooclap: { availability: "included", label: "PDF, XLSX et CSV" },
  },
];

function AvailabilityIcon({ availability }: { availability: Availability }) {
  if (availability === "included") {
    return <Check size={17} strokeWidth={3} aria-hidden="true" />;
  }
  if (availability === "partial") {
    return <CircleDotDashed size={17} strokeWidth={2.4} aria-hidden="true" />;
  }
  return <Minus size={17} strokeWidth={2.6} aria-hidden="true" />;
}

export function CompetitorComparison() {
  return (
    <div className={styles.comparison}>
      <div
        className={styles.scroller}
        role="region"
        aria-label="Comparaison des fonctionnalités de Brivia, Kahoot, Mentimeter et Wooclap"
        tabIndex={0}
      >
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.featureHead} scope="col">
                Fonctionnalités
              </th>
              {PRODUCTS.map((product) => (
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
            {ROWS.map((row) => (
              <tr key={row.feature}>
                <th className={styles.featureCell} scope="row">
                  {row.feature}
                </th>
                {PRODUCTS.map((product) => {
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

      <div className={styles.legend} aria-label="Légende du comparatif">
        <span><Check size={15} strokeWidth={3} aria-hidden="true" /> Inclus ou natif</span>
        <span><CircleDotDashed size={15} strokeWidth={2.4} aria-hidden="true" /> Partiel, séparé ou selon l&apos;offre</span>
        <span><Minus size={15} strokeWidth={2.6} aria-hidden="true" /> Pas de format dédié</span>
      </div>

      <p className={styles.disclaimer}>
        Comparaison des fonctionnalités publiques consultées le 26 juillet 2026. La disponibilité peut varier selon
        les offres. Sources officielles :{" "}
        <a href="https://kahoot.com/features/how-it-works/" target="_blank" rel="noreferrer">Kahoot!</a>,{" "}
        <a href="https://www.mentimeter.com/features" target="_blank" rel="noreferrer">Mentimeter</a>,{" "}
        <a href="https://www.wooclap.com/en/features/" target="_blank" rel="noreferrer">Wooclap</a> et leurs documentations{" "}
        <a href="https://support.kahoot.com/hc/en-us/articles/360035547493" target="_blank" rel="noreferrer">rapports</a>,{" "}
        <a href="https://help.mentimeter.com/en/articles/410566-export-results-to-excel" target="_blank" rel="noreferrer">exports</a> et{" "}
        <a href="https://www.wooclap.com/en/wooflash/" target="_blank" rel="noreferrer">Wooflash</a>.
      </p>
    </div>
  );
}
