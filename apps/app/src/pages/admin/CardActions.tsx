import { Pencil, EyeOff, Check, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Props = {
  status: string;
  label: string;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
};

/** Shared edit / publish / delete row for public-form admin cards. */
export const CardActions = ({ status, label, onEdit, onToggleStatus, onDelete }: Props) => (
  <div className="adm-cardactions">
    <button className="adm-iconbtn" onClick={onEdit}>
      <span className="adm-iconbtn__inner"><Pencil className="h-3.5 w-3.5" /> Éditer</span>
    </button>
    <button className="adm-iconbtn pub" onClick={onToggleStatus}>
      <span className="adm-iconbtn__inner">
        {status === "published" ? <><EyeOff className="h-3.5 w-3.5" /> Masquer</> : <><Check className="h-3.5 w-3.5" /> Publier</>}
      </span>
    </button>
    <AlertDialog>
      <AlertDialogTrigger asChild><button className="adm-iconbtn del"><Trash2 className="h-3.5 w-3.5" /></button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer « {label} » ?</AlertDialogTitle>
          <AlertDialogDescription>Action irréversible.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete}>Supprimer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
);
