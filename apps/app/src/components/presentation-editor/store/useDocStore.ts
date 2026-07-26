import { create } from "zustand";
import type { Presentation, PresentationFooter, Slide, SlideBackground, SlideElement } from "../types/presentation";
import { applySlideLayout, createSlideFromLayout, type SlideLayoutId } from "../layouts/slideLayouts";

interface DocState {
  presentation: Presentation | null;

  load: (presentation: Presentation) => void;
  exportJSON: () => string;
  importJSON: (json: string) => void;
  setTitle: (title: string) => void;
  updateFooter: (patch: Partial<PresentationFooter>) => void;

  addSlide: (afterSlideId?: string, layoutId?: SlideLayoutId) => string;
  duplicateSlide: (slideId: string) => string;
  insertSlideCopy: (slide: Slide, afterSlideId: string) => string;
  deleteSlide: (slideId: string) => void;
  reorderSlides: (slideId: string, toIndex: number) => void;
  toggleSlideHidden: (slideId: string) => void;
  setSlideBackground: (slideId: string, background: SlideBackground | undefined) => void;
  applySlideLayout: (slideId: string, layoutId: SlideLayoutId) => void;

  addElement: (slideId: string, element: SlideElement) => void;
  updateElement: (slideId: string, elementId: string, patch: Partial<SlideElement>) => void;
  updateElements: (slideId: string, patches: { id: string; patch: Partial<SlideElement> }[]) => void;
  removeElement: (slideId: string, elementId: string) => void;
  bringToFront: (slideId: string, elementId: string) => void;
  sendToBack: (slideId: string, elementId: string) => void;
  groupElements: (slideId: string, elementIds: string[]) => string;
  ungroupElements: (slideId: string, groupId: string) => void;
}

function reindex(slides: Slide[]): Slide[] {
  return slides.map((s, i) => ({ ...s, order: i }));
}

function mapSlide(presentation: Presentation, slideId: string, fn: (slide: Slide) => Slide): Presentation {
  return { ...presentation, slides: presentation.slides.map((s) => (s.id === slideId ? fn(s) : s)) };
}

let uid = 0;
function nextId(prefix: string): string {
  uid += 1;
  return `${prefix}-${Date.now()}-${uid}`;
}

function cloneSlide(source: Slide, id: string): Slide {
  const elementIds = new Map(source.elements.map((element) => [element.id, nextId("el")]));
  const elements = source.elements.map((element): SlideElement => {
    const shared = {
      ...element,
      id: elementIds.get(element.id)!,
      groupId: element.groupId ? elementIds.get(element.groupId) : undefined,
    };
    if (element.type === "group") {
      return {
        ...shared,
        childIds: element.childIds.map((childId) => elementIds.get(childId) ?? childId),
      } as SlideElement;
    }
    return shared as SlideElement;
  });
  return { ...source, id, elements };
}

export const useDocStore = create<DocState>((set, get) => ({
  presentation: null,

  load: (presentation) => set({ presentation }),
  exportJSON: () => JSON.stringify(get().presentation),
  importJSON: (json) => set({ presentation: JSON.parse(json) as Presentation }),

  setTitle: (title) => set((state) => {
    if (!state.presentation) return state;
    return { presentation: { ...state.presentation, title } };
  }),

  updateFooter: (patch) => set((state) => {
    if (!state.presentation) return state;
    const current = state.presentation.footer ?? { showSlideNumber: false, text: "", skipTitleSlide: false };
    return { presentation: { ...state.presentation, footer: { ...current, ...patch } } };
  }),

  addSlide: (afterSlideId, layoutId = "title-body") => {
    const id = nextId("slide");
    set((state) => {
      if (!state.presentation) return state;
      const nextSlide = createSlideFromLayout(
        id,
        0,
        layoutId,
        state.presentation.width,
        state.presentation.height,
      );
      const afterIndex = afterSlideId
        ? state.presentation.slides.findIndex((slide) => slide.id === afterSlideId)
        : -1;
      const slides = afterIndex >= 0
        ? reindex([
            ...state.presentation.slides.slice(0, afterIndex + 1),
            nextSlide,
            ...state.presentation.slides.slice(afterIndex + 1),
          ])
        : reindex([...state.presentation.slides, nextSlide]);
      return { presentation: { ...state.presentation, slides } };
    });
    return id;
  },

  duplicateSlide: (slideId) => {
    const newId = nextId("slide");
    set((state) => {
      if (!state.presentation) return state;
      const idx = state.presentation.slides.findIndex((s) => s.id === slideId);
      if (idx === -1) return state;
      const source = state.presentation.slides[idx];
      const copy = cloneSlide(source, newId);
      const slides = reindex([
        ...state.presentation.slides.slice(0, idx + 1),
        copy,
        ...state.presentation.slides.slice(idx + 1),
      ]);
      return { presentation: { ...state.presentation, slides } };
    });
    return newId;
  },

  insertSlideCopy: (source, afterSlideId) => {
    const newId = nextId("slide");
    set((state) => {
      if (!state.presentation) return state;
      const idx = state.presentation.slides.findIndex((slide) => slide.id === afterSlideId);
      if (idx === -1) return state;
      const copy = cloneSlide(source, newId);
      const slides = reindex([
        ...state.presentation.slides.slice(0, idx + 1),
        copy,
        ...state.presentation.slides.slice(idx + 1),
      ]);
      return { presentation: { ...state.presentation, slides } };
    });
    return newId;
  },

  deleteSlide: (slideId) => set((state) => {
    if (!state.presentation || state.presentation.slides.length <= 1) return state;
    const slides = reindex(state.presentation.slides.filter((s) => s.id !== slideId));
    return { presentation: { ...state.presentation, slides } };
  }),

  reorderSlides: (slideId, toIndex) => set((state) => {
    if (!state.presentation) return state;
    const slides = state.presentation.slides.slice();
    const from = slides.findIndex((s) => s.id === slideId);
    if (from === -1 || toIndex < 0 || toIndex >= slides.length) return state;
    const [moved] = slides.splice(from, 1);
    slides.splice(toIndex, 0, moved);
    return { presentation: { ...state.presentation, slides: reindex(slides) } };
  }),

  toggleSlideHidden: (slideId) => set((state) => {
    if (!state.presentation) return state;
    return { presentation: mapSlide(state.presentation, slideId, (s) => ({ ...s, hidden: !s.hidden })) };
  }),

  setSlideBackground: (slideId, background) => set((state) => {
    if (!state.presentation) return state;
    return { presentation: mapSlide(state.presentation, slideId, (s) => ({ ...s, background })) };
  }),

  applySlideLayout: (slideId, layoutId) => set((state) => {
    if (!state.presentation) return state;
    return {
      presentation: mapSlide(state.presentation, slideId, (slide) => (
        applySlideLayout(slide, layoutId, state.presentation!.width, state.presentation!.height)
      )),
    };
  }),

  addElement: (slideId, element) => set((state) => {
    if (!state.presentation) return state;
    return { presentation: mapSlide(state.presentation, slideId, (s) => ({ ...s, elements: [...s.elements, element] })) };
  }),

  updateElement: (slideId, elementId, patch) => set((state) => {
    if (!state.presentation) return state;
    return {
      presentation: mapSlide(state.presentation, slideId, (s) => ({
        ...s,
        elements: s.elements.map((e) => (e.id === elementId ? ({ ...e, ...patch } as SlideElement) : e)),
      })),
    };
  }),

  updateElements: (slideId, patches) => set((state) => {
    if (!state.presentation) return state;
    const byId = new Map(patches.map((p) => [p.id, p.patch]));
    return {
      presentation: mapSlide(state.presentation, slideId, (s) => ({
        ...s,
        elements: s.elements.map((e) => (byId.has(e.id) ? ({ ...e, ...byId.get(e.id) } as SlideElement) : e)),
      })),
    };
  }),

  removeElement: (slideId, elementId) => set((state) => {
    if (!state.presentation) return state;
    return {
      presentation: mapSlide(state.presentation, slideId, (s) => ({
        ...s,
        elements: s.elements.filter((e) => e.id !== elementId),
      })),
    };
  }),

  bringToFront: (slideId, elementId) => set((state) => {
    if (!state.presentation) return state;
    return {
      presentation: mapSlide(state.presentation, slideId, (s) => {
        const maxZ = Math.max(0, ...s.elements.map((e) => e.zIndex));
        return { ...s, elements: s.elements.map((e) => (e.id === elementId ? { ...e, zIndex: maxZ + 1 } : e)) };
      }),
    };
  }),

  sendToBack: (slideId, elementId) => set((state) => {
    if (!state.presentation) return state;
    return {
      presentation: mapSlide(state.presentation, slideId, (s) => {
        const minZ = Math.min(0, ...s.elements.map((e) => e.zIndex));
        return { ...s, elements: s.elements.map((e) => (e.id === elementId ? { ...e, zIndex: minZ - 1 } : e)) };
      }),
    };
  }),

  groupElements: (slideId, elementIds) => {
    const groupId = nextId("group");
    set((state) => {
      if (!state.presentation) return state;
      return {
        presentation: mapSlide(state.presentation, slideId, (s) => {
          const children = s.elements.filter((e) => elementIds.includes(e.id));
          if (children.length === 0) return s;
          const minX = Math.min(...children.map((e) => e.x));
          const minY = Math.min(...children.map((e) => e.y));
          const maxX = Math.max(...children.map((e) => e.x + e.width));
          const maxY = Math.max(...children.map((e) => e.y + e.height));
          const group: SlideElement = {
            id: groupId, type: "group", x: minX, y: minY, width: maxX - minX, height: maxY - minY,
            rotation: 0, zIndex: Math.max(...children.map((e) => e.zIndex)) + 1, opacity: 1, locked: false, visible: true,
            childIds: children.map((c) => c.id),
          };
          return {
            ...s,
            elements: [
              ...s.elements.map((e) => (elementIds.includes(e.id) ? { ...e, groupId } : e)),
              group,
            ],
          };
        }),
      };
    });
    return groupId;
  },

  ungroupElements: (slideId, groupId) => set((state) => {
    if (!state.presentation) return state;
    return {
      presentation: mapSlide(state.presentation, slideId, (s) => ({
        ...s,
        elements: s.elements
          .filter((e) => e.id !== groupId)
          .map((e) => (e.groupId === groupId ? { ...e, groupId: undefined } : e)),
      })),
    };
  }),
}));
