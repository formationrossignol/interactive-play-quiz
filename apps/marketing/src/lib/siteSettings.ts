import { cache } from "react";
import { supabase } from "./supabase";
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
