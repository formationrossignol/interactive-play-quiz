import type {
  RoadmapRow, RoadmapCard, ShippedCard, RoadmapView,
  ReleaseRow, ChangelogItemRow, Release,
  GuideRow, Guide,
  FaqRow, FaqGroup,
  ReviewRow, Review,
  ReportType, ReportStatus, ReportRow, MyReport,
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
        voted: false,
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

export function mergeRoadmapVotes(
  view: RoadmapView,
  counts: Map<string, number>,
  myVotes: Set<string>,
): { view: RoadmapView; remaining: number } {
  const bump = <T extends { id: string; votes: number }>(card: T) => ({
    ...card,
    votes: card.votes + (counts.get(card.id) ?? 0),
  });
  const merged: RoadmapView = {
    idea: view.idea.map((c) => ({ ...bump(c), voted: myVotes.has(c.id) })),
    planned: view.planned.map((c) => ({ ...bump(c), voted: myVotes.has(c.id) })),
    dev: view.dev.map((c) => ({ ...bump(c), voted: myVotes.has(c.id) })),
    shipped: view.shipped.map((c) => bump(c)),
  };
  return { view: merged, remaining: Math.max(0, 3 - myVotes.size) };
}

const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  bug: 'Bug', question: 'Question', billing: 'Facturation',
};
const REPORT_STATUS: Record<ReportStatus, { cls: string; label: string }> = {
  open: { cls: 'tst--wait', label: 'Ouvert' },
  in_progress: { cls: 'tst--prog', label: 'En cours' },
  waiting: { cls: 'tst--wait', label: 'Attend votre réponse' },
  resolved: { cls: 'tst--done', label: 'Résolu' },
};

export function mapReport(row: ReportRow): MyReport {
  const date = new Date(row.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  const st = REPORT_STATUS[row.status];
  return {
    id: row.id,
    shortId: '#' + row.id.slice(0, 4),
    title: row.title,
    meta: `${REPORT_TYPE_LABEL[row.type]} · ${date}`,
    statusClass: st.cls,
    statusLabel: st.label,
  };
}
