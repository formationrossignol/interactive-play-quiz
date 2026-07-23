import type { NextConfig } from "next";

// Everything not owned by a marketing page (the product app: /builder, /join/:code,
// /quiz/:code, /admin, etc.) is proxied to the existing Vite app deployment. Fallback
// rewrites only fire when no Next page/file matches, so every app URL — including
// ones already shared via QR codes and join links — stays byte-identical.
// See docs/marketing-app-decoupling.md.
const APP_ORIGIN = process.env.APP_ORIGIN ?? "https://interactive-play-quiz.vercel.app";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [{ source: "/:path*", destination: `${APP_ORIGIN}/:path*` }],
    };
  },
};

export default nextConfig;
