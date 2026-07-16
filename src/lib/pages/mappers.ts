import type {
  RoadmapRow, RoadmapCard, ShippedCard, RoadmapView,
  ReleaseRow, ChangelogItemRow, Release,
  GuideRow, Guide,
  FaqRow, FaqGroup,
  ReviewRow, Review,
} from './types';

export function groupRoadmap(rows: RoadmapRow[]): RoadmapView {
  const view: RoadmapView = { idea: [], planned: [], dev: [], shipped: [] };
  for (const r of rows) {
    if (r.col === 'shipped') {
      const card: ShippedCard = {
        id: r.id, votes: r.base_votes, title: r.title,
        sub: r.shipped_label ?? r.subtitle, cat: r.category, link: r.shipped_link,
      };
      view.shipped.push(card);
    } else {
      const card: RoadmapCard = {
        id: r.id, votes: r.base_votes, title: r.title, sub: r.subtitle,
        tags: r.tags, cat: r.category, locked: r.locked, beta: r.beta,
      };
      view[r.col].push(card);
    }
  }
  return view;
}

export function groupChangelog(releases: ReleaseRow[], items: ChangelogItemRow[]): Release[] {
  return releases.map((r) => {
    const release: Release = {
      v: r.version, title: r.title, date: r.date_label,
      items: items
        .filter((it) => it.release_id === r.id)
        .map((it) => ({ t: it.kind, text: it.text, fromVotes: it.from_votes })),
    };
    if (r.intro) release.intro = r.intro;
    if (r.media) release.media = r.media;
    return release;
  });
}

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

export function mapReview(row: ReviewRow): Review {
  return {
    id: row.id, p: row.persona, stars: row.stars, text: row.text,
    av: row.avatar_emoji, name: row.author_name, role: row.author_role,
  };
}
