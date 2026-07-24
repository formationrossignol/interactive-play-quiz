import { cache } from "react";
import { supabase } from "./supabase";
import { mapGuide, groupFaq, mapReview } from "./mappers";
import type { StaticPage, GuideRow, Guide, FaqRow, FaqGroup, ReviewRow, Review } from "./types";

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

// Mirrors apps/app/src/lib/pages/repo.ts#fetchGuides / #fetchFaq — defensive
// try/catch added (the app's react-query hooks handle a thrown error via
// isLoading/error state; here it would fail the page's static generation).
export const fetchGuides = cache(async (): Promise<Guide[]> => {
  try {
    const { data, error } = await supabase
      .from("guides")
      .select("id,emoji,cover_token,duration_label,title,level,format,url,body,sort")
      .order("sort", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as GuideRow[]).map(mapGuide);
  } catch {
    return [];
  }
});

export const fetchFaq = cache(async (): Promise<FaqGroup[]> => {
  try {
    const { data, error } = await supabase
      .from("faq_items")
      .select("id,category,question,answer,sort")
      .order("sort", { ascending: true });
    if (error) throw error;
    return groupFaq((data ?? []) as FaqRow[]);
  } catch {
    return [];
  }
});

export const fetchReviews = cache(async (): Promise<Review[]> => {
  try {
    const { data, error } = await supabase
      .from("reviews")
      .select("id,persona,stars,text,author_name,author_role,avatar_emoji,sort")
      .eq("status", "published")
      .order("sort", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as ReviewRow[]).map(mapReview);
  } catch {
    return [];
  }
});
