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
  voted: boolean;
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

// ── Interactions (SP2) ──────────────────────────────────────────────────────
export type ReportType = 'bug' | 'question' | 'billing';
export type ReportSeverity = 1 | 2 | 3;
export type ReportStatus = 'open' | 'in_progress' | 'waiting' | 'resolved';

export interface ReportRow {
  id: string;
  type: ReportType;
  severity: ReportSeverity;
  title: string;
  body: string;
  status: ReportStatus;
  created_at: string;
}
// Shape the Report page renders in "Mes tickets".
export interface MyReport {
  id: string;
  shortId: string;   // "#" + first 4 hex of uuid
  title: string;
  meta: string;      // e.g. "Bug · 14 juil. 2026"
  statusClass: string;
  statusLabel: string;
}

export interface NewReport {
  type: ReportType;
  severity: ReportSeverity;
  title: string;
  body: string;
}
export interface NewReview {
  persona: ReviewPersona;
  stars: number;
  text: string;
  authorRole: string;
}

// ── Static pages (legal + marketing, admin-editable) ────────────────────────
export interface StaticPageBlock { title: string; desc: string }
export interface StaticPage {
  slug: string;
  title: string;
  subtitle: string;
  body: string;            // sanitized HTML (legal pages, About mission)
  blocks: StaticPageBlock[]; // icon cards (Features / About values)
  status: 'draft' | 'published';
}

// ── Admin rows (full, incl. status/sort) ────────────────────────────────────
export type Status = 'draft' | 'published';

export interface RoadmapAdminRow {
  id: string; col: RoadmapCol; category: string; title: string; subtitle: string;
  tags: RoadmapTag[]; beta: boolean; locked: boolean; base_votes: number;
  shipped_label: string | null; shipped_link: boolean; status: Status; sort: number;
}
export interface GuideAdminRow {
  id: string; emoji: string; cover_token: string; duration_label: string; title: string;
  level: 'deb' | 'int' | 'avc'; format: 'video' | 'article'; url: string | null;
  body: string | null; status: Status; sort: number;
}
export interface FaqAdminRow {
  id: string; category: string; question: string; answer: string; status: Status; sort: number;
}
export interface ReleaseAdminRow {
  id: string; version: string; title: string; date_label: string;
  intro: string | null; media: string | null; status: Status; sort: number;
}
export interface ChangelogItemAdminRow {
  id: string; release_id: string; kind: ChangelogKind; text: string; from_votes: boolean; sort: number;
}

export interface PendingReview {
  id: string; persona: ReviewPersona; stars: number; text: string;
  author_name: string; author_role: string; created_at: string;
}
export type ReviewStatus = 'pending' | 'published' | 'rejected';
export interface ReviewAdminRow {
  id: string; persona: ReviewPersona; stars: number; text: string;
  author_name: string; author_role: string; avatar_emoji: string;
  status: ReviewStatus; sort: number;
}
export interface IdeaRow {
  id: string; user_id: string; text: string; status: 'pending' | 'converted' | 'rejected'; created_at: string;
}
export interface AdminReportRow {
  id: string; user_id: string; type: ReportType; severity: ReportSeverity;
  title: string; body: string; status: ReportStatus; created_at: string;
}
export interface SubscriberRow { user_id: string; created_at: string; }
