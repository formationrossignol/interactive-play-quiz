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
