# Presentation Canvas Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy question-array `slide` content type with a free-form, single-user canvas presentation editor (text/image/shape/line/video/group elements, drag/resize/rotate/group/align, Tiptap rich text, Supabase Storage media, bounded undo/redo, autosave, a basic fullscreen presentation mode) — data model and editor UI only, no realtime collaboration.

**Architecture:** DOM+SVG rendering (no canvas library) so Tiptap contentEditable and accessibility come for free. Two isolated Zustand stores — `useDocStore` (the persisted document, later swappable for Yjs) and `useEditorUIStore` (ephemeral selection/tool/zoom state) — plus a separate `useHistoryStore` observing document commits. All drag/resize/rotate interaction is imperative (refs + direct DOM style writes) with exactly one store commit per gesture, per the spec's zero-rerenders-mid-drag requirement.

**Tech Stack:** React 18 + TypeScript + Vite, Zustand (new dependency), Tiptap (already a dependency, three new official extensions), Supabase (existing `content` table + new Storage bucket), dnd-kit (already a dependency, for thumbnail reordering), Vitest (existing).

Full design: `docs/superpowers/specs/2026-07-22-presentation-canvas-editor-design.md`.

---

## Task 1: Add dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

Run: `npm install zustand @tiptap/extension-text-style @tiptap/extension-color @tiptap/extension-font-family`

Expected: `package.json`/`package-lock.json` updated, no errors.

- [ ] **Step 2: Verify the app still builds**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed (new deps unused so far, no code changes yet).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add zustand + tiptap text-style/color/font-family extensions"
```

---

## Task 2: Data model types

**Files:**
- Create: `src/components/presentation-editor/types/presentation.ts`

- [ ] **Step 1: Write the types file**

```ts
// src/components/presentation-editor/types/presentation.ts
import type { JSONContent } from "@tiptap/react";

export type PresentationFormat = "16:9" | "4:3" | "custom";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SlideBackground {
  type: "color" | "gradient" | "image";
  value: string; // css color / css gradient string / image URL
}

export interface BaseElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  zIndex: number;
  opacity: number; // 0-1
  locked: boolean;
  visible: boolean;
  groupId?: string;
}

export interface TextElement extends BaseElement {
  type: "text";
  richText: JSONContent;
}

export interface ImageElement extends BaseElement {
  type: "image";
  src: string;
  crop?: Rect;
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
}

export interface ShapeElement extends BaseElement {
  type: "rect" | "circle";
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface LineElement extends BaseElement {
  type: "line" | "arrow";
  points: [number, number][];
  stroke: string;
  strokeWidth: number;
}

export interface VideoElement extends BaseElement {
  type: "video";
  src: string;
  provider: "upload" | "youtube" | "vimeo";
}

export interface GroupElement extends BaseElement {
  type: "group";
  childIds: string[];
}

export type SlideElement =
  | TextElement
  | ImageElement
  | ShapeElement
  | LineElement
  | VideoElement
  | GroupElement;

export interface Slide {
  id: string;
  order: number;
  hidden: boolean;
  background?: SlideBackground;
  elements: SlideElement[];
}

export interface Presentation {
  id: string;
  title: string;
  format: PresentationFormat;
  width: number;
  height: number;
  themeId?: string; // forward-compat placeholder only, unused in this phase
  slides: Slide[];
}

export const PRESENTATION_FORMAT_SIZE: Record<Exclude<PresentationFormat, "custom">, { width: number; height: number }> = {
  "16:9": { width: 1280, height: 720 },
  "4:3": { width: 1024, height: 768 },
};

export function createBlankPresentation(id: string, title = "Sans titre"): Presentation {
  const slideId = `${id}-s1`;
  return {
    id,
    title,
    format: "16:9",
    width: PRESENTATION_FORMAT_SIZE["16:9"].width,
    height: PRESENTATION_FORMAT_SIZE["16:9"].height,
    slides: [{ id: slideId, order: 0, hidden: false, elements: [] }],
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors (unused-export warnings are not errors here; every export is consumed by later tasks).

- [ ] **Step 3: Commit**

```bash
git add src/components/presentation-editor/types/presentation.ts
git commit -m "feat(presentation-editor): data model types"
```

---

## Task 3: Legacy `slide` migration converter

**Files:**
- Create: `src/components/presentation-editor/utils/migrateLegacySlide.ts`
- Test: `src/components/presentation-editor/utils/__tests__/migrateLegacySlide.test.ts`

The old `slide` content shape is a `SavedQuiz` with `type: 'slide'` and
`questions: [{ type: 'slide', title, content, image }]` (see
`src/lib/quizStorage.ts`, `src/components/SlideEditor.tsx`). Convert each
legacy question into a `Slide` with a title `TextElement`, a body
`TextElement`, and an optional `ImageElement`.

- [ ] **Step 1: Write the failing test**

```ts
// src/components/presentation-editor/utils/__tests__/migrateLegacySlide.test.ts
import { describe, it, expect } from "vitest";
import { isLegacySlideShape, migrateLegacySlideToPresentation } from "../migrateLegacySlide";

describe("isLegacySlideShape", () => {
  it("is true for the old questions[] shape", () => {
    expect(isLegacySlideShape({ questions: [{ type: "slide", title: "A" }] })).toBe(true);
  });
  it("is false for the new slides[] shape", () => {
    expect(isLegacySlideShape({ slides: [] })).toBe(false);
  });
  it("is false for garbage input", () => {
    expect(isLegacySlideShape({})).toBe(false);
    expect(isLegacySlideShape(null)).toBe(false);
  });
});

describe("migrateLegacySlideToPresentation", () => {
  it("converts each legacy question into a slide with title/body/image elements", () => {
    const legacy = {
      id: "quiz-1",
      title: "Ma présentation",
      questions: [
        { title: "Intro", content: "Bienvenue", image: "https://example.com/a.png" },
        { title: "Suite", content: "Sans image" },
      ],
    };

    const pres = migrateLegacySlideToPresentation(legacy);

    expect(pres.id).toBe("quiz-1");
    expect(pres.title).toBe("Ma présentation");
    expect(pres.slides).toHaveLength(2);

    const [s1, s2] = pres.slides;
    expect(s1.order).toBe(0);
    expect(s2.order).toBe(1);

    const titleEl = s1.elements.find((e) => e.type === "text" && e.id.endsWith("-title"));
    const bodyEl = s1.elements.find((e) => e.type === "text" && e.id.endsWith("-body"));
    const imgEl = s1.elements.find((e) => e.type === "image");
    expect(titleEl).toBeDefined();
    expect(bodyEl).toBeDefined();
    expect(imgEl).toMatchObject({ src: "https://example.com/a.png" });

    // second slide has no image in the source -> no image element
    expect(s2.elements.some((e) => e.type === "image")).toBe(false);
  });

  it("gives every slide and element a stable, unique id", () => {
    const legacy = { id: "quiz-2", title: "T", questions: [{ title: "A" }, { title: "B" }] };
    const pres = migrateLegacySlideToPresentation(legacy);
    const ids = pres.slides.flatMap((s) => [s.id, ...s.elements.map((e) => e.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/presentation-editor/utils/__tests__/migrateLegacySlide.test.ts`
Expected: FAIL — `Cannot find module '../migrateLegacySlide'`

- [ ] **Step 3: Write the implementation**

```ts
// src/components/presentation-editor/utils/migrateLegacySlide.ts
import type { Presentation, Slide, TextElement, ImageElement } from "../types/presentation";
import { PRESENTATION_FORMAT_SIZE } from "../types/presentation";

interface LegacyQuestion {
  title?: string;
  content?: string;
  image?: string;
}

interface LegacySlideQuiz {
  id?: string;
  title?: string;
  questions?: LegacyQuestion[];
}

export function isLegacySlideShape(value: unknown): value is LegacySlideQuiz {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.questions) && !Array.isArray(v.slides);
}

function textEl(id: string, x: number, y: number, width: number, height: number, text: string, bold: boolean): TextElement {
  return {
    id, type: "text", x, y, width, height, rotation: 0, zIndex: bold ? 2 : 1, opacity: 1, locked: false, visible: true,
    richText: {
      type: "doc",
      content: [{
        type: "paragraph",
        content: text ? [{ type: "text", marks: bold ? [{ type: "bold" }] : undefined, text }] : [],
      }],
    },
  };
}

function imageEl(id: string, x: number, y: number, width: number, height: number, src: string): ImageElement {
  return {
    id, type: "image", x, y, width, height, rotation: 0, zIndex: 1, opacity: 1, locked: false, visible: true,
    src, borderRadius: 0, borderWidth: 0, borderColor: "transparent",
  };
}

export function migrateLegacySlideToPresentation(legacy: LegacySlideQuiz): Presentation {
  const id = legacy.id ?? `presentation-${Date.now()}`;
  const { width, height } = PRESENTATION_FORMAT_SIZE["16:9"];
  const questions = legacy.questions ?? [];

  const slides: Slide[] = questions.map((q, i) => {
    const slideId = `${id}-slide-${i}`;
    const hasImage = !!q.image;
    const contentWidth = hasImage ? width - 480 : width - 96;

    return {
      id: slideId,
      order: i,
      hidden: false,
      elements: [
        textEl(`${slideId}-title`, 48, 48, contentWidth, 90, q.title ?? "", true),
        textEl(`${slideId}-body`, 48, 160, contentWidth, height - 220, q.content ?? "", false),
        ...(hasImage ? [imageEl(`${slideId}-image`, width - 400, 48, 352, height - 96, q.image as string)] : []),
      ],
    };
  });

  return {
    id,
    title: legacy.title ?? "Sans titre",
    format: "16:9",
    width,
    height,
    slides: slides.length > 0 ? slides : [{ id: `${id}-slide-0`, order: 0, hidden: false, elements: [] }],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/presentation-editor/utils/__tests__/migrateLegacySlide.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/presentation-editor/utils/migrateLegacySlide.ts src/components/presentation-editor/utils/__tests__/migrateLegacySlide.test.ts
git commit -m "feat(presentation-editor): legacy slide -> presentation migration"
```

---

## Task 4: Geometry utilities

**Files:**
- Create: `src/components/presentation-editor/utils/geometry.ts`
- Test: `src/components/presentation-editor/utils/__tests__/geometry.test.ts`

Pure functions for snapping, alignment, distribution, group bounding boxes,
and marquee-selection hit testing. No React, no store — used by both
`useDocStore` actions and the drag hook.

- [ ] **Step 1: Write the failing tests**

```ts
// src/components/presentation-editor/utils/__tests__/geometry.test.ts
import { describe, it, expect } from "vitest";
import {
  rectsIntersect, boundingBoxOf, snapDelta,
  alignLeft, alignCenterH, alignRight, alignTop, alignMiddleV, alignBottom,
  distributeHorizontal, distributeVertical,
} from "../geometry";
import type { BaseElement } from "../../types/presentation";

const el = (id: string, x: number, y: number, width = 100, height = 50): BaseElement => ({
  id, x, y, width, height, rotation: 0, zIndex: 0, opacity: 1, locked: false, visible: true,
});

describe("rectsIntersect", () => {
  it("true for overlapping rects", () => {
    expect(rectsIntersect({ x: 0, y: 0, width: 50, height: 50 }, { x: 25, y: 25, width: 50, height: 50 })).toBe(true);
  });
  it("false for disjoint rects", () => {
    expect(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 100, y: 100, width: 10, height: 10 })).toBe(false);
  });
});

describe("boundingBoxOf", () => {
  it("computes the union rect of multiple elements", () => {
    const box = boundingBoxOf([el("a", 0, 0), el("b", 200, 100, 40, 40)]);
    expect(box).toEqual({ x: 0, y: 0, width: 240, height: 140 });
  });
});

describe("snapDelta", () => {
  it("snaps to another element's edge within threshold", () => {
    // dragged element at x=98 moving toward a static element whose left edge is at x=100
    const dragged = el("dragged", 98, 0);
    const staticEl = el("target", 100, 200);
    const { dx } = snapDelta(dragged, 0, 0, [staticEl], 8);
    expect(dragged.x + dx).toBe(100);
  });
  it("does not snap when outside threshold", () => {
    const dragged = el("dragged", 50, 0);
    const staticEl = el("target", 100, 200);
    const { dx } = snapDelta(dragged, 0, 0, [staticEl], 8);
    expect(dx).toBe(0);
  });
});

describe("alignment", () => {
  const a = el("a", 10, 10, 100, 50);
  const b = el("b", 200, 80, 40, 20);

  it("alignLeft moves both to the min x", () => {
    const out = alignLeft([a, b]);
    expect(out.find((e) => e.id === "a")!.x).toBe(10);
    expect(out.find((e) => e.id === "b")!.x).toBe(10);
  });
  it("alignRight moves both so their right edges match the max right edge", () => {
    const out = alignRight([a, b]);
    const maxRight = Math.max(a.x + a.width, b.x + b.width);
    expect(out.find((e) => e.id === "a")!.x + a.width).toBe(maxRight);
    expect(out.find((e) => e.id === "b")!.x + b.width).toBe(maxRight);
  });
  it("alignCenterH centers both on the same vertical axis", () => {
    const out = alignCenterH([a, b]);
    const ca = out.find((e) => e.id === "a")!;
    const cb = out.find((e) => e.id === "b")!;
    expect(ca.x + ca.width / 2).toBeCloseTo(cb.x + cb.width / 2, 5);
  });
  it("alignTop/alignBottom/alignMiddleV mirror the horizontal ones on the Y axis", () => {
    const top = alignTop([a, b]);
    expect(top.find((e) => e.id === "a")!.y).toBe(10);
    expect(top.find((e) => e.id === "b")!.y).toBe(10);

    const bottom = alignBottom([a, b]);
    const maxBottom = Math.max(a.y + a.height, b.y + b.height);
    expect(bottom.find((e) => e.id === "a")!.y + a.height).toBe(maxBottom);

    const middle = alignMiddleV([a, b]);
    const ma = middle.find((e) => e.id === "a")!;
    const mb = middle.find((e) => e.id === "b")!;
    expect(ma.y + ma.height / 2).toBeCloseTo(mb.y + mb.height / 2, 5);
  });
});

describe("distribute", () => {
  it("distributeHorizontal spaces three elements evenly between the outer two", () => {
    const els = [el("a", 0, 0, 20, 20), el("b", 40, 0, 20, 20), el("c", 300, 0, 20, 20)];
    const out = distributeHorizontal(els);
    const sorted = out.slice().sort((x, y) => x.x - y.x);
    const gap1 = sorted[1].x - (sorted[0].x + sorted[0].width);
    const gap2 = sorted[2].x - (sorted[1].x + sorted[1].width);
    expect(gap1).toBeCloseTo(gap2, 5);
  });
  it("distributeVertical spaces three elements evenly between the outer two", () => {
    const els = [el("a", 0, 0, 20, 20), el("b", 0, 40, 20, 20), el("c", 0, 300, 20, 20)];
    const out = distributeVertical(els);
    const sorted = out.slice().sort((x, y) => x.y - y.y);
    const gap1 = sorted[1].y - (sorted[0].y + sorted[0].height);
    const gap2 = sorted[2].y - (sorted[1].y + sorted[1].height);
    expect(gap1).toBeCloseTo(gap2, 5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/presentation-editor/utils/__tests__/geometry.test.ts`
Expected: FAIL — `Cannot find module '../geometry'`

- [ ] **Step 3: Write the implementation**

```ts
// src/components/presentation-editor/utils/geometry.ts
import type { BaseElement, Rect } from "../types/presentation";

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function boundingBoxOf(elements: BaseElement[]): Rect {
  const minX = Math.min(...elements.map((e) => e.x));
  const minY = Math.min(...elements.map((e) => e.y));
  const maxX = Math.max(...elements.map((e) => e.x + e.width));
  const maxY = Math.max(...elements.map((e) => e.y + e.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Given a dragged element's committed geometry plus a proposed (dx, dy),
 * returns an adjusted (dx, dy) snapped to the nearest matching edge/center
 * of `others` when within `threshold` px. Checks left/center/right edges on
 * X and top/middle/bottom edges on Y independently.
 */
export function snapDelta(
  dragged: BaseElement,
  dx: number,
  dy: number,
  others: BaseElement[],
  threshold: number,
): { dx: number; dy: number } {
  const left = dragged.x + dx;
  const right = left + dragged.width;
  const centerX = left + dragged.width / 2;
  const top = dragged.y + dy;
  const bottom = top + dragged.height;
  const centerY = top + dragged.height / 2;

  let bestDx = dx;
  let bestDxDist = threshold;
  let bestDy = dy;
  let bestDyDist = threshold;

  for (const o of others) {
    const oLeft = o.x, oRight = o.x + o.width, oCenterX = o.x + o.width / 2;
    const oTop = o.y, oBottom = o.y + o.height, oCenterY = o.y + o.height / 2;

    for (const [edge, target] of [[left, oLeft], [right, oRight], [centerX, oCenterX]] as const) {
      const dist = Math.abs(edge - target);
      if (dist < bestDxDist) { bestDxDist = dist; bestDx = dx + (target - edge); }
    }
    for (const [edge, target] of [[top, oTop], [bottom, oBottom], [centerY, oCenterY]] as const) {
      const dist = Math.abs(edge - target);
      if (dist < bestDyDist) { bestDyDist = dist; bestDy = dy + (target - edge); }
    }
  }

  return { dx: bestDx, dy: bestDy };
}

function mapById<T extends BaseElement>(elements: T[], fn: (e: T) => Partial<T>): T[] {
  return elements.map((e) => ({ ...e, ...fn(e) }));
}

export function alignLeft<T extends BaseElement>(elements: T[]): T[] {
  const min = Math.min(...elements.map((e) => e.x));
  return mapById(elements, () => ({ x: min } as Partial<T>));
}
export function alignRight<T extends BaseElement>(elements: T[]): T[] {
  const maxRight = Math.max(...elements.map((e) => e.x + e.width));
  return mapById(elements, (e) => ({ x: maxRight - e.width } as Partial<T>));
}
export function alignCenterH<T extends BaseElement>(elements: T[]): T[] {
  const box = boundingBoxOf(elements);
  const centerX = box.x + box.width / 2;
  return mapById(elements, (e) => ({ x: centerX - e.width / 2 } as Partial<T>));
}
export function alignTop<T extends BaseElement>(elements: T[]): T[] {
  const min = Math.min(...elements.map((e) => e.y));
  return mapById(elements, () => ({ y: min } as Partial<T>));
}
export function alignBottom<T extends BaseElement>(elements: T[]): T[] {
  const maxBottom = Math.max(...elements.map((e) => e.y + e.height));
  return mapById(elements, (e) => ({ y: maxBottom - e.height } as Partial<T>));
}
export function alignMiddleV<T extends BaseElement>(elements: T[]): T[] {
  const box = boundingBoxOf(elements);
  const centerY = box.y + box.height / 2;
  return mapById(elements, (e) => ({ y: centerY - e.height / 2 } as Partial<T>));
}

export function distributeHorizontal<T extends BaseElement>(elements: T[]): T[] {
  if (elements.length < 3) return elements;
  const sorted = elements.slice().sort((a, b) => a.x - b.x);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const totalSpan = (last.x + last.width) - first.x;
  const totalWidth = sorted.reduce((sum, e) => sum + e.width, 0);
  const gap = (totalSpan - totalWidth) / (sorted.length - 1);

  let cursor = first.x + first.width;
  const positioned = new Map<string, number>();
  positioned.set(first.id, first.x);
  for (let i = 1; i < sorted.length - 1; i++) {
    positioned.set(sorted[i].id, cursor + gap);
    cursor = cursor + gap + sorted[i].width;
  }
  positioned.set(last.id, last.x);

  return elements.map((e) => (positioned.has(e.id) ? { ...e, x: positioned.get(e.id)! } : e));
}

export function distributeVertical<T extends BaseElement>(elements: T[]): T[] {
  if (elements.length < 3) return elements;
  const sorted = elements.slice().sort((a, b) => a.y - b.y);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const totalSpan = (last.y + last.height) - first.y;
  const totalHeight = sorted.reduce((sum, e) => sum + e.height, 0);
  const gap = (totalSpan - totalHeight) / (sorted.length - 1);

  let cursor = first.y + first.height;
  const positioned = new Map<string, number>();
  positioned.set(first.id, first.y);
  for (let i = 1; i < sorted.length - 1; i++) {
    positioned.set(sorted[i].id, cursor + gap);
    cursor = cursor + gap + sorted[i].height;
  }
  positioned.set(last.id, last.y);

  return elements.map((e) => (positioned.has(e.id) ? { ...e, y: positioned.get(e.id)! } : e));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/presentation-editor/utils/__tests__/geometry.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/presentation-editor/utils/geometry.ts src/components/presentation-editor/utils/__tests__/geometry.test.ts
git commit -m "feat(presentation-editor): geometry utils (snap/align/distribute)"
```

---

## Task 5: `useDocStore` — the document

**Files:**
- Create: `src/components/presentation-editor/store/useDocStore.ts`
- Test: `src/components/presentation-editor/store/__tests__/useDocStore.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/components/presentation-editor/store/__tests__/useDocStore.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useDocStore } from "../useDocStore";
import { createBlankPresentation } from "../../types/presentation";
import type { ShapeElement } from "../../types/presentation";

const rect = (id: string, overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id, type: "rect", x: 0, y: 0, width: 100, height: 100, rotation: 0, zIndex: 0, opacity: 1, locked: false, visible: true, fill: "#fff",
  ...overrides,
});

beforeEach(() => {
  useDocStore.getState().load(createBlankPresentation("p1"));
});

describe("slide management", () => {
  it("addSlide appends a slide with the next order", () => {
    useDocStore.getState().addSlide();
    const slides = useDocStore.getState().presentation!.slides;
    expect(slides).toHaveLength(2);
    expect(slides[1].order).toBe(1);
  });

  it("duplicateSlide inserts a copy right after the source with a new id", () => {
    const store = useDocStore.getState();
    const originalId = store.presentation!.slides[0].id;
    store.duplicateSlide(originalId);
    const slides = useDocStore.getState().presentation!.slides;
    expect(slides).toHaveLength(2);
    expect(slides[1].id).not.toBe(originalId);
    expect(slides.map((s, i) => s.order)).toEqual([0, 1]);
  });

  it("deleteSlide removes it and reindexes order", () => {
    const store = useDocStore.getState();
    store.addSlide();
    store.addSlide();
    const ids = useDocStore.getState().presentation!.slides.map((s) => s.id);
    store.deleteSlide(ids[1]);
    const slides = useDocStore.getState().presentation!.slides;
    expect(slides).toHaveLength(2);
    expect(slides.map((s) => s.order)).toEqual([0, 1]);
  });

  it("reorderSlides moves a slide to a new index and reindexes order", () => {
    const store = useDocStore.getState();
    store.addSlide();
    store.addSlide();
    const ids = useDocStore.getState().presentation!.slides.map((s) => s.id);
    store.reorderSlides(ids[0], 2);
    const slides = useDocStore.getState().presentation!.slides;
    expect(slides.map((s) => s.id)).toEqual([ids[1], ids[2], ids[0]]);
    expect(slides.map((s) => s.order)).toEqual([0, 1, 2]);
  });

  it("toggleSlideHidden flips the hidden flag", () => {
    const store = useDocStore.getState();
    const id = store.presentation!.slides[0].id;
    store.toggleSlideHidden(id);
    expect(useDocStore.getState().presentation!.slides[0].hidden).toBe(true);
    store.toggleSlideHidden(id);
    expect(useDocStore.getState().presentation!.slides[0].hidden).toBe(false);
  });
});

describe("element management", () => {
  it("addElement appends to the given slide", () => {
    const store = useDocStore.getState();
    const slideId = store.presentation!.slides[0].id;
    store.addElement(slideId, rect("r1"));
    expect(useDocStore.getState().presentation!.slides[0].elements).toHaveLength(1);
  });

  it("updateElement patches only the matching element, in one commit", () => {
    const store = useDocStore.getState();
    const slideId = store.presentation!.slides[0].id;
    store.addElement(slideId, rect("r1"));
    store.addElement(slideId, rect("r2", { x: 500 }));
    store.updateElement(slideId, "r1", { x: 42, y: 7 });
    const elements = useDocStore.getState().presentation!.slides[0].elements;
    expect(elements.find((e) => e.id === "r1")).toMatchObject({ x: 42, y: 7 });
    expect(elements.find((e) => e.id === "r2")).toMatchObject({ x: 500 });
  });

  it("removeElement deletes it", () => {
    const store = useDocStore.getState();
    const slideId = store.presentation!.slides[0].id;
    store.addElement(slideId, rect("r1"));
    store.removeElement(slideId, "r1");
    expect(useDocStore.getState().presentation!.slides[0].elements).toHaveLength(0);
  });

  it("bringToFront/sendToBack reassign zIndex", () => {
    const store = useDocStore.getState();
    const slideId = store.presentation!.slides[0].id;
    store.addElement(slideId, rect("r1", { zIndex: 0 }));
    store.addElement(slideId, rect("r2", { zIndex: 1 }));
    store.bringToFront(slideId, "r1");
    const els = useDocStore.getState().presentation!.slides[0].elements;
    const r1 = els.find((e) => e.id === "r1")!;
    const r2 = els.find((e) => e.id === "r2")!;
    expect(r1.zIndex).toBeGreaterThan(r2.zIndex);
  });

  it("groupElements creates a GroupElement referencing the selected ids and sets their groupId", () => {
    const store = useDocStore.getState();
    const slideId = store.presentation!.slides[0].id;
    store.addElement(slideId, rect("r1"));
    store.addElement(slideId, rect("r2", { x: 200 }));
    const groupId = store.groupElements(slideId, ["r1", "r2"]);
    const els = useDocStore.getState().presentation!.slides[0].elements;
    const group = els.find((e) => e.id === groupId);
    expect(group).toMatchObject({ type: "group", childIds: ["r1", "r2"] });
    expect(els.find((e) => e.id === "r1")!.groupId).toBe(groupId);
    expect(els.find((e) => e.id === "r2")!.groupId).toBe(groupId);
  });

  it("ungroupElements removes the group and clears children's groupId", () => {
    const store = useDocStore.getState();
    const slideId = store.presentation!.slides[0].id;
    store.addElement(slideId, rect("r1"));
    store.addElement(slideId, rect("r2", { x: 200 }));
    const groupId = store.groupElements(slideId, ["r1", "r2"]);
    store.ungroupElements(slideId, groupId);
    const els = useDocStore.getState().presentation!.slides[0].elements;
    expect(els.some((e) => e.id === groupId)).toBe(false);
    expect(els.find((e) => e.id === "r1")!.groupId).toBeUndefined();
  });
});

describe("export/import", () => {
  it("exportJSON/importJSON round-trip the presentation", () => {
    const store = useDocStore.getState();
    const slideId = store.presentation!.slides[0].id;
    store.addElement(slideId, rect("r1"));
    const json = store.exportJSON();
    store.load(createBlankPresentation("other"));
    store.importJSON(json);
    expect(useDocStore.getState().presentation!.id).toBe("p1");
    expect(useDocStore.getState().presentation!.slides[0].elements[0].id).toBe("r1");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/presentation-editor/store/__tests__/useDocStore.test.ts`
Expected: FAIL — `Cannot find module '../useDocStore'`

- [ ] **Step 3: Write the implementation**

```ts
// src/components/presentation-editor/store/useDocStore.ts
import { create } from "zustand";
import type { Presentation, Slide, SlideElement } from "../types/presentation";

interface DocState {
  presentation: Presentation | null;

  load: (presentation: Presentation) => void;
  exportJSON: () => string;
  importJSON: (json: string) => void;

  addSlide: () => string;
  duplicateSlide: (slideId: string) => string;
  deleteSlide: (slideId: string) => void;
  reorderSlides: (slideId: string, toIndex: number) => void;
  toggleSlideHidden: (slideId: string) => void;

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

export const useDocStore = create<DocState>((set, get) => ({
  presentation: null,

  load: (presentation) => set({ presentation }),
  exportJSON: () => JSON.stringify(get().presentation),
  importJSON: (json) => set({ presentation: JSON.parse(json) as Presentation }),

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
      const copy: Slide = {
        ...source,
        id: newId,
        elements: source.elements.map((e) => ({ ...e, id: nextId("el") })),
      };
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
    if (!state.presentation) return state;
    const slides = reindex(state.presentation.slides.filter((s) => s.id !== slideId));
    return { presentation: { ...state.presentation, slides } };
  }),

  reorderSlides: (slideId, toIndex) => set((state) => {
    if (!state.presentation) return state;
    const slides = state.presentation.slides.slice();
    const from = slides.findIndex((s) => s.id === slideId);
    if (from === -1) return state;
    const [moved] = slides.splice(from, 1);
    slides.splice(toIndex, 0, moved);
    return { presentation: { ...state.presentation, slides: reindex(slides) } };
  }),

  toggleSlideHidden: (slideId) => set((state) => {
    if (!state.presentation) return state;
    return { presentation: mapSlide(state.presentation, slideId, (s) => ({ ...s, hidden: !s.hidden })) };
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
            childIds: elementIds,
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/presentation-editor/store/__tests__/useDocStore.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/presentation-editor/store/useDocStore.ts src/components/presentation-editor/store/__tests__/useDocStore.test.ts
git commit -m "feat(presentation-editor): useDocStore (document actions)"
```

---

## Task 6: `useHistoryStore` — bounded undo/redo

**Files:**
- Create: `src/components/presentation-editor/store/useHistoryStore.ts`
- Test: `src/components/presentation-editor/store/__tests__/useHistoryStore.test.ts`

Records `{ presentation }` snapshots on explicit `commit()` calls only (never
on every drag frame — callers control when a commit happens, per the
gesture-based history rule in the spec). Capped at 100 entries.

- [ ] **Step 1: Write the failing tests**

```ts
// src/components/presentation-editor/store/__tests__/useHistoryStore.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useHistoryStore, MAX_HISTORY } from "../useHistoryStore";
import { useDocStore } from "../useDocStore";
import { createBlankPresentation } from "../../types/presentation";

beforeEach(() => {
  useDocStore.getState().load(createBlankPresentation("p1"));
  useHistoryStore.getState().reset();
});

describe("commit/undo/redo", () => {
  it("commit snapshots the current document; undo restores the previous one", () => {
    useHistoryStore.getState().commit();
    useDocStore.getState().addSlide();
    expect(useDocStore.getState().presentation!.slides).toHaveLength(2);

    useHistoryStore.getState().commit();
    useHistoryStore.getState().undo();
    expect(useDocStore.getState().presentation!.slides).toHaveLength(1);
  });

  it("redo re-applies an undone change", () => {
    useHistoryStore.getState().commit();
    useDocStore.getState().addSlide();
    useHistoryStore.getState().commit();

    useHistoryStore.getState().undo();
    expect(useDocStore.getState().presentation!.slides).toHaveLength(1);

    useHistoryStore.getState().redo();
    expect(useDocStore.getState().presentation!.slides).toHaveLength(2);
  });

  it("a new commit after undo discards the redo branch", () => {
    useHistoryStore.getState().commit();
    useDocStore.getState().addSlide();
    useHistoryStore.getState().commit();
    useHistoryStore.getState().undo();

    useDocStore.getState().addSlide();
    useHistoryStore.getState().commit();

    expect(useHistoryStore.getState().canRedo()).toBe(false);
  });

  it("caps the stack at MAX_HISTORY entries", () => {
    for (let i = 0; i < MAX_HISTORY + 20; i++) {
      useDocStore.getState().addSlide();
      useHistoryStore.getState().commit();
    }
    expect(useHistoryStore.getState().past.length).toBeLessThanOrEqual(MAX_HISTORY);
  });

  it("undo/redo are no-ops at the ends of the stack", () => {
    useHistoryStore.getState().undo(); // nothing committed yet
    expect(useDocStore.getState().presentation!.slides).toHaveLength(1);
    useHistoryStore.getState().commit();
    useHistoryStore.getState().redo(); // nothing to redo
    expect(useDocStore.getState().presentation!.slides).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/presentation-editor/store/__tests__/useHistoryStore.test.ts`
Expected: FAIL — `Cannot find module '../useHistoryStore'`

- [ ] **Step 3: Write the implementation**

```ts
// src/components/presentation-editor/store/useHistoryStore.ts
import { create } from "zustand";
import { useDocStore } from "./useDocStore";
import type { Presentation } from "../types/presentation";

export const MAX_HISTORY = 100;

interface HistoryState {
  past: Presentation[];
  future: Presentation[];
  commit: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  reset: () => void;
}

function snapshot(): Presentation | null {
  const p = useDocStore.getState().presentation;
  return p ? (JSON.parse(JSON.stringify(p)) as Presentation) : null;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],

  commit: () => {
    const current = snapshot();
    if (!current) return;
    set((state) => ({
      past: [...state.past, current].slice(-MAX_HISTORY),
      future: [],
    }));
  },

  undo: () => {
    const { past } = get();
    if (past.length === 0) return;
    const current = snapshot();
    const previous = past[past.length - 1];
    set((state) => ({
      past: state.past.slice(0, -1),
      future: current ? [current, ...state.future] : state.future,
    }));
    useDocStore.getState().load(previous);
  },

  redo: () => {
    const { future } = get();
    if (future.length === 0) return;
    const current = snapshot();
    const next = future[0];
    set((state) => ({
      future: state.future.slice(1),
      past: current ? [...state.past, current].slice(-MAX_HISTORY) : state.past,
    }));
    useDocStore.getState().load(next);
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  reset: () => set({ past: [], future: [] }),
}));
```

Note: the first `commit()` in the test suite snapshots the state *before*
the next change, matching how the drag hook (Task 12) and text-edit commit
(Task 14) will call it — right before mutating `useDocStore`, not after.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/presentation-editor/store/__tests__/useHistoryStore.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/presentation-editor/store/useHistoryStore.ts src/components/presentation-editor/store/__tests__/useHistoryStore.test.ts
git commit -m "feat(presentation-editor): useHistoryStore (bounded undo/redo)"
```

---

## Task 7: `useEditorUIStore` — ephemeral UI state

**Files:**
- Create: `src/components/presentation-editor/store/useEditorUIStore.ts`
- Test: `src/components/presentation-editor/store/__tests__/useEditorUIStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/components/presentation-editor/store/__tests__/useEditorUIStore.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useEditorUIStore } from "../useEditorUIStore";

beforeEach(() => useEditorUIStore.getState().reset());

describe("selection", () => {
  it("select replaces the selection; toggleSelect adds/removes", () => {
    const store = useEditorUIStore.getState();
    store.select(["a"]);
    expect([...useEditorUIStore.getState().selectedIds]).toEqual(["a"]);

    store.toggleSelect("b");
    expect(new Set(useEditorUIStore.getState().selectedIds)).toEqual(new Set(["a", "b"]));

    store.toggleSelect("a");
    expect([...useEditorUIStore.getState().selectedIds]).toEqual(["b"]);
  });

  it("clearSelection empties it", () => {
    const store = useEditorUIStore.getState();
    store.select(["a", "b"]);
    store.clearSelection();
    expect(useEditorUIStore.getState().selectedIds.size).toBe(0);
  });
});

describe("zoom", () => {
  it("setZoom clamps between 0.1 and 4", () => {
    const store = useEditorUIStore.getState();
    store.setZoom(10);
    expect(useEditorUIStore.getState().zoom).toBe(4);
    store.setZoom(-1);
    expect(useEditorUIStore.getState().zoom).toBe(0.1);
    store.setZoom(1.5);
    expect(useEditorUIStore.getState().zoom).toBe(1.5);
  });
});

describe("tool and drag flags", () => {
  it("setActiveTool/setDragging update independently of selection", () => {
    const store = useEditorUIStore.getState();
    store.select(["a"]);
    store.setActiveTool("rect");
    store.setDragging(true);
    const state = useEditorUIStore.getState();
    expect(state.activeTool).toBe("rect");
    expect(state.isDragging).toBe(true);
    expect([...state.selectedIds]).toEqual(["a"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/presentation-editor/store/__tests__/useEditorUIStore.test.ts`
Expected: FAIL — `Cannot find module '../useEditorUIStore'`

- [ ] **Step 3: Write the implementation**

```ts
// src/components/presentation-editor/store/useEditorUIStore.ts
import { create } from "zustand";

export type EditorTool = "select" | "text" | "image" | "rect" | "circle" | "line" | "arrow" | "video";

interface EditorUIState {
  selectedIds: Set<string>;
  activeSlideId: string | null;
  activeTool: EditorTool;
  zoom: number;
  isDragging: boolean;
  activePanel: "properties" | null;

  select: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  setActiveSlideId: (id: string | null) => void;
  setActiveTool: (tool: EditorTool) => void;
  setZoom: (zoom: number) => void;
  setDragging: (dragging: boolean) => void;
  setActivePanel: (panel: "properties" | null) => void;
  reset: () => void;
}

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 4;

const initial = {
  selectedIds: new Set<string>(),
  activeSlideId: null as string | null,
  activeTool: "select" as EditorTool,
  zoom: 1,
  isDragging: false,
  activePanel: null as "properties" | null,
};

export const useEditorUIStore = create<EditorUIState>((set) => ({
  ...initial,

  select: (ids) => set({ selectedIds: new Set(ids) }),
  toggleSelect: (id) => set((state) => {
    const next = new Set(state.selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    return { selectedIds: next };
  }),
  clearSelection: () => set({ selectedIds: new Set() }),
  setActiveSlideId: (id) => set({ activeSlideId: id }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setZoom: (zoom) => set({ zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)) }),
  setDragging: (dragging) => set({ isDragging: dragging }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  reset: () => set({ ...initial, selectedIds: new Set() }),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/presentation-editor/store/__tests__/useEditorUIStore.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/presentation-editor/store/useEditorUIStore.ts src/components/presentation-editor/store/__tests__/useEditorUIStore.test.ts
git commit -m "feat(presentation-editor): useEditorUIStore (ephemeral UI state)"
```

---

## Task 8: `presentation-media` Storage bucket + upload helper

**Files:**
- Create: `supabase/migrations/20260723120000_presentation_media_bucket.sql`
- Create: `src/components/presentation-editor/utils/mediaRepo.ts`
- Test: `src/components/presentation-editor/utils/__tests__/mediaRepo.test.ts`

- [ ] **Step 1: Write the storage bucket migration**

```sql
-- supabase/migrations/20260723120000_presentation_media_bucket.sql
-- Storage bucket for presentation-editor image/video uploads. URLs are
-- stored in ImageElement/VideoElement.src; raw bytes never go in content.data.
insert into storage.buckets (id, name, public)
values ('presentation-media', 'presentation-media', true)
on conflict (id) do nothing;

-- Owner-only write, keyed by the first path segment being the uploader's user id
-- (path convention: <user_id>/<presentation_id>/<element_id>.<ext>).
create policy presentation_media_owner_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'presentation-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy presentation_media_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'presentation-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy presentation_media_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'presentation-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- Public read (bucket is public=true above, but an explicit select policy
-- keeps behavior consistent if the bucket is ever flipped to private).
create policy presentation_media_public_read on storage.objects
  for select using (bucket_id = 'presentation-media');
```

- [ ] **Step 2: Write the failing test for validation**

```ts
// src/components/presentation-editor/utils/__tests__/mediaRepo.test.ts
import { describe, it, expect } from "vitest";
import { validateMediaFile } from "../mediaRepo";

function fakeFile(name: string, type: string, sizeBytes: number): File {
  const blob = new Blob([new Uint8Array(sizeBytes)], { type });
  return new File([blob], name, { type });
}

describe("validateMediaFile", () => {
  it("accepts a small png", () => {
    expect(validateMediaFile(fakeFile("a.png", "image/png", 1024))).toEqual({ ok: true });
  });
  it("accepts a small mp4", () => {
    expect(validateMediaFile(fakeFile("a.mp4", "video/mp4", 1024))).toEqual({ ok: true });
  });
  it("rejects an unsupported type", () => {
    expect(validateMediaFile(fakeFile("a.exe", "application/x-msdownload", 1024))).toEqual({
      ok: false, error: "Type de fichier non supporté.",
    });
  });
  it("rejects an image over 10MB", () => {
    expect(validateMediaFile(fakeFile("a.png", "image/png", 11 * 1024 * 1024))).toEqual({
      ok: false, error: "Image trop volumineuse (max 10 Mo).",
    });
  });
  it("rejects a video over 50MB", () => {
    expect(validateMediaFile(fakeFile("a.mp4", "video/mp4", 51 * 1024 * 1024))).toEqual({
      ok: false, error: "Vidéo trop volumineuse (max 50 Mo).",
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/presentation-editor/utils/__tests__/mediaRepo.test.ts`
Expected: FAIL — `Cannot find module '../mediaRepo'`

- [ ] **Step 4: Write the implementation**

```ts
// src/components/presentation-editor/utils/mediaRepo.ts
import { supabase } from "@/lib/supabase";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/webm"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export type MediaValidation = { ok: true } | { ok: false; error: string };

export function validateMediaFile(file: File): MediaValidation {
  if (IMAGE_TYPES.includes(file.type)) {
    return file.size > MAX_IMAGE_BYTES ? { ok: false, error: "Image trop volumineuse (max 10 Mo)." } : { ok: true };
  }
  if (VIDEO_TYPES.includes(file.type)) {
    return file.size > MAX_VIDEO_BYTES ? { ok: false, error: "Vidéo trop volumineuse (max 50 Mo)." } : { ok: true };
  }
  return { ok: false, error: "Type de fichier non supporté." };
}

/**
 * Uploads a validated file to the presentation-media bucket at
 * `<userId>/<presentationId>/<elementId>.<ext>` and returns its public URL.
 * Throws MediaValidationError if `validateMediaFile` would reject the file
 * (call it first in the UI to show an error without attempting the upload).
 */
export class MediaValidationError extends Error {}

export async function uploadPresentationMedia(
  userId: string,
  presentationId: string,
  elementId: string,
  file: File,
): Promise<string> {
  const validation = validateMediaFile(file);
  if (!validation.ok) throw new MediaValidationError(validation.error);

  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${userId}/${presentationId}/${elementId}.${ext}`;

  const { error } = await supabase.storage
    .from("presentation-media")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;

  const { data } = supabase.storage.from("presentation-media").getPublicUrl(path);
  return data.publicUrl;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/presentation-editor/utils/__tests__/mediaRepo.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Apply the migration to the local/dev Supabase project**

Run: `npx supabase db push` (or the Management API HTTPS path already used for this project if port 5432 is firewalled — see `docs/superpowers/specs/2026-07-22-presentation-canvas-editor-design.md` and prior prod-deploy notes for that project).
Expected: bucket + 4 policies created without error.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260723120000_presentation_media_bucket.sql src/components/presentation-editor/utils/mediaRepo.ts src/components/presentation-editor/utils/__tests__/mediaRepo.test.ts
git commit -m "feat(presentation-editor): media storage bucket + upload validation"
```

---

## Task 9: `SlideCanvas` — stage, zoom, static rendering

**Files:**
- Create: `src/components/presentation-editor/SlideCanvas.tsx`
- Create: `src/components/presentation-editor/elements/CanvasElement.tsx`
- Create: `src/components/presentation-editor/elements/TextElementView.tsx`
- Create: `src/components/presentation-editor/elements/ImageElementView.tsx`
- Create: `src/components/presentation-editor/elements/ShapeElementView.tsx`
- Create: `src/components/presentation-editor/elements/LineArrowLayer.tsx`
- Create: `src/components/presentation-editor/elements/VideoElementView.tsx`
- Create: `src/components/presentation-editor/elements/GroupElementView.tsx`

No automated tests for this task (pure rendering, no logic to unit test —
per the spec's testing section). Manual QA step at the end instead.

- [ ] **Step 1: Write the per-type static views**

```tsx
// src/components/presentation-editor/elements/TextElementView.tsx
import { generateHTML } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import type { TextElement } from "../types/presentation";

export const TIPTAP_EXTENSIONS = [
  StarterKit,
  Link,
  Underline,
  TextAlign.configure({ types: ["paragraph", "heading"] }),
  TextStyle,
  Color,
  FontFamily,
];

export function TextElementView({ element }: { element: TextElement }) {
  const html = generateHTML(element.richText, TIPTAP_EXTENSIONS);
  return (
    <div
      style={{ width: "100%", height: "100%", overflow: "hidden" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

```tsx
// src/components/presentation-editor/elements/ImageElementView.tsx
import type { ImageElement } from "../types/presentation";

export function ImageElementView({ element }: { element: ImageElement }) {
  const cropStyle: React.CSSProperties = element.crop
    ? { objectPosition: `-${element.crop.x}px -${element.crop.y}px` }
    : {};
  return (
    <img
      src={element.src}
      alt=""
      style={{
        width: "100%", height: "100%", objectFit: "cover",
        borderRadius: element.borderRadius,
        border: element.borderWidth > 0 ? `${element.borderWidth}px solid ${element.borderColor}` : undefined,
        ...cropStyle,
      }}
      draggable={false}
    />
  );
}
```

```tsx
// src/components/presentation-editor/elements/ShapeElementView.tsx
import type { ShapeElement } from "../types/presentation";

export function ShapeElementView({ element }: { element: ShapeElement }) {
  if (element.type === "circle") {
    return (
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <ellipse cx={50} cy={50} rx={50} ry={50} fill={element.fill} stroke={element.stroke} strokeWidth={element.strokeWidth} />
      </svg>
    );
  }
  return (
    <div style={{ width: "100%", height: "100%", background: element.fill, border: element.stroke ? `${element.strokeWidth ?? 1}px solid ${element.stroke}` : undefined }} />
  );
}
```

```tsx
// src/components/presentation-editor/elements/LineArrowLayer.tsx
import type { LineElement } from "../types/presentation";

/** One shared <svg> for every line/arrow on the slide — see design doc's
 *  rendering rationale (single layer for correct z-order + hit-testing). */
export function LineArrowLayer({ lines, width, height }: { lines: LineElement[]; width: number; height: number }) {
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <polygon points="0 0, 10 5, 0 10" />
        </marker>
      </defs>
      {lines.map((line) => (
        <polyline
          key={line.id}
          points={line.points.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          stroke={line.stroke}
          strokeWidth={line.strokeWidth}
          markerEnd={line.type === "arrow" ? "url(#arrowhead)" : undefined}
        />
      ))}
    </svg>
  );
}
```

```tsx
// src/components/presentation-editor/elements/VideoElementView.tsx
import type { VideoElement } from "../types/presentation";

function embedUrl(element: VideoElement): string | null {
  if (element.provider === "youtube") return element.src.replace("watch?v=", "embed/");
  if (element.provider === "vimeo") return element.src.replace("vimeo.com/", "player.vimeo.com/video/");
  return null;
}

export function VideoElementView({ element }: { element: VideoElement }) {
  if (element.provider === "upload") {
    return <video src={element.src} style={{ width: "100%", height: "100%", objectFit: "cover" }} controls />;
  }
  const url = embedUrl(element);
  return <iframe src={url ?? undefined} style={{ width: "100%", height: "100%", border: "none" }} allowFullScreen title="embed" />;
}
```

```tsx
// src/components/presentation-editor/elements/GroupElementView.tsx
// A group has no visual of its own — its children render themselves at
// their own absolute positions (see Task 4 model note: no nested coordinate
// space). This component exists only so CanvasElement's type router has a
// case for "group" without special-casing it at the call site.
export function GroupElementView() {
  return null;
}
```

- [ ] **Step 2: Write the type router**

```tsx
// src/components/presentation-editor/elements/CanvasElement.tsx
import type { SlideElement } from "../types/presentation";
import { TextElementView } from "./TextElementView";
import { ImageElementView } from "./ImageElementView";
import { ShapeElementView } from "./ShapeElementView";
import { VideoElementView } from "./VideoElementView";
import { GroupElementView } from "./GroupElementView";

interface CanvasElementProps {
  element: SlideElement;
  elementRef: (node: HTMLDivElement | null) => void;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
}

/** Lines/arrows are excluded here — they render in the shared LineArrowLayer,
 *  not as individual positioned divs (see design doc).
 *
 *  `elementRef`/`onPointerDown` attach directly to THIS root div — the one
 *  that actually carries `position: absolute; left; top; width; height`.
 *  Later tasks (drag, resize/rotate) read/write `.style.left/.top/.width/
 *  .height/.transform` on the node they get from `elementRef` — if that ref
 *  ever pointed at a plain wrapper around this div instead of this div
 *  itself, those writes would silently no-op (`left`/`top` only affect
 *  positioned elements). Never wrap this component in another div to attach
 *  handlers — extend these two props instead. */
export function CanvasElement({ element, elementRef, onPointerDown }: CanvasElementProps) {
  if (element.type === "line" || element.type === "arrow") return null;
  if (!element.visible) return null;

  return (
    <div
      ref={elementRef}
      data-element-id={element.id}
      onPointerDown={onPointerDown}
      style={{
        position: "absolute",
        left: element.x, top: element.y,
        width: element.width, height: element.height,
        transform: `rotate(${element.rotation}deg)`,
        opacity: element.opacity,
        zIndex: element.zIndex,
        pointerEvents: element.locked ? "none" : "auto",
      }}
    >
      {element.type === "text" && <TextElementView element={element} />}
      {element.type === "image" && <ImageElementView element={element} />}
      {(element.type === "rect" || element.type === "circle") && <ShapeElementView element={element} />}
      {element.type === "video" && <VideoElementView element={element} />}
      {element.type === "group" && <GroupElementView />}
    </div>
  );
}
```

- [ ] **Step 3: Write `SlideCanvas`**

```tsx
// src/components/presentation-editor/SlideCanvas.tsx
import { useDocStore } from "./store/useDocStore";
import { useEditorUIStore } from "./store/useEditorUIStore";
import { CanvasElement } from "./elements/CanvasElement";
import { LineArrowLayer } from "./elements/LineArrowLayer";
import type { LineElement } from "./types/presentation";

export function SlideCanvas() {
  const presentation = useDocStore((s) => s.presentation);
  const activeSlideId = useEditorUIStore((s) => s.activeSlideId);
  const zoom = useEditorUIStore((s) => s.zoom);

  if (!presentation) return null;
  const slide = presentation.slides.find((s) => s.id === activeSlideId) ?? presentation.slides[0];
  if (!slide) return null;

  const lines = slide.elements.filter((e): e is LineElement => e.type === "line" || e.type === "arrow");

  return (
    <div style={{ overflow: "auto", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ap-paper-2)" }}>
      <div
        data-slide-stage
        style={{
          position: "relative",
          width: presentation.width,
          height: presentation.height,
          transform: `scale(${zoom})`,
          transformOrigin: "center center",
          background: slide.background?.value ?? "#fff",
          boxShadow: "0 8px 24px rgba(0,0,0,.15)",
          flexShrink: 0,
        }}
      >
        {slide.elements
          .filter((e) => e.type !== "line" && e.type !== "arrow")
          .map((element) => (
            <CanvasElement key={element.id} element={element} elementRef={() => {}} />
          ))}
        <LineArrowLayer lines={lines} width={presentation.width} height={presentation.height} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual QA**

Not wired into a route yet — deferred to Task 21's shell + route. Skip
manual QA for this task in isolation; it's covered once Task 21 mounts
`PresentationEditor`.

- [ ] **Step 6: Commit**

```bash
git add src/components/presentation-editor/SlideCanvas.tsx src/components/presentation-editor/elements/
git commit -m "feat(presentation-editor): static canvas rendering (all element types)"
```

---

## Task 10: Selection — click, shift-click, marquee

**Files:**
- Create: `src/components/presentation-editor/SelectionOverlay.tsx`
- Modify: `src/components/presentation-editor/SlideCanvas.tsx`

- [ ] **Step 1: Add click/shift-click selection to `SlideCanvas`**

Each `CanvasElement` gets its `onPointerDown` prop (added in Task 9) wired
to selection logic directly — no extra wrapper div around it (see the
warning in Task 9's `CanvasElement` docstring: a wrapper's ref would point
at the wrong node for every later task that reads/writes element geometry
imperatively).

Full updated file:

```tsx
// src/components/presentation-editor/SlideCanvas.tsx
import { useDocStore } from "./store/useDocStore";
import { useEditorUIStore } from "./store/useEditorUIStore";
import { CanvasElement } from "./elements/CanvasElement";
import { LineArrowLayer } from "./elements/LineArrowLayer";
import { SelectionOverlay } from "./SelectionOverlay";
import type { LineElement } from "./types/presentation";

export function SlideCanvas() {
  const presentation = useDocStore((s) => s.presentation);
  const activeSlideId = useEditorUIStore((s) => s.activeSlideId);
  const zoom = useEditorUIStore((s) => s.zoom);
  const selectedIds = useEditorUIStore((s) => s.selectedIds);
  const select = useEditorUIStore((s) => s.select);
  const toggleSelect = useEditorUIStore((s) => s.toggleSelect);
  const clearSelection = useEditorUIStore((s) => s.clearSelection);

  if (!presentation) return null;
  const slide = presentation.slides.find((s) => s.id === activeSlideId) ?? presentation.slides[0];
  if (!slide) return null;

  const lines = slide.elements.filter((e): e is LineElement => e.type === "line" || e.type === "arrow");
  const selectable = slide.elements.filter((e) => e.type !== "line" && e.type !== "arrow");

  return (
    <div style={{ overflow: "auto", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ap-paper-2)" }}>
      <div
        data-slide-stage
        onPointerDown={(e) => { if (e.target === e.currentTarget) clearSelection(); }}
        style={{
          position: "relative",
          width: presentation.width,
          height: presentation.height,
          transform: `scale(${zoom})`,
          transformOrigin: "center center",
          background: slide.background?.value ?? "#fff",
          boxShadow: "0 8px 24px rgba(0,0,0,.15)",
          flexShrink: 0,
        }}
      >
        {selectable.map((element) => (
          <CanvasElement
            key={element.id}
            element={element}
            elementRef={() => {}}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (e.shiftKey) toggleSelect(element.id); else select([element.id]);
            }}
          />
        ))}
        <LineArrowLayer lines={lines} width={presentation.width} height={presentation.height} />
        <SelectionOverlay slideId={slide.id} elements={selectable} selectedIds={selectedIds} zoom={zoom} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `SelectionOverlay`**

```tsx
// src/components/presentation-editor/SelectionOverlay.tsx
import { boundingBoxOf } from "./utils/geometry";
import type { SlideElement } from "./types/presentation";

interface SelectionOverlayProps {
  slideId: string;
  elements: SlideElement[];
  selectedIds: Set<string>;
  zoom: number;
}

/** Draws a dashed outline around each selected element, plus one solid
 *  bounding box when 2+ are selected (multi-select group handles hook into
 *  this box in Task 11). Purely visual — no pointer handling here, that
 *  lives in TransformControls (Task 11). */
export function SelectionOverlay({ elements, selectedIds, zoom }: SelectionOverlayProps) {
  const selected = elements.filter((e) => selectedIds.has(e.id));
  if (selected.length === 0) return null;

  const box = selected.length > 1 ? boundingBoxOf(selected) : null;

  return (
    <>
      {selected.map((e) => (
        <div
          key={e.id}
          style={{
            position: "absolute",
            left: e.x, top: e.y, width: e.width, height: e.height,
            border: `${1.5 / zoom}px dashed var(--ap-brand)`,
            pointerEvents: "none",
          }}
        />
      ))}
      {box && (
        <div
          style={{
            position: "absolute",
            left: box.x, top: box.y, width: box.width, height: box.height,
            border: `${2 / zoom}px solid var(--ap-brand)`,
            pointerEvents: "none",
          }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/presentation-editor/SelectionOverlay.tsx src/components/presentation-editor/SlideCanvas.tsx
git commit -m "feat(presentation-editor): click/shift-click selection + overlay"
```

---

## Task 11: Marquee (rubber-band) selection

**Files:**
- Modify: `src/components/presentation-editor/SlideCanvas.tsx`

Marquee drawing is imperative (ref-updated div, no state per pointermove),
matching the spec's zero-rerender-mid-gesture rule. Only the final
`selectedIds` commit touches the store.

- [ ] **Step 1: Add the marquee interaction**

```tsx
// src/components/presentation-editor/SlideCanvas.tsx — add inside the component, replacing the stage's onPointerDown
import { useRef } from "react";
import { rectsIntersect } from "./utils/geometry";
// ...

const marqueeRef = useRef<HTMLDivElement | null>(null);
const dragState = useRef<{ startX: number; startY: number } | null>(null);

function stagePointerDown(e: React.PointerEvent<HTMLDivElement>) {
  if (e.target !== e.currentTarget) return;
  clearSelection();
  const stage = e.currentTarget;
  const bounds = stage.getBoundingClientRect();
  const startX = (e.clientX - bounds.left) / zoom;
  const startY = (e.clientY - bounds.top) / zoom;
  dragState.current = { startX, startY };

  const marquee = marqueeRef.current;
  if (marquee) {
    marquee.style.display = "block";
    marquee.style.left = `${startX}px`;
    marquee.style.top = `${startY}px`;
    marquee.style.width = "0px";
    marquee.style.height = "0px";
  }

  function onMove(moveEvent: PointerEvent) {
    if (!dragState.current || !marquee) return;
    const x = (moveEvent.clientX - bounds.left) / zoom;
    const y = (moveEvent.clientY - bounds.top) / zoom;
    const left = Math.min(dragState.current.startX, x);
    const top = Math.min(dragState.current.startY, y);
    marquee.style.left = `${left}px`;
    marquee.style.top = `${top}px`;
    marquee.style.width = `${Math.abs(x - dragState.current.startX)}px`;
    marquee.style.height = `${Math.abs(y - dragState.current.startY)}px`;
  }

  function onUp(upEvent: PointerEvent) {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    if (!dragState.current) return;
    const x = (upEvent.clientX - bounds.left) / zoom;
    const y = (upEvent.clientY - bounds.top) / zoom;
    const marqueeRect = {
      x: Math.min(dragState.current.startX, x),
      y: Math.min(dragState.current.startY, y),
      width: Math.abs(x - dragState.current.startX),
      height: Math.abs(y - dragState.current.startY),
    };
    const hitIds = selectable
      .filter((el) => rectsIntersect(marqueeRect, el))
      .map((el) => el.id);
    if (hitIds.length > 0) select(hitIds);
    dragState.current = null;
    if (marquee) marquee.style.display = "none";
  }

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}
```

Replace the stage `<div>`'s `onPointerDown` with `stagePointerDown`, and add
the marquee rect element as the stage's last child:

```tsx
<div ref={marqueeRef} style={{ position: "absolute", display: "none", border: "1px dashed var(--ap-brand)", background: "rgba(108,99,255,.08)", pointerEvents: "none" }} />
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual QA** (once Task 21 mounts the shell)

Draw a rectangle over 2+ elements on an empty part of the canvas; verify
all intersected elements become selected and the marquee rectangle
disappears on release.

- [ ] **Step 4: Commit**

```bash
git add src/components/presentation-editor/SlideCanvas.tsx
git commit -m "feat(presentation-editor): marquee selection"
```

---

## Task 12: `useElementDrag` — the core imperative drag mechanism

**Files:**
- Create: `src/components/presentation-editor/hooks/useElementDrag.ts`
- Modify: `src/components/presentation-editor/SlideCanvas.tsx`

This is the piece the spec calls out explicitly: zero React re-renders and
zero store writes during `pointermove`; exactly one commit on `pointerup`.

- [ ] **Step 1: Write the hook**

```ts
// src/components/presentation-editor/hooks/useElementDrag.ts
import { useRef, useCallback } from "react";
import { useDocStore } from "../store/useDocStore";
import { useEditorUIStore } from "../store/useEditorUIStore";
import { useHistoryStore } from "../store/useHistoryStore";
import { snapDelta } from "../utils/geometry";
import type { BaseElement } from "../types/presentation";

interface DragTarget {
  id: string;
  startX: number;
  startY: number;
  node: HTMLElement;
}

/**
 * Returns a pointerdown handler to attach to a selected element's wrapper.
 * `nodesRef` must map element id -> its live DOM node (CanvasElement's
 * elementRef callback feeds this).
 */
export function useElementDrag(slideId: string, nodesRef: React.MutableRefObject<Map<string, HTMLElement>>) {
  const draggingRef = useRef<DragTarget[] | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent, draggedId: string) => {
    e.stopPropagation();
    const doc = useDocStore.getState();
    const ui = useEditorUIStore.getState();
    const slide = doc.presentation!.slides.find((s) => s.id === slideId)!;

    const activeIds = ui.selectedIds.has(draggedId) ? [...ui.selectedIds] : [draggedId];
    if (!ui.selectedIds.has(draggedId)) ui.select([draggedId]);

    const targets: DragTarget[] = activeIds
      .map((id) => {
        const el = slide.elements.find((x) => x.id === id);
        const node = nodesRef.current.get(id);
        if (!el || !node) return null;
        return { id, startX: el.x, startY: el.y, node };
      })
      .filter((t): t is DragTarget => t !== null);
    draggingRef.current = targets;
    ui.setDragging(true);

    const others = slide.elements.filter((el): el is BaseElement => !activeIds.includes(el.id));
    const zoom = ui.zoom;
    const startClientX = e.clientX;
    const startClientY = e.clientY;

    function onMove(moveEvent: PointerEvent) {
      if (!draggingRef.current) return;
      let dx = (moveEvent.clientX - startClientX) / zoom;
      let dy = (moveEvent.clientY - startClientY) / zoom;

      if (!moveEvent.altKey) {
        const primary = draggingRef.current[0];
        const proxy: BaseElement = { ...slide.elements.find((x) => x.id === primary.id)!, x: primary.startX, y: primary.startY };
        const snapped = snapDelta(proxy, dx, dy, others, 8);
        dx = snapped.dx;
        dy = snapped.dy;
      }

      for (const t of draggingRef.current) {
        // CanvasElement's own React-controlled style already sets
        // `transform: rotate(${element.rotation}deg)` — overwriting it with
        // just `translate()` would un-rotate the element for the duration
        // of the drag. Read the element's rotation once (it doesn't change
        // mid-drag) and compose both in one transform string.
        const rotation = slide.elements.find((x) => x.id === t.id)?.rotation ?? 0;
        t.node.style.transform = `translate(${dx}px, ${dy}px) rotate(${rotation}deg)`;
      }
    }

    function onUp(upEvent: PointerEvent) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const targets = draggingRef.current;
      draggingRef.current = null;
      useEditorUIStore.getState().setDragging(false);
      if (!targets) return;

      let dx = (upEvent.clientX - startClientX) / zoom;
      let dy = (upEvent.clientY - startClientY) / zoom;
      if (!upEvent.altKey) {
        const primary = targets[0];
        const proxy: BaseElement = { ...slide.elements.find((x) => x.id === primary.id)!, x: primary.startX, y: primary.startY };
        const snapped = snapDelta(proxy, dx, dy, others, 8);
        dx = snapped.dx;
        dy = snapped.dy;
      }

      useHistoryStore.getState().commit();
      useDocStore.getState().updateElements(
        slideId,
        targets.map((t) => ({ id: t.id, patch: { x: t.startX + dx, y: t.startY + dy } })),
      );
      // clear the imperative transform now that the store holds the real position
      for (const t of targets) t.node.style.transform = "";
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [slideId, nodesRef]);

  return { onPointerDown };
}
```

- [ ] **Step 2: Wire it into `SlideCanvas`**

`elementRef` now registers the element's real node (the same one
`CanvasElement` positions with `left`/`top`/`width`/`height`, per Task 9)
into `nodesRef`, and the single `onPointerDown` handler both updates
selection and — for a plain (non-shift) press — kicks off the drag:

```tsx
// src/components/presentation-editor/SlideCanvas.tsx — add near the top of the component
const nodesRef = useRef(new Map<string, HTMLElement>());
const { onPointerDown: onElementDragStart } = useElementDrag(slide.id, nodesRef);

// Replace the .map from Task 10:
{selectable.map((element) => (
  <CanvasElement
    key={element.id}
    element={element}
    elementRef={(node) => {
      if (node) nodesRef.current.set(element.id, node); else nodesRef.current.delete(element.id);
    }}
    onPointerDown={(e) => {
      e.stopPropagation();
      if (e.shiftKey) { toggleSelect(element.id); return; }
      if (!selectedIds.has(element.id)) select([element.id]);
      onElementDragStart(e, element.id);
    }}
  />
))}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual QA** (once Task 21 mounts the shell)

Drag a single element: confirm smooth movement with no visible jank; open
React DevTools profiler and confirm no component re-renders fire between
pointerdown and pointerup, only one render after (on commit). Drag two
selected elements together: both move by the same delta. Hold Alt while
dragging near another element's edge: confirm snapping is suppressed.

- [ ] **Step 5: Commit**

```bash
git add src/components/presentation-editor/hooks/useElementDrag.ts src/components/presentation-editor/SlideCanvas.tsx
git commit -m "feat(presentation-editor): imperative drag with snap-to-edge, single commit on release"
```

---

## Task 13: `TransformControls` — resize + rotate handles

**Files:**
- Create: `src/components/presentation-editor/TransformControls.tsx`
- Modify: `src/components/presentation-editor/SlideCanvas.tsx`

Same imperative-during-gesture, commit-on-release pattern as Task 12.

- [ ] **Step 1: Write `TransformControls`**

```tsx
// src/components/presentation-editor/TransformControls.tsx
import { useRef } from "react";
import { useDocStore } from "./store/useDocStore";
import { useHistoryStore } from "./store/useHistoryStore";
import type { SlideElement } from "./types/presentation";

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type Handle = (typeof HANDLES)[number];

interface TransformControlsProps {
  slideId: string;
  element: SlideElement;
  zoom: number;
  node: HTMLElement | null; // the element's own DOM node, for imperative style writes
}

export function TransformControls({ slideId, element, zoom, node }: TransformControlsProps) {
  const startRef = useRef<{ x: number; y: number; width: number; height: number; clientX: number; clientY: number } | null>(null);

  function onResizeStart(e: React.PointerEvent, handle: Handle) {
    e.stopPropagation();
    startRef.current = { x: element.x, y: element.y, width: element.width, height: element.height, clientX: e.clientX, clientY: e.clientY };

    function onMove(moveEvent: PointerEvent) {
      const start = startRef.current;
      if (!start || !node) return;
      const dx = (moveEvent.clientX - start.clientX) / zoom;
      const dy = (moveEvent.clientY - start.clientY) / zoom;

      let { x, y, width, height } = start;
      if (handle.includes("e")) width = Math.max(10, start.width + dx);
      if (handle.includes("s")) height = Math.max(10, start.height + dy);
      if (handle.includes("w")) { width = Math.max(10, start.width - dx); x = start.x + dx; }
      if (handle.includes("n")) { height = Math.max(10, start.height - dy); y = start.y + dy; }

      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      node.style.width = `${width}px`;
      node.style.height = `${height}px`;
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const start = startRef.current;
      startRef.current = null;
      if (!start || !node) return;
      useHistoryStore.getState().commit();
      useDocStore.getState().updateElement(slideId, element.id, {
        x: parseFloat(node.style.left), y: parseFloat(node.style.top),
        width: parseFloat(node.style.width), height: parseFloat(node.style.height),
      });
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function onRotateStart(e: React.PointerEvent) {
    e.stopPropagation();
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    function angleAt(clientX: number, clientY: number) {
      return (Math.atan2(clientY - centerY, clientX - centerX) * 180) / Math.PI + 90;
    }
    const startAngle = angleAt(e.clientX, e.clientY) - element.rotation;

    function onMove(moveEvent: PointerEvent) {
      if (!node) return;
      const rotation = angleAt(moveEvent.clientX, moveEvent.clientY) - startAngle;
      node.style.transform = `rotate(${rotation}deg)`;
      node.dataset.pendingRotation = String(rotation);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (!node) return;
      const rotation = parseFloat(node.dataset.pendingRotation ?? String(element.rotation));
      delete node.dataset.pendingRotation;
      useHistoryStore.getState().commit();
      useDocStore.getState().updateElement(slideId, element.id, { rotation });
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const size = 8 / zoom;
  const handleStyle = (handle: Handle): React.CSSProperties => {
    const pos: Record<Handle, React.CSSProperties> = {
      nw: { left: -size / 2, top: -size / 2, cursor: "nwse-resize" },
      n: { left: "50%", top: -size / 2, marginLeft: -size / 2, cursor: "ns-resize" },
      ne: { right: -size / 2, top: -size / 2, cursor: "nesw-resize" },
      e: { right: -size / 2, top: "50%", marginTop: -size / 2, cursor: "ew-resize" },
      se: { right: -size / 2, bottom: -size / 2, cursor: "nwse-resize" },
      s: { left: "50%", bottom: -size / 2, marginLeft: -size / 2, cursor: "ns-resize" },
      sw: { left: -size / 2, bottom: -size / 2, cursor: "nesw-resize" },
      w: { left: -size / 2, top: "50%", marginTop: -size / 2, cursor: "ew-resize" },
    };
    return { position: "absolute", width: size, height: size, background: "#fff", border: "1px solid var(--ap-brand)", ...pos[handle] };
  };

  return (
    <div style={{ position: "absolute", left: element.x, top: element.y, width: element.width, height: element.height, pointerEvents: "none" }}>
      {HANDLES.map((h) => (
        <div key={h} style={{ ...handleStyle(h), pointerEvents: "auto" }} onPointerDown={(e) => onResizeStart(e, h)} />
      ))}
      <div
        style={{ position: "absolute", left: "50%", top: -24 / zoom, width: size, height: size, marginLeft: -size / 2, borderRadius: "50%", background: "#fff", border: "1px solid var(--ap-brand)", cursor: "grab", pointerEvents: "auto" }}
        onPointerDown={onRotateStart}
      />
    </div>
  );
}
```

- [ ] **Step 2: Render it for single-selected, unlocked elements in `SlideCanvas`**

```tsx
// src/components/presentation-editor/SlideCanvas.tsx — add after <SelectionOverlay .../>
{selectedIds.size === 1 && (() => {
  const onlyId = [...selectedIds][0];
  const el = selectable.find((x) => x.id === onlyId);
  if (!el || el.locked) return null;
  return <TransformControls slideId={slide.id} element={el} zoom={zoom} node={nodesRef.current.get(onlyId) ?? null} />;
})()}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual QA**

Select a single element, drag each of the 8 handles: confirm resize
behaves per handle direction and commits once on release. Drag the rotate
handle: confirm smooth rotation, committed once on release.

- [ ] **Step 5: Commit**

```bash
git add src/components/presentation-editor/TransformControls.tsx src/components/presentation-editor/SlideCanvas.tsx
git commit -m "feat(presentation-editor): resize + rotate handles"
```

---

## Task 14: Text editing (Tiptap mount on double-click)

**Files:**
- Create: `src/components/presentation-editor/elements/TextElementEditing.tsx`
- Modify: `src/components/presentation-editor/elements/CanvasElement.tsx`

- [ ] **Step 1: Write the editable variant**

```tsx
// src/components/presentation-editor/elements/TextElementEditing.tsx
import { useEditor, EditorContent } from "@tiptap/react";
import { useEffect } from "react";
import { TIPTAP_EXTENSIONS } from "./TextElementView";
import { useDocStore } from "../store/useDocStore";
import { useHistoryStore } from "../store/useHistoryStore";
import type { TextElement } from "../types/presentation";

interface TextElementEditingProps {
  slideId: string;
  element: TextElement;
  onDone: () => void;
}

/** Mounted only for the element currently being edited (double-click to
 *  enter — see CanvasElement). Commits history on a typing pause (~500ms)
 *  and again on blur, per the spec's "one gesture = one entry" rule. */
export function TextElementEditing({ slideId, element, onDone }: TextElementEditingProps) {
  const editor = useEditor({
    extensions: TIPTAP_EXTENSIONS,
    content: element.richText,
    autofocus: "end",
    onUpdate: ({ editor: e }) => {
      useDocStore.getState().updateElement(slideId, element.id, { richText: e.getJSON() });
    },
  });

  useEffect(() => {
    if (!editor) return;
    let timer: ReturnType<typeof setTimeout>;
    const commitOnPause = () => {
      clearTimeout(timer);
      timer = setTimeout(() => useHistoryStore.getState().commit(), 500);
    };
    editor.on("update", commitOnPause);
    return () => { clearTimeout(timer); editor.off("update", commitOnPause); };
  }, [editor]);

  return (
    <div
      style={{ width: "100%", height: "100%" }}
      onBlur={() => { useHistoryStore.getState().commit(); onDone(); }}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
```

- [ ] **Step 2: Wire double-click into `CanvasElement`**

```tsx
// src/components/presentation-editor/elements/CanvasElement.tsx
import { useState } from "react";
import type { SlideElement } from "../types/presentation";
import { TextElementView } from "./TextElementView";
import { TextElementEditing } from "./TextElementEditing";
import { ImageElementView } from "./ImageElementView";
import { ShapeElementView } from "./ShapeElementView";
import { VideoElementView } from "./VideoElementView";
import { GroupElementView } from "./GroupElementView";

interface CanvasElementProps {
  slideId: string;
  element: SlideElement;
  elementRef: (node: HTMLDivElement | null) => void;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export function CanvasElement({ slideId, element, elementRef, onPointerDown }: CanvasElementProps) {
  const [editing, setEditing] = useState(false);
  if (element.type === "line" || element.type === "arrow") return null;
  if (!element.visible) return null;

  return (
    <div
      ref={elementRef}
      data-element-id={element.id}
      onPointerDown={onPointerDown}
      onDoubleClick={() => { if (element.type === "text") setEditing(true); }}
      style={{
        position: "absolute",
        left: element.x, top: element.y,
        width: element.width, height: element.height,
        transform: `rotate(${element.rotation}deg)`,
        opacity: element.opacity,
        zIndex: element.zIndex,
        pointerEvents: element.locked ? "none" : "auto",
      }}
    >
      {element.type === "text" && (editing
        ? <TextElementEditing slideId={slideId} element={element} onDone={() => setEditing(false)} />
        : <TextElementView element={element} />)}
      {element.type === "image" && <ImageElementView element={element} />}
      {(element.type === "rect" || element.type === "circle") && <ShapeElementView element={element} />}
      {element.type === "video" && <VideoElementView element={element} />}
      {element.type === "group" && <GroupElementView />}
    </div>
  );
}
```

Update the one call site in `SlideCanvas.tsx` (inside the `.map` from Task
12) to also pass `slideId={slide.id}` — `elementRef` and `onPointerDown`
stay exactly as Task 12 left them.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual QA**

Double-click a text element: confirm a real caret appears and typing
works. Click away: confirm it commits and reverts to static rendering.
Type continuously for 2+ seconds, then check `useHistoryStore.getState().past.length`
in the console before/after — confirm it only grew by one (not once per
keystroke).

- [ ] **Step 5: Commit**

```bash
git add src/components/presentation-editor/elements/TextElementEditing.tsx src/components/presentation-editor/elements/CanvasElement.tsx src/components/presentation-editor/SlideCanvas.tsx
git commit -m "feat(presentation-editor): double-click text editing with debounced history commit"
```

---

## Task 15: `useKeyboardShortcuts`

**Files:**
- Create: `src/components/presentation-editor/hooks/useKeyboardShortcuts.ts`

- [ ] **Step 1: Write the hook**

```ts
// src/components/presentation-editor/hooks/useKeyboardShortcuts.ts
import { useEffect, useRef } from "react";
import { useDocStore } from "../store/useDocStore";
import { useEditorUIStore } from "../store/useEditorUIStore";
import { useHistoryStore } from "../store/useHistoryStore";
import type { SlideElement } from "../types/presentation";

const NUDGE = 1;
const NUDGE_LARGE = 10;

export function useKeyboardShortcuts(slideId: string) {
  const clipboardRef = useRef<SlideElement[] | null>(null);

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      return target instanceof HTMLElement && (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA");
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      const doc = useDocStore.getState();
      const ui = useEditorUIStore.getState();
      const history = useHistoryStore.getState();
      const slide = doc.presentation?.slides.find((s) => s.id === slideId);
      if (!slide) return;
      const selected = slide.elements.filter((el) => ui.selectedIds.has(el.id));
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === "z" && !e.shiftKey) { e.preventDefault(); history.undo(); return; }
      if (mod && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); history.redo(); return; }

      if (mod && e.key === "c") {
        e.preventDefault();
        clipboardRef.current = selected.map((el) => ({ ...el }));
        return;
      }
      if (mod && e.key === "x") {
        e.preventDefault();
        clipboardRef.current = selected.map((el) => ({ ...el }));
        history.commit();
        for (const el of selected) doc.removeElement(slideId, el.id);
        return;
      }
      if (mod && e.key === "v") {
        e.preventDefault();
        if (!clipboardRef.current || clipboardRef.current.length === 0) return;
        history.commit();
        const newIds: string[] = [];
        for (const el of clipboardRef.current) {
          const id = `${el.id}-copy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          doc.addElement(slideId, { ...el, id, x: el.x + 20, y: el.y + 20 } as SlideElement);
          newIds.push(id);
        }
        ui.select(newIds);
        return;
      }
      if (mod && e.key === "d") {
        e.preventDefault();
        if (selected.length === 0) return;
        history.commit();
        const newIds: string[] = [];
        for (const el of selected) {
          const id = `${el.id}-dup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          doc.addElement(slideId, { ...el, id, x: el.x + 20, y: el.y + 20 } as SlideElement);
          newIds.push(id);
        }
        ui.select(newIds);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selected.length === 0) return;
        e.preventDefault();
        history.commit();
        for (const el of selected) doc.removeElement(slideId, el.id);
        return;
      }

      const arrowDeltas: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
      };
      if (arrowDeltas[e.key] && selected.length > 0) {
        e.preventDefault();
        const step = e.shiftKey ? NUDGE_LARGE : NUDGE;
        const [dx, dy] = arrowDeltas[e.key];
        history.commit();
        doc.updateElements(slideId, selected.map((el) => ({ id: el.id, patch: { x: el.x + dx * step, y: el.y + dy * step } })));
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [slideId]);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual QA** (once Task 21 mounts the shell and calls this hook)

Select an element, press each arrow key: 1px move. Shift+arrow: 10px move.
Cmd/Ctrl+C then Cmd/Ctrl+V: a duplicate appears offset by (20,20). Cmd/
Ctrl+D: same, single shortcut. Delete: removes selection. Cmd/Ctrl+Z then
Cmd/Ctrl+Shift+Z: undo then redo restore correctly. Click into a text
element being edited and press Delete: confirm it deletes a character, not
the element (typing-target guard).

- [ ] **Step 4: Commit**

```bash
git add src/components/presentation-editor/hooks/useKeyboardShortcuts.ts
git commit -m "feat(presentation-editor): keyboard shortcuts (nudge, copy/cut/paste, duplicate, delete, undo/redo)"
```

---

## Task 16: `EditorToolbar` (contextual)

**Files:**
- Create: `src/components/presentation-editor/EditorToolbar.tsx`

- [ ] **Step 1: Write the toolbar**

```tsx
// src/components/presentation-editor/EditorToolbar.tsx
import { useDocStore } from "./store/useDocStore";
import { useEditorUIStore, type EditorTool } from "./store/useEditorUIStore";
import { useHistoryStore } from "./store/useHistoryStore";
import { alignLeft, alignCenterH, alignRight, alignTop, alignMiddleV, alignBottom, distributeHorizontal, distributeVertical } from "./utils/geometry";
import type { SlideElement } from "./types/presentation";

const TOOLS: { id: EditorTool; label: string }[] = [
  { id: "select", label: "Sélection" },
  { id: "text", label: "Texte" },
  { id: "image", label: "Image" },
  { id: "rect", label: "Rectangle" },
  { id: "circle", label: "Cercle" },
  { id: "line", label: "Ligne" },
  { id: "arrow", label: "Flèche" },
  { id: "video", label: "Vidéo" },
];

export function EditorToolbar({ slideId }: { slideId: string }) {
  const activeTool = useEditorUIStore((s) => s.activeTool);
  const setActiveTool = useEditorUIStore((s) => s.setActiveTool);
  const selectedIds = useEditorUIStore((s) => s.selectedIds);
  const presentation = useDocStore((s) => s.presentation);

  const slide = presentation?.slides.find((s) => s.id === slideId);
  const selected = slide ? slide.elements.filter((el) => selectedIds.has(el.id)) : [];

  function applyAlign(fn: (els: SlideElement[]) => SlideElement[]) {
    if (selected.length < 2) return;
    useHistoryStore.getState().commit();
    const updated = fn(selected);
    useDocStore.getState().updateElements(slideId, updated.map((el) => ({ id: el.id, patch: el })));
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "var(--ap-border-w) solid var(--ap-line)", flexWrap: "wrap" }}>
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          onClick={() => setActiveTool(tool.id)}
          className="ap-btn ap-btn--sm ap-btn--pill"
          aria-pressed={activeTool === tool.id}
          style={{ background: activeTool === tool.id ? "var(--ap-brand)" : "var(--ap-card)", color: activeTool === tool.id ? "#fff" : "var(--ap-ink)" }}
        >
          {tool.label}
        </button>
      ))}

      {selected.length >= 2 && (
        <>
          <span style={{ width: 1, height: 20, background: "var(--ap-line)", margin: "0 4px" }} />
          <button className="ap-btn ap-btn--sm ap-btn--ghost" aria-label="Aligner à gauche" onClick={() => applyAlign(alignLeft)}>⟸</button>
          <button className="ap-btn ap-btn--sm ap-btn--ghost" aria-label="Centrer horizontalement" onClick={() => applyAlign(alignCenterH)}>⇹</button>
          <button className="ap-btn ap-btn--sm ap-btn--ghost" aria-label="Aligner à droite" onClick={() => applyAlign(alignRight)}>⟹</button>
          <button className="ap-btn ap-btn--sm ap-btn--ghost" aria-label="Aligner en haut" onClick={() => applyAlign(alignTop)}>⟰</button>
          <button className="ap-btn ap-btn--sm ap-btn--ghost" aria-label="Centrer verticalement" onClick={() => applyAlign(alignMiddleV)}>⇳</button>
          <button className="ap-btn ap-btn--sm ap-btn--ghost" aria-label="Aligner en bas" onClick={() => applyAlign(alignBottom)}>⟱</button>
          {selected.length >= 3 && (
            <>
              <button className="ap-btn ap-btn--sm ap-btn--ghost" aria-label="Distribuer horizontalement" onClick={() => applyAlign(distributeHorizontal)}>⇔</button>
              <button className="ap-btn ap-btn--sm ap-btn--ghost" aria-label="Distribuer verticalement" onClick={() => applyAlign(distributeVertical)}>⇕</button>
            </>
          )}
          <button
            className="ap-btn ap-btn--sm ap-btn--ghost"
            onClick={() => {
              useHistoryStore.getState().commit();
              useDocStore.getState().groupElements(slideId, [...selectedIds]);
            }}
          >
            Grouper
          </button>
        </>
      )}
      {selected.length === 1 && selected[0].type === "group" && (
        <button
          className="ap-btn ap-btn--sm ap-btn--ghost"
          onClick={() => {
            useHistoryStore.getState().commit();
            useDocStore.getState().ungroupElements(slideId, selected[0].id);
          }}
        >
          Dégrouper
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual QA** (once Task 21 mounts the shell)

Select a tool: confirm pressed-state highlight. Select 2 elements: confirm
align buttons appear and each one moves elements as expected. Select 3:
confirm distribute buttons appear too. Group then ungroup: confirm the
group toolbar button swaps correctly.

- [ ] **Step 4: Commit**

```bash
git add src/components/presentation-editor/EditorToolbar.tsx
git commit -m "feat(presentation-editor): contextual toolbar (tools, align, distribute, group)"
```

---

## Task 17: `PropertiesPanel`

**Files:**
- Create: `src/components/presentation-editor/PropertiesPanel.tsx`

- [ ] **Step 1: Write the panel**

```tsx
// src/components/presentation-editor/PropertiesPanel.tsx
import { useDocStore } from "./store/useDocStore";
import { useEditorUIStore } from "./store/useEditorUIStore";
import { useHistoryStore } from "./store/useHistoryStore";
import type { ImageElement, ShapeElement, SlideElement } from "./types/presentation";

function NumberField({ label, value, onCommit }: { label: string; value: number; onCommit: (n: number) => void }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--ap-muted)" }}>
      {label}
      <input
        type="number"
        defaultValue={value}
        onBlur={(e) => onCommit(Number(e.target.value))}
        style={{ border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-sm)", padding: "6px 8px", fontSize: 13 }}
      />
    </label>
  );
}

export function PropertiesPanel({ slideId }: { slideId: string }) {
  const presentation = useDocStore((s) => s.presentation);
  const selectedIds = useEditorUIStore((s) => s.selectedIds);
  const slide = presentation?.slides.find((s) => s.id === slideId);
  const selected: SlideElement[] = slide ? slide.elements.filter((el) => selectedIds.has(el.id)) : [];

  if (selected.length !== 1) {
    return <div style={{ padding: 16, fontSize: 13, color: "var(--ap-muted)" }}>{selected.length === 0 ? "Aucune sélection" : `${selected.length} éléments sélectionnés`}</div>;
  }
  const el = selected[0];

  function commit(patch: Partial<SlideElement>) {
    useHistoryStore.getState().commit();
    useDocStore.getState().updateElement(slideId, el.id, patch);
  }

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, width: 240 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <NumberField label="X" value={el.x} onCommit={(x) => commit({ x })} />
        <NumberField label="Y" value={el.y} onCommit={(y) => commit({ y })} />
        <NumberField label="Largeur" value={el.width} onCommit={(width) => commit({ width })} />
        <NumberField label="Hauteur" value={el.height} onCommit={(height) => commit({ height })} />
        <NumberField label="Rotation" value={el.rotation} onCommit={(rotation) => commit({ rotation })} />
        <NumberField label="Opacité (%)" value={Math.round(el.opacity * 100)} onCommit={(pct) => commit({ opacity: Math.min(1, Math.max(0, pct / 100)) })} />
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <input type="checkbox" checked={el.locked} onChange={(e) => commit({ locked: e.target.checked })} />
        Verrouillé
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <input type="checkbox" checked={el.visible} onChange={(e) => commit({ visible: e.target.checked })} />
        Visible
      </label>

      {(el.type === "rect" || el.type === "circle") && (
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--ap-muted)" }}>
          Couleur de remplissage
          <input type="color" value={(el as ShapeElement).fill} onChange={(e) => commit({ fill: e.target.value } as Partial<ShapeElement>)} />
        </label>
      )}

      {el.type === "image" && (
        <>
          <NumberField label="Coins arrondis" value={(el as ImageElement).borderRadius} onCommit={(borderRadius) => commit({ borderRadius } as Partial<ImageElement>)} />
          <NumberField label="Épaisseur bordure" value={(el as ImageElement).borderWidth} onCommit={(borderWidth) => commit({ borderWidth } as Partial<ImageElement>)} />
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--ap-muted)" }}>
            Couleur bordure
            <input type="color" value={(el as ImageElement).borderColor} onChange={(e) => commit({ borderColor: e.target.value } as Partial<ImageElement>)} />
          </label>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual QA** (once Task 21 mounts the shell)

Select each element type in turn: confirm the type-specific fields
(fill color for shapes; radius/border for images) appear only when
relevant. Change a number field and blur: confirm it commits (check
`useHistoryStore` grew by one) and the canvas updates.

- [ ] **Step 4: Commit**

```bash
git add src/components/presentation-editor/PropertiesPanel.tsx
git commit -m "feat(presentation-editor): properties panel"
```

---

## Task 18: `SlideNavigator` (thumbnails, reorder, multi-select, hide/duplicate/delete)

**Files:**
- Create: `src/components/presentation-editor/SlideNavigator.tsx`
- Create: `src/components/presentation-editor/SlideThumbnail.tsx`

Reuses `@dnd-kit/sortable` (already a dependency, already used elsewhere in
this codebase for list reordering) rather than a new DnD library.

- [ ] **Step 1: Write `SlideThumbnail`**

```tsx
// src/components/presentation-editor/SlideThumbnail.tsx
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Slide } from "./types/presentation";

interface SlideThumbnailProps {
  slide: Slide;
  index: number;
  presentationWidth: number;
  presentationHeight: number;
  isActive: boolean;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
}

/** Scaled-down, non-interactive read of the slide — reuses the same
 *  element data but renders it inert (no drag/edit handlers) at ~1/8
 *  scale via CSS transform, so there is no separate thumbnail renderer to
 *  keep in sync with the real canvas. */
export function SlideThumbnail({ slide, index, presentationWidth, presentationHeight, isActive, isSelected, onSelect }: SlideThumbnailProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id });
  const THUMB_WIDTH = 160;
  const scale = THUMB_WIDTH / presentationWidth;
  const thumbHeight = presentationHeight * scale;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      style={{
        transform: CSS.Transform.toString(transform), transition,
        opacity: isDragging ? 0.4 : slide.hidden ? 0.5 : 1,
        cursor: "pointer",
        border: `2px solid ${isActive || isSelected ? "var(--ap-brand)" : "var(--ap-line)"}`,
        borderRadius: "var(--ap-r-sm)",
        overflow: "hidden",
        width: THUMB_WIDTH, height: thumbHeight,
        position: "relative", flexShrink: 0,
        background: slide.background?.value ?? "#fff",
      }}
    >
      <span style={{ position: "absolute", left: 4, top: 2, fontSize: 10, fontWeight: 800, color: "var(--ap-muted)" }}>{index + 1}</span>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${scale})`, transformOrigin: "top left", width: presentationWidth, height: presentationHeight, pointerEvents: "none" }}>
        {slide.elements.filter((e) => e.visible).map((e) => (
          <div key={e.id} style={{ position: "absolute", left: e.x, top: e.y, width: e.width, height: e.height, background: e.type === "rect" || e.type === "circle" ? (e as { fill?: string }).fill : undefined }} />
        ))}
      </div>
      {slide.hidden && <span style={{ position: "absolute", right: 4, top: 2, fontSize: 10 }}>🚫</span>}
    </div>
  );
}
```

- [ ] **Step 2: Write `SlideNavigator`**

```tsx
// src/components/presentation-editor/SlideNavigator.tsx
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
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
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
```

Note: virtualization (spec's performance baseline for large decks) is
intentionally deferred past this task — `react-window`/similar is not yet
a dependency and a plain scrollable column is correct for the deck sizes
this phase targets. Flag it in Task 21's shell if profiling later shows
this is a bottleneck; do not add a virtualization dependency speculatively
(YAGNI).

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual QA** (once Task 21 mounts the shell)

Add several slides, drag to reorder: confirm order persists and `order`
fields stay 0..n-1. Duplicate, hide/unhide, delete (down to the 1-slide
floor where delete disables): confirm each works and thumbnails reflect
elements.

- [ ] **Step 5: Commit**

```bash
git add src/components/presentation-editor/SlideNavigator.tsx src/components/presentation-editor/SlideThumbnail.tsx
git commit -m "feat(presentation-editor): slide navigator (thumbnails, reorder, duplicate, hide, delete)"
```

---

## Task 19: `PresentationMode` (fullscreen slideshow + JSON export/import)

**Files:**
- Create: `src/components/presentation-editor/PresentationMode.tsx`

PDF export, image export, and print are explicitly out of scope for this
spec (see design doc) — only the fullscreen viewer and JSON export/import
are built here.

- [ ] **Step 1: Write the component**

```tsx
// src/components/presentation-editor/PresentationMode.tsx
import { useEffect, useState } from "react";
import { useDocStore } from "./store/useDocStore";
import { CanvasElement } from "./elements/CanvasElement";
import { LineArrowLayer } from "./elements/LineArrowLayer";
import type { LineElement } from "./types/presentation";

export function PresentationMode({ onExit }: { onExit: () => void }) {
  const presentation = useDocStore((s) => s.presentation);
  const [index, setIndex] = useState(0);
  const visibleSlides = (presentation?.slides ?? []).filter((s) => !s.hidden).sort((a, b) => a.order - b.order);
  const slide = visibleSlides[index];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") setIndex((i) => Math.min(visibleSlides.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "Escape") onExit();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visibleSlides.length, onExit]);

  let touchStartX = 0;
  function onTouchStart(e: React.TouchEvent) { touchStartX = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (dx < -50) setIndex((i) => Math.min(visibleSlides.length - 1, i + 1));
    if (dx > 50) setIndex((i) => Math.max(0, i - 1));
  }

  if (!presentation || !slide) return null;
  const lines = slide.elements.filter((e): e is LineElement => e.type === "line" || e.type === "arrow");

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div style={{ position: "relative", width: presentation.width, height: presentation.height, background: slide.background?.value ?? "#fff" }}>
        {slide.elements.filter((e) => e.type !== "line" && e.type !== "arrow").map((element) => (
          <CanvasElement key={element.id} slideId={slide.id} element={element} elementRef={() => {}} />
        ))}
        <LineArrowLayer lines={lines} width={presentation.width} height={presentation.height} />
      </div>
      <div style={{ position: "absolute", bottom: 16, right: 16, color: "#fff", fontSize: 14, fontFamily: "var(--ap-font-body)" }}>
        {index + 1} / {visibleSlides.length}
      </div>
      <button onClick={onExit} style={{ position: "absolute", top: 16, right: 16, color: "#fff", background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>
        ✕
      </button>
    </div>
  );
}

export function exportPresentationAsFile() {
  const json = useDocStore.getState().exportJSON();
  const presentation = useDocStore.getState().presentation;
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${presentation?.title ?? "presentation"}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importPresentationFromFile(file: File): Promise<void> {
  return file.text().then((json) => useDocStore.getState().importJSON(json));
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual QA** (once Task 21 mounts the shell)

Enter presentation mode: confirm fullscreen, arrow keys/space navigate,
swipe navigates on a touch device/emulator, Escape exits. Export JSON,
reload the editor, import the same file: confirm the deck is identical.

- [ ] **Step 4: Commit**

```bash
git add src/components/presentation-editor/PresentationMode.tsx
git commit -m "feat(presentation-editor): fullscreen presentation mode + JSON export/import"
```

---

## Task 20: `useAutosave` + save indicator + unload guard

**Files:**
- Create: `src/components/presentation-editor/hooks/useAutosave.ts`
- Test: `src/components/presentation-editor/hooks/__tests__/useAutosave.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/components/presentation-editor/hooks/__tests__/useAutosave.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAutosave } from "../useAutosave";
import { useDocStore } from "../../store/useDocStore";
import { createBlankPresentation } from "../../../types/presentation";

vi.mock("@/lib/content/contentRepo", () => ({
  updateContent: vi.fn(async () => {}),
  createContent: vi.fn(async () => ({ id: "new-row-id" })),
}));
import { updateContent, createContent } from "@/lib/content/contentRepo";

beforeEach(() => {
  vi.useFakeTimers();
  useDocStore.getState().load(createBlankPresentation("existing-id"));
});
afterEach(() => vi.useRealTimers());

describe("useAutosave", () => {
  it("debounces: rapid changes within the window only trigger one save", () => {
    const { result } = renderHook(() => useAutosave("row-1", "user-1"));
    useDocStore.getState().addSlide();
    useDocStore.getState().addSlide();
    useDocStore.getState().addSlide();
    vi.advanceTimersByTime(1500);
    expect(updateContent).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("saved");
  });

  it("does nothing when nothing changed", () => {
    renderHook(() => useAutosave("row-1", "user-1"));
    vi.advanceTimersByTime(5000);
    expect(updateContent).not.toHaveBeenCalled();
  });

  it("creates a content row on first save when contentId is null", async () => {
    const { result, rerender } = renderHook(({ id }) => useAutosave(id, "user-1"), { initialProps: { id: null as string | null } });
    useDocStore.getState().addSlide();
    vi.advanceTimersByTime(1500);
    await vi.waitFor(() => expect(createContent).toHaveBeenCalledTimes(1));
    rerender({ id: null });
    expect(result.current.contentId).toBe("new-row-id");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/presentation-editor/hooks/__tests__/useAutosave.test.ts`
Expected: FAIL — `Cannot find module '../useAutosave'` (and `@testing-library/react` not installed yet)

- [ ] **Step 3: Add the test-only dependency**

Run: `npm install -D @testing-library/react`

This is the one exception to the spec's "no new component-testing
dependency" call — `renderHook` is the only practical way to test a
debounced-effect hook's timing without a live DOM, and it's dev-only.

- [ ] **Step 4: Write the implementation**

```ts
// src/components/presentation-editor/hooks/useAutosave.ts
import { useEffect, useRef, useState } from "react";
import { useDocStore } from "../store/useDocStore";
import { createContent, updateContent } from "@/lib/content/contentRepo";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 1500;

export function useAutosave(initialContentId: string | null, userId: string) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [contentId, setContentId] = useState<string | null>(initialContentId);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const firstRun = useRef(true);

  const presentation = useDocStore((s) => s.presentation);

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (!presentation) return;

    clearTimeout(timerRef.current);
    setStatus("saving");
    timerRef.current = setTimeout(async () => {
      try {
        if (contentId) {
          await updateContent(contentId, { data: presentation as unknown as Record<string, unknown> });
        } else {
          const row = await createContent(userId, "slide", presentation as unknown as Record<string, unknown>);
          setContentId(row.id);
        }
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timerRef.current);
  }, [presentation, contentId, userId]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (status !== "saving") return;
      e.preventDefault();
      e.returnValue = "Des modifications ne sont pas encore enregistrées.";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status]);

  return { status, contentId };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/presentation-editor/hooks/__tests__/useAutosave.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/components/presentation-editor/hooks/useAutosave.ts src/components/presentation-editor/hooks/__tests__/useAutosave.test.ts
git commit -m "feat(presentation-editor): debounced autosave with save-status + unload guard"
```

---

## Task 21: `PresentationEditor` shell + route

**Files:**
- Create: `src/components/presentation-editor/PresentationEditor.tsx`
- Create: `src/pages/PresentationEditorPage.tsx`
- Modify: `src/App.tsx`

This is where every prior task's manual-QA steps actually become testable
end to end.

- [ ] **Step 1: Write the shell component**

```tsx
// src/components/presentation-editor/PresentationEditor.tsx
import { useEffect, useState } from "react";
import { useDocStore } from "./store/useDocStore";
import { useEditorUIStore } from "./store/useEditorUIStore";
import { useAutosave } from "./hooks/useAutosave";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { EditorToolbar } from "./EditorToolbar";
import { SlideNavigator } from "./SlideNavigator";
import { SlideCanvas } from "./SlideCanvas";
import { PropertiesPanel } from "./PropertiesPanel";
import { PresentationMode, exportPresentationAsFile, importPresentationFromFile } from "./PresentationMode";
import { getContent } from "@/lib/content/contentRepo";
import { isLegacySlideShape, migrateLegacySlideToPresentation } from "./utils/migrateLegacySlide";
import { createBlankPresentation, type Presentation } from "./types/presentation";

interface PresentationEditorProps {
  contentId: string | null;
  userId: string;
}

export function PresentationEditor({ contentId, userId }: PresentationEditorProps) {
  const [loading, setLoading] = useState(!!contentId);
  const [presenting, setPresenting] = useState(false);
  const presentation = useDocStore((s) => s.presentation);
  const load = useDocStore((s) => s.load);
  const activeSlideId = useEditorUIStore((s) => s.activeSlideId);
  const setActiveSlideId = useEditorUIStore((s) => s.setActiveSlideId);
  const setZoom = useEditorUIStore((s) => s.setZoom);
  const zoom = useEditorUIStore((s) => s.zoom);

  const { status } = useAutosave(contentId, userId);
  useKeyboardShortcuts(activeSlideId ?? "");

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!contentId) {
        const blank = createBlankPresentation(`new-${Date.now()}`);
        if (!cancelled) { load(blank); setActiveSlideId(blank.slides[0].id); setLoading(false); }
        return;
      }
      const row = await getContent(contentId);
      if (cancelled) return;
      const raw = row?.data ?? {};
      const pres: Presentation = isLegacySlideShape(raw)
        ? migrateLegacySlideToPresentation(raw as Parameters<typeof migrateLegacySlideToPresentation>[0])
        : (raw as unknown as Presentation);
      load(pres.slides?.length ? pres : createBlankPresentation(contentId));
      setActiveSlideId(pres.slides?.[0]?.id ?? null);
      setLoading(false);
    }
    init();
    return () => { cancelled = true; };
  }, [contentId, load, setActiveSlideId]);

  if (loading || !presentation || !activeSlideId) {
    return <div style={{ padding: 40, textAlign: "center" }}>Chargement…</div>;
  }

  if (presenting) {
    return <PresentationMode onExit={() => setPresenting(false)} />;
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderBottom: "var(--ap-border-w) solid var(--ap-line)" }}>
        <span style={{ fontFamily: "var(--ap-font-display)", fontWeight: 700 }}>{presentation.title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "var(--ap-muted)" }}>
            {status === "saving" ? "Enregistrement…" : status === "saved" ? "Enregistré" : status === "error" ? "Erreur d'enregistrement" : ""}
          </span>
          <button className="ap-btn ap-btn--sm ap-btn--ghost" onClick={() => setZoom(zoom - 0.1)}>−</button>
          <span style={{ fontSize: 12, width: 40, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
          <button className="ap-btn ap-btn--sm ap-btn--ghost" onClick={() => setZoom(zoom + 0.1)}>+</button>
          <button className="ap-btn ap-btn--sm ap-btn--ghost" onClick={exportPresentationAsFile}>Exporter JSON</button>
          <label className="ap-btn ap-btn--sm ap-btn--ghost" style={{ cursor: "pointer" }}>
            Importer JSON
            <input type="file" accept="application/json" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) importPresentationFromFile(f); }} />
          </label>
          <button className="ap-btn ap-btn--sm ap-btn--pill" onClick={() => setPresenting(true)}>▶ Présenter</button>
        </div>
      </div>
      <EditorToolbar slideId={activeSlideId} />
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <SlideNavigator />
        <SlideCanvas />
        <PropertiesPanel slideId={activeSlideId} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the page + route**

```tsx
// src/pages/PresentationEditorPage.tsx
import { useSearchParams } from "react-router-dom";
import { PresentationEditor } from "@/components/presentation-editor/PresentationEditor";
import { getCurrentUser } from "@/lib/auth";

const PresentationEditorPage = () => {
  const [searchParams] = useSearchParams();
  const contentId = searchParams.get("id");
  const user = getCurrentUser();
  if (!user) return null;
  return <PresentationEditor contentId={contentId} userId={user.id} />;
};

export default PresentationEditorPage;
```

```ts
// src/App.tsx — add alongside the other lazy page imports
const PresentationEditorPage = lazy(() => import("./pages/PresentationEditorPage"));
// ...and alongside the other <Route> entries
<Route path="/presentation-editor" element={<PresentationEditorPage />} />
```

- [ ] **Step 3: Verify it compiles and builds**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [ ] **Step 4: Manual QA — full end-to-end pass**

Start the dev server (`npm run dev`), navigate to `/presentation-editor`:
create a blank presentation, add a text/image/rect/circle/arrow element of
each type, drag/resize/rotate one, group two elements, align three, use
keyboard nudge and undo/redo, double-click to edit text, add a second
slide via the navigator and reorder it, enter presentation mode and
navigate with arrows, export then re-import JSON, confirm the "Enregistré"
indicator appears after edits and the row is visible in Supabase once
autosave fires.

- [ ] **Step 5: Commit**

```bash
git add src/components/presentation-editor/PresentationEditor.tsx src/pages/PresentationEditorPage.tsx src/App.tsx
git commit -m "feat(presentation-editor): shell component + /presentation-editor route"
```

---

## Task 22: Wire `MySlides` to the new editor, retire the legacy slide flow

**Files:**
- Modify: `src/pages/MySlides.tsx`
- Modify: `src/pages/QuizBuilderStart.tsx`
- Modify: `src/pages/LiveQuizPage.tsx`
- Modify: `src/components/QuizBuilder.tsx`

- [ ] **Step 1: Update `MySlides.tsx`'s config to the new editor and new count**

```tsx
// src/pages/MySlides.tsx — replace the whole file
import { useNavigate } from "react-router-dom";
import { ContentExplorer } from "@/components/content/ContentExplorer";
import { GenericCard, GenericRow, type GenericItemConfig } from "@/components/content/GenericItem";
import { t } from "@/lib/i18n";

const config: GenericItemConfig = {
  accentBtn: "ap-btn--pres",
  editRoute: (id) => `/presentation-editor?id=${id}`,
  countOf: (d) => (d.data.slides as unknown[] | undefined)?.length ?? 0,
  countLabel: (n) => `${n} diapositive${n > 1 ? "s" : ""}`,
  play: {
    label: "Présenter",
    run: (d, navigate) => navigate(`/presentation-editor?id=${(d.data.id as string) ?? ""}&present=1`),
  },
};

const MySlides = () => {
  const navigate = useNavigate();
  return (
    <ContentExplorer
      type="slide"
      accentBtn="ap-btn--pres"
      headerTitle={t("mySlides")}
      headerSubtitle={t("mySlidesSubtitle")}
      rootLabel="Toutes les présentations"
      oneLabel="présentation"
      cta={{ label: "Créer une présentation", onClick: () => navigate("/presentation-editor") }}
      renderCard={(d, ctx) => <GenericCard d={d} ctx={ctx} config={config} navigate={navigate} />}
      renderRow={(d, ctx) => <GenericRow d={d} ctx={ctx} config={config} navigate={navigate} />}
    />
  );
};

export default MySlides;
```

Note: the `&present=1` query param on the play action is read by
`PresentationEditorPage`/`PresentationEditor` — add that read in this
step too:

```tsx
// src/pages/PresentationEditorPage.tsx — modify
const presentParam = searchParams.get("present") === "1";
return <PresentationEditor contentId={contentId} userId={user.id} initialPresenting={presentParam} />;
```

```tsx
// src/components/presentation-editor/PresentationEditor.tsx — modify the props + initial state
interface PresentationEditorProps {
  contentId: string | null;
  userId: string;
  initialPresenting?: boolean;
}
export function PresentationEditor({ contentId, userId, initialPresenting = false }: PresentationEditorProps) {
  const [presenting, setPresenting] = useState(initialPresenting);
  // ...rest unchanged
```

- [ ] **Step 2: Remove the `slide` branch from `QuizBuilderStart.tsx`**

The old template-selection flow no longer applies — `/builder-start?type=slide`
should redirect straight to the new editor. Modify:

```tsx
// src/pages/QuizBuilderStart.tsx — at the very top of the component body, before computing quizType
import { Navigate } from "react-router-dom";
// ...
export const QuizBuilderStart = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  if (searchParams.get("type") === "slide") return <Navigate to="/presentation-editor" replace />;
  const quizType = (searchParams.get("type") || "quiz") as "quiz" | "poll" | "flashcard" | "slide";
  // ...rest unchanged (the isSlide-conditional JSX later in the file becomes dead code
  // reachable only for already-open tabs mid-navigation; leave it — Task 23 does the
  // full dead-code removal pass once this route change is verified working end to end)
```

- [ ] **Step 3: Swap `LiveQuizPage`'s `'slide'` case to the new presenter**

Legacy live sessions of `slide`-typed content go through
`SlidePresentationSession`; new content should render via the new
`PresentationMode` component instead, gated on shape:

```tsx
// src/pages/LiveQuizPage.tsx — modify the switch statement's 'slide' case
import { PresentationMode } from "@/components/presentation-editor/PresentationMode";
import { useDocStore } from "@/components/presentation-editor/store/useDocStore";
import { isLegacySlideShape, migrateLegacySlideToPresentation } from "@/components/presentation-editor/utils/migrateLegacySlide";
import type { Presentation } from "@/components/presentation-editor/types/presentation";
// ...
case "slide": {
  const raw = loadedQuiz as unknown as Record<string, unknown>;
  const pres: Presentation = isLegacySlideShape(raw)
    ? migrateLegacySlideToPresentation(raw as Parameters<typeof migrateLegacySlideToPresentation>[0])
    : (raw as unknown as Presentation);
  useDocStore.getState().load(pres);
  return <PresentationMode onExit={() => {}} />;
}
```

- [ ] **Step 4: Verify it compiles and builds**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [ ] **Step 5: Manual QA**

From `/my-slides`, click "Créer une présentation": lands on the new
editor with a blank deck. Click an existing legacy slide deck's card (one
created before this plan, if any test data exists): confirm
`isLegacySlideShape` migration path loads it correctly with title/body/
image elements positioned sensibly. Click "Présenter" from the list:
confirm it opens straight into presentation mode.

- [ ] **Step 6: Commit**

```bash
git add src/pages/MySlides.tsx src/pages/QuizBuilderStart.tsx src/pages/LiveQuizPage.tsx src/pages/PresentationEditorPage.tsx src/components/presentation-editor/PresentationEditor.tsx
git commit -m "feat(presentation-editor): wire Mes Slides + legacy live-session path to the new editor"
```

---

## Task 23: Remove now-dead legacy slide components

**Files:**
- Modify: `src/components/QuizBuilder.tsx`
- Delete: `src/components/SlideEditor.tsx`
- Delete: `src/components/SlidePreview.tsx`
- Delete: `src/components/SlideTemplateSelectorEnhanced.tsx`
- Delete: `src/components/SlidePresentationSession.tsx`
- Delete: `src/lib/slideTemplates.ts`

Only do this task after Task 22's manual QA passes — it removes the last
callers of these files.

- [ ] **Step 1: Remove the `isSlide` branch from `QuizBuilder.tsx`**

`QuizBuilder` is never reached for `type=slide` anymore (Task 22 redirects
before it). Search for every `isSlide` occurrence in
`src/components/QuizBuilder.tsx` and remove the conditional branches (the
`isSlide` variable itself, its uses in `handleSaveQuiz`'s navigate target,
`backPath`/`backLabel`, the `getSlideTemplate` template-loading branch, and
the `<SlideEditor>`/`<SlidePreview>` JSX branches) — `grep -n "isSlide" src/components/QuizBuilder.tsx`
first to get the current exact line numbers, since earlier unrelated edits
in this codebase may have shifted them.

- [ ] **Step 2: Delete the now-unreferenced files**

```bash
git rm src/components/SlideEditor.tsx src/components/SlidePreview.tsx src/components/SlideTemplateSelectorEnhanced.tsx src/components/SlidePresentationSession.tsx src/lib/slideTemplates.ts
```

- [ ] **Step 3: Verify nothing else imports them**

Run: `grep -rln "SlideEditor\|SlidePreview\|SlideTemplateSelectorEnhanced\|SlidePresentationSession\|slideTemplates" src/ | grep -v node_modules`
Expected: no output (empty).

- [ ] **Step 4: Verify it compiles and builds**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (no test referenced the deleted files directly —
confirm with the grep in Step 3 before deleting).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(presentation-editor): remove legacy slide editor/preview/templates (superseded by the canvas editor)"
```

---

## Self-review notes

**Spec coverage check** — every numbered section of the design doc maps to
a task: data model → Task 2; migration → Task 3; frontend architecture/
state separation → Tasks 5–7, 21; rendering (DOM+SVG) → Task 9; element
manipulation (drag/resize/rotate/group/align/distribute/z-order/keyboard/
snapping/marquee/pointer-unification) → Tasks 10–13, 15, 16; text editing
→ Task 14; media → Task 8; history → Task 6; persistence/autosave → Task
20; presentation mode → Task 19; MySlides integration + legacy cleanup →
Tasks 22–23; testing approach (pure-logic vitest, no new component-test
dependency except the one `@testing-library/react` exception for the
debounce-timing test) → present throughout.

**Explicitly not covered** (per the design doc's Out of Scope section, so
correctly absent here): realtime collaboration, comments, PDF/image
export, print, and a dedicated accessibility/performance/security audit
pass.

---

## Execution options

Plan complete and saved to `docs/superpowers/plans/2026-07-22-presentation-canvas-editor.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
