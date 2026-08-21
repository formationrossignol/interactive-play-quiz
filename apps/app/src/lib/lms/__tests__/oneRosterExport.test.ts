import { describe, expect, it } from "vitest";
import { buildOneRosterResultsRows } from "../oneRosterResultsCsv";

describe("buildOneRosterResultsRows", () => {
  it("produces the real OneRoster results.csv header set", () => {
    const rows = buildOneRosterResultsRows([]);
    expect(rows[0]).toEqual([
      "sourcedId", "status", "dateLastModified", "lineItemSourcedId",
      "studentSourcedId", "scoreStatus", "score", "scoreDate", "comment",
    ]);
  });

  it("falls back to Brivia's own ids when no external mapping exists, never invents a fake sourcedId", () => {
    const rows = buildOneRosterResultsRows([
      { gradeItemId: "gi-1", gradeItemExternalId: null, learnerId: "learner-1", learnerExternalId: null, points: 8, maxPoints: 10, publishedAt: "2026-08-21T00:00:00Z" },
    ]);
    expect(rows[1][3]).toBe("gi-1"); // lineItemSourcedId falls back to grade_item id
    expect(rows[1][4]).toBe("learner-1"); // studentSourcedId falls back to learner id
    expect(rows[1][6]).toBe("8");
  });

  it("prefers the real OneRoster external id when one exists", () => {
    const rows = buildOneRosterResultsRows([
      { gradeItemId: "gi-1", gradeItemExternalId: "org1:class-ext", learnerId: "learner-1", learnerExternalId: "org1:user-ext", points: 10, maxPoints: 10, publishedAt: "2026-08-21T00:00:00Z" },
    ]);
    expect(rows[1][3]).toBe("org1:class-ext");
    expect(rows[1][4]).toBe("org1:user-ext");
  });
});
