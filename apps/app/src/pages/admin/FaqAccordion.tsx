import { useEffect, useMemo, useRef, useState } from "react";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, ChevronDown, GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import type { FaqAdminRow, FaqSectionAdminRow } from "@/lib/pages/types";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { CardActions } from "./CardActions";

type SectionState = FaqSectionAdminRow & { items: FaqAdminRow[] };

type Props = {
  rows: FaqAdminRow[];
  sections: FaqSectionAdminRow[];
  onEdit: (row: FaqAdminRow) => void;
  onNew: (category: string, sort: number) => void;
  onNewSection: (title: string, sort: number) => void;
  onDeleteSection: (id: string) => void;
  onStructureChange: (sections: SectionState[]) => void;
  onToggleStatus: (row: FaqAdminRow) => void;
  onDelete: (id: string) => void;
};

const sectionId = (id: string) => `section:${id}`;
const questionId = (id: string) => `question:${id}`;

function normalize(sections: SectionState[]) {
  return sections.map((section, sectionIndex) => ({
    ...section,
    sort: (sectionIndex + 1) * 1000,
    items: section.items.map((item, itemIndex) => ({
      ...item,
      category: section.title,
      sort: (sectionIndex + 1) * 1000 + (itemIndex + 1) * 10,
    })),
  }));
}

function SortableQuestion({
  row,
  onEdit,
  onToggleStatus,
  onDelete,
}: {
  row: FaqAdminRow;
  onEdit: (row: FaqAdminRow) => void;
  onToggleStatus: (row: FaqAdminRow) => void;
  onDelete: (id: string) => void;
}) {
  const sortable = useSortable({ id: questionId(row.id) });
  return (
    <div
      ref={sortable.setNodeRef}
      className={`adm-faqrow ${row.status === "published" ? "is-published" : "is-draft"}`}
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition, opacity: sortable.isDragging ? .55 : undefined }}
    >
      <div className="q">
        <button type="button" className="adm-drag" {...sortable.attributes} {...sortable.listeners} aria-label={`Déplacer ${row.question}`}><GripVertical size={16} /></button>
        {row.status !== "published" && <span className="draftdot">brouillon</span>}
        {row.question || "-"}
      </div>
      <div className="a" dangerouslySetInnerHTML={{ __html: sanitizeHtml(row.answer) }} />
      <CardActions status={row.status} label={row.question} onEdit={() => onEdit(row)} onToggleStatus={() => onToggleStatus(row)} onDelete={() => onDelete(row.id)} />
    </div>
  );
}

function SortableSection({
  section,
  open,
  onOpenChange,
  onRename,
  onNew,
  onDeleteSection,
  onEdit,
  onToggleStatus,
  onDelete,
}: {
  section: SectionState;
  open: boolean;
  onOpenChange: () => void;
  onRename: (title: string) => void;
  onNew: () => void;
  onDeleteSection: () => void;
  onEdit: (row: FaqAdminRow) => void;
  onToggleStatus: (row: FaqAdminRow) => void;
  onDelete: (id: string) => void;
}) {
  const sortable = useSortable({ id: sectionId(section.id) });
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(section.title);
  const renameInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => setDraftTitle(section.title), [section.title]);
  useEffect(() => {
    if (renaming) renameInputRef.current?.focus();
  }, [renaming]);

  const submitRename = () => {
    const title = draftTitle.trim();
    if (title && title !== section.title) onRename(title);
    setRenaming(false);
  };

  return (
    <section
      ref={sortable.setNodeRef}
      className="adm-faqgroup"
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition, opacity: sortable.isDragging ? .55 : undefined }}
    >
      <div className="adm-faqgroup-head">
        <button type="button" className="adm-drag" {...sortable.attributes} {...sortable.listeners} aria-label={`Déplacer la section ${section.title}`}><GripVertical size={17} /></button>
        {renaming ? (
          <form className="adm-faqgroup-rename" onSubmit={(event) => { event.preventDefault(); submitRename(); }}>
            <input ref={renameInputRef} className="ap-input" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} aria-label="Nom de la section" />
            <button type="submit" className="adm-iconbtn" disabled={!draftTitle.trim()} aria-label="Valider le nouveau nom"><Check size={15} /></button>
            <button type="button" className="adm-iconbtn" onClick={() => { setDraftTitle(section.title); setRenaming(false); }} aria-label="Annuler"><X size={15} /></button>
          </form>
        ) : (
          <>
            <button type="button" className="adm-faqgroup-toggle" onClick={onOpenChange} aria-expanded={open}>
              <span>{section.title}</span>
              <span className="adm-tag">{section.items.length}</span>
              <ChevronDown size={17} style={{ transform: open ? "rotate(180deg)" : undefined }} />
            </button>
            <button type="button" className="adm-iconbtn" onClick={() => setRenaming(true)} aria-label={`Renommer ${section.title}`}><Pencil size={15} /></button>
          </>
        )}
        <button type="button" className="adm-iconbtn del" disabled={section.items.length > 0} onClick={onDeleteSection} aria-label={`Supprimer ${section.title}`} title={section.items.length > 0 ? "Supprimez ou déplacez les questions avant de supprimer la section" : "Supprimer la section"}><Trash2 size={15} /></button>
      </div>
      {open && (
        <div className="adm-faqgroup-content">
          <SortableContext items={section.items.map((item) => questionId(item.id))} strategy={verticalListSortingStrategy}>
            {section.items.map((item) => <SortableQuestion key={item.id} row={item} onEdit={onEdit} onToggleStatus={onToggleStatus} onDelete={onDelete} />)}
          </SortableContext>
          <button className="adm-bcol-add" onClick={onNew}><Plus size={15} /> Ajouter une question</button>
        </div>
      )}
    </section>
  );
}

export const FaqAccordion = ({
  rows,
  sections,
  onEdit,
  onNew,
  onNewSection,
  onDeleteSection,
  onStructureChange,
  onToggleStatus,
  onDelete,
}: Props) => {
  const structured = useMemo<SectionState[]>(() => {
    const source = sections.length > 0
      ? [...sections].sort((a, b) => a.sort - b.sort)
      : Array.from(new Set(rows.map((row) => row.category))).map((title, index) => ({ id: `legacy-${index}`, title, sort: index * 1000 }));
    return source.map((section) => ({
      ...section,
      items: rows.filter((row) => row.category === section.title).sort((a, b) => a.sort - b.sort),
    }));
  }, [rows, sections]);
  const [localSections, setLocalSections] = useState(structured);
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(structured.map((section) => section.id)));
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    setLocalSections(structured);
    setOpenSections((current) => new Set([...current, ...structured.map((section) => section.id)]));
  }, [structured]);

  const commit = (next: SectionState[]) => {
    const normalized = normalize(next);
    setLocalSections(normalized);
    onStructureChange(normalized);
  };

  const findQuestion = (id: string) => {
    for (let sectionIndex = 0; sectionIndex < localSections.length; sectionIndex += 1) {
      const itemIndex = localSections[sectionIndex].items.findIndex((item) => questionId(item.id) === id);
      if (itemIndex >= 0) return { sectionIndex, itemIndex };
    }
    return null;
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const activeKey = String(active.id);
    const overKey = String(over.id);
    if (activeKey.startsWith("section:")) {
      const from = localSections.findIndex((section) => sectionId(section.id) === activeKey);
      const targetQuestion = findQuestion(overKey);
      const to = targetQuestion?.sectionIndex ?? localSections.findIndex((section) => sectionId(section.id) === overKey);
      if (from >= 0 && to >= 0) commit(arrayMove(localSections, from, to));
      return;
    }
    const source = findQuestion(activeKey);
    if (!source) return;
    const targetQuestion = findQuestion(overKey);
    const targetSectionIndex = targetQuestion?.sectionIndex ?? localSections.findIndex((section) => sectionId(section.id) === overKey);
    if (targetSectionIndex < 0) return;
    const next = localSections.map((section) => ({ ...section, items: [...section.items] }));
    const [moved] = next[source.sectionIndex].items.splice(source.itemIndex, 1);
    const targetIndex = targetQuestion ? targetQuestion.itemIndex : next[targetSectionIndex].items.length;
    next[targetSectionIndex].items.splice(targetIndex, 0, moved);
    commit(next);
  };

  const rename = (section: SectionState, nextTitle: string) => {
    const title = nextTitle.trim();
    if (!title || title === section.title || localSections.some((item) => item.title === title)) return;
    commit(localSections.map((item) => item.id === section.id ? { ...item, title } : item));
  };

  const createSection = () => {
    const title = newSectionTitle.trim();
    if (!title || localSections.some((section) => section.title === title)) return;
    onNewSection(title, (localSections.length + 1) * 1000);
    setNewSectionTitle("");
  };

  return (
    <div className="adm-faq">
      <div className="adm-faq-create">
        <input className="ap-input" value={newSectionTitle} onChange={(event) => setNewSectionTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") createSection(); }} placeholder="Nom de la nouvelle section" />
        <button className="adm-btn adm-btn--sm" disabled={!newSectionTitle.trim()} onClick={createSection}><Plus size={15} /> Ajouter une section</button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={localSections.map((section) => sectionId(section.id))} strategy={verticalListSortingStrategy}>
          {localSections.map((section) => (
            <SortableSection
              key={section.id}
              section={section}
              open={openSections.has(section.id)}
              onOpenChange={() => setOpenSections((current) => {
                const next = new Set(current);
                if (next.has(section.id)) next.delete(section.id); else next.add(section.id);
                return next;
              })}
              onRename={(title) => rename(section, title)}
              onNew={() => onNew(section.title, section.sort + section.items.length * 10 + 10)}
              onDeleteSection={() => onDeleteSection(section.id)}
              onEdit={onEdit}
              onToggleStatus={onToggleStatus}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
};
