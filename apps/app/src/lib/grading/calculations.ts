import type {
  AttendanceStatus,
  ManualEvaluation,
  ManualGrade,
  PublishedGrade,
  RoundingRule,
} from "./types";

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "Présent",
  absent: "Absent",
  absent_excused: "Absent justifié",
  absent_unexcused: "Absent non justifié",
  not_submitted: "Non rendu",
  exempt: "Dispensé",
  not_evaluated: "Non évalué",
};

export const VALIDATION_LABELS = {
  validated: "Validé",
  not_validated: "Non validé",
  review: "À revoir",
  not_evaluated: "Non évalué",
} as const;

export function parseLocalizedScore(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function validateNumericScore(
  value: string,
  evaluation: Pick<ManualEvaluation, "minimum_score" | "maximum_score" | "decimal_places">,
): string | null {
  const parsed = parseLocalizedScore(value);
  if (parsed === null) return null;
  if (!Number.isFinite(parsed)) return "Saisissez un nombre valide.";
  if (parsed < evaluation.minimum_score || parsed > evaluation.maximum_score) {
    return `La note doit être comprise entre ${evaluation.minimum_score} et ${evaluation.maximum_score}.`;
  }
  const factor = 10 ** evaluation.decimal_places;
  if (Math.abs(parsed * factor - Math.round(parsed * factor)) > Number.EPSILON * factor) {
    return `Maximum ${evaluation.decimal_places} décimale${evaluation.decimal_places !== 1 ? "s" : ""}.`;
  }
  return null;
}

export function roundGrade(value: number, rule: RoundingRule): number {
  if (rule === "tenth") return Math.round(value * 10) / 10;
  if (rule === "half") return Math.round(value * 2) / 2;
  if (rule === "integer") return Math.round(value);
  return value;
}

export interface ActivityStats {
  graded: number;
  mean: number | null;
  median: number | null;
  minimum: number | null;
  maximum: number | null;
  passRate: number | null;
}

export function computeActivityStats(
  grades: ManualGrade[],
  evaluation: Pick<ManualEvaluation, "grading_type" | "pass_threshold" | "minimum_score">,
): ActivityStats {
  if (evaluation.grading_type !== "numeric") {
    const completed = grades.filter((grade) => grade.validation_value !== null);
    const passed = completed.filter((grade) => grade.validation_value === "validated").length;
    return {
      graded: completed.length,
      mean: null,
      median: null,
      minimum: null,
      maximum: null,
      passRate: completed.length ? (passed / completed.length) * 100 : null,
    };
  }

  const values = grades
    .flatMap((grade) => {
      if (grade.attendance_status === "present" && grade.score !== null) return [grade.score];
      if (ZERO_ATTENDANCE.has(grade.attendance_status)) return [evaluation.minimum_score];
      return [];
    })
    .sort((a, b) => a - b);
  if (values.length === 0) {
    return { graded: 0, mean: null, median: null, minimum: null, maximum: null, passRate: null };
  }
  const midpoint = Math.floor(values.length / 2);
  const median = values.length % 2
    ? values[midpoint]
    : (values[midpoint - 1] + values[midpoint]) / 2;
  const passed = evaluation.pass_threshold === null
    ? 0
    : values.filter((score) => score >= evaluation.pass_threshold!).length;
  return {
    graded: values.length,
    mean: values.reduce((sum, score) => sum + score, 0) / values.length,
    median,
    minimum: values[0],
    maximum: values[values.length - 1],
    passRate: evaluation.pass_threshold === null ? null : (passed / values.length) * 100,
  };
}

const ZERO_ATTENDANCE = new Set<AttendanceStatus>([
  "absent",
  "absent_unexcused",
  "not_submitted",
]);
const EXCLUDED_ATTENDANCE = new Set<AttendanceStatus>([
  "absent_excused",
  "exempt",
  "not_evaluated",
]);

/** Weighted average normalized to /20. V1 attendance rules:
 * absent/non-justified/not-submitted = zero; justified/exempt/not-evaluated
 * = excluded. Validation-only assessments do not enter a numeric average. */
export function computeWeightedAverage(grades: PublishedGrade[]): number | null {
  let weightedTotal = 0;
  let coefficientTotal = 0;

  grades.forEach((grade) => {
    const evaluation = grade.evaluation;
    if (evaluation.grading_type !== "numeric") return;
    if (EXCLUDED_ATTENDANCE.has(grade.attendance_status)) return;

    let normalized = 0;
    if (grade.attendance_status === "present") {
      if (grade.score === null) return;
      normalized = ((grade.score - evaluation.minimum_score)
        / (evaluation.maximum_score - evaluation.minimum_score)) * 20;
    } else if (!ZERO_ATTENDANCE.has(grade.attendance_status)) {
      return;
    }

    weightedTotal += normalized * evaluation.coefficient;
    coefficientTotal += evaluation.coefficient;
  });

  return coefficientTotal ? weightedTotal / coefficientTotal : null;
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function buildGradeCsv(
  evaluation: ManualEvaluation,
  rows: Array<{ username: string; grade: ManualGrade | null }>,
): string {
  const headers = [
    "Apprenant",
    evaluation.grading_type === "numeric" ? "Note" : "Validation",
    "Barème",
    "Présence",
    "Appréciation",
    "Publication",
    "Dernière modification",
  ];
  const body = rows.map(({ username, grade }) => {
    const result = evaluation.grading_type === "numeric"
      ? grade?.score ?? ""
      : grade?.validation_value ? VALIDATION_LABELS[grade.validation_value] : "";
    return [
      username,
      result,
      evaluation.grading_type === "numeric" ? evaluation.maximum_score : "",
      grade ? ATTENDANCE_LABELS[grade.attendance_status] : "Non évalué",
      grade?.appreciation ?? "",
      grade?.workflow_status === "published" ? "Publiée" : "Brouillon",
      grade?.updated_at ?? "",
    ].map(csvCell).join(";");
  });
  return `\uFEFF${headers.map(csvCell).join(";")}\n${body.join("\n")}\n`;
}
