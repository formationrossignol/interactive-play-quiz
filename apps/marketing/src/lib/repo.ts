import { cache } from "react";
import { supabase } from "./supabase";
import type { StaticPage } from "./types";

// Mirrors apps/app/src/lib/pages/repo.ts#fetchStaticPage. Wrapped in React's
// cache() so generateMetadata and the page component share one query per
// request instead of two.
export const fetchStaticPage = cache(async (slug: string): Promise<StaticPage | null> => {
  try {
    const { data, error } = await supabase
      .from("static_pages")
      .select("slug,title,subtitle,body,blocks,status")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw error;
    return data ? (data as StaticPage) : null;
  } catch {
    return null;
  }
});
