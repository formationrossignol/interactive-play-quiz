import { describe, expect, it } from "vitest";
import { buildEnrollmentPreview, extractIdentifierColumn, importableEnrollmentRows } from "../enrollmentImport";
import type { ResolvedOrgMember } from "../enrollment";

const resolved: ResolvedOrgMember[] = [
  { identifier: "alice@example.com", learner_id: "u1", username: "alice" },
  { identifier: "bob@example.com", learner_id: "u2", username: "bob" },
];

describe("extractIdentifierColumn", () => {
  it("skips the header row and blank cells", () => {
    const rows = [["email"], ["alice@example.com"], [""], ["  bob@example.com  "]];
    expect(extractIdentifierColumn(rows, 0)).toEqual(["alice@example.com", "bob@example.com"]);
  });
});

describe("buildEnrollmentPreview", () => {
  it("marks resolved identifiers ok", () => {
    const rows = [["email"], ["alice@example.com"], ["bob@example.com"]];
    const preview = buildEnrollmentPreview(rows, 0, resolved, new Set());
    expect(preview.map((r) => r.status)).toEqual(["ok", "ok"]);
    expect(preview[0].learnerId).toBe("u1");
  });

  it("flags an identifier that never resolved as unmatched", () => {
    const rows = [["email"], ["carol@example.com"]];
    const preview = buildEnrollmentPreview(rows, 0, resolved, new Set());
    expect(preview[0].status).toBe("unmatched");
  });

  it("flags a blank cell as unmatched rather than crashing on the lookup", () => {
    const rows = [["email"], [""]];
    const preview = buildEnrollmentPreview(rows, 0, resolved, new Set());
    expect(preview[0].status).toBe("unmatched");
  });

  it("keeps the first occurrence of a duplicate identifier, flags the rest", () => {
    const rows = [["email"], ["alice@example.com"], ["alice@example.com"]];
    const preview = buildEnrollmentPreview(rows, 0, resolved, new Set());
    expect(preview[0].status).toBe("ok");
    expect(preview[1].status).toBe("duplicate");
  });

  it("flags an already-actively-enrolled learner distinctly from ok", () => {
    const rows = [["email"], ["alice@example.com"]];
    const preview = buildEnrollmentPreview(rows, 0, resolved, new Set(["u1"]));
    expect(preview[0].status).toBe("already_enrolled");
  });
});

describe("importableEnrollmentRows", () => {
  it("includes both ok and already_enrolled, excludes unmatched/duplicate", () => {
    const rows = [["email"], ["alice@example.com"], ["alice@example.com"], ["carol@example.com"], ["bob@example.com"]];
    const preview = buildEnrollmentPreview(rows, 0, resolved, new Set(["u2"]));
    expect(importableEnrollmentRows(preview)).toEqual([{ learnerId: "u1" }, { learnerId: "u2" }]);
  });
});
