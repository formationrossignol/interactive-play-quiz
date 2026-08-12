import { describe, expect, it } from "vitest";
import { buildImportPreview, validImportRows } from "../gradebookImport";

const roster = [
  { learnerId: "u1", username: "alice" },
  { learnerId: "u2", username: "bob" },
];

describe("buildImportPreview", () => {
  it("matches by username, tolerating a leading @ and case", () => {
    const rows = [
      ["identifiant", "note"],
      ["@Alice", "15"],
      ["bob", "18,5"],
    ];
    const preview = buildImportPreview(rows, 0, 1, roster, 20);
    expect(preview).toEqual([
      { rowIndex: 0, rawIdentifier: "@Alice", rawPoints: "15", learnerId: "u1", matchedLabel: "@alice", points: 15, status: "ok" },
      { rowIndex: 1, rawIdentifier: "bob", rawPoints: "18,5", learnerId: "u2", matchedLabel: "@bob", points: 18.5, status: "ok" },
    ]);
  });

  it("flags an identifier absent from the roster as unmatched", () => {
    const rows = [["identifiant", "note"], ["carol", "10"]];
    const preview = buildImportPreview(rows, 0, 1, roster, 20);
    expect(preview[0].status).toBe("unmatched");
    expect(preview[0].learnerId).toBeNull();
  });

  it("keeps the first occurrence of a duplicate identifier, flags the rest", () => {
    const rows = [
      ["identifiant", "note"],
      ["alice", "15"],
      ["alice", "17"],
    ];
    const preview = buildImportPreview(rows, 0, 1, roster, 20);
    expect(preview[0].status).toBe("ok");
    expect(preview[1].status).toBe("duplicate");
  });

  it("flags points outside [0, maxPoints] and unparseable points", () => {
    const rows = [
      ["identifiant", "note"],
      ["alice", "25"],
      ["bob", "abc"],
    ];
    const preview = buildImportPreview(rows, 0, 1, roster, 20);
    expect(preview[0].status).toBe("invalid_points");
    expect(preview[1].status).toBe("invalid_points");
  });
});

describe("validImportRows", () => {
  it("only returns rows with status ok", () => {
    const rows = [
      ["identifiant", "note"],
      ["alice", "15"],
      ["carol", "10"],
    ];
    const preview = buildImportPreview(rows, 0, 1, roster, 20);
    expect(validImportRows(preview)).toEqual([{ learnerId: "u1", points: 15 }]);
  });
});
