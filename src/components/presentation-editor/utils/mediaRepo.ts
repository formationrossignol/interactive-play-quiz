// src/components/presentation-editor/utils/mediaRepo.ts
import { supabase } from "@/lib/supabase";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/webm"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export type MediaValidation = { ok: true } | { ok: false; error: string };

export function validateMediaFile(file: File): MediaValidation {
  if (IMAGE_TYPES.includes(file.type)) {
    return file.size > MAX_IMAGE_BYTES ? { ok: false, error: "Image trop volumineuse (max 10 Mo)." } : { ok: true };
  }
  if (VIDEO_TYPES.includes(file.type)) {
    return file.size > MAX_VIDEO_BYTES ? { ok: false, error: "Vidéo trop volumineuse (max 50 Mo)." } : { ok: true };
  }
  return { ok: false, error: "Type de fichier non supporté." };
}

/**
 * Uploads a validated file to the presentation-media bucket at
 * `<userId>/<presentationId>/<elementId>.<ext>` and returns its public URL.
 * Throws MediaValidationError if `validateMediaFile` would reject the file
 * (call it first in the UI to show an error without attempting the upload).
 */
export class MediaValidationError extends Error {}

export async function uploadPresentationMedia(
  userId: string,
  presentationId: string,
  elementId: string,
  file: File,
): Promise<string> {
  const validation = validateMediaFile(file);
  if (!validation.ok) throw new MediaValidationError(validation.error);

  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${userId}/${presentationId}/${elementId}.${ext}`;

  const { error } = await supabase.storage
    .from("presentation-media")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;

  const { data } = supabase.storage.from("presentation-media").getPublicUrl(path);
  return data.publicUrl;
}
