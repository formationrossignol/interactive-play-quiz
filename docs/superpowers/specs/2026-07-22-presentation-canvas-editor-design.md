# Presentation canvas editor — sub-project 1: core editor

## Context

Full ambition (stated by user): compete with Google Slides — a real canvas-based
presentation editor, not the current question-array `slide` content type
(`SlideEditor`/`SlidePreview`, title/content/image only).

That full ambition decomposes into independent sub-projects:

1. **Core canvas editor** (this spec) — slides/elements, selection, transform,
   rich text, media. Single-user.
2. Data model & persistence — folded into this spec (same `content` table,
   no new relational tables yet).
3. Real-time collaboration — Yjs/CRDT, presence, roles enforced server-side.
   New infra (WebSocket/Hocuspocus or equivalent). Separate spec.
4. Comments — threads, mentions, resolve. Separate spec.
5. Presentation mode polish + export — PDF/image export, print. Basic
   fullscreen slideshow + JSON export/import ARE in this spec (see Out of
   scope); PDF/image/print need a server-rendering decision, deferred.
6. Accessibility, performance, security hardening — cross-cutting, applied
   as baseline practice throughout 1–5, not a standalone project. This spec
   includes the baseline (keyboard nav, focus, ARIA on controls, the
   drag-perf mechanism, storage upload validation) but not a dedicated audit.

This document specs sub-project 1 only.

## Goals

Replace the `slide` content type entirely with a free-form
Presentation/Slide/Element model, editable in a canvas-style editor at
parity (list page, plan caps, etc.) with quiz/poll/flashcard/course. No
collaboration, comments, or PDF export in this phase.

## Data model

Stored as JSON in `content.data` (same polymorphic table as
quiz/poll/flashcard/course — no new relational tables for this phase):

```ts
type Presentation = {
  id: string;
  title: string;
  format: '16:9' | '4:3' | 'custom';
  width: number;   // logical px, e.g. 1280
  height: number;  // e.g. 720
  themeId?: string;
  slides: Slide[];
};

type Slide = {
  id: string;        // stable across reordering
  order: number;
  hidden: boolean;
  background?: { type: 'color' | 'gradient' | 'image'; value: string };
  elements: SlideElement[];
};

type BaseElement = {
  id: string;
  x: number; y: number;
  width: number; height: number;
  rotation: number;
  zIndex: number;
  opacity: number;
  locked: boolean;
  visible: boolean;
  groupId?: string;   // membership in a group; no deep nesting in V1
};

type TextElement  = BaseElement & { type: 'text';  richText: JSONContent /* Tiptap doc */ };
type ImageElement = BaseElement & { type: 'image'; src: string; crop?: Rect; borderRadius: number; borderWidth: number; borderColor: string };
type ShapeElement = BaseElement & { type: 'rect' | 'circle'; fill: string; stroke?: string; strokeWidth?: number };
type LineElement  = BaseElement & { type: 'line' | 'arrow'; points: [number, number][]; stroke: string; strokeWidth: number };
type VideoElement = BaseElement & { type: 'video'; src: string; provider: 'upload' | 'youtube' | 'vimeo' };
type GroupElement = BaseElement & { type: 'group'; childIds: string[] };

type SlideElement = TextElement | ImageElement | ShapeElement | LineElement | VideoElement | GroupElement;
```

Slide titles are a normal `TextElement` in `elements`, not a separate field —
consistent with "everything is a positionable element."

`themeId` is a forward-compat placeholder field only — no theme system
(no `ThemeDefinition` type, no theme picker/gallery component) is built in
this phase. V1's answer to "apply a theme/layout" is per-slide
`background` (already modeled) set manually; a real theme preset library is
deferred past this spec, added later without a data migration since the
field already exists.

## Migration of existing legacy `slide` content

Old shape (`SavedQuiz` with `type: 'slide'`): `questions: [{ type: 'slide',
title, content, image }]`. On open, detect the old shape (has `questions`,
no `slides`) and run a pure `migrateLegacySlideToPresentation()` converter:
each legacy question becomes a `Slide` with a title `TextElement`, a body
`TextElement`, and an optional `ImageElement` at sensible default positions.
Save immediately in the new shape — lazy, one-time, on-open (same pattern
already used by `migrateLocalToSupabase`'s flag-gated one-time import), no
separate batch job.

## Frontend architecture

The project has no `features/` layout — everything is flat
(`src/components`, `src/pages`, `src/lib`, `src/hooks`). A dedicated
subfolder under `src/components/`, not a new top-level paradigm:

```
src/components/presentation-editor/
  PresentationEditor.tsx       # shell, mounts everything else
  EditorToolbar.tsx            # contextual toolbar (depends on selection)
  SlideNavigator.tsx           # thumbnail column, DnD reorder (dnd-kit, already a dep), virtualized
  SlideThumbnail.tsx           # one thumbnail (cached render, see Performance)
  SlideCanvas.tsx              # center stage: active slide, zoom/pan
  elements/
    CanvasElement.tsx          # router by type -> *ElementView
    TextElementView.tsx
    ImageElementView.tsx
    ShapeElementView.tsx       # rect/circle in SVG
    LineArrowLayer.tsx         # ONE shared SVG layer for all lines/arrows on the slide
    VideoElementView.tsx
    GroupElementView.tsx
  SelectionOverlay.tsx         # selection rect(s) + handles
  TransformControls.tsx        # drag/resize/rotate logic (see Manipulation)
  PropertiesPanel.tsx          # content depends on selected type
  PresentationMode.tsx         # fullscreen slideshow (basic — see Presentation mode)
  store/
    useDocStore.ts             # Zustand — the document (Presentation/Slide/Element), persistent
    useEditorUIStore.ts        # Zustand — ephemeral UI state (selection, tool, zoom, in-progress drag, guides)
    useHistoryStore.ts         # undo/redo, operates on useDocStore
  hooks/
    useElementDrag.ts, useElementResize.ts, useKeyboardShortcuts.ts, useAutosave.ts
  types/
    presentation.ts            # the data model above
```

**State separation** — two distinct Zustand stores, never one React context:

- `useDocStore`: the document. The only thing persisted (autosave →
  `content.data`). All mutation goes through its actions
  (`updateElement`, `addSlide`, ...) — isolates the future Yjs swap
  (sub-project 3) to this store alone, components never touch it directly.
- `useEditorUIStore`: current selection, active tool, zoom, open panel, drag
  in progress, alignment guides. Never persisted, never sent to the server.
- `useHistoryStore`: separate undo/redo stack, observes `useDocStore` commits
  (not every drag frame — see History).

**Rendering (DOM + SVG)** — chosen over Fabric.js/Konva: native text
rendering stays crisp at any zoom (canvas text is rasterized and blurs),
`contentEditable` integrates directly with Tiptap with no overlay-sync
hack, and accessibility comes from real DOM nodes instead of being rebuilt
by hand over an opaque `<canvas>`. `SlideCanvas` is a `<div>` at the
presentation's logical size (e.g. 1280×720); zoom is a CSS
`transform: scale()` on that container only — it never touches stored x/y/
width. Each element is an absolutely positioned child `<div>`. Lines/arrows
live in one shared `<svg>` overlay per slide (not one `<svg>` per element)
for correct z-ordering and handle hit-testing. Non-active text renders as
static HTML (Tiptap `generateHTML`, no mounted instance); double-click
mounts a real Tiptap instance for that one element only.

## Element manipulation

Hard requirement: zero unnecessary React re-renders during drag.

```
pointerdown on element
  → capture initial geometry (x,y,w,h,rotation) from useDocStore, once
  → useEditorUIStore only flips isDragging=true (not live coordinates)

pointermove (can fire at 120Hz)
  → compute delta, apply directly via ref: element.style.transform = `translate(${dx}px,${dy}px)`
  → NO setState, NO re-render, NO useDocStore write
  → alignment guides: other elements' geometry read once at pointerdown,
    compared in plain JS during move, guide overlay updated via ref (not React state)
  → snapping: adjusts dx/dy before applying the transform (magnetism on edges/centers/grid)

pointerup
  → ONE useDocStore.updateElement(id, {x: x0+dx, y: y0+dy}) commit
  → ONE history entry
  → triggers debounced autosave
```

Same mechanism for resize (`TransformControls` handles) and rotate (angle
around element center). Multi-selection: delta applied to all selected
elements in one pass, one grouped commit.

**Groups**: a `GroupElement` references `childIds`. Moving a group applies
the same delta to each child (no nested coordinate spaces in the model —
simpler, sufficient for V1). Group rotation = affine rotation of each
child around the group's bounding-box center, one commit.

**Multi-select**: shift-click toggles membership in
`useEditorUIStore.selectedIds` (a `Set`). Marquee selection: pointerdown on
empty canvas draws a rectangle via ref (no state during drag), intersected
elements committed to `selectedIds` once on pointerup.

**Align/distribute/z-order**: one-shot actions (one click = one commit), no
drag, no perf concern. Align relative to selection bounding box or to the
slide; distribute = even spacing over sorted positions.

**Keyboard**: arrows nudge 1px, Shift+arrow nudges 10px. Holding Alt during
a mouse drag disables snapping for precise pixel placement.

**Pointer unification**: Pointer Events API everywhere (`pointerdown/move/
up`), not separate mouse/touch handlers.

## Text editing

Reuses Tiptap (`@tiptap/react`, `starter-kit`,
`extension-link/placeholder/text-align/underline` already deps). New:
`@tiptap/extension-text-style` + `extension-color` + `extension-font-family`
(official Tiptap extensions, not a new library) for color/font/size.

- `TextElement.richText` is a Tiptap JSON doc, not raw stored HTML.
- Inactive elements render static HTML (`generateHTML()`, no mounted
  instance — see Rendering).
- Double-click mounts a real editable instance for that element; Escape/
  click-away commits and unmounts.
- Contextual toolbar driven by Tiptap commands
  (`editor.chain().focus().toggleBold().run()`, ...), shown in
  `PropertiesPanel` when a text element is selected/edited.
- Paste sanitized via `dompurify` (already a dep) before insertion — never
  insert raw clipboard HTML.
- Auto-grow height by default; width is manually resizable; toggle to lock
  a fixed box.

## Images and media

New Supabase Storage bucket `presentation-media` (owner write, public read
when the presentation `is_public` — mirrors the existing `content.is_public`
model). Upload is real; only the resulting URL goes into `ImageElement.src`
— never raw bytes in the jsonb blob.

- Validation before upload: type whitelist (png/jpeg/webp/gif;
  mp4/webm for video), size limit (proposed 10MB image / 50MB video,
  adjustable).
- Upload errors surface via `sonner` toast (existing pattern) with retry.
- Crop stored as a `Rect` (source-image space), applied via CSS
  (`object-position`/`clip-path`) at display time — no physical re-encode
  until export.
- Rounded corners/border/opacity are plain CSS from `ImageElement`
  properties.

## History

Undo/redo stack in `useHistoryStore`, lightweight diffs (not whole-document
snapshots), capped (proposed 100 entries, oldest dropped).

- One "gesture" = one entry: the commit-on-pointerup mechanism above
  already coalesces drag/resize/rotate. For text: commit on blur or a
  typing pause (~500ms), not per keystroke.
- V1 is a plain single-user stack, NOT CRDT-compatible yet. Deliberate seam
  for later: when sub-project 3 replaces `useDocStore` internals with Yjs,
  history moves to Yjs's own `UndoManager` (built for exactly this) — not
  built now (YAGNI).

## Persistence / autosave

- `useDocStore` changes → debounced autosave (~1.5s after the last commit)
  → upsert into `content.data` (same table/pattern as quiz/poll/course
  today).
- "Saving…" / "Saved" / error+retry indicator as light local state, not in
  the doc store.
- Initial load: fetch the `content` row by id, parse JSON into the doc
  store.
- Data-loss prevention: reuse the existing `shouldBlockNavigation` /
  `beforeunload` pattern already in `QuizBuilder`, not a new mechanism.

## Presentation mode (basic, in scope)

Fullscreen slideshow of the current deck: keyboard navigation
(arrows/Escape), touch swipe navigation, optional slide numbering, a
minimal presenter view (current + next slide), JSON export/import (trivial
— serializes/deserializes the doc store to a file). PDF export, image
export, and print are explicitly **out of scope** for this spec (need a
server-rendering decision — deferred to sub-project 5).

## Accessibility & performance baseline (in scope, not a dedicated audit)

- Keyboard reachability for all toolbar/panel controls, visible focus,
  accessible labels/ARIA on icon-only buttons.
- `SlideNavigator` thumbnail list virtualized (decks can have many slides).
  Thumbnails cached/re-rendered only when their slide's content actually
  changes.
- The drag-perf mechanism above is the main performance guarantee for this
  phase; a dedicated performance/a11y audit pass is sub-project 6, not
  redone here.

## Testing

The project has no component-testing library (no `@testing-library`) —
existing tests (`migrate.test.ts`, `plans.test.ts`) are pure-logic vitest,
no rendering. Same approach here:

- Vitest on geometry math (snapping, align/distribute, group transform,
  history diff/undo-apply) — no DOM.
- Vitest on the Zustand store actions directly (create a store instance,
  dispatch, assert state) — no rendering.
- Drag/Tiptap/canvas interactions: manual QA via the dev server (already
  the project's convention this session), no new component-testing
  dependency for this phase.

## Out of scope for this spec

- Real-time collaboration (Yjs/CRDT, presence, roles enforced
  server-side) — sub-project 3.
- Comments (threads, mentions, resolve) — sub-project 4.
- PDF export, image export, print — sub-project 5.
- Dedicated accessibility/performance/security audit passes — sub-project
  6 (baseline hygiene above is included; the audit is not).
