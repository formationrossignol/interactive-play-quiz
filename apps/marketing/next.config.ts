import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Everything not owned by a marketing page (the product app: /builder, /join/:code,
// /quiz/:code, /admin, etc.) is proxied to the existing Vite app deployment. Fallback
// rewrites only fire when no Next page/file matches, so every app URL — including
// ones already shared via QR codes and join links — stays byte-identical.
// See docs/marketing-app-decoupling.md.
const APP_ORIGIN = process.env.APP_ORIGIN ?? "https://app.brivia.app";

const nextConfig: NextConfig = {
  serverExternalPackages: ["isomorphic-dompurify"],
  allowedDevOrigins: ["127.0.0.1"],
  async redirects() {
    return ["roadmap", "changelog", "report"].map((path) => ({
      source: `/${path}`,
      destination: `${APP_ORIGIN}/${path}`,
      permanent: false,
    }));
  },
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [{ source: "/:path*", destination: `${APP_ORIGIN}/:path*` }],
    };
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
