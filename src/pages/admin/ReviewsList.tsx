import type { ReviewAdminRow } from "@/lib/pages/types";
import { CardActions } from "./CardActions";

const stars = (n: number) => "★★★★★☆☆☆☆☆".slice(5 - n, 10 - n);

type Props = {
  rows: ReviewAdminRow[];
  onEdit: (row: ReviewAdminRow) => void;
  onNew: () => void;
  onUnpublish: (row: ReviewAdminRow) => void;
  onDelete: (id: string) => void;
};

export const ReviewsList = ({ rows, onEdit, onNew, onUnpublish, onDelete }: Props) => (
  <div className="adm-tgrid">
    {[...rows].sort((a, b) => a.sort - b.sort).map((r) => (
      <div className="adm-tcard" key={r.id}>
        <div className="adm-tstars">{stars(r.stars)}</div>
        <p>{r.text}</p>
        <div className="adm-twho">
          <span className="adm-tav">{r.avatar_emoji || "🙂"}</span>
          <div>
            <span className="who-name">{r.author_name || "—"}</span>
            <span className="who-role">{r.author_role}</span>
          </div>
          <span className="adm-tverif">✓ Vérifié</span>
        </div>
        <CardActions
          status={r.status}
          label={r.author_name || r.text.slice(0, 30)}
          onEdit={() => onEdit(r)}
          onToggleStatus={() => onUnpublish(r)}
          onDelete={() => onDelete(r.id)}
        />
      </div>
    ))}
    <button className="adm-bcol-add" style={{ minHeight: 160 }} onClick={onNew}>+ Ajouter un témoignage</button>
  </div>
);
