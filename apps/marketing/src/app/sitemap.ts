import type { MetadataRoute } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { QUESTION_TYPE_PAGES } from "@/lib/questionTypePages";
import { SITE_URL } from "@/lib/siteUrl";

// roadmap/changelog/report are excluded: next.config.ts redirects those
// paths to the product app (APP_ORIGIN), so they never actually serve
// marketing content at this origin.
const PAGES = [
  { href: "/", priority: 1, translated: true },
  { href: "/contact", priority: 0.7, translated: true },
  { href: "/enterprise", priority: 0.7, translated: true },
  { href: "/security", priority: 0.7, translated: true },
  { href: "/about", priority: 0.7, translated: true },
  { href: "/pricing", priority: 0.7, translated: true },
  { href: "/solutions/education", priority: 0.7, translated: true },
  { href: "/solutions/training", priority: 0.7, translated: true },
  { href: "/solutions/events", priority: 0.7, translated: true },
  { href: "/features", priority: 0.7, translated: false },
  { href: "/guides", priority: 0.7, translated: false },
  { href: "/guides/quiz-interactif", priority: 0.7, translated: false },
  { href: "/help", priority: 0.7, translated: false },
  { href: "/customers", priority: 0.7, translated: false },
  { href: "/integrations", priority: 0.7, translated: false },
  { href: "/reviews", priority: 0.7, translated: false },
  { href: "/cgu", priority: 0.7, translated: false },
  { href: "/mentions-legales", priority: 0.7, translated: false },
  { href: "/confidentialite", priority: 0.7, translated: false },
  { href: "/accessibility", priority: 0.7, translated: false },
] as const;

const CONTENT_UPDATED_AT = new Date("2026-08-02T00:00:00.000Z");

function localizedAlternates(href: string) {
  const languages = Object.fromEntries(
    routing.locales.map((locale) => [locale, `${SITE_URL}${getPathname({ locale, href })}`]),
  );
  return { languages: { ...languages, "x-default": languages[routing.defaultLocale] } };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = PAGES.flatMap((page) => {
    const locales = page.translated ? routing.locales : [routing.defaultLocale];
    return locales.map((locale) => ({
      url: `${SITE_URL}${getPathname({ locale, href: page.href })}`,
      lastModified: CONTENT_UPDATED_AT,
      changeFrequency: "monthly" as const,
      priority: page.href === "/" ? 1 : page.priority,
      ...(page.translated ? { alternates: localizedAlternates(page.href) } : {}),
    }));
  });

  const questionTypePages = QUESTION_TYPE_PAGES.map(({ slug }) => ({
    url: `${SITE_URL}/features/questions/${slug}`,
    lastModified: CONTENT_UPDATED_AT,
    changeFrequency: "monthly" as const,
    priority: 0.65,
  }));

  return [...entries, ...questionTypePages];
}
