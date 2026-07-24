import { createClient } from "@supabase/supabase-js";

// Client-side counterpart to lib/supabase.ts (which is server-only, used by
// Server Components to fetch content). This one runs in the browser — same
// Supabase project, so NEXT_PUBLIC_-prefixed env vars (client bundle-visible
// by design, same as apps/app's VITE_SUPABASE_* pair).
//
// Session storage is the Supabase JS default (localStorage, origin-scoped).
// Once marketing and app share one custom domain, a session created by
// logging in on the app becomes visible here too, same-origin. On separate
// *.vercel.app preview domains, sessions don't cross over — expected until
// the real domain is attached (see docs/marketing-app-decoupling.md).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// This backs decorative widgets (live-visitor count, footer social icons) —
// createClient() throws synchronously if either var is missing, which would
// otherwise crash every page that renders the footer. Fall back to a dummy
// endpoint so the client constructs; callers already degrade to an empty
// result when the actual network call fails.
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing — live visitor count and social links will stay empty.");
}

export const supabaseBrowser = createClient(url || "https://placeholder.supabase.co", key || "placeholder");
