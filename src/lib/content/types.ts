export const CONTENT_TYPES = ['quiz','poll','flashcard','exam','course'] as const;
export type ContentType = typeof CONTENT_TYPES[number];
export const isContentType = (v: string): v is ContentType =>
  (CONTENT_TYPES as readonly string[]).includes(v);

export interface ContentRow {
  id: string;
  user_id: string;
  type: ContentType;
  folder_id: string | null;
  data: Record<string, unknown>;
  is_public: boolean;
  is_open: boolean;
  created_at: string;
  updated_at: string;
}

export interface FolderRow {
  id: string;
  user_id: string;
  type: ContentType;
  name: string;
  parent_id: string | null;
  created_at: string;
}
