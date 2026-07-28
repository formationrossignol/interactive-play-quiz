import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type {
  ChangelogItemRow,
  FaqGroup,
  FaqRow,
  MyReport,
  NewReport,
  Release,
  ReleaseRow,
  ReportRow,
  ReportStatus,
  ReportType,
  RoadmapCard,
  RoadmapRow,
  RoadmapView,
  ShippedCard,
} from "./types";

export async function fetchFaq(): Promise<FaqGroup[]> {
  const { data, error } = await supabase
    .from("faq_items")
    .select("id,category,question,answer,sort")
    .eq("status", "published")
    .order("sort");
  if (error) throw error;
  const groups: FaqGroup[] = [];
  const byCategory = new Map<string, FaqGroup>();
  for (const row of (data ?? []) as FaqRow[]) {
    let group = byCategory.get(row.category);
    if (!group) {
      group = { category: row.category, questions: [] };
      byCategory.set(row.category, group);
      groups.push(group);
    }
    group.questions.push({ q: row.question, a: row.answer });
  }
  return groups;
}

const emptyRoadmap = (): RoadmapView => ({ idea: [], planned: [], dev: [], shipped: [] });

function groupRoadmap(rows: RoadmapRow[]): RoadmapView {
  return rows.reduce<RoadmapView>((view, row) => {
    if (row.col === "shipped") {
      const card: ShippedCard = {
        id: row.id,
        votes: row.base_votes,
        title: row.title,
        sub: row.shipped_label ?? row.subtitle,
        cat: row.category,
        link: row.shipped_link,
      };
      view.shipped.push(card);
    } else {
      const card: RoadmapCard = {
        id: row.id,
        votes: row.base_votes,
        title: row.title,
        sub: row.subtitle,
        tags: row.tags,
        cat: row.category,
        locked: row.locked,
        beta: row.beta,
        voted: false,
      };
      view[row.col].push(card);
    }
    return view;
  }, emptyRoadmap());
}

export async function fetchRoadmap(): Promise<{ view: RoadmapView; remaining: number }> {
  const [{ data: rows, error }, { data: counts }, { data: votes }] = await Promise.all([
    supabase.from("roadmap_items").select("id,col,category,title,subtitle,tags,beta,locked,base_votes,shipped_label,shipped_link,sort").eq("status", "published").order("sort"),
    supabase.from("roadmap_vote_counts").select("item_id,votes"),
    getCurrentUser()
      ? supabase.from("roadmap_votes").select("item_id").eq("user_id", getCurrentUser()!.id)
      : Promise.resolve({ data: [] }),
  ]);
  if (error) throw error;
  const view = groupRoadmap((rows ?? []) as RoadmapRow[]);
  const countMap = new Map((counts ?? []).map((row) => [String(row.item_id), Number(row.votes)]));
  const myVotes = new Set((votes ?? []).map((row) => String(row.item_id)));
  const addVotes = <T extends { id: string; votes: number }>(card: T) => ({ ...card, votes: card.votes + (countMap.get(card.id) ?? 0) });
  return {
    view: {
      idea: view.idea.map((card) => ({ ...addVotes(card), voted: myVotes.has(card.id) })),
      planned: view.planned.map((card) => ({ ...addVotes(card), voted: myVotes.has(card.id) })),
      dev: view.dev.map((card) => ({ ...addVotes(card), voted: myVotes.has(card.id) })),
      shipped: view.shipped.map(addVotes),
    },
    remaining: Math.max(0, 3 - myVotes.size),
  };
}

export async function setRoadmapVote(itemId: string, voted: boolean) {
  const user = getCurrentUser();
  if (!user) throw new Error("AUTH_REQUIRED");
  const query = voted
    ? supabase.from("roadmap_votes").delete().eq("user_id", user.id).eq("item_id", itemId)
    : supabase.from("roadmap_votes").insert({ user_id: user.id, item_id: itemId });
  const { error } = await query;
  if (error) throw error;
}

export async function submitRoadmapIdea(text: string) {
  const user = getCurrentUser();
  if (!user) throw new Error("AUTH_REQUIRED");
  const { error } = await supabase.from("roadmap_ideas").insert({ user_id: user.id, text });
  if (error) throw error;
}

export async function fetchChangelog(): Promise<Release[]> {
  const [releasesResult, itemsResult] = await Promise.all([
    supabase.from("changelog_releases").select("id,version,title,date_label,intro,media,sort").eq("status", "published").order("sort"),
    supabase.from("changelog_items").select("id,release_id,kind,text,from_votes,sort").order("sort"),
  ]);
  if (releasesResult.error) throw releasesResult.error;
  if (itemsResult.error) throw itemsResult.error;
  const items = (itemsResult.data ?? []) as ChangelogItemRow[];
  return ((releasesResult.data ?? []) as ReleaseRow[]).map((release) => ({
    v: release.version,
    title: release.title,
    date: release.date_label,
    ...(release.intro ? { intro: release.intro } : {}),
    ...(release.media ? { media: release.media } : {}),
    items: items
      .filter((item) => item.release_id === release.id)
      .map((item) => ({ t: item.kind, text: item.text, fromVotes: item.from_votes })),
  }));
}

export async function getChangelogSubscription() {
  const user = getCurrentUser();
  if (!user) return false;
  const { data, error } = await supabase.from("changelog_subscribers").select("user_id").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function setChangelogSubscription(subscribed: boolean) {
  const user = getCurrentUser();
  if (!user) throw new Error("AUTH_REQUIRED");
  const query = subscribed
    ? supabase.from("changelog_subscribers").delete().eq("user_id", user.id)
    : supabase.from("changelog_subscribers").insert({ user_id: user.id });
  const { error } = await query;
  if (error && error.code !== "23505") throw error;
}

const TYPE_LABEL: Record<ReportType, string> = { bug: "Bug", question: "Question", billing: "Facturation" };
const STATUS_META: Record<ReportStatus, { cls: string; label: string }> = {
  open: { cls: "is-open", label: "Ouvert" },
  in_progress: { cls: "is-progress", label: "En cours" },
  waiting: { cls: "is-waiting", label: "Attend votre réponse" },
  resolved: { cls: "is-resolved", label: "Résolu" },
};

const mapReport = (row: ReportRow): MyReport => {
  const status = STATUS_META[row.status];
  return {
    id: row.id,
    shortId: `#${row.id.slice(0, 4)}`,
    title: row.title,
    meta: `${TYPE_LABEL[row.type]} · ${new Date(row.created_at).toLocaleDateString("fr-FR")}`,
    statusClass: status.cls,
    statusLabel: status.label,
  };
};

export async function fetchMyReports(): Promise<MyReport[]> {
  const user = getCurrentUser();
  if (!user) return [];
  const { data, error } = await supabase.from("reports")
    .select("id,type,severity,title,body,status,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as ReportRow[]).map(mapReport);
}

export async function submitReport(input: NewReport) {
  const user = getCurrentUser();
  if (!user) throw new Error("AUTH_REQUIRED");
  const { error } = await supabase.from("reports").insert({ user_id: user.id, ...input });
  if (error) throw error;
}
