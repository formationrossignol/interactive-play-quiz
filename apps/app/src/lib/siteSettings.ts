// Site-wide key/value settings stored in the Supabase `site_settings` table.
// First consumer: the footer's social links, edited from the admin console.
// Every read degrades gracefully to a default when the table is not deployed
// yet (mirrors the static_pages pattern).
import { supabase } from "./supabase";

export const SOCIAL_NETWORKS = [
  { id: "linkedin", label: "LinkedIn", placeholder: "https://www.linkedin.com/company/…" },
  { id: "instagram", label: "Instagram", placeholder: "https://www.instagram.com/…" },
  { id: "facebook", label: "Facebook", placeholder: "https://www.facebook.com/…" },
  { id: "youtube", label: "YouTube", placeholder: "https://www.youtube.com/@…" },
  { id: "x", label: "X (Twitter)", placeholder: "https://x.com/…" },
  { id: "tiktok", label: "TikTok", placeholder: "https://www.tiktok.com/@…" },
] as const;

export type SocialNetworkId = (typeof SOCIAL_NETWORKS)[number]["id"];

/** network id → absolute URL; missing/empty = not displayed. */
export type SocialLinks = Partial<Record<SocialNetworkId, string>>;

const SOCIAL_LINKS_KEY = "social_links";

const sanitize = (raw: unknown): SocialLinks => {
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
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", SOCIAL_LINKS_KEY)
      .maybeSingle();
    if (error || !data) return {};
    return sanitize(data.value);
  } catch {
    return {};
  }
};

/** Admin-only (enforced by RLS). Stores the full map; empty strings dropped. */
export const saveSocialLinks = async (links: SocialLinks): Promise<boolean> => {
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: SOCIAL_LINKS_KEY, value: sanitize(links), updated_at: new Date().toISOString() });
  return !error;
};

// ── Partners strip — "Partenaires" logo band, same site_settings pattern. ──

export interface Partner {
  id: string;
  name: string;
  logoUrl: string;
  link?: string;
}

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

export const fetchPartners = async (): Promise<Partner[]> => {
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
};

/** Admin-only (enforced by RLS). Stores the full list; invalid rows dropped. */
export const savePartners = async (partners: Partner[]): Promise<boolean> => {
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: PARTNERS_KEY, value: sanitizePartners(partners), updated_at: new Date().toISOString() });
  return !error;
};
