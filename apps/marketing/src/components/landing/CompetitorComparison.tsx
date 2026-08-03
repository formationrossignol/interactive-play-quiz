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

const FRENCH_PRODUCTS = [
  { id: "brivia", name: "Brivia", note: "Tout-en-un" },
  { id: "kahoot", name: "Kahoot!", note: "Gamification" },
  { id: "mentimeter", name: "Mentimeter", note: "Présentation" },
  { id: "wooclap", name: "Wooclap", note: "Pédagogie active" },
] as const;

const ENGLISH_PRODUCTS = [
  { id: "brivia", name: "Brivia", note: "All in one" },
  { id: "kahoot", name: "Kahoot!", note: "Gamification" },
  { id: "mentimeter", name: "Mentimeter", note: "Presentations" },
  { id: "wooclap", name: "Wooclap", note: "Active learning" },
] as const;

const FRENCH_ROWS: ComparisonRow[] = [
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

const ENGLISH_ROWS: ComparisonRow[] = [
  {
    feature: "Live quizzes and leaderboard",
    brivia: { availability: "included", label: "Included" },
    kahoot: { availability: "included", label: "Included" },
    mentimeter: { availability: "included", label: "Competition quiz" },
    wooclap: { availability: "included", label: "Competition mode" },
  },
  {
    feature: "Polls and word clouds",
    brivia: { availability: "included", label: "Included" },
    kahoot: { availability: "included", label: "Included" },
    mentimeter: { availability: "included", label: "Included" },
    wooclap: { availability: "included", label: "Included" },
  },
  {
    feature: "Interactive presentations",
    brivia: { availability: "included", label: "Built-in editor" },
    kahoot: { availability: "included", label: "Slides and imports" },
    mentimeter: { availability: "included", label: "Core product" },
    wooclap: { availability: "included", label: "Slides and integrations" },
  },
  {
    feature: "Flashcards",
    brivia: { availability: "included", label: "Native format" },
    kahoot: { availability: "included", label: "Study mode" },
    mentimeter: { availability: "absent", label: "No dedicated format" },
    wooclap: { availability: "partial", label: "Through Wooflash" },
  },
  {
    feature: "Dedicated assessments",
    brivia: { availability: "included", label: "Access, thresholds and monitoring" },
    kahoot: { availability: "partial", label: "Assignments and reports" },
    mentimeter: { availability: "partial", label: "Self-paced sessions" },
    wooclap: { availability: "partial", label: "Assessment and Wooflash" },
  },
  {
    feature: "Structured paths and courses",
    brivia: { availability: "included", label: "Course builder" },
    kahoot: { availability: "included", label: "Courses" },
    mentimeter: { availability: "absent", label: "No dedicated path" },
    wooclap: { availability: "partial", label: "Through Wooflash" },
  },
  {
    feature: "Live reactions and discussion",
    brivia: { availability: "included", label: "Configurable emoji and chat" },
    kahoot: { availability: "partial", label: "Reactions and feedback" },
    mentimeter: { availability: "partial", label: "Anonymous Q&A" },
    wooclap: { availability: "partial", label: "Message wall" },
  },
  {
    feature: "Participant access",
    brivia: { availability: "included", label: "QR or code, no account" },
    kahoot: { availability: "included", label: "QR or PIN, no account" },
    mentimeter: { availability: "included", label: "QR or code" },
    wooclap: { availability: "included", label: "QR or code" },
  },
  {
    feature: "Results exports",
    brivia: { availability: "included", label: "PDF, XLSX, CSV and JSON" },
    kahoot: { availability: "partial", label: "XLSX or Google Drive" },
    mentimeter: { availability: "partial", label: "XLSX, PDF and images" },
    wooclap: { availability: "included", label: "PDF, XLSX and CSV" },
  },
];

function AvailabilityIcon({ availability }: { availability: Availability }) {
  if (availability === "included") {
    return <ProductGlyph name="check" />;
  }
  if (availability === "partial") {
    return <ProductGlyph name="partial" />;
  }
  return <ProductGlyph name="minus" />;
}

export function CompetitorComparison({ language = "fr" }: { language?: "fr" | "en" }) {
  const english = language === "en";
  const products = english ? ENGLISH_PRODUCTS : FRENCH_PRODUCTS;
  const rows = english ? ENGLISH_ROWS : FRENCH_ROWS;

  return (
    <div className={styles.comparison}>
      <div
        className={styles.scroller}
        role="region"
        aria-label={english
          ? "Feature comparison between Brivia, Kahoot, Mentimeter and Wooclap"
          : "Comparaison des fonctionnalités de Brivia, Kahoot, Mentimeter et Wooclap"}
        tabIndex={0}
      >
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.featureHead} scope="col">
                {english ? "Features" : "Fonctionnalités"}
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

      <div className={styles.legend} aria-label={english ? "Comparison legend" : "Légende du comparatif"}>
        <span><ProductGlyph name="check" /> {english ? "Included or native" : "Inclus ou natif"}</span>
        <span><ProductGlyph name="partial" /> {english ? "Partial, separate or plan-dependent" : <>Partiel, séparé ou selon l&apos;offre</>}</span>
        <span><ProductGlyph name="minus" /> {english ? "No dedicated format" : "Pas de format dédié"}</span>
      </div>

      <p className={styles.disclaimer}>
        {english
          ? "Public features reviewed on 26 July 2026. Availability may vary by plan. Official sources: "
          : "Comparaison des fonctionnalités publiques consultées le 26 juillet 2026. La disponibilité peut varier selon les offres. Sources officielles : "}
        <a href="https://kahoot.com/features/how-it-works/" target="_blank" rel="noreferrer">Kahoot!</a>,{" "}
        <a href="https://www.mentimeter.com/features" target="_blank" rel="noreferrer">Mentimeter</a>,{" "}
        <a href="https://www.wooclap.com/en/features/" target="_blank" rel="noreferrer">Wooclap</a> {english ? "and their documentation on " : "et leurs documentations "}
        <a href="https://support.kahoot.com/hc/en-us/articles/360035547493" target="_blank" rel="noreferrer">{english ? "reports" : "rapports"}</a>,{" "}
        <a href="https://help.mentimeter.com/en/articles/410566-export-results-to-excel" target="_blank" rel="noreferrer">exports</a> {english ? "and " : "et "}
        <a href="https://www.wooclap.com/en/wooflash/" target="_blank" rel="noreferrer">Wooflash</a>.
      </p>
    </div>
  );
}
