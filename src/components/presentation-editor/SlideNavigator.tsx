import { DndContext, closestCenter, useSensor, useSensors, PointerSensor, KeyboardSensor, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useDocStore } from "./store/useDocStore";
import { useEditorUIStore } from "./store/useEditorUIStore";
import { useHistoryStore } from "./store/useHistoryStore";
import { SlideThumbnail } from "./SlideThumbnail";

export function SlideNavigator() {
  const presentation = useDocStore((s) => s.presentation);
  const activeSlideId = useEditorUIStore((s) => s.activeSlideId);
  const setActiveSlideId = useEditorUIStore((s) => s.setActiveSlideId);

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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, overflowY: "auto", width: 184 }}>
      <button
        className="ap-btn ap-btn--sm ap-btn--pill"
        onClick={() => {
          useHistoryStore.getState().commit();
          const id = useDocStore.getState().addSlide();
          setActiveSlideId(id);
        }}
      >
        + Diapositive
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
              <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                <button
                  className="ap-btn ap-btn--ghost ap-btn--sm"
                  title="Dupliquer"
                  onClick={() => { useHistoryStore.getState().commit(); useDocStore.getState().duplicateSlide(slide.id); }}
                >
                  ⧉
                </button>
                <button
                  className="ap-btn ap-btn--ghost ap-btn--sm"
                  title={slide.hidden ? "Afficher" : "Masquer"}
                  onClick={() => { useHistoryStore.getState().commit(); useDocStore.getState().toggleSlideHidden(slide.id); }}
                >
                  {slide.hidden ? "👁" : "🚫"}
                </button>
                <button
                  className="ap-btn ap-btn--ghost ap-btn--sm"
                  title="Supprimer"
                  disabled={slides.length <= 1}
                  onClick={() => { useHistoryStore.getState().commit(); useDocStore.getState().deleteSlide(slide.id); }}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
