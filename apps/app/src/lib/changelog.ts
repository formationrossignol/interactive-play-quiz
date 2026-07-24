import { supabase } from "./supabase";

export interface ChangelogRelease {
  id: string;
  version: string;
  title: string;
  dateLabel: string;
  intro: string | null;
}

/** Public read, no auth required — same changelog_releases table
 *  apps/marketing's /changelog page reads (see apps/marketing/src/lib/repo.ts
 *  #fetchChangelog). Degrades to [] on any failure, same pattern as every
 *  other public-read helper in this codebase. */
export const fetchLatestChangelog = async (limit = 5): Promise<ChangelogRelease[]> => {
  try {
    const { data, error } = await supabase
      .from("changelog_releases")
      .select("id,version,title,date_label,intro,sort")
      .order("sort", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map((row) => ({
      id: row.id as string,
      version: row.version as string,
      title: row.title as string,
      dateLabel: row.date_label as string,
      intro: (row.intro as string | null) ?? null,
    }));
  } catch {
    return [];
  }
};
