import { createClient } from "@supabase/supabase-js";

// Server-only: these marketing pages fetch content in Server Components, so
// the anon key never needs to reach the client bundle. Same Supabase project
// as apps/app (see apps/app/src/lib/supabase.ts).
const url = process.env.SUPABASE_URL as string;
const key = process.env.SUPABASE_ANON_KEY as string;

const fetchWithTimeout: typeof fetch = (input, init) => fetch(input, {
  ...init,
  signal: init?.signal ?? AbortSignal.timeout(5000),
});

export const supabase = createClient(url, key, {
  global: { fetch: fetchWithTimeout },
});
