# Course Transitions Fix + Quiz Report View

**Date:** 2026-07-02  
**Status:** Approved

---

## 1. Course Transition Fix

### Problem

`CourseViewer.tsx` tracks manually-collapsed modules in `collapsedModules: Set<string>`. When the user navigates via "Suivant"/"Précédent" buttons (or clicks a lesson directly), if the target lesson belongs to a collapsed module, the sidebar renders nothing for that lesson — the active highlight is invisible.

### Fix

Add one `useEffect` in `CourseViewer` that fires when `currentLessonId` changes. It finds the module containing the active lesson and removes it from `collapsedModules`.

```ts
useEffect(() => {
  if (!currentLessonId || !course) return;
  const ownerModule = course.modules.find(m =>
    m.lessons.some(l => l.id === currentLessonId)
  );
  if (ownerModule) {
    setCollapsedModules(prev => {
      const next = new Set(prev);
      next.delete(ownerModule.id);
      return next;
    });
  }
}, [currentLessonId, course]);
```

**Scope:** 1 file, ~10 lines added.

---

## 2. Quiz Report Page

### Goal

A dedicated report page for quizzes, mirroring the existing `PollResults` page for polls.

### Data

Session history is stored in `localStorage` at key `quiz-session-history-{quizId}` via `appendSessionHistory` / `readSessionHistory` in `sessionState.ts`. Max 5 sessions kept. Each `SessionRun`:

```ts
interface SessionRun {
  id: string;
  date: string;
  questionCount: number;
  players: Array<{
    id: string;
    name: string;
    avatar: string;
    score: number;
    correctAnswers: number;
  }>;
}
```

### New Page — `src/pages/QuizResults.tsx`

Route: `/quiz-results/:quizId`

**Layout:**

```
Header — "[Quiz Title] — Résultats"
Back button → /my-quizzes

Stat cards (4):
  Sessions | Participants total | Score moyen | Meilleur score

Sessions accordion (newest first, first expanded):
  SessionCard header: Date · X participants · Y questions
  SessionCard body: ranked player list
    #rank  [avatar]  [name]  [score pts]  [correctAnswers/questionCount]
```

**Computed stats:**
- `totalSessions` = `runs.length`
- `totalParticipants` = `sum(run.players.length)`
- `avgScore` = `mean(all player scores across all sessions)`, rounded
- `bestScore` = `max(all player scores across all sessions)`

**Empty state:** when no sessions exist, show dashed-border card prompting user to launch the quiz.

### Access Point — `MyQuizzes.tsx`

Add "Résultats" button (icon: `BarChart2`) on each quiz card/list item, visible only when `readSessionHistory(quiz.id).length > 0`. Navigates to `/quiz-results/${quiz.id}`.

Pattern is identical to the existing "Résultats" button already present in `MyPolls.tsx`.

### Route

Add to `App.tsx`:
```tsx
<Route path="/quiz-results/:quizId" element={<QuizResults />} />
```

Add import for `QuizResults`.

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/CourseViewer.tsx` | +1 useEffect (auto-expand module) |
| `src/pages/QuizResults.tsx` | New page |
| `src/pages/MyQuizzes.tsx` | Add "Résultats" button per quiz card |
| `src/App.tsx` | +1 route + import |

---

## Out of Scope

- Poll results page: already exists (`PollResults.tsx`)
- Persisting more than 5 sessions (MAX_HISTORY limit intentional)
- CSV export
- Per-question answer distribution for quizzes (data not captured at session-history level)
