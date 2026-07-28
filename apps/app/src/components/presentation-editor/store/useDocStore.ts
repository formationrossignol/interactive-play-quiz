import { create } from "zustand";
import type { Presentation, Slide, SlideBackground, SlideElement } from "../types/presentation";
import { blankRichText } from "../utils/createElement";

interface DocState {
  presentation: Presentation | null;

  load: (presentation: Presentation) => void;
  exportJSON: () => string;
  importJSON: (json: string) => void;
  setTitle: (title: string) => void;

  addSlide: () => string;
  duplicateSlide: (slideId: string) => string;
  deleteSlide: (slideId: string) => void;
  reorderSlides: (slideId: string, toIndex: number) => void;
  toggleSlideHidden: (slideId: string) => void;
  setSlideBackground: (slideId: string, background: SlideBackground | undefined) => void;

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

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function isValidRichText(v: unknown): boolean {
  return !!v && typeof v === "object" && (v as { type?: unknown }).type === "doc" && Array.isArray((v as { content?: unknown }).content);
}

/** Defends against malformed data reaching the store — from an imported
 *  .json file with no schema of its own, or a legacy/hand-edited Supabase
 *  content row. Missing/non-finite geometry becomes 0 rather than NaN
 *  propagating into style props and layout math elsewhere (drag, marquee
 *  intersection, group bounding box); invalid richText (the actual crash
 *  site — see TextElementView) becomes a blank doc instead of whatever
 *  garbage was stored. Elements with no id/type at all are dropped.
 */
function sanitizePresentation(raw: Presentation): Presentation {
  return {
    ...raw,
    slides: (raw.slides ?? []).map((slide) => ({
      ...slide,
      elements: (slide.elements ?? [])
        .filter((el): el is SlideElement => !!el && typeof el === "object" && typeof el.id === "string" && typeof el.type === "string")
        .map((el) => {
          const base = {
            ...el,
            x: num(el.x, 0),
            y: num(el.y, 0),
            width: num(el.width, 100),
            height: num(el.height, 100),
            rotation: num(el.rotation, 0),
            zIndex: num(el.zIndex, 0),
            opacity: typeof el.opacity === "number" && Number.isFinite(el.opacity) ? el.opacity : 1,
          };
          if (base.type === "text" && !isValidRichText(base.richText)) {
            return { ...base, richText: blankRichText() };
          }
          return base;
        }),
    })),
  };
}

export const useDocStore = create<DocState>((set, get) => ({
  presentation: null,

  load: (presentation) => set({ presentation: sanitizePresentation(presentation) }),
  exportJSON: () => JSON.stringify(get().presentation),
  importJSON: (json) => set({ presentation: sanitizePresentation(JSON.parse(json) as Presentation) }),

  setTitle: (title) => set((state) => {
    if (!state.presentation) return state;
    return { presentation: { ...state.presentation, title } };
  }),

  addSlide: () => {
    const id = nextId("slide");
    set((state) => {
      if (!state.presentation) return state;
      const slides = reindex([...state.presentation.slides, { id, order: 0, hidden: false, elements: [] }]);
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
      // groupId (on children) and childIds (on the group element) reference
      // element ids within THIS slide — copying them verbatim after
      // generating fresh ids would leave the duplicate's group pointing at
      // ids that only exist on the source slide (ungrouping the duplicate
      // would then match nothing and leave stale groupId on its children).
      const idMap = new Map(source.elements.map((e) => [e.id, nextId("el")]));
      const elements = source.elements.map((e) => {
        const copy = { ...e, id: idMap.get(e.id)! };
        if (copy.groupId) copy.groupId = idMap.get(copy.groupId) ?? copy.groupId;
        if (copy.type === "group") copy.childIds = copy.childIds.map((cid) => idMap.get(cid) ?? cid);
        return copy;
      });
      const copy: Slide = { ...source, id: newId, elements };
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
