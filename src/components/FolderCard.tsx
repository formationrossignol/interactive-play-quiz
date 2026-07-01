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
