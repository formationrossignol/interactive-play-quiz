import { useCallback, useEffect, useState } from 'react';
import { getCurrentUser } from '@/lib/auth';
import type { ContentRow, ContentType, FolderRow } from '@/lib/content/types';
import {
  buildTree,
  createFolder as repoCreateFolder,
  deleteFolder as repoDeleteFolder,
  listFolders,
  moveFolder as repoMoveFolder,
  renameFolder as repoRenameFolder,
  wouldCreateCycle,
  type FolderNode,
} from '@/lib/content/foldersRepo';
import {
  duplicateContent as repoDuplicateContent,
  listContent,
  listPublicContent,
  moveContent as repoMoveContent,
  removeContent,
  setPublic,
  updateContent,
} from '@/lib/content/contentRepo';

export interface UseContentCollection {
  loading: boolean;
  error: string | null;
  items: ContentRow[]; // ALL content of this type for the user (page filters via contentView)
  publicItems: ContentRow[]; // public content of this type across all users ("public" tab)
  folders: FolderRow[];
  tree: FolderNode[]; // buildTree(folders)
  currentFolderId: string | null;
  setCurrentFolderId: (id: string | null) => void;
  reload: () => Promise<void>;
  // folder actions
  createFolder: (parentId: string | null, name: string) => Promise<void>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  moveFolder: (id: string, newParentId: string | null) => Promise<void>;
  // content actions
  moveContent: (id: string, folderId: string | null) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  trashItem: (id: string) => Promise<void>;
  restoreItem: (id: string) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  duplicateItem: (id: string) => Promise<void>;
  setItemPublic: (id: string, isPublic: boolean) => Promise<void>;
}

export function useContentCollection(type: ContentType): UseContentCollection {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ContentRow[]>([]);
  const [publicItems, setPublicItems] = useState<ContentRow[]>([]);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [tree, setTree] = useState<FolderNode[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const userId = getCurrentUser()?.id;
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const [contentRows, folderRows, publicRows] = await Promise.all([
        listContent(userId, type),
        listFolders(userId, type),
        listPublicContent(type).catch(() => [] as ContentRow[]),
      ]);
      setItems(contentRows);
      setPublicItems(publicRows);
      setFolders(folderRows);
      setTree(buildTree(folderRows));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    if (!getCurrentUser()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void reload();
  }, [reload]);

  // --- Folder actions ---

  const createFolder = useCallback(
    async (parentId: string | null, name: string) => {
      const userId = getCurrentUser()?.id;
      if (!userId) return;
      await repoCreateFolder(userId, type, name, parentId);
      await reload();
    },
    [type, reload],
  );

  const renameFolder = useCallback(
    async (id: string, name: string) => {
      if (!getCurrentUser()) return;
      await repoRenameFolder(id, name);
      await reload();
    },
    [reload],
  );

  const deleteFolder = useCallback(
    async (id: string) => {
      if (!getCurrentUser()) return;
      const folder = folders.find((f) => f.id === id);
      await repoDeleteFolder(id, folder?.parent_id ?? null);
      await reload();
    },
    [folders, reload],
  );

  const moveFolder = useCallback(
    async (id: string, newParentId: string | null) => {
      if (!getCurrentUser()) return;
      if (wouldCreateCycle(folders, id, newParentId)) throw new Error('cycle');
      await repoMoveFolder(id, newParentId, folders);
      await reload();
    },
    [folders, reload],
  );

  // --- Content actions ---

  const moveContent = useCallback(
    async (id: string, folderId: string | null) => {
      if (!getCurrentUser()) return;
      await repoMoveContent(id, folderId);
      await reload();
    },
    [reload],
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      if (!getCurrentUser()) return;
      const row = items.find((i) => i.id === id);
      if (!row) return;
      const data = { ...row.data, isFavorite: !row.data.isFavorite };
      await updateContent(id, { data });
      await reload();
    },
    [items, reload],
  );

  const trashItem = useCallback(
    async (id: string) => {
      if (!getCurrentUser()) return;
      const row = items.find((i) => i.id === id);
      if (!row) return;
      const data = { ...row.data, deletedAt: new Date().toISOString() };
      await updateContent(id, { data });
      await reload();
    },
    [items, reload],
  );

  const restoreItem = useCallback(
    async (id: string) => {
      if (!getCurrentUser()) return;
      const row = items.find((i) => i.id === id);
      if (!row) return;
      const data = { ...row.data };
      delete data.deletedAt;
      await updateContent(id, { data });
      await reload();
    },
    [items, reload],
  );

  const removeItem = useCallback(
    async (id: string) => {
      if (!getCurrentUser()) return;
      await removeContent(id);
      await reload();
    },
    [reload],
  );

  const duplicateItem = useCallback(
    async (id: string) => {
      const userId = getCurrentUser()?.id;
      if (!userId) return;
      await repoDuplicateContent(userId, id);
      await reload();
    },
    [reload],
  );

  const setItemPublic = useCallback(
    async (id: string, isPublic: boolean) => {
      if (!getCurrentUser()) return;
      await setPublic(id, isPublic);
      await reload();
    },
    [reload],
  );

  return {
    loading,
    error,
    items,
    publicItems,
    folders,
    tree,
    currentFolderId,
    setCurrentFolderId,
    reload,
    createFolder,
    renameFolder,
    deleteFolder,
    moveFolder,
    moveContent,
    toggleFavorite,
    trashItem,
    restoreItem,
    removeItem,
    duplicateItem,
    setItemPublic,
  };
}
