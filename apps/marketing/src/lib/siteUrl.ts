// Canonical marketing-site origin, for metadataBase/sitemap/robots. Distinct
// from APP_ORIGIN (next.config.ts), which points at the product app the
// fallback rewrite proxies to — this is the marketing site's own domain.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://brivia.app";
