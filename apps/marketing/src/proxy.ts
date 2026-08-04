import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

// Root segments actually owned by app/[locale]/... . Anything else (/builder,
// /join/:code, /quiz/:code, /admin, /discover, /auth, ...) belongs to the
// product app and must reach next.config.ts's `fallback` rewrite untouched —
// see docs/marketing-app-decoupling.md. Letting next-intl rewrite those paths
// (e.g. /builder -> /fr/builder internally) would break the fallback proxy,
// since Proxy runs before `fallback` rewrites in Next's execution order.
const MARKETING_SEGMENTS = new Set([
  "", "en", "contact", "enterprise", "security", "about", "pricing", "solutions",
  "features", "guides", "help", "customers", "integrations", "reviews",
  "cgu", "mentions-legales", "confidentialite", "accessibility",
]);

function isMarketingPath(pathname: string) {
  const [, first] = pathname.split("/");
  return MARKETING_SEGMENTS.has(first ?? "");
}

export default function proxy(request: NextRequest) {
  if (!isMarketingPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  return intlMiddleware(request);
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
