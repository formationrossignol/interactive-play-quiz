// src/lib/avatarRepo.ts
import { supabase } from "@/lib/supabase";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export type AvatarValidation = { ok: true } | { ok: false; error: string };

export function validateAvatarFile(file: File): AvatarValidation {
  if (!IMAGE_TYPES.includes(file.type)) return { ok: false, error: "Format non supporté (PNG, JPEG, WebP ou GIF)." };
  if (file.size > MAX_AVATAR_BYTES) return { ok: false, error: "Image trop volumineuse (max 5 Mo)." };
  return { ok: true };
}

export class AvatarValidationError extends Error {}

/**
 * Uploads a validated avatar to `<userId>/avatar.<ext>` in the avatars
 * bucket and returns its public URL. Upserts so re-uploading replaces the
 * previous photo instead of accumulating orphaned files.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const validation = validateAvatarFile(file);
  if (validation.ok === false) throw new AvatarValidationError(validation.error);

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/avatar.${ext}`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  // Cache-bust: same path on re-upload would otherwise keep serving the
  // browser/CDN's cached previous photo under an unchanged URL.
  return `${data.publicUrl}?v=${Date.now()}`;
}
