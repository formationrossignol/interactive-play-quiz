import { supabase } from '@/lib/supabase';
import type {
  RoadmapAdminRow, GuideAdminRow, FaqAdminRow, ReleaseAdminRow, ChangelogItemAdminRow,
  PendingReview, ReviewAdminRow, IdeaRow, AdminReportRow, SubscriberRow, StaticPage, FaqSectionAdminRow,
  Status, ReportStatus,
} from './types';

// ── Generic content list / status / delete ──────────────────────────────────
// Allowlist of tables the admin UI is actually allowed to touch through the
// generic list/create/update/delete helpers below. RLS is the last line of
// defense, but this keeps an app-level guard against an arbitrary table name
// reaching Supabase (e.g. via a bug or a compromised admin-page prop).
const ADMIN_TABLE_ALLOWLIST = new Set([
  'roadmap_items',
  'guides',
  'faq_items',
  'changelog_releases',
  'reviews',
  'static_pages',
  'roadmap_ideas',
  'reports',
]);

function assertAllowedTable(table: string): void {
  if (!ADMIN_TABLE_ALLOWLIST.has(table)) {
    throw new Error(`Table "${table}" is not in the admin allowlist`);
  }
}

async function listAll<T>(table: string): Promise<T[]> {
  assertAllowedTable(table);
  const { data, error } = await supabase.from(table).select('*').order('sort', { ascending: true });
  if (error) throw error;
  return (data ?? []) as T[];
}

export const listRoadmap = () => listAll<RoadmapAdminRow>('roadmap_items');
export const listGuides = () => listAll<GuideAdminRow>('guides');
export const listFaq = () => listAll<FaqAdminRow>('faq_items');
export const listFaqSections = () => listAll<FaqSectionAdminRow>('faq_sections');
export const listReleases = () => listAll<ReleaseAdminRow>('changelog_releases');

export async function listReleaseItems(releaseId: string): Promise<ChangelogItemAdminRow[]> {
  const { data, error } = await supabase.from('changelog_items').select('*')
    .eq('release_id', releaseId).order('sort', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChangelogItemAdminRow[];
}

export async function createRow(table: string, values: Record<string, unknown>): Promise<void> {
  assertAllowedTable(table);
  const { error } = await supabase.from(table).insert(values);
  if (error) throw error;
}
export async function updateRow(table: string, id: string, patch: Record<string, unknown>): Promise<void> {
  assertAllowedTable(table);
  const { error } = await supabase.from(table).update(patch).eq('id', id);
  if (error) throw error;
}
export async function deleteRow(table: string, id: string): Promise<void> {
  assertAllowedTable(table);
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}
export const setStatus = (table: string, id: string, status: Status) => updateRow(table, id, { status });

export async function updateFaqStructure(
  sections: Pick<FaqSectionAdminRow, 'id' | 'title' | 'sort'>[],
  items: Pick<FaqAdminRow, 'id' | 'category' | 'sort'>[],
): Promise<void> {
  const results = await Promise.all([
    ...sections.map((section) => supabase.from('faq_sections').update({ title: section.title, sort: section.sort }).eq('id', section.id)),
    ...items.map((item) => supabase.from('faq_items').update({ category: item.category, sort: item.sort }).eq('id', item.id)),
  ]);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
}

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

/** Full review rows (incl. avatar/status/sort) for a given status — admin curation of the public page. */
export async function listReviewsFull(status = 'published'): Promise<ReviewAdminRow[]> {
  const { data, error } = await supabase.from('reviews')
    .select('id,persona,stars,text,author_name,author_role,avatar_emoji,status,sort')
    .eq('status', status).order('sort', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ReviewAdminRow[];
}

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

// ── Static pages ─────────────────────────────────────────────────────────────
export async function listStaticPages(): Promise<StaticPage[]> {
  const { data, error } = await supabase.from('static_pages')
    .select('slug,title,subtitle,body,blocks,status');
  if (error) throw error;
  return (data ?? []) as StaticPage[];
}
export async function upsertStaticPage(row: StaticPage): Promise<void> {
  const { error } = await supabase.from('static_pages').upsert({
    slug: row.slug, title: row.title, subtitle: row.subtitle,
    body: row.body, blocks: row.blocks, status: row.status,
  }, { onConflict: 'slug' });
  if (error) throw error;
}

// ── Subscribers ──────────────────────────────────────────────────────────────
export async function listSubscribers(): Promise<SubscriberRow[]> {
  const { data, error } = await supabase.from('changelog_subscribers')
    .select('user_id,created_at').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SubscriberRow[];
}
