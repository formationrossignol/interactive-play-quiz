import { cache } from "react";
import { supabase } from "./supabase";
import { supabaseBrowser } from "./supabaseBrowser";
import type { Partner } from "./types";

// Mirrors apps/app/src/lib/siteSettings.ts#fetchPartners (partners_logos
// only — that's all apps/marketing needs so far).
const PARTNERS_KEY = "partners_logos";

const sanitizePartners = (raw: unknown): Partner[] => {
  if (!Array.isArray(raw)) return [];
  const out: Partner[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const { id, name, logoUrl, link } = entry as Record<string, unknown>;
    if (typeof name !== "string" || !name.trim()) continue;
    if (typeof logoUrl !== "string" || !/^https?:\/\//i.test(logoUrl.trim())) continue;
    out.push({
      id: typeof id === "string" && id ? id : crypto.randomUUID(),
      name: name.trim(),
      logoUrl: logoUrl.trim(),
      ...(typeof link === "string" && /^https?:\/\//i.test(link.trim()) ? { link: link.trim() } : {}),
    });
  }
  return out;
};

export const fetchPartners = cache(async (): Promise<Partner[]> => {
  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", PARTNERS_KEY)
      .maybeSingle();
    if (error || !data) return [];
    return sanitizePartners(data.value);
  } catch {
    return [];
  }
});

// ── Social links — mirrors apps/app/src/lib/siteSettings.ts#fetchSocialLinks.
// Footer's SocialLinksRow is a client component (fetches on mount from the
// browser), so this uses supabaseBrowser rather than the cache()-wrapped
// server client above.

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
