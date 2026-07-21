import { Copy, Edit, MoreHorizontal, Star, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ExamContextMenuProps {
  isFavorite: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggleFavorite: () => void;
  onTrash: () => void;
}

const menuStyle = {
  minWidth: 188,
  border: "var(--ap-border-w) solid var(--ap-line)",
  background: "var(--ap-card)",
  borderRadius: "var(--ap-r-md)",
};

export const ExamContextMenu = ({
  isFavorite,
  onEdit,
  onDuplicate,
  onToggleFavorite,
  onTrash,
}: ExamContextMenuProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
      <button className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "5px 7px" }} title="Actions">
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" style={menuStyle} onClick={(e) => e.stopPropagation()}>
      <DropdownMenuItem onSelect={onEdit} className="flex items-center gap-2 cursor-pointer text-sm">
        <Edit className="h-3.5 w-3.5" /> Modifier
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onDuplicate} className="flex items-center gap-2 cursor-pointer text-sm">
        <Copy className="h-3.5 w-3.5" /> Dupliquer
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={onToggleFavorite} className="flex items-center gap-2 cursor-pointer text-sm">
        <Star className="h-3.5 w-3.5" style={isFavorite ? { fill: "#fbbf24", color: "#fbbf24" } : {}} />
        {isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
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
