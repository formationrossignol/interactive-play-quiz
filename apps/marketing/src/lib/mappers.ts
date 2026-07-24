import type { GuideRow, Guide, FaqRow, FaqGroup } from "./types";

// Mirrors apps/app/src/lib/pages/mappers.ts.
export function mapGuide(row: GuideRow): Guide {
  return {
    id: row.id, emoji: row.emoji, cover: row.cover_token, dur: row.duration_label,
    title: row.title, lvl: row.level, fmt: row.format, url: row.url,
  };
}

export function groupFaq(rows: FaqRow[]): FaqGroup[] {
  const groups: FaqGroup[] = [];
  const byCategory = new Map<string, FaqGroup>();
  for (const r of rows) {
    let group = byCategory.get(r.category);
    if (!group) {
      group = { category: r.category, questions: [] };
      byCategory.set(r.category, group);
      groups.push(group);
    }
    group.questions.push({ q: r.question, a: r.answer });
  }
  return groups;
}
