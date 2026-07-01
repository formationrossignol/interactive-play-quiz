import { Check, Copy, Edit, FolderInput, FolderOpen, MoreHorizontal, Share2, Star, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SavedQuiz } from "@/lib/quizStorage";
import type { Folder } from "@/lib/folderStorage";

interface ItemContextMenuProps {
  item: SavedQuiz;
  folders: Folder[];
  onEdit: () => void;
  onDuplicate: () => void;
  onToggleFavorite: () => void;
  onMoveToFolder: (folderId: string | null) => void;
  onShare: () => void;
  onTrash: () => void;
}

const menuContentStyle = {
  minWidth: 188,
  border: "2px solid var(--ap-line)",
  background: "var(--ap-card)",
  borderRadius: "var(--ap-r-md)",
};

export const ItemContextMenu = ({
  item,
  folders,
  onEdit,
  onDuplicate,
  onToggleFavorite,
  onMoveToFolder,
  onShare,
  onTrash,
}: ItemContextMenuProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button
          className="ap-btn ap-btn--ghost ap-btn--sm"
          style={{ padding: "5px 7px" }}
          title="Actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        style={menuContentStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem
          onSelect={onEdit}
          className="flex items-center gap-2 cursor-pointer text-sm"
        >
          <Edit className="h-3.5 w-3.5" /> Modifier
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={onDuplicate}
          className="flex items-center gap-2 cursor-pointer text-sm"
        >
          <Copy className="h-3.5 w-3.5" /> Dupliquer
        </DropdownMenuItem>
        {folders.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2 cursor-pointer text-sm">
              <FolderInput className="h-3.5 w-3.5" /> Déplacer vers
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent style={menuContentStyle}>
              {item.folderId && (
                <DropdownMenuItem
                  onSelect={() => onMoveToFolder(null)}
                  className="flex items-center gap-2 cursor-pointer text-sm"
                >
                  <FolderOpen className="h-3.5 w-3.5" /> Racine
                </DropdownMenuItem>
              )}
              {folders.map((f) => (
                <DropdownMenuItem
                  key={f.id}
                  onSelect={() => onMoveToFolder(f.id)}
                  className="flex items-center gap-2 cursor-pointer text-sm"
                >
                  <span className="w-3.5 flex-shrink-0">
                    {item.folderId === f.id && <Check className="h-3 w-3" />}
                  </span>
                  {f.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        <DropdownMenuItem
          onSelect={onShare}
          className="flex items-center gap-2 cursor-pointer text-sm"
        >
          <Share2 className="h-3.5 w-3.5" /> Partager
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={onToggleFavorite}
          className="flex items-center gap-2 cursor-pointer text-sm"
        >
          <Star
            className="h-3.5 w-3.5"
            style={item.isFavorite ? { fill: "#fbbf24", color: "#fbbf24" } : {}}
          />
          {item.isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={onTrash}
          className="flex items-center gap-2 cursor-pointer text-sm"
          style={{ color: "var(--ap-quiz)" }}
        >
          <Trash2 className="h-3.5 w-3.5" /> Mettre à la corbeille
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
