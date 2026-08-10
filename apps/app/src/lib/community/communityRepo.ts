import { supabase } from "@/lib/supabase";

export type CommunityCategory = "announcements" | "help" | "sharing" | "ideas";

interface CommunityReactionRow {
  user_id: string;
}

interface CommunityReplyRow {
  id: string;
}

interface CommunityThreadRow {
  id: string;
  org_id: string;
  author_user_id: string;
  author_name: string;
  category: CommunityCategory;
  title: string;
  body: string;
  solved: boolean;
  created_at: string;
  community_thread_likes: CommunityReactionRow[] | null;
  community_thread_replies: CommunityReplyRow[] | null;
}

export interface CommunityThread {
  id: string;
  orgId: string;
  authorUserId: string;
  authorName: string;
  category: CommunityCategory;
  title: string;
  body: string;
  solved: boolean;
  createdAt: string;
  likes: number;
  replies: number;
  likedByCurrentUser: boolean;
}

export async function listCommunityThreads(orgId: string, currentUserId: string): Promise<CommunityThread[]> {
  const { data, error } = await supabase
    .from("community_threads")
    .select("id,org_id,author_user_id,author_name,category,title,body,solved,created_at,community_thread_likes(user_id),community_thread_replies(id)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as CommunityThreadRow[]).map((row) => ({
    id: row.id,
    orgId: row.org_id,
    authorUserId: row.author_user_id,
    authorName: row.author_name,
    category: row.category,
    title: row.title,
    body: row.body,
    solved: row.solved,
    createdAt: row.created_at,
    likes: row.community_thread_likes?.length ?? 0,
    replies: row.community_thread_replies?.length ?? 0,
    likedByCurrentUser: row.community_thread_likes?.some((reaction) => reaction.user_id === currentUserId) ?? false,
  }));
}

export async function createCommunityThread(input: {
  orgId: string;
  authorUserId: string;
  authorName: string;
  category: CommunityCategory;
  title: string;
  body: string;
}): Promise<void> {
  const { error } = await supabase.from("community_threads").insert({
    org_id: input.orgId,
    author_user_id: input.authorUserId,
    author_name: input.authorName.trim(),
    category: input.category,
    title: input.title.trim(),
    body: input.body.trim(),
  });
  if (error) throw error;
}

export async function updateCommunityThread(
  threadId: string,
  input: { category: CommunityCategory; title: string; body: string },
): Promise<void> {
  const { error } = await supabase
    .from("community_threads")
    .update({
      category: input.category,
      title: input.title.trim(),
      body: input.body.trim(),
    })
    .eq("id", threadId);
  if (error) throw error;
}

export async function deleteCommunityThread(threadId: string): Promise<void> {
  const { error } = await supabase.from("community_threads").delete().eq("id", threadId);
  if (error) throw error;
}

export async function setCommunityThreadLike(threadId: string, userId: string, liked: boolean): Promise<void> {
  const query = liked
    ? supabase.from("community_thread_likes").delete().eq("thread_id", threadId).eq("user_id", userId)
    : supabase.from("community_thread_likes").insert({ thread_id: threadId, user_id: userId });
  const { error } = await query;
  if (error) throw error;
}
