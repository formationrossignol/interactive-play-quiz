import { cache } from "react";
import { supabase } from "./supabase";
import { mapGuide, groupFaq, mapReview, groupRoadmap, groupChangelog } from "./mappers";
import type {
  StaticPage, GuideRow, Guide, FaqRow, FaqGroup, ReviewRow, Review,
  RoadmapRow, RoadmapView, ReleaseRow, ChangelogItemRow, Release,
} from "./types";

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

// Roadmap/changelog: public read data only (no per-user vote/subscription
// state — that's fetched client-side, see components/RoadmapBoard.tsx and
// ChangelogSubscribe.tsx). Mirrors apps/app/src/lib/pages/repo.ts#fetchRoadmap
// / #fetchChangelog, minus the vote-count merge (also client-side).
export const fetchRoadmap = cache(async (): Promise<RoadmapView> => {
  try {
    const { data, error } = await supabase
      .from("roadmap_items")
      .select("id,col,category,title,subtitle,tags,beta,locked,base_votes,shipped_label,shipped_link,sort")
      .order("sort", { ascending: true });
    if (error) throw error;
    return groupRoadmap((data ?? []) as RoadmapRow[]);
  } catch {
    return { idea: [], planned: [], dev: [], shipped: [] };
  }
});

export const fetchChangelog = cache(async (): Promise<Release[]> => {
  try {
    const [releasesRes, itemsRes] = await Promise.all([
      supabase.from("changelog_releases")
        .select("id,version,title,date_label,intro,media,sort")
        .order("sort", { ascending: true }),
      supabase.from("changelog_items")
        .select("id,release_id,kind,text,from_votes,sort")
        .order("sort", { ascending: true }),
    ]);
    if (releasesRes.error) throw releasesRes.error;
    if (itemsRes.error) throw itemsRes.error;
    return groupChangelog((releasesRes.data ?? []) as ReleaseRow[], (itemsRes.data ?? []) as ChangelogItemRow[]);
  } catch {
    return [];
  }
});
