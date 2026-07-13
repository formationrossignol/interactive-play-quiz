/**
 * FolderExplorer — recursive sidebar folder tree (controlled component).
 *
 * DnD id conventions (consumed by the PAGE's DndContext onDragEnd):
 *   - Droppable folder targets:  'folder:<folderId>'   (root/"Tous" is 'folder:root')
 *   - Draggable folder handles:  'movefolder:<folderId>'
 *
 * The page owns the <DndContext>. This component only declares droppables/draggables.
 * On drop, the page inspects active.id / over.id:
 *   - over.id 'folder:root'      -> parent target is null
 *   - over.id 'folder:<id>'      -> parent target is <id>
 *   - active.id 'movefolder:<id>'-> a folder move  -> onMoveFolder(<id>, target)
 *   - active.id anything else    -> a content-item drop -> page moves the item into <target>
 *
 * State: fully controlled via callbacks. The ONLY local state is which nodes are
 * expanded (persisted to localStorage[storageKey]) plus transient inline-edit UI.
 */
import { createContext, useContext, useEffect, useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { FolderNode } from '@/lib/content/foldersRepo';

export interface FolderExplorerProps {
  tree: FolderNode[]; // roots (parent_id === null)
  currentFolderId: string | null; // null = "Tous" (root)
  counts?: Record<string, number>; // folderId -> direct item count (optional badge)
  storageKey: string; // localStorage key for persisted expand state
  onNavigate: (folderId: string | null) => void;
  onCreate: (parentId: string | null, name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onMoveFolder: (id: string, newParentId: string | null) => void;
}

/** DFS: return the ancestor ids (excluding the target itself) on the path to `targetId`. */
function collectAncestorIds(tree: FolderNode[], targetId: string): string[] {
  const found: string[] = [];
  const dfs = (nodes: FolderNode[], trail: string[]): boolean => {
    for (const node of nodes) {
      if (node.id === targetId) {
        found.push(...trail);
        return true;
      }
      if (dfs(node.children, [...trail, node.id])) return true;
    }
    return false;
  };
  dfs(tree, []);
  return found;
}

interface ExplorerCtx {
  currentFolderId: string | null;
  counts?: Record<string, number>;
  expanded: Set<string>;
  toggle: (id: string) => void;
  expand: (id: string) => void;
  onNavigate: (folderId: string | null) => void;
  onCreate: (parentId: string | null, name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
  confirmingId: string | null;
  setConfirmingId: (id: string | null) => void;
  subfolderParentId: string | null;
  setSubfolderParentId: (id: string | null) => void;
}

const Ctx = createContext<ExplorerCtx | null>(null);
const useExplorer = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('FolderExplorer parts must render inside FolderExplorer');
  return ctx;
};

const rowBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  paddingTop: '6px',
  paddingBottom: '6px',
  paddingRight: '8px',
  borderRadius: 'var(--ap-r-sm)',
  fontFamily: 'var(--ap-font-body)',
  fontWeight: 700,
  fontSize: '13px',
  color: 'var(--ap-ink)',
  cursor: 'pointer',
  userSelect: 'none',
};

const iconBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  color: 'var(--ap-muted)',
  cursor: 'pointer',
  padding: '2px',
  borderRadius: '4px',
  flexShrink: 0,
};

const inlineInputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  height: '26px',
  padding: '2px 8px',
  fontFamily: 'var(--ap-font-body)',
  fontWeight: 700,
  fontSize: '13px',
  color: 'var(--ap-ink)',
  background: 'var(--ap-card)',
  border: '2px solid var(--ap-brand)',
  borderRadius: 'var(--ap-r-sm)',
  outline: 'none',
};

const badgeStyle: React.CSSProperties = {
  flexShrink: 0,
  fontSize: '11px',
  fontWeight: 800,
  lineHeight: 1,
  padding: '2px 6px',
  borderRadius: '999px',
  background: 'var(--ap-paper-2)',
  color: 'var(--ap-muted)',
};

/** Inline text input used for both "create" and "rename" affordances. */
const NameInput = ({
  initial,
  placeholder,
  onSubmit,
  onCancel,
  indent,
}: {
  initial: string;
  placeholder?: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
  indent: number;
}) => {
  const [value, setValue] = useState(initial);
  const commit = () => {
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
    else onCancel();
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingLeft: indent, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}>
      <input
        autoFocus
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') onCancel();
        }}
        onClick={(e) => e.stopPropagation()}
        style={inlineInputStyle}
      />
      <button type="button" style={{ ...iconBtn, color: 'var(--ap-brand)' }} title="Valider" onClick={commit}>
        <Check style={{ width: 15, height: 15 }} />
      </button>
      <button type="button" style={iconBtn} title="Annuler" onClick={onCancel}>
        <X style={{ width: 15, height: 15 }} />
      </button>
    </div>
  );
};

const NodeRow = ({ node, depth }: { node: FolderNode; depth: number }) => {
  const ctx = useExplorer();
  const {
    currentFolderId,
    counts,
    expanded,
    toggle,
    expand,
    onNavigate,
    onCreate,
    onRename,
    onDelete,
    renamingId,
    setRenamingId,
    confirmingId,
    setConfirmingId,
    subfolderParentId,
    setSubfolderParentId,
  } = ctx;

  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isCurrent = currentFolderId === node.id;
  const indent = 12 + depth * 16;

  const { isOver, setNodeRef: setDropRef } = useDroppable({ id: `folder:${node.id}` });
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `movefolder:${node.id}`,
  });

  const rowStyle: React.CSSProperties = {
    ...rowBase,
    paddingLeft: indent,
    opacity: isDragging ? 0.4 : 1,
    background: isCurrent
      ? 'var(--ap-brand-soft)'
      : isOver
      ? 'var(--ap-brand-soft)'
      : 'transparent',
    boxShadow: isOver && !isCurrent ? 'inset 0 0 0 2px var(--ap-brand)' : 'none',
    color: isCurrent ? 'var(--ap-brand)' : 'var(--ap-ink)',
  };

  const isRenaming = renamingId === node.id;
  const isConfirming = confirmingId === node.id;

  return (
    <div>
      {isRenaming ? (
        <NameInput
          initial={node.name}
          indent={indent}
          onSubmit={(name) => {
            onRename(node.id, name);
            setRenamingId(null);
          }}
          onCancel={() => setRenamingId(null)}
        />
      ) : (
        <div
          ref={setDropRef}
          style={rowStyle}
          onMouseEnter={(e) => {
            if (!isCurrent && !isOver) e.currentTarget.style.background = 'var(--ap-paper-2)';
          }}
          onMouseLeave={(e) => {
            if (!isCurrent && !isOver) e.currentTarget.style.background = 'transparent';
          }}
        >
          <button
            type="button"
            ref={setDragRef}
            {...attributes}
            {...listeners}
            title="Déplacer le dossier"
            style={{ ...iconBtn, cursor: 'grab', touchAction: 'none' }}
            aria-label={`Déplacer ${node.name}`}
          >
            <GripVertical style={{ width: 13, height: 13 }} />
          </button>

          {hasChildren ? (
            <button
              type="button"
              style={iconBtn}
              title={isExpanded ? 'Réduire' : 'Développer'}
              onClick={(e) => {
                e.stopPropagation();
                toggle(node.id);
              }}
            >
              {isExpanded ? <ChevronDown style={{ width: 15, height: 15 }} /> : <ChevronRight style={{ width: 15, height: 15 }} />}
            </button>
          ) : (
            <span style={{ width: 17, flexShrink: 0 }} />
          )}

          {isExpanded && hasChildren ? (
            <FolderOpen style={{ width: 15, height: 15, flexShrink: 0, color: isCurrent ? 'var(--ap-brand)' : 'var(--ap-muted)' }} />
          ) : (
            <Folder style={{ width: 15, height: 15, flexShrink: 0, color: isCurrent ? 'var(--ap-brand)' : 'var(--ap-muted)' }} />
          )}

          <button
            type="button"
            onClick={() => onNavigate(node.id)}
            title={node.name}
            style={{
              flex: 1,
              minWidth: 0,
              textAlign: 'left',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              fontFamily: 'inherit',
              fontWeight: 'inherit',
              fontSize: 'inherit',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {node.name}
          </button>

          {isConfirming ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ap-quiz)' }}>Confirmer ?</span>
              <button
                type="button"
                style={{ ...iconBtn, color: 'var(--ap-quiz)' }}
                title="Confirmer la suppression"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(node.id);
                  setConfirmingId(null);
                }}
              >
                <Check style={{ width: 14, height: 14 }} />
              </button>
              <button
                type="button"
                style={iconBtn}
                title="Annuler"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmingId(null);
                }}
              >
                <X style={{ width: 14, height: 14 }} />
              </button>
            </span>
          ) : (
            <>
              {counts?.[node.id] != null && counts[node.id] > 0 && (
                <span style={badgeStyle}>{counts[node.id]}</span>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button type="button" style={iconBtn} title="Actions">
                    <MoreHorizontal style={{ width: 15, height: 15 }} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  style={{ minWidth: 180, border: '2px solid var(--ap-line)', background: 'var(--ap-card)', borderRadius: 'var(--ap-r-md)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenuItem
                    className="flex items-center gap-2 cursor-pointer text-sm"
                    onSelect={() => {
                      expand(node.id);
                      setSubfolderParentId(node.id);
                    }}
                  >
                    <FolderPlus className="h-3.5 w-3.5" /> Nouveau sous-dossier
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex items-center gap-2 cursor-pointer text-sm"
                    onSelect={() => setRenamingId(node.id)}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Renommer
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="flex items-center gap-2 cursor-pointer text-sm"
                    style={{ color: 'var(--ap-quiz)' }}
                    onSelect={() => setConfirmingId(node.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      )}

      {subfolderParentId === node.id && (
        <NameInput
          initial=""
          placeholder="Nom du sous-dossier"
          indent={12 + (depth + 1) * 16}
          onSubmit={(name) => {
            onCreate(node.id, name);
            setSubfolderParentId(null);
          }}
          onCancel={() => setSubfolderParentId(null)}
        />
      )}

      {isExpanded &&
        node.children.map((child) => <NodeRow key={child.id} node={child} depth={depth + 1} />)}
    </div>
  );
};

/** The "Tous" (root) row: a droppable target ('folder:root'), not draggable. */
const RootRow = () => {
  const { currentFolderId, onNavigate } = useExplorer();
  const isCurrent = currentFolderId === null;
  const { isOver, setNodeRef } = useDroppable({ id: 'folder:root' });

  return (
    <div
      ref={setNodeRef}
      onClick={() => onNavigate(null)}
      style={{
        ...rowBase,
        paddingLeft: 12,
        gap: '8px',
        background: isCurrent || isOver ? 'var(--ap-brand-soft)' : 'transparent',
        boxShadow: isOver && !isCurrent ? 'inset 0 0 0 2px var(--ap-brand)' : 'none',
        color: isCurrent ? 'var(--ap-brand)' : 'var(--ap-ink)',
      }}
      onMouseEnter={(e) => {
        if (!isCurrent && !isOver) e.currentTarget.style.background = 'var(--ap-paper-2)';
      }}
      onMouseLeave={(e) => {
        if (!isCurrent && !isOver) e.currentTarget.style.background = 'transparent';
      }}
    >
      <span aria-hidden>📁</span>
      <span style={{ flex: 1 }}>Tous</span>
    </div>
  );
};

export const FolderExplorer = ({
  tree,
  currentFolderId,
  counts,
  storageKey,
  onNavigate,
  onCreate,
  onRename,
  onDelete,
  onMoveFolder: _onMoveFolder, // moves are routed by the page's onDragEnd via the documented ids
}: FolderExplorerProps) => {
  void _onMoveFolder;

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    let stored: string[] = [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) stored = JSON.parse(raw);
    } catch {
      stored = [];
    }
    const set = new Set(Array.isArray(stored) ? stored : []);
    // Auto-expand the path to the currently-navigated folder on mount.
    if (currentFolderId) {
      for (const id of collectAncestorIds(tree, currentFolderId)) set.add(id);
    }
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [subfolderParentId, setSubfolderParentId] = useState<string | null>(null);
  const [creatingRoot, setCreatingRoot] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...expanded]));
    } catch {
      /* ignore quota / private-mode errors */
    }
  }, [expanded, storageKey]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const expand = (id: string) =>
    setExpanded((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });

  const ctx: ExplorerCtx = {
    currentFolderId,
    counts,
    expanded,
    toggle,
    expand,
    onNavigate,
    onCreate,
    onRename,
    onDelete,
    renamingId,
    setRenamingId,
    confirmingId,
    setConfirmingId,
    subfolderParentId,
    setSubfolderParentId,
  };

  return (
    <Ctx.Provider value={ctx}>
      <nav aria-label="Dossiers" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <RootRow />

        {tree.map((node) => (
          <NodeRow key={node.id} node={node} depth={0} />
        ))}

        {creatingRoot ? (
          <NameInput
            initial=""
            placeholder="Nom du dossier"
            indent={12}
            onSubmit={(name) => {
              onCreate(currentFolderId, name);
              setCreatingRoot(false);
            }}
            onCancel={() => setCreatingRoot(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setCreatingRoot(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '4px',
              padding: '6px 12px',
              background: 'transparent',
              border: '2px dashed var(--ap-line)',
              borderRadius: 'var(--ap-r-sm)',
              color: 'var(--ap-muted)',
              fontFamily: 'var(--ap-font-body)',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <FolderPlus style={{ width: 15, height: 15 }} /> Nouveau dossier
          </button>
        )}
      </nav>
    </Ctx.Provider>
  );
};

export default FolderExplorer;
