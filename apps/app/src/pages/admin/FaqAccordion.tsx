import type { FaqAdminRow } from "@/lib/pages/types";
import { CardActions } from "./CardActions";

type Props = {
  rows: FaqAdminRow[];
  onEdit: (row: FaqAdminRow) => void;
  onNew: () => void;
  onToggleStatus: (row: FaqAdminRow) => void;
  onDelete: (id: string) => void;
};

export const FaqAccordion = ({ rows, onEdit, onNew, onToggleStatus, onDelete }: Props) => {
  const groups = new Map<string, FaqAdminRow[]>();
  for (const r of [...rows].sort((a, b) => a.sort - b.sort)) {
    const key = r.category || "Sans catégorie";
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }

  return (
    <div className="adm-faq">
      {[...groups.entries()].map(([cat, items]) => (
        <div className="adm-faqgroup" key={cat}>
          <div className="cat">{cat}</div>
          {items.map((f) => (
            <div className={`adm-faqrow ${f.status === "published" ? "is-published" : "is-draft"}`} key={f.id}>
              <div className="q">
                {f.status !== "published" && <span className="draftdot">brouillon</span>}
                {f.question || "—"}
              </div>
              <p className="a">{f.answer}</p>
              <CardActions
                status={f.status}
                label={f.question}
                onEdit={() => onEdit(f)}
                onToggleStatus={() => onToggleStatus(f)}
                onDelete={() => onDelete(f.id)}
              />
            </div>
          ))}
        </div>
      ))}
      <button className="adm-bcol-add" onClick={onNew}>+ Ajouter une question</button>
    </div>
  );
};
