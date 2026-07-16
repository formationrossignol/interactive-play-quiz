import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { RoadmapAdminRow, RoadmapCol } from "@/lib/pages/types";

const COLS: { key: RoadmapCol; head: string; cls: string }[] = [
  { key: "idea", head: "👀 À l'étude", cls: "col-idea" },
  { key: "planned", head: "🗓 Planifié", cls: "col-planned" },
  { key: "dev", head: "🔨 En développement", cls: "col-dev" },
  { key: "shipped", head: "✅ Livré", cls: "col-shipped" },
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
            {col.head}
            <span className="cnt">{cards.length}</span>
          </div>

          {cards.map((c) => (
            <div className={`adm-bcard ${c.status === "published" ? "is-published" : "is-draft"}`} key={c.id}>
              <div className="bc-top">
                <span className="bc-cat">{c.category}</span>
                <span className="bc-votes">▲ {c.base_votes}</span>
              </div>
              <b>{c.title || "—"}</b>
              {c.subtitle && <small>{c.subtitle}</small>}
              {(c.beta || c.locked || c.status === "draft") && (
                <div className="bc-flags">
                  {c.status === "draft" && <span className="bc-flag">brouillon</span>}
                  {c.beta && <span className="bc-flag">bêta</span>}
                  {c.locked && <span className="bc-flag">🔒 vote</span>}
                </div>
              )}
              <div className="bc-actions">
                <button className="adm-iconbtn" onClick={() => onEdit(c)}>✎ Éditer</button>
                <button className="adm-iconbtn pub" onClick={() => onToggleStatus(c)}>
                  {c.status === "published" ? "◎ Masquer" : "✔ Publier"}
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild><button className="adm-iconbtn del">🗑</button></AlertDialogTrigger>
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
