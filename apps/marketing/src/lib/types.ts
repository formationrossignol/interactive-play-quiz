export interface StaticPageBlock { title: string; desc: string }

export interface StaticPage {
  slug: string;
  title: string;
  subtitle: string;
  body: string; // sanitized HTML
  blocks: StaticPageBlock[];
  status: "draft" | "published";
}
