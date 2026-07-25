# Global search bar — design

## Problem
No way to jump straight to a piece of content (quiz, poll, flashcard deck, slide, course, exam) from the top header. Users have to navigate into the matching "My X" page and use its local search.

## Scope
A single search input in `AppLayout`'s header (logged-in users only) that searches across all of the user's own content types and routes to the matching item's editor on click. MVP: flat top-8 dropdown, no dedicated results page, no folder/tool search.

## Data source
Existing polymorphic Supabase `content` table (`apps/app/src/lib/content/types.ts` — `ContentRow { id, user_id, type, data, ... }`, `data.title` holds the display title). No schema change.

Query (client-side, `apps/app/src/lib/content/contentRepo.ts` — new `searchContent` function):
```
supabase.from('content')
  .select('id,type,data,updated_at')
  .eq('user_id', userId)
  .in('type', CONTENT_TYPES)
  .ilike('data->>title', `%${q}%`)
  .order('updated_at', { ascending: false })
  .limit(30)
```
Client-side: drop rows where `data.deletedAt` is set (trashed), take the first 8.

## Component
New `apps/app/src/components/GlobalSearch.tsx`, mounted in `AppLayout.tsx`'s `<header>` between the logo block and the account menu (`ml-auto` group), only when `user` is truthy.

- Controlled text input; debounced 300ms; fires from 2+ characters typed.
- While focused with results (or loading), renders an absolutely-positioned dropdown panel below the input, styled consistent with existing `ap-card`/`DropdownMenuContent` tokens (`--ap-card`, `--ap-line`, `--ap-shadow-card`).
- Each result row: type icon (reuse the icon set already defined in `AppSidebar.tsx`'s `CREATE_ITEMS`, keyed by type), title (`data.title`), small type label (reuse existing `t()` keys: `creationTypeQuiz` etc.).
- Empty state (query present, 0 results): "Aucun résultat" row.
- Keyboard: `ArrowDown`/`ArrowUp` moves a highlighted index, `Enter` opens the highlighted row, `Escape` closes and blurs. Click-outside closes (existing pattern: mirror how other dropdowns in this codebase close, e.g. controlled `open` state + outside-click listener, matching `DropdownMenu` usage elsewhere).

## Routing on click
Reuses each type's existing edit route, collected into one lookup (new small map, colocated in `GlobalSearch.tsx`):
```
quiz:       (id) => `/builder?type=quiz&quizId=${id}`
poll:       (id) => `/builder?type=poll&quizId=${id}`
flashcard:  (id) => `/builder?type=flashcard&quizId=${id}`
slide:      (id) => `/presentation-editor?id=${id}`
course:     (id) => `/course-builder?courseId=${id}`
exam:       (id) => `/exam-builder?examId=${id}`
```
`id` here is `data.id` (the item's own id embedded in the jsonb payload — the same id `MyQuizzes.tsx` etc. already key off via their `idOf` helpers), not the Supabase row id.

## Out of scope (explicitly not building)
- Server-side full-text ranking / Postgres `tsvector` — `ilike` is enough at this data scale.
- Searching folders, tools (library not built yet), public/other users' content.
- A dedicated "all results" page beyond the top-8 dropdown.
- Recent-searches / history.

## Testing
- Unit test for the route-lookup map (pure function, one assertion per type).
- Manual: type a known quiz title fragment, confirm it appears and clicking it opens the builder with the right `quizId`.
