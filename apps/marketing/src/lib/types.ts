export interface StaticPageBlock { title: string; desc: string }

export interface StaticPage {
  slug: string;
  title: string;
  subtitle: string;
  body: string; // sanitized HTML
  blocks: StaticPageBlock[];
  status: "draft" | "published";
}

// ── Guides ───────────────────────────────────────────────────────────────
export interface GuideRow {
  id: string;
  emoji: string;
  cover_token: string;
  duration_label: string;
  title: string;
  level: "deb" | "int" | "avc";
  format: "video" | "article";
  url: string | null;
}
export interface Guide {
  id: string;
  emoji: string;
  cover: string;
  dur: string;
  title: string;
  lvl: "deb" | "int" | "avc";
  fmt: "video" | "article";
  url: string | null;
}

// ── FAQ ──────────────────────────────────────────────────────────────────
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
