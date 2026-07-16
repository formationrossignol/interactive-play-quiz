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
    <button className="adm-iconbtn" onClick={onEdit}>✎ Éditer</button>
    <button className="adm-iconbtn pub" onClick={onToggleStatus}>
      {status === "published" ? "◎ Masquer" : "✔ Publier"}
    </button>
    <AlertDialog>
      <AlertDialogTrigger asChild><button className="adm-iconbtn del">🗑</button></AlertDialogTrigger>
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
