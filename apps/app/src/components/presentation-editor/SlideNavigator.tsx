import { useState } from "react";
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor, KeyboardSensor, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useDocStore } from "./store/useDocStore";
import { useEditorUIStore } from "./store/useEditorUIStore";
import { useHistoryStore } from "./store/useHistoryStore";
import { SlideThumbnail } from "./SlideThumbnail";
import type { Slide } from "./types/presentation";
import {
  ClipboardCopy,
  ClipboardPaste,
  CopyPlus,
  Eye,
  EyeOff,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function snapshotSlide(slide: Slide): Slide {
  return {
    ...slide,
    elements: slide.elements.map((element) => (
      element.type === "group"
        ? { ...element, childIds: [...element.childIds] }
        : { ...element }
    )),
  };
}

export function SlideNavigator() {
  const presentation = useDocStore((s) => s.presentation);
  const activeSlideId = useEditorUIStore((s) => s.activeSlideId);
  const setActiveSlideId = useEditorUIStore((s) => s.setActiveSlideId);
  const [copiedSlide, setCopiedSlide] = useState<Slide | null>(null);

  // Hooks must run unconditionally on every render (Rules of Hooks) — call
  // this before the early return below.
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!presentation) return null;
  const slides = presentation.slides.slice().sort((a, b) => a.order - b.order);
  const ids = slides.map((s) => s.id);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    const reordered = arrayMove(slides, from, to);
    useHistoryStore.getState().commit();
    useDocStore.getState().reorderSlides(String(active.id), to);
    void reordered; // ordering is recomputed by reorderSlides itself; kept for clarity
  }

  function addSlide(afterSlideId?: string) {
    useHistoryStore.getState().commit();
    const id = useDocStore.getState().addSlide(afterSlideId);
    setActiveSlideId(id);
  }

  function duplicateSlide(slideId: string) {
    useHistoryStore.getState().commit();
    const id = useDocStore.getState().duplicateSlide(slideId);
    setActiveSlideId(id);
  }

  function pasteSlide(afterSlideId: string) {
    if (!copiedSlide) return;
    useHistoryStore.getState().commit();
    const id = useDocStore.getState().insertSlideCopy(copiedSlide, afterSlideId);
    setActiveSlideId(id);
  }

  function deleteSlide(slideId: string) {
    if (slides.length <= 1) return;
    const index = slides.findIndex((slide) => slide.id === slideId);
    const fallbackId = slides[index + 1]?.id ?? slides[index - 1]?.id ?? null;
    useHistoryStore.getState().commit();
    useDocStore.getState().deleteSlide(slideId);
    if (activeSlideId === slideId) setActiveSlideId(fallbackId);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, overflowY: "auto", width: 184 }}>
      <button
        className="ap-btn ap-btn--sm ap-btn--pill"
        onClick={() => addSlide()}
      >
        <Plus size={17} aria-hidden="true" />
        Diapositive
      </button>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {slides.map((slide, i) => (
            <div key={slide.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <SlideThumbnail
                slide={slide}
                index={i}
                presentationWidth={presentation.width}
                presentationHeight={presentation.height}
                isActive={slide.id === activeSlideId}
                isSelected={false}
                onSelect={() => setActiveSlideId(slide.id)}
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="ap-btn ap-btn--ghost ap-btn--sm"
                      style={{ padding: "5px 8px" }}
                      title="Actions de la diapositive"
                      aria-label={`Actions de la diapositive ${i + 1}`}
                    >
                      <MoreHorizontal size={17} aria-hidden="true" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    side="right"
                    style={{
                      minWidth: 220,
                      background: "var(--ap-card)",
                      border: "var(--ap-border-w) solid var(--ap-line)",
                      borderRadius: "var(--ap-r-md)",
                      boxShadow: "var(--ap-shadow-card)",
                    }}
                  >
                    <DropdownMenuItem
                      className="flex items-center gap-2 cursor-pointer text-sm"
                      onSelect={() => setCopiedSlide(snapshotSlide(slide))}
                    >
                      <ClipboardCopy className="h-4 w-4" /> Copier
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="flex items-center gap-2 cursor-pointer text-sm"
                      onSelect={() => duplicateSlide(slide.id)}
                    >
                      <CopyPlus className="h-4 w-4" /> Dupliquer
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="flex items-center gap-2 cursor-pointer text-sm"
                      disabled={!copiedSlide}
                      onSelect={() => pasteSlide(slide.id)}
                    >
                      <ClipboardPaste className="h-4 w-4" />
                      <span>Coller</span>
                      {!copiedSlide && <span className="ml-auto text-xs">Copiez d’abord une slide</span>}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="flex items-center gap-2 cursor-pointer text-sm"
                      onSelect={() => addSlide(slide.id)}
                    >
                      <Plus className="h-4 w-4" /> Nouvelle diapositive
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="flex items-center gap-2 cursor-pointer text-sm"
                      onSelect={() => {
                        useHistoryStore.getState().commit();
                        useDocStore.getState().toggleSlideHidden(slide.id);
                      }}
                    >
                      {slide.hidden
                        ? <Eye className="h-4 w-4" />
                        : <EyeOff className="h-4 w-4" />}
                      {slide.hidden ? "Afficher la diapositive" : "Ignorer la diapositive"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="flex items-center gap-2 cursor-pointer text-sm"
                      style={{ color: "var(--ap-quiz)" }}
                      disabled={slides.length <= 1}
                      onSelect={() => deleteSlide(slide.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Supprimer</span>
                      {slides.length <= 1 && <span className="ml-auto text-xs">Une slide minimum</span>}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
