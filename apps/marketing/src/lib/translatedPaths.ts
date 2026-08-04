// Locale-agnostic hrefs (no /en prefix) that have a real translation in
// every locale of routing.ts today. Used by the language switcher to fall
// back to the homepage instead of linking to a route that 404s in the
// target locale (see src/app/[locale]/**/page.tsx `dynamicParams = false`
// guards on everything not in this list).
export const TRANSLATED_PATHS = new Set([
  "/",
  "/contact",
  "/enterprise",
  "/security",
  "/about",
  "/pricing",
  "/solutions/education",
  "/solutions/training",
  "/solutions/events",
]);
