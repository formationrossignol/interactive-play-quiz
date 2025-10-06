import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteQuizDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  type: 'quiz' | 'poll';
}

export const DeleteQuizDialog = ({ open, onOpenChange, onConfirm, title, type }: DeleteQuizDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmer la suppression</DialogTitle>
          <DialogDescription>
            Êtes-vous sûr de vouloir supprimer {type === 'quiz' ? 'le quiz' : 'le sondage'} "{title}" ? Cette action est irréversible.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Supprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
