import { supabase } from '@/lib/supabase';
import type {
  RoadmapRow, RoadmapView, ReleaseRow, ChangelogItemRow, Release,
  GuideRow, Guide, FaqRow, FaqGroup, ReviewRow, Review, StaticPage,
} from './types';
import { groupRoadmap, groupChangelog, mapGuide, groupFaq, mapReview, mergeRoadmapVotes } from './mappers';
import { fetchVoteCounts, fetchMyVotes } from './interactionsRepo';

// RLS returns only status='published' rows to anon/non-admin callers.

export async function fetchRoadmap(): Promise<RoadmapView> {
  const { data, error } = await supabase
    .from('roadmap_items')
    .select('id,col,category,title,subtitle,tags,beta,locked,base_votes,shipped_label,shipped_link,sort')
    .order('sort', { ascending: true });
  if (error) throw error;
  return groupRoadmap((data ?? []) as RoadmapRow[]);
}

export async function fetchRoadmapWithVotes(): Promise<{ view: RoadmapView; remaining: number }> {
  const [view, counts, myVotes] = await Promise.all([
    fetchRoadmap(),
    fetchVoteCounts(),
    fetchMyVotes(),
  ]);
  return mergeRoadmapVotes(view, counts, myVotes);
}

export async function fetchChangelog(): Promise<Release[]> {
  const [releasesRes, itemsRes] = await Promise.all([
    supabase.from('changelog_releases')
      .select('id,version,title,date_label,intro,media,sort')
      .order('sort', { ascending: true }),
    supabase.from('changelog_items')
      .select('id,release_id,kind,text,from_votes,sort')
      .order('sort', { ascending: true }),
  ]);
  if (releasesRes.error) throw releasesRes.error;
  if (itemsRes.error) throw itemsRes.error;
  return groupChangelog((releasesRes.data ?? []) as ReleaseRow[], (itemsRes.data ?? []) as ChangelogItemRow[]);
}

export async function fetchGuides(): Promise<Guide[]> {
  const { data, error } = await supabase
    .from('guides')
    .select('id,emoji,cover_token,duration_label,title,level,format,url,body,sort')
    .order('sort', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as GuideRow[]).map(mapGuide);
}

export async function fetchFaq(): Promise<FaqGroup[]> {
  const { data, error } = await supabase
    .from('faq_items')
    .select('id,category,question,answer,sort')
    .order('sort', { ascending: true });
  if (error) throw error;
  return groupFaq((data ?? []) as FaqRow[]);
}

export async function fetchReviews(): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('id,persona,stars,text,author_name,author_role,avatar_emoji,sort')
    .eq('status', 'published')
    .order('sort', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as ReviewRow[]).map(mapReview);
}

/**
 * Static page row by slug. Returns null on any failure (incl. table not yet
 * deployed) so callers can fall back to their in-code defaults.
 */
export async function fetchStaticPage(slug: string): Promise<StaticPage | null> {
  try {
    const { data, error } = await supabase
      .from('static_pages')
      .select('slug,title,subtitle,body,blocks,status')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();
    if (error) throw error;
    return data ? (data as StaticPage) : null;
  } catch {
    return null;
  }
}
