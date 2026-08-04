import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function getLocalizedAlternates(href: string): { languages: Record<string, string> } {
  const languages: Record<string, string> = Object.fromEntries(
    routing.locales.map((locale) => [locale, getPathname({ locale, href })]),
  );
  languages["x-default"] = languages[routing.defaultLocale];
  return { languages };
}
