import type { ReleaseAdminRow } from "@/lib/pages/types";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { CardActions } from "./CardActions";

type Props = {
  rows: ReleaseAdminRow[];
  onEdit: (row: ReleaseAdminRow) => void;
  onNew: () => void;
  onToggleStatus: (row: ReleaseAdminRow) => void;
  onDelete: (id: string) => void;
};

export const ChangelogList = ({ rows, onEdit, onNew, onToggleStatus, onDelete }: Props) => (
  <div className="adm-rellist">
    {[...rows].sort((a, b) => a.sort - b.sort).map((r) => (
      <div className={`adm-relcard ${r.status === "published" ? "is-published" : "is-draft"}`} key={r.id}>
        <div className="adm-relhead">
          <span className="adm-vtag">{r.version || "—"}</span>
          <h4>{r.title || "—"}</h4>
          {r.date_label && <span className="adm-reldate">{r.date_label}</span>}
        </div>
        {r.intro && <div className="adm-relintro" dangerouslySetInnerHTML={{ __html: sanitizeHtml(r.intro) }} />}
        <CardActions
          status={r.status}
          label={r.version}
          onEdit={() => onEdit(r)}
          onToggleStatus={() => onToggleStatus(r)}
          onDelete={() => onDelete(r.id)}
        />
      </div>
    ))}
    <button className="adm-bcol-add" onClick={onNew}>+ Ajouter une release</button>
  </div>
);
