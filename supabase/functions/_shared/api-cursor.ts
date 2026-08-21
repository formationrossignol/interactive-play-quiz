// API-001 — cursor pagination shared by every api-v1 list endpoint. Cursor
// is an opaque base64 encoding of {createdAt, id} — the last row's own
// (created_at, id) tuple, not an offset (offsets drift under concurrent
// inserts/deletes; a tuple cursor doesn't, the standard reason REST APIs use
// this shape over page numbers).
export interface CursorPage {
  createdAt: string;
  id: string;
}

export function encodeCursor(page: CursorPage): string {
  return btoa(JSON.stringify(page));
}

export function decodeCursor(raw: string | null): CursorPage | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(atob(raw));
    if (typeof parsed?.createdAt === "string" && typeof parsed?.id === "string") return parsed;
    return null;
  } catch {
    return null;
  }
}
