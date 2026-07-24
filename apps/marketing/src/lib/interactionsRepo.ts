import { supabaseBrowser } from "./supabaseBrowser";
import { mapReport } from "./mappers";
import type { NewReport, NewReview, MyReport, ReportRow } from "./types";

// Client-side counterpart to apps/app/src/lib/pages/interactionsRepo.ts.
// The app's getCurrentUser() is a synchronous cache populated by initAuth()
// at startup; marketing has no such bootstrap, so each function here reads
// the current user id directly off the Supabase browser client.
async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabaseBrowser.auth.getUser();
  return data.user?.id ?? null;
}

/** Redirects to /auth (full navigation — app-owned route) when logged out.
 *  Call before any mutation below; mirrors apps/app/src/lib/pages/requireAuth.ts. */
export async function requireAuth(): Promise<boolean> {
  const uid = await getCurrentUserId();
  if (uid) return true;
  window.location.href = "/auth";
  return false;
}

// ── Roadmap votes ──────────────────────────────────────────────────────────
export async function fetchVoteCounts(): Promise<Map<string, number>> {
  const { data, error } = await supabaseBrowser.from("roadmap_vote_counts").select("item_id,votes");
  if (error) throw error;
  return new Map((data ?? []).map((r) => [r.item_id as string, r.votes as number]));
}

export async function fetchMyVotes(): Promise<Set<string>> {
  const uid = await getCurrentUserId();
  if (!uid) return new Set();
  const { data, error } = await supabaseBrowser.from("roadmap_votes").select("item_id").eq("user_id", uid);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.item_id as string));
}

export async function castVote(itemId: string): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error("not authenticated");
  const { error } = await supabaseBrowser.from("roadmap_votes").insert({ user_id: uid, item_id: itemId });
  if (error) throw error;
}

export async function removeVote(itemId: string): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error("not authenticated");
  const { error } = await supabaseBrowser.from("roadmap_votes").delete().eq("user_id", uid).eq("item_id", itemId);
  if (error) throw error;
}

export async function submitIdea(text: string): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error("not authenticated");
  const { error } = await supabaseBrowser.from("roadmap_ideas").insert({ user_id: uid, text });
  if (error) throw error;
}

// ── Changelog subscription ─────────────────────────────────────────────────
export async function isSubscribed(): Promise<boolean> {
  const uid = await getCurrentUserId();
  if (!uid) return false;
  const { data, error } = await supabaseBrowser.from("changelog_subscribers").select("user_id").eq("user_id", uid).maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function subscribe(): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error("not authenticated");
  const { error } = await supabaseBrowser.from("changelog_subscribers").insert({ user_id: uid });
  if (error && error.code !== "23505") throw error; // ignore duplicate
}

export async function unsubscribe(): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error("not authenticated");
  const { error } = await supabaseBrowser.from("changelog_subscribers").delete().eq("user_id", uid);
  if (error) throw error;
}

// ── Reports ─────────────────────────────────────────────────────────────────
export async function submitReport(input: NewReport): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error("not authenticated");
  const { error } = await supabaseBrowser.from("reports").insert({ user_id: uid, ...input });
  if (error) throw error;
}

export async function fetchMyReports(): Promise<MyReport[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];
  const { data, error } = await supabaseBrowser
    .from("reports")
    .select("id,type,severity,title,body,status,created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as ReportRow[]).map(mapReport);
}

// ── Reviews ─────────────────────────────────────────────────────────────────
export async function submitReview(input: NewReview): Promise<void> {
  const { data: { user } } = await supabaseBrowser.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const username = (user.user_metadata?.username as string) || (user.email ?? "").split("@")[0];
  const { error } = await supabaseBrowser.from("reviews").insert({
    author_user_id: user.id,
    persona: input.persona,
    stars: input.stars,
    text: input.text,
    author_name: username,
    author_role: input.authorRole,
    avatar_emoji: "🙂",
    status: "pending",
  });
  if (error) throw error;
}
