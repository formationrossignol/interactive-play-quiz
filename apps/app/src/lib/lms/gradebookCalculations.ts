import type { GradeItem, GradeResult } from "./gradebook";

export const SOURCE_LABEL: Record<string, string> = {
  assignment: "Devoir", exam: "Examen", manual: "Évaluation", quiz: "Quiz", scorm: "SCORM", h5p: "H5P",
};

/** GBK-003: absent/excused/not-submitted/not-graded must never read as a
 *  silent zero — only a 'graded' result with points enters any average. */
export interface GradeCell {
  status: "graded" | "excused" | "missing" | "not_graded";
  points: number | null;
  percentage: number | null;
}

const NOT_GRADED_CELL: GradeCell = { status: "not_graded", points: null, percentage: null };

export function cellFor(item: GradeItem, result: GradeResult | undefined): GradeCell {
  if (!result) return NOT_GRADED_CELL;
  if (result.status !== "graded" || result.points === null) {
    return { status: result.status, points: result.points, percentage: null };
  }
  return { status: "graded", points: result.points, percentage: item.max_points > 0 ? (result.points / item.max_points) * 100 : null };
}

export interface CategoryTotal {
  category: string;
  percentage: number | null;
  /** Item titles actually summed into `percentage`, in the order they were weighted. */
  includedTitles: string[];
  /** Excluded by the "drop lowest" toggle, not by a missing grade. */
  droppedTitle: string | null;
  /** Human-readable trace satisfying GBK-004 ("every total exposes its formula"). */
  formula: string;
}

export interface LearnerTotals {
  learnerId: string;
  categories: CategoryTotal[];
  overall: CategoryTotal;
}

function weightedTotal(entries: Array<{ title: string; weight: number; percentage: number }>): { percentage: number | null; formula: string } {
  if (entries.length === 0) return { percentage: null, formula: "Aucun élément noté" };
  const weightSum = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (weightSum <= 0) return { percentage: null, formula: "Somme des coefficients nulle" };
  const weighted = entries.reduce((sum, entry) => sum + entry.percentage * entry.weight, 0);
  const percentage = weighted / weightSum;
  const formula = entries
    .map((entry) => `${entry.title} (${entry.percentage.toFixed(1)}% × ${entry.weight})`)
    .join(" + ") + ` ÷ ${weightSum} = ${percentage.toFixed(1)}%`;
  return { percentage, formula };
}

/** One learner's category subtotals + overall total, honoring a per-category
 *  "drop lowest" toggle (GBK-002). Categories are weighted equally into the
 *  overall total is *not* what this does — there is no `grade_categories`
 *  coefficient in this schema (see RESTE-A-FAIRE §01), so the overall total
 *  is the same item-weighted average as each category, just computed across
 *  every included item regardless of category. Each category total is shown
 *  purely as a breakdown, not as an input weighted a second time. */
export function computeLearnerTotals(
  learnerId: string,
  items: GradeItem[],
  resultsByItemId: Map<string, GradeResult>,
  dropLowestCategories: Set<string>,
): LearnerTotals {
  const byCategory = new Map<string, GradeItem[]>();
  for (const item of items) {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }

  const allIncluded: Array<{ title: string; weight: number; percentage: number }> = [];
  const categories: CategoryTotal[] = [];

  for (const [category, categoryItems] of byCategory) {
    const graded = categoryItems
      .map((item) => ({ item, cell: cellFor(item, resultsByItemId.get(item.id)) }))
      .filter((entry): entry is { item: GradeItem; cell: GradeCell & { percentage: number } } => entry.cell.percentage !== null);

    let droppedTitle: string | null = null;
    let counted = graded;
    if (dropLowestCategories.has(category) && graded.length > 1) {
      const lowest = graded.reduce((min, entry) => (entry.cell.percentage < min.cell.percentage ? entry : min));
      droppedTitle = lowest.item.title;
      counted = graded.filter((entry) => entry !== lowest);
    }

    const entries = counted.map((entry) => ({ title: entry.item.title, weight: entry.item.weight, percentage: entry.cell.percentage }));
    allIncluded.push(...entries);
    const { percentage, formula } = weightedTotal(entries);
    categories.push({
      category,
      percentage,
      includedTitles: entries.map((entry) => entry.title),
      droppedTitle,
      formula,
    });
  }

  categories.sort((a, b) => a.category.localeCompare(b.category, "fr"));
  const overallResult = weightedTotal(allIncluded);
  return {
    learnerId,
    categories,
    overall: {
      category: "overall",
      percentage: overallResult.percentage,
      includedTitles: allIncluded.map((entry) => entry.title),
      droppedTitle: null,
      formula: overallResult.formula,
    },
  };
}

/** GBK-005: learner-side "what if I receive X" — pure client computation,
 *  never written back. Overrides not-yet-graded items with a hypothetical
 *  percentage without touching real grade_results. */
export function simulateWhatIf(
  items: GradeItem[],
  resultsByItemId: Map<string, GradeResult>,
  learnerId: string,
  overrides: Map<string, number>,
  dropLowestCategories: Set<string>,
): LearnerTotals {
  const simulatedResults = new Map(resultsByItemId);
  for (const item of items) {
    const overridePercentage = overrides.get(item.id);
    if (overridePercentage === undefined) continue;
    const existing = simulatedResults.get(item.id);
    simulatedResults.set(item.id, {
      id: existing?.id ?? `simulated-${item.id}`,
      grade_item_id: item.id,
      learner_id: learnerId,
      status: "graded",
      points: (overridePercentage / 100) * item.max_points,
      published_at: null,
      grade_items: null,
    });
  }
  return computeLearnerTotals(learnerId, items, simulatedResults, dropLowestCategories);
}
