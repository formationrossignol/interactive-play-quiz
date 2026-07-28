import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import {
  isSignatureRequestActionable,
  mapSignatureRequest,
  uniqueRecipientCount,
} from "../signatureRepo";

describe("signatureRepo helpers", () => {
  it("maps nested request relations to stable arrays", () => {
    const request = mapSignatureRequest({
      id: "request-1",
      owner_id: "owner-1",
      title: "Charte",
      message: "",
      status: "open",
      due_at: null,
      created_at: "2026-07-28T10:00:00Z",
      updated_at: "2026-07-28T10:00:00Z",
      signature_request_groups: [{ group_id: "group-1" }, { group_id: "group-2" }],
      signature_responses: [],
    });

    expect(request.groupIds).toEqual(["group-1", "group-2"]);
    expect(request.responses).toEqual([]);
  });

  it("deduplicates recipients shared by several groups", () => {
    expect(uniqueRecipientCount([
      { group_id: "a", user_id: "user-1", pending_email: null },
      { group_id: "b", user_id: "user-1", pending_email: null },
      { group_id: "b", user_id: null, pending_email: "New@Example.com" },
      { group_id: "c", user_id: null, pending_email: "new@example.com" },
    ])).toBe(2);
  });

  it("rejects closed and overdue requests", () => {
    const now = new Date("2026-07-28T12:00:00Z");
    expect(isSignatureRequestActionable({ status: "open", due_at: null }, now)).toBe(true);
    expect(isSignatureRequestActionable({ status: "closed", due_at: null }, now)).toBe(false);
    expect(isSignatureRequestActionable({ status: "open", due_at: "2026-07-28T11:59:59Z" }, now)).toBe(false);
  });
});
