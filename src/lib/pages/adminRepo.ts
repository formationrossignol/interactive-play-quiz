import { supabase } from '@/lib/supabase';
import type {
  RoadmapAdminRow, GuideAdminRow, FaqAdminRow, ReleaseAdminRow, ChangelogItemAdminRow,
  PendingReview, IdeaRow, AdminReportRow, SubscriberRow,
  Status, ReportStatus,
} from './types';

// ── Generic content list / status / delete ──────────────────────────────────
async function listAll<T>(table: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*').order('sort', { ascending: true });
  if (error) throw error;
  return (data ?? []) as T[];
}

export const listRoadmap = () => listAll<RoadmapAdminRow>('roadmap_items');
export const listGuides = () => listAll<GuideAdminRow>('guides');
export const listFaq = () => listAll<FaqAdminRow>('faq_items');
export const listReleases = () => listAll<ReleaseAdminRow>('changelog_releases');

export async function listReleaseItems(releaseId: string): Promise<ChangelogItemAdminRow[]> {
  const { data, error } = await supabase.from('changelog_items').select('*')
    .eq('release_id', releaseId).order('sort', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChangelogItemAdminRow[];
}

export async function createRow(table: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from(table).insert(values);
  if (error) throw error;
}
export async function updateRow(table: string, id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from(table).update(patch).eq('id', id);
  if (error) throw error;
}
export async function deleteRow(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}
export const setStatus = (table: string, id: string, status: Status) => updateRow(table, id, { status });

// ── Moderation ───────────────────────────────────────────────────────────────
export async function listReviews(status = 'pending'): Promise<PendingReview[]> {
  const { data, error } = await supabase.from('reviews')
    .select('id,persona,stars,text,author_name,author_role,created_at')
    .eq('status', status).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PendingReview[];
}
export const setReviewStatus = (id: string, status: 'published' | 'rejected') =>
  updateRow('reviews', id, { status });

export async function listIdeas(status = 'pending'): Promise<IdeaRow[]> {
  const { data, error } = await supabase.from('roadmap_ideas').select('*')
    .eq('status', status).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as IdeaRow[];
}
export const setIdeaStatus = (id: string, status: 'converted' | 'rejected') =>
  updateRow('roadmap_ideas', id, { status });

/** Pure: shape a draft roadmap_items insert from an idea-conversion form. */
export function ideaToRoadmapInsert(input: { col: string; category: string; title: string; subtitle: string }) {
  return {
    col: input.col, category: input.category, title: input.title, subtitle: input.subtitle,
    tags: [], beta: false, locked: false, base_votes: 0,
    shipped_label: null, shipped_link: false, status: 'draft', sort: 0,
  };
}
export async function convertIdeaToRoadmap(
  ideaId: string, input: { col: string; category: string; title: string; subtitle: string },
): Promise<void> {
  await createRow('roadmap_items', ideaToRoadmapInsert(input));
  await setIdeaStatus(ideaId, 'converted');
}

export async function listReports(status?: ReportStatus): Promise<AdminReportRow[]> {
  let q = supabase.from('reports').select('*').order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as AdminReportRow[];
}
export const setReportStatus = (id: string, status: ReportStatus) =>
  updateRow('reports', id, { status });

// ── Subscribers ──────────────────────────────────────────────────────────────
export async function listSubscribers(): Promise<SubscriberRow[]> {
  const { data, error } = await supabase.from('changelog_subscribers')
    .select('user_id,created_at').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SubscriberRow[];
}
