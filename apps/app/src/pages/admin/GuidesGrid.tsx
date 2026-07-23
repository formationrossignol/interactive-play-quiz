import type { GuideAdminRow } from "@/lib/pages/types";
import { CardActions } from "./CardActions";

const LVL: Record<string, string> = { deb: "Débutant", int: "Intermédiaire", avc: "Avancé" };

type Props = {
  rows: GuideAdminRow[];
  onEdit: (row: GuideAdminRow) => void;
  onNew: () => void;
  onToggleStatus: (row: GuideAdminRow) => void;
  onDelete: (id: string) => void;
};

export const GuidesGrid = ({ rows, onEdit, onNew, onToggleStatus, onDelete }: Props) => (
  <div className="adm-ggrid">
    {[...rows].sort((a, b) => a.sort - b.sort).map((g) => (
      <article className={`adm-gcard ${g.status === "published" ? "is-published" : "is-draft"}`} key={g.id}>
        <div className="adm-gcover" style={{ background: `var(${g.cover_token})` }}>
          {g.emoji || "📄"}
          {g.duration_label && <span className="g-dur">{g.duration_label}</span>}
        </div>
        <div className="adm-gbody">
          <h4>{g.title || "—"}</h4>
          <div className="adm-gmeta">
            <span className={`adm-lvl ${g.level}`}>{LVL[g.level] ?? g.level}</span>
            <span className="adm-fmt">{g.format === "video" ? "🎬 Vidéo" : "Article"}</span>
          </div>
          <CardActions
            status={g.status}
            label={g.title}
            onEdit={() => onEdit(g)}
            onToggleStatus={() => onToggleStatus(g)}
            onDelete={() => onDelete(g.id)}
          />
        </div>
      </article>
    ))}
    <button className="adm-bcol-add" style={{ minHeight: 200 }} onClick={onNew}>+ Ajouter un guide</button>
  </div>
);
