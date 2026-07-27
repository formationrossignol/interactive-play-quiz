import { useState } from "react";
import { Map, BookOpen, HelpCircle, Package, MessageSquare, FileText } from "lucide-react";
import { useAdminRoadmap, useAdminGuides, useAdminFaq, useAdminFaqSections, useAdminReleases, useAdminReviews, useContentMutations, useFaqStructureMutation } from "@/lib/pages/adminHooks";
import type { RoadmapCol, Status } from "@/lib/pages/types";
import { RoadmapBoard } from "./RoadmapBoard";
import { GuidesGrid } from "./GuidesGrid";
import { ChangelogList } from "./ChangelogList";
import { FaqAccordion } from "./FaqAccordion";
import { ReviewsList } from "./ReviewsList";
import { StaticPagesList } from "./StaticPagesList";
import { RoadmapEditor } from "./editors/RoadmapEditor";
import { GuideEditor } from "./editors/GuideEditor";
import { FaqEditor } from "./editors/FaqEditor";
import { ChangelogEditor } from "./editors/ChangelogEditor";
import { ReviewEditor } from "./editors/ReviewEditor";

type Res = "roadmap_items" | "guides" | "faq_items" | "changelog_releases" | "reviews" | "static_pages";
const RES: { key: Res; label: string; icon: typeof Map }[] = [
  { key: "roadmap_items", label: "Roadmap", icon: Map },
  { key: "guides", label: "Guides", icon: BookOpen },
  { key: "faq_items", label: "FAQ", icon: HelpCircle },
  { key: "changelog_releases", label: "Changelog", icon: Package },
  { key: "reviews", label: "Témoignages", icon: MessageSquare },
  { key: "static_pages", label: "Pages", icon: FileText },
];

export const ContentTab = () => {
  const [res, setRes] = useState<Res>("roadmap_items");
  const [editing, setEditing] = useState<{ open: boolean; row?: unknown }>({ open: false });

  const roadmap = useAdminRoadmap();
  const guides = useAdminGuides();
  const faq = useAdminFaq();
  const faqSections = useAdminFaqSections();
  const releases = useAdminReleases();
  const reviews = useAdminReviews();
  const mut = useContentMutations(res);
  const faqSectionMut = useContentMutations("faq_sections");
  const faqStructure = useFaqStructureMutation();

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
              <r.icon className="h-3.5 w-3.5" /> {r.label}
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
          sections={faqSections.data ?? []}
          onEdit={edit}
          onNew={(category, sort) => setEditing({ open: true, row: { category, sort } })}
          onNewSection={(title, sort) => faqSectionMut.create.mutate({ title, sort })}
          onDeleteSection={(id) => faqSectionMut.remove.mutate(id)}
          onStructureChange={(sections) => faqStructure.mutate({
            sections: sections.map(({ id, title, sort }) => ({ id, title, sort })),
            items: sections.flatMap((section) => section.items.map(({ id, category, sort }) => ({ id, category, sort }))),
          })}
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
      {res === "static_pages" && <StaticPagesList />}

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
