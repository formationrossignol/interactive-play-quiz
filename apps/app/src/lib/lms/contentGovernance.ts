import { supabase } from '@/lib/supabase';

/** CNT-006's 7 states. A version reaches 'published' either directly
 *  (publishContentVersion, no review) or via the review pipeline below
 *  (draft -> in_review -> approved -> published, or -> changes_requested
 *  and back to a new draft) — see 20260823010000_content_review_workflow.sql. */
export interface ContentVersion {
  id: string;
  content_id: string;
  version: number;
  status: 'draft' | 'in_review' | 'changes_requested' | 'approved' | 'published' | 'deprecated' | 'archived';
  changelog: string | null;
  approved_by: string | null;
  created_at: string;
}

export async function listContentVersions(contentId: string): Promise<ContentVersion[]> {
  const { data, error } = await supabase.from('content_versions').select('*').eq('content_id', contentId).order('version', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ContentVersion[];
}

/** Atomic: rejects the write if someone else published since p_expected_version (no silent overwrite). */
export async function publishContentVersion(contentId: string, expectedVersion: number, snapshot: Record<string, unknown>, changelog?: string): Promise<ContentVersion> {
  const { data, error } = await supabase.rpc('publish_content_version', {
    p_content_id: contentId, p_expected_version: expectedVersion, p_snapshot: snapshot, p_changelog: changelog ?? null,
  });
  if (error) throw error;
  return data as ContentVersion;
}

/** Always creates a new version — never mutates the restored one. */
export async function restoreContentVersion(contentId: string, fromVersion: number): Promise<ContentVersion> {
  const { data, error } = await supabase.rpc('restore_content_version', { p_content_id: contentId, p_from_version: fromVersion });
  if (error) throw error;
  return data as ContentVersion;
}

/** Same optimistic-concurrency contract as publishContentVersion, lands on
 *  'draft' instead of 'published' — the review pipeline's entry point. */
export async function saveContentDraft(contentId: string, expectedVersion: number, snapshot: Record<string, unknown>, changelog?: string): Promise<ContentVersion> {
  const { data, error } = await supabase.rpc('save_content_draft', {
    p_content_id: contentId, p_expected_version: expectedVersion, p_snapshot: snapshot, p_changelog: changelog ?? null,
  });
  if (error) throw error;
  return data as ContentVersion;
}

export interface ReviewRequest {
  id: string;
  content_id: string;
  version: number;
  requested_by: string;
  status: 'open' | 'approved' | 'changes_requested' | 'cancelled';
  created_at: string;
  resolved_at: string | null;
}

/** draft -> in_review. Refused if the version isn't a draft (already
 *  submitted, or already published some other way). */
export async function submitContentForReview(contentId: string, version: number): Promise<ReviewRequest> {
  const { data, error } = await supabase.rpc('submit_content_for_review', { p_content_id: contentId, p_version: version });
  if (error) throw error;
  return data as ReviewRequest;
}

export async function listOpenReviewRequests(contentId: string): Promise<ReviewRequest[]> {
  const { data, error } = await supabase.from('review_requests').select('*').eq('content_id', contentId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ReviewRequest[];
}

export interface ReviewStep {
  id: string;
  review_request_id: string;
  reviewer_id: string;
  decision: 'approved' | 'changes_requested' | 'comment';
  note: string | null;
  created_at: string;
}

export async function listReviewSteps(reviewRequestId: string): Promise<ReviewStep[]> {
  const { data, error } = await supabase.from('review_steps').select('*').eq('review_request_id', reviewRequestId).order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ReviewStep[];
}

/** Reviewer-only (pedago/admin), and never the version's own author — see
 *  the migration header for why that separation is hardwired rather than
 *  an org toggle. 'comment' logs feedback without resolving the request. */
export async function submitReviewDecision(reviewRequestId: string, decision: ReviewStep['decision'], note?: string): Promise<ReviewStep> {
  const { data, error } = await supabase.rpc('submit_review_decision', { p_review_request_id: reviewRequestId, p_decision: decision, p_note: note ?? null });
  if (error) throw error;
  return data as ReviewStep;
}

export interface ContentRelease {
  id: string;
  content_id: string;
  version: number;
  channel: 'library' | 'catalog' | 'url' | 'embed' | 'lti' | 'package';
  release_notes: string | null;
  published_at: string;
  retired_at: string | null;
}

/** The reviewed path's publish step — requires the version to already be
 *  'approved'. Complements publishContentVersion (the direct, unreviewed
 *  path); doesn't replace it. */
export async function publishApprovedVersion(contentId: string, version: number, channel: ContentRelease['channel'] = 'library', releaseNotes?: string): Promise<ContentRelease> {
  const { data, error } = await supabase.rpc('publish_approved_version', {
    p_content_id: contentId, p_version: version, p_channel: channel, p_release_notes: releaseNotes ?? null,
  });
  if (error) throw error;
  return data as ContentRelease;
}

export async function listContentReleases(contentId: string): Promise<ContentRelease[]> {
  const { data, error } = await supabase.from('content_releases').select('*').eq('content_id', contentId).order('published_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ContentRelease[];
}

/** CNT-011/012/013 — an optional governed layer on top of session content
 *  delivery. Only 'session' actually syncs a consumer table on adopt
 *  (course_sessions.content_snapshot); 'path'/'public_url'/'integration'
 *  can be created and checked but have no consumer wired yet — see
 *  20260823020000_content_deployments_wiring.sql's header. */
export interface ContentDeployment {
  id: string;
  release_id: string;
  deployment_type: 'session' | 'path' | 'public_url' | 'integration';
  deployment_ref: string;
  update_policy: 'pinned' | 'follow_approved_updates';
  pinned_version: number;
  created_at: string;
}

export async function createContentDeployment(
  releaseId: string, deploymentType: ContentDeployment['deployment_type'], deploymentRef: string, updatePolicy: ContentDeployment['update_policy'] = 'pinned',
): Promise<ContentDeployment> {
  const { data, error } = await supabase.rpc('create_content_deployment', {
    p_release_id: releaseId, p_deployment_type: deploymentType, p_deployment_ref: deploymentRef, p_update_policy: updatePolicy,
  });
  if (error) throw error;
  return data as ContentDeployment;
}

/** No dedicated RPC: content_deployments_read RLS already covers a direct
 *  select — this is a PostgREST embedded filter across the release ->
 *  content_id relationship it can't express through .eq() alone. */
export async function listContentDeployments(contentId: string): Promise<ContentDeployment[]> {
  const { data, error } = await supabase
    .from('content_deployments')
    .select('*, content_releases!inner(content_id)')
    .eq('content_releases.content_id', contentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ContentDeployment[];
}

export interface ContentDeploymentUpdateCheck {
  deployment_id: string;
  content_id: string;
  pinned_version: number;
  latest_published_version: number | null;
  has_update: boolean;
  changelog: string | null;
  hash_changed: boolean;
  schema_version_changed: boolean;
}

export async function checkContentDeploymentUpdate(deploymentId: string): Promise<ContentDeploymentUpdateCheck> {
  const { data, error } = await supabase.rpc('check_content_deployment_update', { p_deployment_id: deploymentId });
  if (error) throw error;
  return data as ContentDeploymentUpdateCheck;
}

/** Always explicit — CNT-012's "jamais appliquée silencieusement" — never
 *  called automatically, only from a confirmed UI action after the diff
 *  (checkContentDeploymentUpdate) has been shown. */
export async function adoptContentDeploymentUpdate(deploymentId: string, toVersion: number): Promise<ContentDeployment> {
  const { data, error } = await supabase.rpc('adopt_content_deployment_update', { p_deployment_id: deploymentId, p_to_version: toVersion });
  if (error) throw error;
  return data as ContentDeployment;
}

export interface ContentComment {
  id: string;
  content_id: string;
  author_id: string;
  body: string;
  resolved: boolean;
  created_at: string;
}

export async function listContentComments(contentId: string): Promise<ContentComment[]> {
  const { data, error } = await supabase.from('content_comments').select('*').eq('content_id', contentId).order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ContentComment[];
}

export async function addContentComment(contentId: string, body: string): Promise<ContentComment> {
  const { data, error } = await supabase.from('content_comments').insert({ content_id: contentId, body }).select().single();
  if (error) throw error;
  return data as ContentComment;
}

/** CNT-008's "résolution" — direct write, no RPC needed: content_comments_update
 *  RLS (20260811000000) already allows the comment's own author or a
 *  pedago/admin of the content's org, exactly the actors who should be able
 *  to resolve a thread. */
export async function resolveContentComment(id: string, resolved = true): Promise<void> {
  const { error } = await supabase.from('content_comments').update({ resolved }).eq('id', id);
  if (error) throw error;
}
