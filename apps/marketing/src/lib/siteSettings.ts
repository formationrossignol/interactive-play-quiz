import { cache } from "react";
import { supabase } from "./supabase";
import type { Partner } from "./types";

// Mirrors apps/app/src/lib/siteSettings.ts#fetchPartners (partners_logos
// only — that's all apps/marketing needs so far).
const PARTNERS_KEY = "partners_logos";

const looksLikeTestData = (value: string) => {
  const compact = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return compact.length < 3
    || /^(test|demo|example|exemple|qwerty|asdf|qs+d|dq+s)/.test(compact)
    || /(.{1,3})\1{2,}/.test(compact);
};

const sanitizePartners = (raw: unknown): Partner[] => {
  if (!Array.isArray(raw)) return [];
  const out: Partner[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const { id, name, logoUrl, link } = entry as Record<string, unknown>;
    if (typeof name !== "string" || !name.trim() || looksLikeTestData(name)) continue;
    if (typeof logoUrl !== "string" || !/^https?:\/\//i.test(logoUrl.trim())) continue;
    if (/googleusercontent|gstatic|google\.com\/imgres/i.test(logoUrl)) continue;
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
