import { describe, expect, it } from "vitest";
import {
  buildGradeCsv,
  computeActivityStats,
  computeWeightedAverage,
  parseLocalizedScore,
  roundGrade,
  validateNumericScore,
} from "../calculations";
import type { ManualEvaluation, ManualGrade, PublishedGrade } from "../types";

const evaluation = {
  id: "evaluation-1",
  owner_id: "teacher-1",
  content_id: null,
  name: "TP",
  description: "",
  context_label: "",
  grading_type: "numeric",
  minimum_score: 0,
  maximum_score: 20,
  decimal_places: 1,
  pass_threshold: 10,
  coefficient: 2,
  rounding_rule: "tenth",
  validation_labels: [],
  evaluation_date: "2026-07-29",
  entry_deadline: null,
  archived_at: null,
  created_at: "2026-07-29T10:00:00Z",
  updated_at: "2026-07-29T10:00:00Z",
  groupIds: ["group-1"],
} satisfies ManualEvaluation;

const grade = (patch: Partial<ManualGrade> = {}): ManualGrade => ({
  id: "grade-1",
  evaluation_id: evaluation.id,
  learner_id: "learner-1",
  score: 15,
  validation_value: null,
  attendance_status: "present",
  appreciation: "",
  workflow_status: "published",
  published_at: "2026-07-29T10:00:00Z",
  locked_at: "2026-07-29T10:00:00Z",
  version: 1,
  last_edited_by: "teacher-1",
  last_change_reason: "",
  created_at: "2026-07-29T10:00:00Z",
  updated_at: "2026-07-29T10:00:00Z",
  ...patch,
});

describe("manual grading calculations", () => {
  it("accepts French decimal commas and rejects invalid scales", () => {
    expect(parseLocalizedScore("8,5")).toBe(8.5);
    expect(validateNumericScore("8,5", evaluation)).toBeNull();
    expect(validateNumericScore("20,1", evaluation)).toContain("comprise");
    expect(validateNumericScore("8,55", evaluation)).toContain("1 décimale");
  });

  it("keeps a numeric zero distinct from an absence", () => {
    expect(parseLocalizedScore("0")).toBe(0);
    expect(parseLocalizedScore("")).toBeNull();
  });

  it("calculates mean, median, bounds and pass rate", () => {
    const stats = computeActivityStats([
      grade({ score: 8 }),
      grade({ id: "grade-2", score: 12 }),
      grade({ id: "grade-3", score: 16 }),
      grade({ id: "grade-4", score: null, attendance_status: "absent_excused" }),
    ], evaluation);
    expect(stats.graded).toBe(3);
    expect(stats.mean).toBe(12);
    expect(stats.median).toBe(12);
    expect(stats.minimum).toBe(8);
    expect(stats.maximum).toBe(16);
    expect(stats.passRate).toBeCloseTo(200 / 3);
  });

  it("counts non-justified absence as the scale minimum in activity statistics", () => {
    const stats = computeActivityStats([
      grade({ score: 16 }),
      grade({ id: "grade-2", score: null, attendance_status: "absent_unexcused" }),
      grade({ id: "grade-3", score: null, attendance_status: "absent_excused" }),
    ], evaluation);
    expect(stats.graded).toBe(2);
    expect(stats.mean).toBe(8);
  });

  it("calculates a coefficient-weighted /20 average and excludes justified absence", () => {
    const secondEvaluation = { ...evaluation, id: "evaluation-2", maximum_score: 10, coefficient: 1 };
    const published: PublishedGrade[] = [
      { ...grade({ score: 16 }), evaluation },
      { ...grade({ id: "grade-2", evaluation_id: "evaluation-2", score: 5 }), evaluation: secondEvaluation },
      { ...grade({ id: "grade-3", score: null, attendance_status: "absent_excused" }), evaluation },
    ];
    expect(computeWeightedAverage(published)).toBe(14);
  });

  it("counts an unexcused absence as zero", () => {
    const published: PublishedGrade[] = [
      { ...grade({ score: 18 }), evaluation },
      { ...grade({ id: "grade-2", score: null, attendance_status: "absent_unexcused" }), evaluation },
    ];
    expect(computeWeightedAverage(published)).toBe(9);
  });

  it("applies configured rounding rules", () => {
    expect(roundGrade(13.67, "none")).toBe(13.67);
    expect(roundGrade(13.67, "tenth")).toBe(13.7);
    expect(roundGrade(13.67, "half")).toBe(13.5);
    expect(roundGrade(13.67, "integer")).toBe(14);
  });

  it("escapes spreadsheet-sensitive CSV fields", () => {
    const csv = buildGradeCsv(evaluation, [{
      username: "dupont",
      grade: grade({ appreciation: "Bien; continue \"ainsi\"" }),
    }]);
    expect(csv).toContain('"Bien; continue ""ainsi"""');
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });

  it("neutralizes spreadsheet formulas in CSV cells", () => {
    const csv = buildGradeCsv(evaluation, [{
      username: "=HYPERLINK(\"https://example.test\")",
      grade: grade(),
    }]);
    expect(csv).toContain(`"'=HYPERLINK(""https://example.test"")"`);
  });
});
