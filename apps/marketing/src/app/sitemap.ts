import type { MetadataRoute } from "next";
import { QUESTION_TYPE_PAGES } from "@/lib/questionTypePages";
import { SITE_URL } from "@/lib/siteUrl";

// roadmap/changelog/report are excluded: next.config.ts redirects those
// paths to the product app (APP_ORIGIN), so they never actually serve
// marketing content at this origin.
const STATIC_PATHS = [
  "", "about", "cgu", "confidentialite", "contact",
  "features", "guides", "help", "mentions-legales", "pricing", "reviews",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${SITE_URL}/${path}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.7,
  }));

  const questionTypePages = QUESTION_TYPE_PAGES.map(({ slug }) => ({
    url: `${SITE_URL}/features/questions/${slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.65,
  }));

  return [...staticPages, ...questionTypePages];
}
