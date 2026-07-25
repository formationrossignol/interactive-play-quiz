import { supabase } from "./supabase";

export interface ChangelogRelease {
  id: string;
  version: string;
  title: string;
  dateLabel: string;
  intro: string | null;
}

/** Public read — same changelog_releases table apps/marketing's /changelog
 *  page reads (see apps/marketing/src/lib/repo.ts #fetchChangelog) and the
 *  admin console's listReleases (lib/pages/adminRepo.ts). Draft rows exist
 *  (status column) but RLS already scopes anon reads to status='published',
 *  so no client-side status filter is needed here. Lower `sort` = newer
 *  release (confirmed against both of those other readers, which also order
 *  ascending). Degrades to [] on any failure, same pattern as every other
 *  public-read helper in this codebase. */
export const fetchLatestChangelog = async (limit = 5): Promise<ChangelogRelease[]> => {
  try {
    const { data, error } = await supabase
      .from("changelog_releases")
      .select("id,version,title,date_label,intro,sort")
      .order("sort", { ascending: true })
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
