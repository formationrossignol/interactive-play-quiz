import { Calendar, Check, CheckCircle2, ChevronUp, Eye, EyeOff, Hammer, Lock, Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { RoadmapAdminRow, RoadmapCol } from "@/lib/pages/types";

const COLS: { key: RoadmapCol; head: string; icon: typeof Eye; cls: string }[] = [
  { key: "idea", head: "À l'étude", icon: Eye, cls: "col-idea" },
  { key: "planned", head: "Planifié", icon: Calendar, cls: "col-planned" },
  { key: "dev", head: "En développement", icon: Hammer, cls: "col-dev" },
  { key: "shipped", head: "Livré", icon: CheckCircle2, cls: "col-shipped" },
];

type Props = {
  rows: RoadmapAdminRow[];
  onEdit: (row: RoadmapAdminRow) => void;
  onNew: (col: RoadmapCol) => void;
  onToggleStatus: (row: RoadmapAdminRow) => void;
  onDelete: (id: string) => void;
};

export const RoadmapBoard = ({ rows, onEdit, onNew, onToggleStatus, onDelete }: Props) => (
  <div className="adm-board">
    {COLS.map((col) => {
      const cards = rows
        .filter((r) => r.col === col.key)
        .sort((a, b) => a.sort - b.sort || b.base_votes - a.base_votes);
      return (
        <div className={`adm-bcol ${col.cls}`} key={col.key}>
          <div className="adm-bcol-head">
            <col.icon className="h-3.5 w-3.5" style={{ flexShrink: 0 }} />
            {col.head}
            <span className="cnt">{cards.length}</span>
          </div>

          {cards.map((c) => (
            <div className={`adm-bcard ${c.status === "published" ? "is-published" : "is-draft"}`} key={c.id}>
              <div className="bc-top">
                <span className="bc-cat">{c.category}</span>
                <span className="bc-votes"><ChevronUp className="h-3 w-3" style={{ display: "inline", verticalAlign: "-1px" }} /> {c.base_votes}</span>
              </div>
              <b>{c.title || "-"}</b>
              {c.subtitle && <small>{c.subtitle}</small>}
              {(c.beta || c.locked || c.status === "draft") && (
                <div className="bc-flags">
                  {c.status === "draft" && <span className="bc-flag">brouillon</span>}
                  {c.beta && <span className="bc-flag">bêta</span>}
                  {c.locked && <span className="bc-flag"><Lock className="h-2.5 w-2.5" style={{ display: "inline", verticalAlign: "-1px" }} /> vote</span>}
                </div>
              )}
              <div className="bc-actions">
                <button className="adm-iconbtn" onClick={() => onEdit(c)}>
                  <span className="adm-iconbtn__inner"><Pencil className="h-3.5 w-3.5" /> Éditer</span>
                </button>
                <button className="adm-iconbtn pub" onClick={() => onToggleStatus(c)}>
                  <span className="adm-iconbtn__inner">
                    {c.status === "published" ? <><EyeOff className="h-3.5 w-3.5" /> Masquer</> : <><Check className="h-3.5 w-3.5" /> Publier</>}
                  </span>
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild><button className="adm-iconbtn del"><Trash2 className="h-3.5 w-3.5" /></button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer « {c.title} » ?</AlertDialogTitle>
                      <AlertDialogDescription>Action irréversible.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDelete(c.id)}>Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}

          <button className="adm-bcol-add" onClick={() => onNew(col.key)}>+ Ajouter une carte</button>
        </div>
      );
    })}
  </div>
);
