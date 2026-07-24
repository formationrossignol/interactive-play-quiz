import { supabaseBrowser } from "./supabaseBrowser";

// Split out of siteSettings.ts: that file also imports the server-only
// ./supabase client (non-NEXT_PUBLIC_ env vars). SocialLinksRow is a client
// component, so importing fetchSocialLinks from siteSettings.ts pulled the
// whole module — including the server client's eager createClient() call —
// into the browser bundle, where SUPABASE_URL is undefined and throws.
// Keeping this client-only means only supabaseBrowser ships to the browser.
// Mirrors apps/app/src/lib/siteSettings.ts#fetchSocialLinks.

export const SOCIAL_NETWORKS = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "youtube", label: "YouTube" },
  { id: "x", label: "X (Twitter)" },
  { id: "tiktok", label: "TikTok" },
] as const;

export type SocialNetworkId = (typeof SOCIAL_NETWORKS)[number]["id"];

/** network id → absolute URL; missing/empty = not displayed. */
export type SocialLinks = Partial<Record<SocialNetworkId, string>>;

const SOCIAL_LINKS_KEY = "social_links";

const sanitizeSocialLinks = (raw: unknown): SocialLinks => {
  if (!raw || typeof raw !== "object") return {};
  const out: SocialLinks = {};
  for (const { id } of SOCIAL_NETWORKS) {
    const v = (raw as Record<string, unknown>)[id];
    if (typeof v === "string" && /^https?:\/\//i.test(v.trim())) out[id] = v.trim();
  }
  return out;
};

export const fetchSocialLinks = async (): Promise<SocialLinks> => {
  try {
    const { data, error } = await supabaseBrowser
      .from("site_settings")
      .select("value")
      .eq("key", SOCIAL_LINKS_KEY)
      .maybeSingle();
    if (error || !data) return {};
    return sanitizeSocialLinks(data.value);
  } catch {
    return {};
  }
};
