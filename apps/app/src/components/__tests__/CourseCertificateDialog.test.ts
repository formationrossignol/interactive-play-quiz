import { describe, expect, it } from "vitest";
import { createLinkedInPostDraft } from "../CourseCertificateDialog";
import type { Course } from "@/lib/courseStorage";

const course: Course = {
  id: "course-1",
  userId: "author-1",
  title: "Gestion de projet agile",
  description: "Un cours pratique",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  isPublic: false,
  isFavorite: false,
  modules: [],
  category: "Management",
  tags: [],
  objectives: ["Prioriser un backlog", "Animer un sprint"],
};

describe("course certificate sharing", () => {
  it("builds an editable LinkedIn post draft from the course", () => {
    const draft = createLinkedInPostDraft(course);
    expect(draft).toContain("Gestion de projet agile");
    expect(draft).toContain("• Prioriser un backlog");
    expect(draft).toContain("#FormationContinue");
    expect(draft.length).toBeLessThan(3000);
  });
});
