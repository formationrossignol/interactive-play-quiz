import { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAdminRoadmap, useAdminGuides, useAdminFaq, useAdminReleases, useContentMutations } from "@/lib/pages/adminHooks";
import type { RoadmapAdminRow, RoadmapCol } from "@/lib/pages/types";
import { RoadmapBoard } from "./RoadmapBoard";
import { RoadmapEditor } from "./editors/RoadmapEditor";
import { GuideEditor } from "./editors/GuideEditor";
import { FaqEditor } from "./editors/FaqEditor";
import { ChangelogEditor } from "./editors/ChangelogEditor";

type Res = "roadmap_items" | "guides" | "faq_items" | "changelog_releases";
const RES: { key: Res; label: string; icon: string }[] = [
  { key: "roadmap_items", label: "Roadmap", icon: "🗺️" },
  { key: "guides", label: "Guides", icon: "📚" },
  { key: "faq_items", label: "FAQ", icon: "❓" },
  { key: "changelog_releases", label: "Changelog", icon: "📦" },
];

export const ContentTab = () => {
  const [res, setRes] = useState<Res>("roadmap_items");
  const [editing, setEditing] = useState<{ open: boolean; row?: unknown }>({ open: false });

  const roadmap = useAdminRoadmap();
  const guides = useAdminGuides();
  const faq = useAdminFaq();
  const releases = useAdminReleases();
  const mut = useContentMutations(res);

  const rows: { id: string; label: string; status: string }[] = (() => {
    if (res === "roadmap_items") return (roadmap.data ?? []).map((r) => ({ id: r.id, label: r.title, status: r.status }));
    if (res === "guides") return (guides.data ?? []).map((r) => ({ id: r.id, label: r.title, status: r.status }));
    if (res === "faq_items") return (faq.data ?? []).map((r) => ({ id: r.id, label: r.question, status: r.status }));
    return (releases.data ?? []).map((r) => ({ id: r.id, label: `${r.version} — ${r.title}`, status: r.status }));
  })();
  const fullRow = (id: string): unknown => {
    if (res === "roadmap_items") return roadmap.data?.find((r) => r.id === id);
    if (res === "guides") return guides.data?.find((r) => r.id === id);
    if (res === "faq_items") return faq.data?.find((r) => r.id === id);
    return releases.data?.find((r) => r.id === id);
  };

  const onSave = (values: Record<string, unknown>) => {
    const row = editing.row as { id?: string } | undefined;
    if (row?.id) mut.update.mutate({ id: row.id, patch: values });
    else mut.create.mutate(values);
    setEditing({ open: false });
  };

  const current = RES.find((r) => r.key === res)!;

  return (
    <div className="adm-panel">
      <div className="adm-panel-head">
        <div className="adm-pills">
          {RES.map((r) => (
            <button key={r.key} className={`adm-pill${res === r.key ? " on" : ""}`} onClick={() => setRes(r.key)}>
              {r.icon} {r.label}
            </button>
          ))}
        </div>
        {res !== "roadmap_items" && (
          <button className="adm-btn" onClick={() => setEditing({ open: true, row: undefined })}>+ Nouveau</button>
        )}
      </div>

      {res === "roadmap_items" ? (
        <RoadmapBoard
          rows={(roadmap.data ?? []) as RoadmapAdminRow[]}
          onEdit={(row) => setEditing({ open: true, row })}
          onNew={(col: RoadmapCol) => setEditing({ open: true, row: { col } })}
          onToggleStatus={(row) => mut.setStatus.mutate({ id: row.id, status: row.status === "published" ? "draft" : "published" })}
          onDelete={(id) => mut.remove.mutate(id)}
        />
      ) : rows.length === 0 ? (
        <div className="adm-empty">
          <span className="e-emo">{current.icon}</span>
          Aucun contenu dans « {current.label} » pour le moment.
        </div>
      ) : (
        <div className="adm-rows">
          {rows.map((row) => (
            <div key={row.id} className="adm-row">
              <span className="r-title">{row.label}</span>
              <span className={`adm-status ${row.status === "published" ? "is-published" : "is-draft"}`}>
                {row.status === "published" ? "publié" : "brouillon"}
              </span>
              <div className="r-actions">
                <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setEditing({ open: true, row: fullRow(row.id) })}>Éditer</button>
                <button
                  className={`adm-btn adm-btn--sm ${row.status === "published" ? "adm-btn--ghost" : "adm-btn--pres"}`}
                  onClick={() => mut.setStatus.mutate({ id: row.id, status: row.status === "published" ? "draft" : "published" })}
                >
                  {row.status === "published" ? "Dépublier" : "Publier"}
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild><button className="adm-btn adm-btn--danger adm-btn--sm">Suppr.</button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Supprimer ?</AlertDialogTitle><AlertDialogDescription>Action irréversible.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => mut.remove.mutate(row.id)}>Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing.open && res === "roadmap_items" && (
        <RoadmapEditor
          open={editing.open}
          onOpenChange={(o) => setEditing({ open: o })}
          initial={editing.row as Parameters<typeof RoadmapEditor>[0]["initial"]}
          onSave={onSave}
        />
      )}
      {editing.open && res === "guides" && (
        <GuideEditor
          open={editing.open}
          onOpenChange={(o) => setEditing({ open: o })}
          initial={editing.row as Parameters<typeof GuideEditor>[0]["initial"]}
          onSave={onSave}
        />
      )}
      {editing.open && res === "faq_items" && (
        <FaqEditor
          open={editing.open}
          onOpenChange={(o) => setEditing({ open: o })}
          initial={editing.row as Parameters<typeof FaqEditor>[0]["initial"]}
          onSave={onSave}
        />
      )}
      {editing.open && res === "changelog_releases" && (
        <ChangelogEditor
          open={editing.open}
          onOpenChange={(o) => setEditing({ open: o })}
          initial={editing.row as Parameters<typeof ChangelogEditor>[0]["initial"]}
          onSave={onSave}
        />
      )}
    </div>
  );
};
