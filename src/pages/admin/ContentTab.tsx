import { useState } from "react";
import { useAdminRoadmap, useAdminGuides, useAdminFaq, useAdminReleases, useAdminReviews, useContentMutations } from "@/lib/pages/adminHooks";
import type { RoadmapCol, Status } from "@/lib/pages/types";
import { RoadmapBoard } from "./RoadmapBoard";
import { GuidesGrid } from "./GuidesGrid";
import { ChangelogList } from "./ChangelogList";
import { FaqAccordion } from "./FaqAccordion";
import { ReviewsList } from "./ReviewsList";
import { RoadmapEditor } from "./editors/RoadmapEditor";
import { GuideEditor } from "./editors/GuideEditor";
import { FaqEditor } from "./editors/FaqEditor";
import { ChangelogEditor } from "./editors/ChangelogEditor";
import { ReviewEditor } from "./editors/ReviewEditor";

type Res = "roadmap_items" | "guides" | "faq_items" | "changelog_releases" | "reviews";
const RES: { key: Res; label: string; icon: string }[] = [
  { key: "roadmap_items", label: "Roadmap", icon: "🗺️" },
  { key: "guides", label: "Guides", icon: "📚" },
  { key: "faq_items", label: "FAQ", icon: "❓" },
  { key: "changelog_releases", label: "Changelog", icon: "📦" },
  { key: "reviews", label: "Témoignages", icon: "💬" },
];

export const ContentTab = () => {
  const [res, setRes] = useState<Res>("roadmap_items");
  const [editing, setEditing] = useState<{ open: boolean; row?: unknown }>({ open: false });

  const roadmap = useAdminRoadmap();
  const guides = useAdminGuides();
  const faq = useAdminFaq();
  const releases = useAdminReleases();
  const reviews = useAdminReviews();
  const mut = useContentMutations(res);

  const onSave = (values: Record<string, unknown>) => {
    const row = editing.row as { id?: string } | undefined;
    if (row?.id) mut.update.mutate({ id: row.id, patch: values });
    else mut.create.mutate(values);
    setEditing({ open: false });
  };

  // Shared handlers passed to every public-form view.
  const edit = (row: unknown) => setEditing({ open: true, row });
  const toggle = (row: { id: string; status: Status }) =>
    mut.setStatus.mutate({ id: row.id, status: row.status === "published" ? "draft" : "published" });
  const del = (id: string) => mut.remove.mutate(id);

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
      </div>

      {res === "roadmap_items" && (
        <RoadmapBoard
          rows={roadmap.data ?? []}
          onEdit={edit}
          onNew={(col: RoadmapCol) => setEditing({ open: true, row: { col } })}
          onToggleStatus={toggle}
          onDelete={del}
        />
      )}
      {res === "guides" && (
        <GuidesGrid
          rows={guides.data ?? []}
          onEdit={edit}
          onNew={() => setEditing({ open: true, row: undefined })}
          onToggleStatus={toggle}
          onDelete={del}
        />
      )}
      {res === "changelog_releases" && (
        <ChangelogList
          rows={releases.data ?? []}
          onEdit={edit}
          onNew={() => setEditing({ open: true, row: undefined })}
          onToggleStatus={toggle}
          onDelete={del}
        />
      )}
      {res === "faq_items" && (
        <FaqAccordion
          rows={faq.data ?? []}
          onEdit={edit}
          onNew={() => setEditing({ open: true, row: undefined })}
          onToggleStatus={toggle}
          onDelete={del}
        />
      )}
      {res === "reviews" && (
        <ReviewsList
          rows={reviews.data ?? []}
          onEdit={edit}
          onNew={() => setEditing({ open: true, row: undefined })}
          onUnpublish={(row) => mut.update.mutate({ id: row.id, patch: { status: "pending" } })}
          onDelete={del}
        />
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
      {editing.open && res === "reviews" && (
        <ReviewEditor
          open={editing.open}
          onOpenChange={(o) => setEditing({ open: o })}
          initial={editing.row as Parameters<typeof ReviewEditor>[0]["initial"]}
          onSave={onSave}
        />
      )}
    </div>
  );
};
