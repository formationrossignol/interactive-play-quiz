# Duplicate & Folders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add duplication of quiz/poll/flashcard items (named "Copie de …") and per-type flat folder management across MyQuizzes, MyPolls, and MyFlashcards pages.

**Architecture:** Folders are stored in localStorage under key `content_folders` as a flat array of `Folder` objects filtered by `type` and `userId`. Items gain an optional `folderId` field. Each page manages a `currentFolderId` state to navigate root ↔ folder. DnD (already installed via @dnd-kit) enables drag-onto-folder in addition to a "Déplacer vers" dropdown menu.

**Tech Stack:** React, TypeScript, localStorage, @dnd-kit/core, lucide-react, sonner (toast), existing design system (arcade-pop.css classes).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/quizStorage.ts` | Modify | Add `folderId` to `SavedQuiz`, add `duplicateQuiz` |
| `src/lib/folderStorage.ts` | Create | Folder CRUD + `moveToFolder` |
| `src/components/FolderCard.tsx` | Create | Folder tile (grid + list variant, rename/delete, DnD droppable) |
| `src/components/MoveToFolderMenu.tsx` | Create | Dropdown "Déplacer vers" with folder list |
| `src/pages/MyQuizzes.tsx` | Modify | Folder state, breadcrumb, duplicate button, DnD context |
| `src/pages/MyPolls.tsx` | Modify | Same pattern as MyQuizzes |
| `src/pages/MyFlashcards.tsx` | Modify | Same pattern as MyQuizzes |

---

## Task 1: Extend `SavedQuiz` + add `duplicateQuiz`

**Files:**
- Modify: `src/lib/quizStorage.ts`

- [ ] **Step 1: Add `folderId` to `SavedQuiz` interface**

In `src/lib/quizStorage.ts`, add the field to the interface (after `ratingCount`):

```ts
export interface SavedQuiz {
  id: string;
  title: string;
  description: string;
  questions: any[];
  createdAt: string;
  userId: string;
  isPublic: boolean;
  isFavorite: boolean;
  tags: string[];
  speedBonus: boolean;
  transitionTime: number;
  category: string;
  type: 'quiz' | 'poll' | 'flashcard' | 'slide';
  headerImage?: string;
  theme?: string;
  font?: string;
  rating?: number;
  ratingCount?: number;
  folderId?: string | null;   // <-- add this
}
```

- [ ] **Step 2: Add `duplicateQuiz` function**

Append at the end of `src/lib/quizStorage.ts`:

```ts
export const duplicateQuiz = (id: string): SavedQuiz | null => {
  const user = getCurrentUser();
  if (!user) return null;
  const original = getQuizById(id);
  if (!original || original.userId !== user.id) return null;

  const existing = new Set(getSavedQuizzes().map((q) => q.id));
  let newId: string;
  do { newId = (Math.floor(Math.random() * 900000) + 100000).toString(); }
  while (existing.has(newId));

  const copy: SavedQuiz = {
    ...original,
    id: newId,
    title: `Copie de ${original.title}`,
    createdAt: new Date().toISOString(),
    isFavorite: false,
    rating: undefined,
    ratingCount: undefined,
    folderId: original.folderId ?? null,
  };

  const quizzes = getSavedQuizzes();
  quizzes.push(copy);
  localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(quizzes));
  return copy;
};
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/quizStorage.ts
git commit -m "feat(storage): add folderId to SavedQuiz + duplicateQuiz function"
```

---

## Task 2: Create `folderStorage.ts`

**Files:**
- Create: `src/lib/folderStorage.ts`

- [ ] **Step 1: Create the file**

```ts
// src/lib/folderStorage.ts
import { getSavedQuizzes } from './quizStorage';
import type { SavedQuiz } from './quizStorage';

const FOLDERS_KEY = 'content_folders';

export interface Folder {
  id: string;
  name: string;
  userId: string;
  type: 'quiz' | 'poll' | 'flashcard';
  createdAt: string;
}

const getAllFolders = (): Folder[] => {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    return raw ? (JSON.parse(raw) as Folder[]) : [];
  } catch {
    return [];
  }
};

const writeFolders = (folders: Folder[]): void => {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
};

export const getFolders = (userId: string, type: Folder['type']): Folder[] => {
  return getAllFolders()
    .filter((f) => f.userId === userId && f.type === type)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
};

export const createFolder = (name: string, userId: string, type: Folder['type']): Folder => {
  const existing = new Set(getAllFolders().map((f) => f.id));
  let id: string;
  do { id = Math.random().toString(36).slice(2, 10); }
  while (existing.has(id));

  const folder: Folder = { id, name: name.trim(), userId, type, createdAt: new Date().toISOString() };
  const folders = getAllFolders();
  folders.push(folder);
  writeFolders(folders);
  return folder;
};

export const renameFolder = (id: string, name: string): Folder | null => {
  const folders = getAllFolders();
  const idx = folders.findIndex((f) => f.id === id);
  if (idx === -1) return null;
  folders[idx] = { ...folders[idx], name: name.trim() };
  writeFolders(folders);
  return folders[idx];
};

export const deleteFolder = (id: string): boolean => {
  const folders = getAllFolders();
  const idx = folders.findIndex((f) => f.id === id);
  if (idx === -1) return false;

  // Move items in this folder back to root
  const quizzes = getSavedQuizzes();
  const updated = quizzes.map((q) => (q.folderId === id ? { ...q, folderId: null } : q));
  localStorage.setItem('saved_quizzes', JSON.stringify(updated));

  writeFolders(folders.filter((f) => f.id !== id));
  return true;
};

export const moveToFolder = (quizId: string, folderId: string | null): boolean => {
  const quizzes = getSavedQuizzes();
  const idx = quizzes.findIndex((q) => q.id === quizId);
  if (idx === -1) return false;
  quizzes[idx] = { ...quizzes[idx], folderId };
  localStorage.setItem('saved_quizzes', JSON.stringify(quizzes));
  return true;
};

export const getFolderItemCount = (folderId: string, userId: string, type: SavedQuiz['type']): number => {
  return getSavedQuizzes().filter(
    (q) => q.folderId === folderId && q.userId === userId && q.type === type,
  ).length;
};
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/folderStorage.ts
git commit -m "feat(storage): add folderStorage with CRUD + moveToFolder"
```

---

## Task 3: Create `FolderCard` component

**Files:**
- Create: `src/components/FolderCard.tsx`

- [ ] **Step 1: Create the file**

```tsx
// src/components/FolderCard.tsx
import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Folder, FolderOpen, Pencil, Trash2, Check, X } from 'lucide-react';
import type { Folder as FolderData } from '@/lib/folderStorage';
import { cn } from '@/lib/utils';

interface FolderCardProps {
  folder: FolderData;
  itemCount: number;
  viewMode: 'grid' | 'list';
  onClick: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export const FolderCard = ({ folder, itemCount, viewMode, onClick, onRename, onDelete }: FolderCardProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(folder.name);

  const { isOver, setNodeRef } = useDroppable({ id: folder.id });

  const commitRename = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== folder.name) onRename(folder.id, trimmed);
    setEditing(false);
  };

  if (viewMode === 'list') {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          'flex items-center gap-4 cursor-pointer px-4 py-3 transition-colors',
          isOver && 'bg-[var(--ap-brand-soft)]',
        )}
        style={{ borderBottom: '2px solid var(--ap-line)' }}
        onClick={!editing ? onClick : undefined}
        onMouseEnter={(e) => { if (!isOver) e.currentTarget.style.background = 'var(--ap-paper-2)'; }}
        onMouseLeave={(e) => { if (!isOver) e.currentTarget.style.background = 'transparent'; }}
      >
        <Folder className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--ap-brand)' }} />
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(false); }}
              className="ap-input"
              style={{ padding: '2px 8px', fontSize: '14px', height: '28px' }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <p className="ap-h3 truncate" style={{ fontSize: '14px' }}>{folder.name}</p>
          )}
          <p className="ap-muted" style={{ fontSize: '12px' }}>{itemCount} élément{itemCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {editing ? (
            <>
              <button className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: '5px' }} onClick={commitRename}><Check className="h-3.5 w-3.5" /></button>
              <button className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: '5px' }} onClick={() => setEditing(false)}><X className="h-3.5 w-3.5" /></button>
            </>
          ) : (
            <>
              <button className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: '5px' }} onClick={() => { setDraft(folder.name); setEditing(true); }}><Pencil className="h-3.5 w-3.5" /></button>
              <button className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: '5px', color: 'var(--ap-quiz)' }} onClick={() => onDelete(folder.id)}><Trash2 className="h-3.5 w-3.5" /></button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'ap-card ap-card--hover flex flex-col cursor-pointer p-5 gap-3 transition-all',
        isOver && 'outline outline-2 outline-[var(--ap-brand)] bg-[var(--ap-brand-soft)]',
      )}
      onClick={!editing ? onClick : undefined}
    >
      <div className="flex items-start justify-between">
        {isOver
          ? <FolderOpen className="h-8 w-8" style={{ color: 'var(--ap-brand)' }} />
          : <Folder className="h-8 w-8" style={{ color: 'var(--ap-brand)' }} />
        }
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          {editing ? (
            <>
              <button className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: '4px' }} onClick={commitRename}><Check className="h-3.5 w-3.5" /></button>
              <button className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: '4px' }} onClick={() => setEditing(false)}><X className="h-3.5 w-3.5" /></button>
            </>
          ) : (
            <>
              <button className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: '4px' }} onClick={() => { setDraft(folder.name); setEditing(true); }}><Pencil className="h-3.5 w-3.5" /></button>
              <button className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: '4px', color: 'var(--ap-quiz)' }} onClick={() => onDelete(folder.id)}><Trash2 className="h-3.5 w-3.5" /></button>
            </>
          )}
        </div>
      </div>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(false); }}
          className="ap-input"
          style={{ padding: '4px 8px', fontSize: '14px', height: '32px' }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <p className="ap-h3 truncate" style={{ fontSize: '15px' }}>{folder.name}</p>
      )}
      <p className="ap-muted" style={{ fontSize: '12px' }}>{itemCount} élément{itemCount !== 1 ? 's' : ''}</p>
    </div>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/FolderCard.tsx
git commit -m "feat(ui): add FolderCard component with DnD droppable + inline rename"
```

---

## Task 4: Create `MoveToFolderMenu` component

**Files:**
- Create: `src/components/MoveToFolderMenu.tsx`

- [ ] **Step 1: Create the file**

```tsx
// src/components/MoveToFolderMenu.tsx
import { FolderInput, FolderMinus } from 'lucide-react';
import type { Folder } from '@/lib/folderStorage';

interface MoveToFolderMenuProps {
  folders: Folder[];
  currentFolderId: string | null | undefined;
  onMove: (folderId: string | null) => void;
}

export const MoveToFolderMenu = ({ folders, currentFolderId, onMove }: MoveToFolderMenuProps) => {
  if (folders.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 50,
        minWidth: '180px',
        background: 'var(--ap-card)',
        border: '2px solid var(--ap-line)',
        borderRadius: 'var(--ap-r-md)',
        boxShadow: 'var(--ap-shadow-float)',
        padding: '6px',
      }}
    >
      {currentFolderId && (
        <>
          <button
            className="ap-btn ap-btn--ghost ap-btn--sm"
            style={{ width: '100%', justifyContent: 'flex-start', gap: '8px', padding: '7px 10px', borderRadius: 'var(--ap-r-sm)', fontWeight: 700, fontSize: '13px' }}
            onClick={() => onMove(null)}
          >
            <FolderMinus className="h-3.5 w-3.5 flex-shrink-0" />
            Retirer du dossier
          </button>
          <div style={{ height: '1px', background: 'var(--ap-line)', margin: '4px 0' }} />
        </>
      )}
      {folders.map((f) => (
        f.id === currentFolderId ? null : (
          <button
            key={f.id}
            className="ap-btn ap-btn--ghost ap-btn--sm"
            style={{ width: '100%', justifyContent: 'flex-start', gap: '8px', padding: '7px 10px', borderRadius: 'var(--ap-r-sm)', fontWeight: 700, fontSize: '13px' }}
            onClick={() => onMove(f.id)}
          >
            <FolderInput className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{f.name}</span>
          </button>
        )
      ))}
    </div>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/MoveToFolderMenu.tsx
git commit -m "feat(ui): add MoveToFolderMenu dropdown component"
```

---

## Task 5: Update `MyQuizzes.tsx`

**Files:**
- Modify: `src/pages/MyQuizzes.tsx`

This is the largest task. Apply the changes below in order.

- [ ] **Step 1: Update imports**

Replace the existing import block at the top of `MyQuizzes.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pagination } from "@/components/Pagination";
import { RatingStars } from "@/components/RatingStars";
import { getCurrentUser } from "@/lib/auth";
import {
  deleteQuiz,
  duplicateQuiz,
  getFavoriteQuizzes,
  getPublicQuizzes,
  getUserQuizzes,
  rateQuiz,
  toggleFavorite,
  type SavedQuiz,
} from "@/lib/quizStorage";
import {
  createFolder,
  deleteFolder,
  getFolderItemCount,
  getFolders,
  moveToFolder,
  renameFolder,
  type Folder,
} from "@/lib/folderStorage";
import { FolderCard } from "@/components/FolderCard";
import { MoveToFolderMenu } from "@/components/MoveToFolderMenu";
import { DeleteQuizDialog } from "@/components/DeleteQuizDialog";
import { DndContext, DragOverlay, type DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { ChevronRight, Copy, Edit, FolderPlus, LayoutGrid, List, Play, Search, Star, Trash2, FolderInput } from "lucide-react";
import { t } from "@/lib/i18n";
import { useCollectionFilters } from "@/hooks/useCollectionFilters";
```

- [ ] **Step 2: Add folder + menu state inside the component**

After the existing state declarations (after `viewMode` state), add:

```tsx
const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
const [folders, setFolders] = useState<Folder[]>([]);
const [newFolderName, setNewFolderName] = useState("");
const [showNewFolderInput, setShowNewFolderInput] = useState(false);
const [moveMenuOpenId, setMoveMenuOpenId] = useState<string | null>(null);
const moveMenuRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 3: Load folders alongside quizzes**

Replace `loadQuizzes` callback with:

```tsx
const loadQuizzes = useCallback(() => {
  if (!user) return;
  const userQuizzes = getUserQuizzes(user.id);
  const publicQuizzesData = getPublicQuizzes();
  const favorite = getFavoriteQuizzes(user.id);
  setMyQuizzes(userQuizzes.filter((q) => q.type === "quiz"));
  setPublicQuizzes(publicQuizzesData.filter((q) => q.type === "quiz"));
  setFavoriteQuizzes(favorite.filter((q) => q.type === "quiz"));
  setFolders(getFolders(user.id, "quiz"));
}, [user]);
```

- [ ] **Step 4: Add click-outside handler for move menu**

Add inside the component (after loadQuizzes):

```tsx
useEffect(() => {
  const handler = (e: globalThis.MouseEvent) => {
    if (moveMenuRef.current && !moveMenuRef.current.contains(e.target as Node)) {
      setMoveMenuOpenId(null);
    }
  };
  document.addEventListener("mousedown", handler);
  return () => document.removeEventListener("mousedown", handler);
}, []);
```

- [ ] **Step 5: Add folder action handlers**

Add after `handleRateQuiz`:

```tsx
const handleCreateFolder = () => {
  const name = newFolderName.trim();
  if (!name || !user) return;
  createFolder(name, user.id, "quiz");
  setNewFolderName("");
  setShowNewFolderInput(false);
  loadQuizzes();
  toast.success(`Dossier "${name}" créé`);
};

const handleRenameFolder = (id: string, name: string) => {
  renameFolder(id, name);
  loadQuizzes();
};

const handleDeleteFolder = (id: string) => {
  const folder = folders.find((f) => f.id === id);
  deleteFolder(id);
  if (currentFolderId === id) setCurrentFolderId(null);
  loadQuizzes();
  if (folder) toast.success(`Dossier "${folder.name}" supprimé`);
};

const handleMoveToFolder = (quizId: string, folderId: string | null) => {
  moveToFolder(quizId, folderId);
  loadQuizzes();
  setMoveMenuOpenId(null);
};

const handleDuplicateQuiz = (e: MouseEvent, id: string) => {
  e.stopPropagation();
  const copy = duplicateQuiz(id);
  if (copy) { toast.success(`"${copy.title}" créé`); loadQuizzes(); }
};

const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  if (over && folders.some((f) => f.id === over.id)) {
    moveToFolder(String(active.id), String(over.id));
    loadQuizzes();
    toast.success("Déplacé dans le dossier");
  }
};
```

- [ ] **Step 6: Filter items by current folder in `renderTabContent`**

In the `renderTabContent` function, before calling `useCollectionFilters`, the items need to be pre-filtered by folder. The page currently passes `allItems` directly to `filtersFor`. Instead, compute `folderItems` in the tab content:

In `renderTabContent`, change the existing empty-state check and filter rendering to this:

```tsx
const renderTabContent = (tab: string, allItems: SavedQuiz[], emptyKey: string, ctaKey?: string, showActions = true) => {
  const isMyTab = tab === "my";
  const folderItems = isMyTab && currentFolderId
    ? allItems.filter((q) => q.folderId === currentFolderId)
    : isMyTab
    ? allItems.filter((q) => !q.folderId)
    : allItems;

  const f = filtersFor(tab);

  // The hook receives allItems but we override paginated for folder view
  // Re-derive filtered items from folderItems for consistency
  const displayedItems = folderItems;

  if (allItems.length === 0) return (
    <div style={{ borderRadius: "var(--ap-r-lg)", border: "2px dashed var(--ap-line-2)", background: "var(--ap-paper-2)", padding: "48px 24px", textAlign: "center" }}>
      <p className="ap-muted" style={{ fontSize: "14px", marginBottom: ctaKey ? "16px" : 0 }}>{t(emptyKey as any)}</p>
      {ctaKey && <button className="ap-btn ap-btn--sm ap-btn--pill" onClick={() => navigate('/builder-start?type=quiz')}>{t(ctaKey as any)}</button>}
    </div>
  );

  const rootFolders = isMyTab && !currentFolderId ? folders : [];

  return (
    <>
      {renderFilters(tab)}

      {/* Folder strip (only on my tab at root) */}
      {rootFolders.length > 0 && (
        <div className={viewMode === "grid" ? "grid gap-4 md:grid-cols-3 lg:grid-cols-4 mb-6" : "ap-card mb-6"} style={viewMode === "list" ? { padding: 0, overflow: "hidden" } : {}}>
          {rootFolders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              itemCount={getFolderItemCount(folder.id, user!.id, "quiz")}
              viewMode={viewMode}
              onClick={() => setCurrentFolderId(folder.id)}
              onRename={handleRenameFolder}
              onDelete={handleDeleteFolder}
            />
          ))}
        </div>
      )}

      {displayedItems.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">
          {currentFolderId ? "Aucun quiz dans ce dossier." : "Aucun résultat pour cette recherche."}
        </p>
      ) : viewMode === "grid" ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {displayedItems.map((q) => renderQuizCard(q, showActions))}
        </div>
      ) : (
        <div className="ap-card" style={{ padding: 0, overflow: "hidden" }}>
          {displayedItems.map((q) => renderQuizRow(q, showActions))}
        </div>
      )}
      <Pagination page={f.page} totalPages={Math.max(1, Math.ceil(displayedItems.length / 12))} onPageChange={f.setPage} className="mt-8" />
    </>
  );
};
```

- [ ] **Step 7: Add duplicate + move buttons to `renderQuizCard`**

In `renderQuizCard`, inside the actions block where Edit and Trash2 buttons are, add after the Edit button and before the Trash2 button:

```tsx
{showActions && (
  <>
    <button onClick={(e) => handleEditQuiz(e, quiz.id)} title={t("edit")} className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "6px 8px" }}><Edit className="h-3.5 w-3.5" /></button>
    <button onClick={(e) => handleDuplicateQuiz(e, quiz.id)} title="Dupliquer" className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "6px 8px" }}><Copy className="h-3.5 w-3.5" /></button>
    {folders.length > 0 && (
      <div className="relative" ref={moveMenuOpenId === quiz.id ? moveMenuRef : undefined}>
        <button
          onClick={(e) => { e.stopPropagation(); setMoveMenuOpenId(moveMenuOpenId === quiz.id ? null : quiz.id); }}
          title="Déplacer vers"
          className="ap-btn ap-btn--ghost ap-btn--sm"
          style={{ padding: "6px 8px" }}
        >
          <FolderInput className="h-3.5 w-3.5" />
        </button>
        {moveMenuOpenId === quiz.id && (
          <MoveToFolderMenu
            folders={folders}
            currentFolderId={quiz.folderId}
            onMove={(fid) => handleMoveToFolder(quiz.id, fid)}
          />
        )}
      </div>
    )}
    <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(quiz); }} title={t("delete")} className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "6px 8px", color: "var(--ap-quiz)" }}><Trash2 className="h-3.5 w-3.5" /></button>
  </>
)}
```

- [ ] **Step 8: Add duplicate + move buttons to `renderQuizRow`**

Same pattern in `renderQuizRow`:

```tsx
{showActions && (
  <>
    <button onClick={(e) => handleEditQuiz(e, quiz.id)} title={t("edit")} className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "5px" }}><Edit className="h-3.5 w-3.5" /></button>
    <button onClick={(e) => handleDuplicateQuiz(e, quiz.id)} title="Dupliquer" className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "5px" }}><Copy className="h-3.5 w-3.5" /></button>
    {folders.length > 0 && (
      <div className="relative" ref={moveMenuOpenId === quiz.id ? moveMenuRef : undefined}>
        <button
          onClick={(e) => { e.stopPropagation(); setMoveMenuOpenId(moveMenuOpenId === quiz.id ? null : quiz.id); }}
          title="Déplacer vers"
          className="ap-btn ap-btn--ghost ap-btn--sm"
          style={{ padding: "5px" }}
        >
          <FolderInput className="h-3.5 w-3.5" />
        </button>
        {moveMenuOpenId === quiz.id && (
          <MoveToFolderMenu
            folders={folders}
            currentFolderId={quiz.folderId}
            onMove={(fid) => handleMoveToFolder(quiz.id, fid)}
          />
        )}
      </div>
    )}
    <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(quiz); }} title={t("delete")} className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "5px", color: "var(--ap-quiz)" }}><Trash2 className="h-3.5 w-3.5" /></button>
  </>
)}
```

- [ ] **Step 9: Add breadcrumb + folder creation UI + DnD wrapper to the JSX return**

Replace the header section (the `<div className="flex flex-col gap-4 ...">`) with:

```tsx
<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
  <div>
    <h1 className="ap-h2" style={{ fontSize: "26px" }}>
      {currentFolderId
        ? <span className="flex items-center gap-2 flex-wrap">
            <button className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "2px 0", fontWeight: 600, fontSize: "inherit" }} onClick={() => setCurrentFolderId(null)}>{t("myQuizzes")}</button>
            <ChevronRight className="h-5 w-5" style={{ color: "var(--ap-muted)" }} />
            {folders.find((f) => f.id === currentFolderId)?.name ?? "Dossier"}
          </span>
        : t("myQuizzes")
      }
    </h1>
    <p className="ap-muted" style={{ fontSize: "14px" }}>{t("myQuizzesSubtitle")}</p>
  </div>
  <div className="flex items-center gap-2 flex-wrap">
    {showNewFolderInput ? (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') { setShowNewFolderInput(false); setNewFolderName(""); } }}
          placeholder="Nom du dossier"
          className="ap-input"
          style={{ width: '180px', height: '38px', padding: '6px 12px' }}
        />
        <button className="ap-btn ap-btn--sm ap-btn--pill" onClick={handleCreateFolder}>Créer</button>
        <button className="ap-btn ap-btn--sm ap-btn--pill ap-btn--ghost" onClick={() => { setShowNewFolderInput(false); setNewFolderName(""); }}>Annuler</button>
      </div>
    ) : (
      <button className="ap-btn ap-btn--sm ap-btn--pill ap-btn--ghost" onClick={() => setShowNewFolderInput(true)} style={{ gap: '6px' }}>
        <FolderPlus className="h-4 w-4" /> Nouveau dossier
      </button>
    )}
    <button className="ap-btn ap-btn--sm ap-btn--pill ap-btn--quiz" onClick={() => navigate('/builder-start?type=quiz')}>{t("createQuizCta")}</button>
  </div>
</div>
```

Wrap the `<Tabs>` block with `<DndContext onDragEnd={handleDragEnd}>`:

```tsx
<DndContext onDragEnd={handleDragEnd}>
  <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
    {/* ... existing tabs content ... */}
  </Tabs>
</DndContext>
```

- [ ] **Step 10: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add src/pages/MyQuizzes.tsx
git commit -m "feat(quizzes): add folders, duplicate, drag-to-folder in MyQuizzes"
```

---

## Task 6: Update `MyPolls.tsx`

**Files:**
- Modify: `src/pages/MyPolls.tsx`

Apply the same pattern as Task 5 for polls. All diff points are identical except:
- `type: "poll"` everywhere instead of `"quiz"`
- Import `duplicateQuiz` (same function — type field is preserved on copy)
- Navigate to `'/builder-start?type=poll'`
- Toast/label messages reference "sondage" instead of "quiz"
- The item type check in `getFolderItemCount` uses `"poll"`

- [ ] **Step 1: Add imports** (same as Task 5 Step 1, adapted for poll page)

```tsx
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pagination } from "@/components/Pagination";
import { getCurrentUser } from "@/lib/auth";
import {
  deleteQuiz,
  duplicateQuiz,
  getFavoriteQuizzes,
  getPublicQuizzes,
  getUserQuizzes,
  toggleFavorite,
  type SavedQuiz,
} from "@/lib/quizStorage";
import {
  createFolder,
  deleteFolder,
  getFolderItemCount,
  getFolders,
  moveToFolder,
  renameFolder,
  type Folder,
} from "@/lib/folderStorage";
import { FolderCard } from "@/components/FolderCard";
import { MoveToFolderMenu } from "@/components/MoveToFolderMenu";
import { DeleteQuizDialog } from "@/components/DeleteQuizDialog";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { ChevronRight, Copy, Edit, FolderPlus, LayoutGrid, List, Play, Search, Star, Trash2, FolderInput } from "lucide-react";
import { t } from "@/lib/i18n";
import { useCollectionFilters } from "@/hooks/useCollectionFilters";
```

- [ ] **Step 2: Add state** (same variables as Task 5 Step 2)

- [ ] **Step 3: Update `loadPolls`** to call `getFolders(user.id, "poll")`

- [ ] **Step 4: Add click-outside handler** (identical to Task 5 Step 4)

- [ ] **Step 5: Add folder + duplicate handlers** using `type: "poll"` and "sondage" in toast messages:

```tsx
const handleCreateFolder = () => {
  const name = newFolderName.trim();
  if (!name || !user) return;
  createFolder(name, user.id, "poll");
  setNewFolderName(""); setShowNewFolderInput(false);
  loadPolls(); toast.success(`Dossier "${name}" créé`);
};
const handleRenameFolder = (id: string, name: string) => { renameFolder(id, name); loadPolls(); };
const handleDeleteFolder = (id: string) => {
  const folder = folders.find((f) => f.id === id);
  deleteFolder(id);
  if (currentFolderId === id) setCurrentFolderId(null);
  loadPolls();
  if (folder) toast.success(`Dossier "${folder.name}" supprimé`);
};
const handleMoveToFolder = (pollId: string, folderId: string | null) => {
  moveToFolder(pollId, folderId); loadPolls(); setMoveMenuOpenId(null);
};
const handleDuplicatePoll = (e: MouseEvent, id: string) => {
  e.stopPropagation();
  const copy = duplicateQuiz(id);
  if (copy) { toast.success(`"${copy.title}" créé`); loadPolls(); }
};
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  if (over && folders.some((f) => f.id === over.id)) {
    moveToFolder(String(active.id), String(over.id));
    loadPolls(); toast.success("Déplacé dans le dossier");
  }
};
```

- [ ] **Step 6: Update `renderTabContent`** — same logic as Task 5 Step 6 but with `"poll"` for `getFolderItemCount` call and type guard.

- [ ] **Step 7: Add duplicate + move buttons to `renderPollCard` and `renderPollRow`** — same buttons as Task 5 Steps 7 & 8 (swap `quiz.id` → `poll.id`, `handleDuplicateQuiz` → `handleDuplicatePoll`).

- [ ] **Step 8: Update JSX header + wrap tabs in DndContext** — same as Task 5 Step 9, with poll labels:
- "Nouveau dossier" button → `setShowNewFolderInput(true)`
- CTA → `'/builder-start?type=poll'`
- Breadcrumb fallback label `"Dossier"` unchanged

- [ ] **Step 9: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 10: Commit**

```bash
git add src/pages/MyPolls.tsx
git commit -m "feat(polls): add folders, duplicate, drag-to-folder in MyPolls"
```

---

## Task 7: Update `MyFlashcards.tsx`

**Files:**
- Modify: `src/pages/MyFlashcards.tsx`

Apply same pattern as Tasks 5 & 6 with `type: "flashcard"`.

- [ ] **Step 1: Read current imports and state in `MyFlashcards.tsx`**

```bash
head -80 src/pages/MyFlashcards.tsx
```

- [ ] **Step 2: Add imports** (same as Task 5 Step 1, adapted — note flashcard page may not import `rateQuiz` or `RatingStars`; only add what the file already uses plus the new ones)

Key additions:
```tsx
import { duplicateQuiz } from "@/lib/quizStorage";
import { createFolder, deleteFolder, getFolderItemCount, getFolders, moveToFolder, renameFolder, type Folder } from "@/lib/folderStorage";
import { FolderCard } from "@/components/FolderCard";
import { MoveToFolderMenu } from "@/components/MoveToFolderMenu";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { ChevronRight, Copy, FolderPlus, FolderInput } from "lucide-react";
```

- [ ] **Step 3: Add state** (same as Task 5 Step 2)

- [ ] **Step 4: Update `loadFlashcards`** to call `getFolders(user.id, "flashcard")`

- [ ] **Step 5: Add click-outside handler** (identical to Task 5 Step 4)

- [ ] **Step 6: Add handlers** using `type: "flashcard"` in createFolder, and function name `handleDuplicateSet`:

```tsx
const handleDuplicateSet = (e: MouseEvent, id: string) => {
  e.stopPropagation();
  const copy = duplicateQuiz(id);
  if (copy) { toast.success(`"${copy.title}" créé`); loadFlashcards(); }
};
```

- [ ] **Step 7: Update `renderTabContent`** to use `type: "flashcard"` for `getFolderItemCount`.

- [ ] **Step 8: Add duplicate + move buttons to flashcard card and row renders.**

- [ ] **Step 9: Update JSX header + wrap tabs in DndContext** — CTA navigates to `'/builder-start?type=flashcard'`.

- [ ] **Step 10: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 11: Commit**

```bash
git add src/pages/MyFlashcards.tsx
git commit -m "feat(flashcards): add folders, duplicate, drag-to-folder in MyFlashcards"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Duplicate creates "Copie de [name]" → Task 1 Step 2
- [x] Duplicate button on each page → Tasks 5/6/7
- [x] Folder CRUD (create, rename, delete) → Task 2 + Tasks 5-7
- [x] Folders are per-type → `type` param in `getFolders` / `createFolder`
- [x] Flat structure (1 level) → no parent field on Folder
- [x] Move via menu → MoveToFolderMenu, Task 4 + Tasks 5-7
- [x] Move via drag & drop → DndContext + FolderCard droppable, Tasks 5-7
- [x] Delete folder moves items to root → `deleteFolder` in Task 2
- [x] Breadcrumb when inside folder → Task 5 Step 9
- [x] New folder inline input → Task 5 Step 9

**Type consistency:**
- `duplicateQuiz` defined Task 1, imported Tasks 5/6/7 ✓
- `Folder` type defined Task 2, used in FolderCard + pages ✓
- `moveToFolder(quizId, folderId)` signature consistent across all usages ✓
- `getFolderItemCount(folderId, userId, type)` consistent ✓
- `currentFolderId: string | null` consistent ✓
