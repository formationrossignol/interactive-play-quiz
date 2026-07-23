# Decoupling marketing site from the app

## Understanding summary

- Today: single Vite SPA, one `App.tsx` router, marketing/CMS pages and product pages share one bundle and one Vercel deploy.
- Goal: split into a marketing site (SEO/perf) and the product app, deployed independently, coexisting cleanly under one domain.
- Driver: SEO/perf for marketing pages — currently client-rendered, not crawlable efficiently, sharing a bundle with heavy app deps (TipTap, dnd-kit, xlsx).
- Non-goal: no rewrite of the product app itself (builder, live quiz/exam, admin) — it moves into the monorepo unchanged.
- Constraint: existing app URLs (`/join/:gameCode`, `/quiz/:gameCode`, `/builder`, etc.) are already shared via links/QR codes — must not change.
- Constraint: marketing pages `/help /guides /roadmap /report /changelog /reviews` already have a Supabase CMS backend in progress (see `pages-cms-program` memory) — must be carried over, not reinvented.

## Assumptions

- Auth stays client-side Supabase (as today via `initAuth`/`AuthGate`); marketing nav only needs a light client-side logged-in check, no shared SSR session for now.
- Marketing routes: `/`, `/features`, `/pricing`, `/contact`, `/about`, `/help`, `/guides`, `/community`, `/reviews`, `/roadmap`, `/report`, `/changelog`, `/mentions-legales`, `/confidentialite`, `/cgu`.
- App routes: everything else, including `/discover` (live/interactive data, not static marketing surface).
- Migration is incremental, page by page, not a single big-bang cutover.
- Stays one Git repo, restructured as a monorepo (not split into two Git repos).

## Decision log

1. **Same domain, path-based split (not subdomain).** Preserves domain SEO authority; avoids cross-domain cookie/auth complexity.
2. **Next.js App Router for marketing (not Vite + vite-ssg prerender).** Real SSR/SSG, dynamic per-page metadata, image optimization. Costs more migration effort than prerendering the existing Vite components, accepted because SEO was the explicit priority.
3. **Turborepo monorepo with a shared `packages/ui` (not two independent repos).** Avoids shadcn/design-system duplication drift over time; low tooling overhead for a two-app setup.
4. **Two separate Vercel projects**, custom domain (`domain.com`) attached only to the marketing project; the app project has no customer-facing domain and is reached transparently through a Next.js fallback rewrite. This keeps every existing app URL byte-identical — no re-prefixing, no broken links/QR codes.
5. **CSP duplicated as-is per project**, not relaxed for migration convenience.

## Final design

### Repo structure

```
apps/
  marketing/     Next.js App Router — the marketing/CMS/legal routes above
  app/           current Vite app, moved as-is, all other routes unchanged
packages/
  ui/            shared shadcn primitives (Button, Card, NavigationMenu, cn()) + Tailwind tokens/fonts
  config/        shared tsconfig/eslint base
turbo.json, root package.json (workspaces)
```

`packages/ui` starts thin: only what the marketing nav/footer actually needs on day 1. Grows incrementally as more pages migrate — no forced full port of the component library.

### Vercel topology

- `marketing` project → root dir `apps/marketing`, owns the custom domain.
- `app` project → root dir `apps/app`, no custom domain, lives at its `*.vercel.app` URL, keeps its existing `vercel.json` SPA rewrite (`(.*) → /index.html`) untouched.
- `apps/marketing/next.config.js` uses Next's fallback rewrites:

```js
rewrites: async () => ({
  fallback: [{ source: "/:path*", destination: "https://<app-project>.vercel.app/:path*" }]
})
```

Fallback rewrites only fire when no Next page/file matches, so every existing app URL stays identical and reachable through the marketing domain.

### Migration sequencing (strangler-fig)

1. Scaffold Turborepo; move current repo content into `apps/app` unchanged. Confirm it still builds/deploys exactly as today.
2. Scaffold `apps/marketing` as an empty Next.js app with just the fallback rewrite. Deploy, verify hitting `domain.com/builder` (etc.) proxies correctly to the `app` project.
3. Port marketing pages one at a time: legal pages first (`/cgu`, `/confidentialite`, `/mentions-legales`) → static pages (`/about`, `/features`, `/pricing`, `/contact`) → CMS-backed pages (`/help`, `/guides`, `/roadmap`, `/report`, `/changelog`, `/reviews`, carrying over the Supabase content reads from `pages-cms-program`) → `/` (Index) last.
4. Each ported page: delete its route + lazy import from `apps/app/App.tsx` in the same PR — never two owners of one route.
5. Cutover is implicit: `domain.com` points at the `marketing` project from step 2 onward; nothing changes at the end, no DNS flip.

### CSP

Replicate the current strict policy (`script-src 'self'`, no wildcards) separately on `apps/marketing`, not shared/relaxed with `apps/app`'s existing one.
