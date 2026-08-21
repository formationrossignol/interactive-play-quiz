import { describe, expect, it } from "vitest";
import {
  buildOneRosterEnrollmentPreview,
  buildOneRosterUserPreview,
  extractOneRosterEnrollmentRows,
  extractOneRosterUserRows,
  importableOneRosterEnrollmentRows,
  importableOneRosterUserRows,
} from "../oneRosterImport";

describe("extractOneRosterUserRows", () => {
  it("finds sourcedId/email columns by header name regardless of order", () => {
    const rows = [
      ["status", "email", "sourcedId"],
      ["active", "ada@example.test", "u1"],
    ];
    expect(extractOneRosterUserRows(rows)).toEqual([{ sourced_id: "u1", email: "ada@example.test", status: "active" }]);
  });

  it("skips rows missing sourcedId or email", () => {
    const rows = [
      ["sourcedId", "email"],
      ["u1", ""],
      ["", "ada@example.test"],
    ];
    expect(extractOneRosterUserRows(rows)).toEqual([]);
  });

  it("returns empty when required columns are absent", () => {
    expect(extractOneRosterUserRows([["foo", "bar"], ["1", "2"]])).toEqual([]);
  });
});

describe("buildOneRosterUserPreview", () => {
  const rows = [{ sourced_id: "u1", email: "ada@example.test", status: "active" }];

  it("marks an unresolved row as unmatched — never guessed, never auto-provisioned", () => {
    const preview = buildOneRosterUserPreview(rows, [{ sourced_id: "u1", email: "ada@example.test", learner_id: null, matched: false }]);
    expect(preview[0].outcomeStatus).toBe("unmatched");
    expect(preview[0].learnerId).toBeNull();
  });

  it("marks a resolved row as ok", () => {
    const preview = buildOneRosterUserPreview(rows, [{ sourced_id: "u1", email: "ada@example.test", learner_id: "learner-1", matched: true }]);
    expect(preview[0].outcomeStatus).toBe("ok");
    expect(preview[0].learnerId).toBe("learner-1");
  });

  it("flags the second occurrence of the same sourcedId as duplicate", () => {
    const dup = [
      { sourced_id: "u1", email: "ada@example.test", status: "active" },
      { sourced_id: "u1", email: "ada@example.test", status: "active" },
    ];
    const preview = buildOneRosterUserPreview(dup, [{ sourced_id: "u1", email: "ada@example.test", learner_id: "learner-1", matched: true }]);
    expect(preview.map((r) => r.outcomeStatus)).toEqual(["ok", "duplicate"]);
  });
});

describe("importableOneRosterUserRows", () => {
  it("only includes ok rows, never unmatched or duplicate ones", () => {
    const preview = buildOneRosterUserPreview(
      [
        { sourced_id: "u1", email: "a@x.test", status: "active" },
        { sourced_id: "u2", email: "b@x.test", status: "active" },
      ],
      [
        { sourced_id: "u1", email: "a@x.test", learner_id: "l1", matched: true },
        { sourced_id: "u2", email: "b@x.test", learner_id: null, matched: false },
      ],
    );
    expect(importableOneRosterUserRows(preview)).toEqual([{ sourced_id: "u1", email: "a@x.test", learner_id: "l1" }]);
  });
});

describe("extractOneRosterEnrollmentRows", () => {
  it("parses the real OneRoster enrollments.csv column set", () => {
    const rows = [
      ["sourcedId", "userSourcedId", "classSourcedId", "status"],
      ["e1", "u1", "c1", "active"],
    ];
    expect(extractOneRosterEnrollmentRows(rows)).toEqual([{ sourced_id: "e1", user_sourced_id: "u1", class_sourced_id: "c1", status: "active" }]);
  });
});

describe("buildOneRosterEnrollmentPreview / importableOneRosterEnrollmentRows", () => {
  const rows = [{ sourced_id: "e1", user_sourced_id: "u1", class_sourced_id: "c1", status: "active" }];

  it("requires BOTH user and class to resolve — an enrollment naming an unknown class is unmatched, never partially applied", () => {
    const userMap = new Map([["u1", "learner-1"]]);
    const classMap = new Map<string, string>(); // c1 unresolved
    const preview = buildOneRosterEnrollmentPreview(rows, userMap, classMap);
    expect(preview[0].outcomeStatus).toBe("unmatched");
    expect(importableOneRosterEnrollmentRows(preview)).toEqual([]);
  });

  it("commits only when both resolve", () => {
    const userMap = new Map([["u1", "learner-1"]]);
    const classMap = new Map([["c1", "session-1"]]);
    const preview = buildOneRosterEnrollmentPreview(rows, userMap, classMap);
    expect(preview[0].outcomeStatus).toBe("ok");
    expect(importableOneRosterEnrollmentRows(preview)).toEqual([{ sourced_id: "e1", learner_id: "learner-1", session_id: "session-1", status: "active" }]);
  });
});
