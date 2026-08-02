import type { MetadataRoute } from "next";
import { QUESTION_TYPE_PAGES } from "@/lib/questionTypePages";
import { SITE_URL } from "@/lib/siteUrl";

// roadmap/changelog/report are excluded: next.config.ts redirects those
// paths to the product app (APP_ORIGIN), so they never actually serve
// marketing content at this origin.
const STATIC_PATHS = [
  "", "about", "accessibility", "cgu", "confidentialite", "contact", "customers",
  "enterprise", "features", "guides", "guides/quiz-interactif", "help", "integrations", "mentions-legales",
  "pricing", "reviews", "security", "solutions/education", "solutions/events", "solutions/training",
];

const LOCALIZED_PATHS = [
  { fr: "", en: "en" },
  { fr: "contact", en: "en/contact" },
  { fr: "enterprise", en: "en/enterprise" },
  { fr: "security", en: "en/security" },
] as const;

const CONTENT_UPDATED_AT = new Date("2026-08-02T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  const localizedAlternates = (fr: string, en: string) => ({
    languages: {
      fr: `${SITE_URL}/${fr}`,
      en: `${SITE_URL}/${en}`,
      "x-default": `${SITE_URL}/${fr}`,
    },
  });

  const staticPages: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => {
    const translation = LOCALIZED_PATHS.find(({ fr }) => fr === path);

    return {
      url: `${SITE_URL}/${path}`,
      lastModified: CONTENT_UPDATED_AT,
      changeFrequency: "monthly",
      priority: path === "" ? 1 : 0.7,
      ...(translation
        ? { alternates: localizedAlternates(translation.fr, translation.en) }
        : {}),
    };
  });

  const englishPages: MetadataRoute.Sitemap = LOCALIZED_PATHS.map(({ fr, en }) => ({
    url: `${SITE_URL}/${en}`,
    lastModified: CONTENT_UPDATED_AT,
    changeFrequency: "monthly",
    priority: en === "en" ? 0.9 : 0.7,
    alternates: localizedAlternates(fr, en),
  }));

  const questionTypePages = QUESTION_TYPE_PAGES.map(({ slug }) => ({
    url: `${SITE_URL}/features/questions/${slug}`,
    lastModified: CONTENT_UPDATED_AT,
    changeFrequency: "monthly" as const,
    priority: 0.65,
  }));

  return [...staticPages, ...englishPages, ...questionTypePages];
}
