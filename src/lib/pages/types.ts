// Canonical shapes for the CMS-backed public pages.
// DB row types mirror the columns of the SP1 migration; view types are what
// the page components consume (kept close to the existing inline page types
// to minimize component rewrites).

// ── Roadmap ────────────────────────────────────────────────────────────────
export type RoadmapCol = 'idea' | 'planned' | 'dev' | 'shipped';
export interface RoadmapTag { label: string; eta?: boolean }

export interface RoadmapRow {
  id: string;
  col: RoadmapCol;
  category: string;
  title: string;
  subtitle: string;
  tags: RoadmapTag[];
  beta: boolean;
  locked: boolean;
  base_votes: number;
  shipped_label: string | null;
  shipped_link: boolean;
  sort: number;
}

export interface RoadmapCard {
  id: string;
  votes: number;
  title: string;
  sub: string;
  tags: RoadmapTag[];
  cat: string;
  locked: boolean;
  beta: boolean;
}
export interface ShippedCard {
  id: string;
  votes: number;
  title: string;
  sub: string;
  cat: string;
  link: boolean;
}
export interface RoadmapView {
  idea: RoadmapCard[];
  planned: RoadmapCard[];
  dev: RoadmapCard[];
  shipped: ShippedCard[];
}

// ── Changelog ──────────────────────────────────────────────────────────────
export type ChangelogKind = 'new' | 'imp' | 'fix';
export interface ReleaseRow {
  id: string;
  version: string;
  title: string;
  date_label: string;
  intro: string | null;
  media: string | null;
  sort: number;
}
export interface ChangelogItemRow {
  id: string;
  release_id: string;
  kind: ChangelogKind;
  text: string;
  from_votes: boolean;
  sort: number;
}
export interface ReleaseItem { t: ChangelogKind; text: string; fromVotes: boolean }
export interface Release {
  v: string;
  title: string;
  date: string;
  intro?: string;
  media?: string;
  items: ReleaseItem[];
}

// ── Guides ─────────────────────────────────────────────────────────────────
export interface GuideRow {
  id: string;
  emoji: string;
  cover_token: string;
  duration_label: string;
  title: string;
  level: 'deb' | 'int' | 'avc';
  format: 'video' | 'article';
  url: string | null;
  body: string | null;
  sort: number;
}
export interface Guide {
  id: string;
  emoji: string;
  cover: string;
  dur: string;
  title: string;
  lvl: 'deb' | 'int' | 'avc';
  fmt: 'video' | 'article';
  url: string | null;
}

// ── FAQ ────────────────────────────────────────────────────────────────────
export interface FaqRow {
  id: string;
  category: string;
  question: string;
  answer: string;
  sort: number;
}
export interface FaqGroup {
  category: string;
  questions: { q: string; a: string }[];
}

// ── Reviews ────────────────────────────────────────────────────────────────
export type ReviewPersona = 'formateur' | 'enseignant' | 'entreprise';
export interface ReviewRow {
  id: string;
  persona: ReviewPersona;
  stars: number;
  text: string;
  author_name: string;
  author_role: string;
  avatar_emoji: string;
  sort: number;
}
export interface Review {
  id: string;
  p: ReviewPersona;
  stars: number;
  text: string;
  av: string;
  name: string;
  role: string;
}
