import { supabase } from "@/lib/supabase";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 8 * 1024 * 1024;

export function validateCommunityImage(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return "Format non supporté (JPEG, PNG, WebP ou GIF).";
  if (file.size > MAX_BYTES) return "Image trop volumineuse (8 Mo maximum).";
  return null;
}

export async function uploadCommunityImage(userId: string, file: File): Promise<string> {
  const invalid = validateCommunityImage(file);
  if (invalid) throw new Error(invalid);
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("community-media").upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
  });
  if (error) throw error;
  return supabase.storage.from("community-media").getPublicUrl(path).data.publicUrl;
}
