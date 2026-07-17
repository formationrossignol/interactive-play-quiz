# Exam Mode: Calm Timer + Organizer Results Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stressful red-pulsing exam countdown with a calm progress bar, and add a per-question difficulty section in ExamAdmin so organizers understand which questions were hardest.

**Architecture:** Two focused edits. (1) `ExamRoom.tsx` — rip out `timerDanger/timerWarn` color logic and the `pulse-danger` animation; replace with a time-remaining progress bar under the topbar and a calm minute-based text. (2) `ExamAdmin.tsx` — add a "Analyse par question" section below the attempts list, computed inline from the already-loaded attempts array; no new storage or route needed.

**Tech Stack:** React 18, inline styles (project convention), CSS custom properties (`var(--ap-*)`), no new dependencies.

**What is already built and should NOT be touched:**
- `durationMinutes` field and ExamBuilder toggle — fully working
- CSV export button in ExamAdmin — fully working
- Participant results list with expandable detail in ExamAdmin — fully working
- ExamResults page for participants — fully working
- Auto-submit at `secondsLeft === 0` in ExamRoom — keep exactly as-is

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/pages/ExamRoom.tsx` | Modify | Remove stress cues; add progress bar + calm minute text |
| `src/pages/ExamAdmin.tsx` | Modify | Add per-question difficulty analytics section |

---

### Task 1: Calm Timer in ExamRoom

**Files:**
- Modify: `src/pages/ExamRoom.tsx`

**Context — current stressful behaviour (lines 350–400):**
```tsx
const timerDanger = secondsLeft !== null && secondsLeft < 120;
const timerWarn   = secondsLeft !== null && secondsLeft < 300 && secondsLeft >= 120;

// topbar timer pill:
color: timerDanger ? '#ff5a4d' : timerWarn ? '#f4970a' : 'var(--ap-ink)',
background: timerDanger ? '#fff3f0' : timerWarn ? '#fff8ec' : 'var(--ap-paper-2)',
animation: timerDanger ? 'pulse-danger 1s ease infinite' : 'none',

// keyframe in <style>:
@keyframes pulse-danger { 0%,100%{opacity:1} 50%{opacity:.6} }
```

**Target UX:** A thin horizontal progress bar spanning the full topbar width, depleting left→right as time passes. Next to exam title: calm text "35 min restantes" (minutes only, updated every 60 s so the number doesn't tick down second-by-second). No color change. No animation. At < 5 min: add a tiny soft nudge text below the bar (`⏳ Pensez à soumettre bientôt`) in `var(--ap-muted)` — no red, no bold, no animation.

- [ ] **Step 1: Add `minutesLeft` derived state**

In `ExamRoom.tsx`, in the `phase === 'taking'` block (around line 345), after the existing derived values, add:

```tsx
const minutesLeft = secondsLeft !== null ? Math.ceil(secondsLeft / 60) : null;
```

- [ ] **Step 2: Remove stress-related constants**

Delete these two lines (they will no longer be referenced):
```tsx
const timerDanger = secondsLeft !== null && secondsLeft < 120;
const timerWarn = secondsLeft !== null && secondsLeft < 300 && secondsLeft >= 120;
```

- [ ] **Step 3: Replace the `<style>` block's `pulse-danger` keyframe**

Find in `ExamRoom.tsx`:
```tsx
<style>{`
  @keyframes pulse-danger { 0%,100%{opacity:1} 50%{opacity:.6} }
`}</style>
```

Delete it entirely (no replacement needed).

- [ ] **Step 4: Replace the timer pill in the topbar**

Find the current timer pill JSX (inside the topbar `<div>`, around line 378):
```tsx
{secondsLeft !== null && (
  <div style={{
    fontFamily: 'var(--ap-font-mono)', fontWeight: 800, fontSize: 18,
    color: timerDanger ? '#ff5a4d' : timerWarn ? '#f4970a' : 'var(--ap-ink)',
    background: timerDanger ? '#fff3f0' : timerWarn ? '#fff8ec' : 'var(--ap-paper-2)',
    padding: '4px 12px', borderRadius: 999,
    animation: timerDanger ? 'pulse-danger 1s ease infinite' : 'none',
  }}>
    ⏱ {fmt(secondsLeft)}
  </div>
)}
```

Replace with:
```tsx
{minutesLeft !== null && (
  <div style={{
    fontSize: 13, fontWeight: 800, color: 'var(--ap-muted)',
    background: 'var(--ap-paper-2)',
    padding: '4px 12px', borderRadius: 999, whiteSpace: 'nowrap',
  }}>
    {minutesLeft} min
  </div>
)}
```

- [ ] **Step 5: Replace the progress bar with a dual-track bar (answers + time)**

Currently the topbar has a single progress bar for answers answered (line ~394):
```tsx
{/* Progress bar */}
<div style={{
  position: 'absolute', bottom: 0, left: 0,
  height: 3, background: 'var(--ap-brand)',
  width: `${(answered / orderedQs.length) * 100}%`,
  transition: 'width .3s',
}} />
```

Replace with two stacked bars — answer progress in brand colour on top, time progress in a very light neutral behind it:

```tsx
{/* Dual progress bar */}
<div style={{
  position: 'absolute', bottom: 0, left: 0, right: 0, height: 4,
  background: 'var(--ap-line)',
}}>
  {/* Time consumed — fills left-to-right as time passes */}
  {secondsLeft !== null && exam.durationMinutes && (
    <div style={{
      position: 'absolute', top: 0, left: 0, bottom: 0,
      width: `${100 - Math.round((secondsLeft / (exam.durationMinutes * 60)) * 100)}%`,
      background: 'var(--ap-paper-2)',
      transition: 'width 1s linear',
    }} />
  )}
  {/* Answers answered — fills left-to-right */}
  <div style={{
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: `${(answered / orderedQs.length) * 100}%`,
    background: 'var(--ap-brand)',
    transition: 'width .3s',
  }} />
</div>
```

Wait — actually the time progress should be a distinct track. Simplify: just keep the answers progress bar as-is (it's already calm), and add the time as a thin secondary line above it or keep a separate indicator. The minutes pill (Step 4) is sufficient for time awareness.

Revised Step 5 — keep existing progress bar for answers, do nothing more:
The existing progress bar (`brand` color tracking answer completeness) stays unchanged. The minutes pill added in Step 4 handles time awareness. **No change needed to the progress bar.**

- [ ] **Step 6: Add the soft < 5 min nudge below the questions area (not topbar)**

In the questions list section (just before the submit button area, around line 476), add:

```tsx
{/* Gentle time nudge when < 5 min remaining */}
{minutesLeft !== null && minutesLeft <= 5 && minutesLeft > 0 && (
  <div style={{
    textAlign: 'center', fontSize: 12, fontWeight: 700,
    color: 'var(--ap-muted)', padding: '8px 0', marginBottom: 8,
  }}>
    ⏳ Pensez à soumettre bientôt
  </div>
)}
```

Place it between the last question card and the submit button.

- [ ] **Step 7: Verify build compiles**

```bash
cd /Users/loicrossignol/Desktop/vibecoding/interactive-play-quiz && npx tsc --noEmit
```

Expected: 0 errors (or only pre-existing errors unrelated to ExamRoom).

- [ ] **Step 8: Commit**

```bash
git add src/pages/ExamRoom.tsx
git commit -m "feat(exam): replace stressful countdown with calm minute timer"
```

---

### Task 2: Per-Question Difficulty Analytics in ExamAdmin

**Files:**
- Modify: `src/pages/ExamAdmin.tsx`

**Context:**
- `attempts` state already contains all attempts for the exam (loaded at line 47)
- `quiz` is loaded at line 88: `const quiz = getQuizById(exam.quizId)`
- `completed` is already computed: `const completed = attempts.filter(a => a.status === 'submitted' || a.status === 'auto-submitted')`
- The `checkCorrect(q, given)` function is defined at line 360
- The existing attempts list renders starting around line 239

**Goal:** Add a collapsible "Analyse par question" section below the attempts list showing, for each question: total responses, % correct, a simple visual bar.

- [ ] **Step 1: Add the `QuestionStats` type and compute function inside `ExamAdmin`**

Add this helper function just above the `return (` statement in `ExamAdmin` (around line 94), after `const completed = ...`:

```tsx
interface QuestionStat {
  id: string;
  question: string;
  totalResponded: number;
  correctCount: number;
  pctCorrect: number;
}

const questionStats: QuestionStat[] = quiz
  ? quiz.questions.map((q: { id: string; question: string; type: string; correctAnswer: unknown }) => {
      const responded = completed.filter((a) => {
        const given = a.answers[q.id];
        return given !== null && given !== undefined && given !== '';
      });
      const correct = responded.filter((a) => checkCorrect(q, a.answers[q.id]));
      const pct = responded.length > 0 ? Math.round((correct.length / responded.length) * 100) : 0;
      return {
        id: q.id,
        question: q.question,
        totalResponded: responded.length,
        correctCount: correct.length,
        pctCorrect: pct,
      };
    })
  : [];
```

- [ ] **Step 2: Add state for section collapse**

Add near the other `useState` declarations (around line 36):
```tsx
const [showQuestionStats, setShowQuestionStats] = useState(false);
```

- [ ] **Step 3: Render the section below the attempts list**

Add this block after the closing `</div>` of the attempts list section (after line 295), before the closing `</div>` of the content wrapper:

```tsx
{/* Per-question analysis */}
{quiz && questionStats.length > 0 && completed.length > 0 && (
  <div style={{ marginTop: 24 }}>
    <button
      onClick={() => setShowQuestionStats((s) => !s)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        fontFamily: 'var(--ap-font-display)', fontWeight: 600, fontSize: 18,
        color: 'var(--ap-ink)',
      }}
    >
      <span>📊 Analyse par question</span>
      <span style={{ fontSize: 14, color: 'var(--ap-muted)', transform: showQuestionStats ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▼</span>
    </button>

    {showQuestionStats && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {questionStats
          .slice()
          .sort((a, b) => a.pctCorrect - b.pctCorrect) // hardest first
          .map((qs, idx) => (
            <div key={qs.id} style={{
              background: 'var(--ap-card)', border: '2px solid var(--ap-line)',
              borderRadius: 'var(--ap-r-lg)', padding: '14px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{
                  width: 22, height: 22, borderRadius: 6, fontSize: 10, fontWeight: 800,
                  background: 'var(--ap-paper-2)', color: 'var(--ap-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {idx + 1}
                </span>
                <p style={{ fontSize: 13, fontWeight: 700, margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {qs.question}
                </p>
                <span style={{
                  fontSize: 14, fontWeight: 800, flexShrink: 0,
                  color: qs.pctCorrect >= 70 ? '#15c08a' : qs.pctCorrect >= 40 ? '#f4970a' : '#ff5a4d',
                }}>
                  {qs.pctCorrect}%
                </span>
              </div>
              {/* Success bar */}
              <div style={{ height: 6, background: 'var(--ap-line)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 999,
                  width: `${qs.pctCorrect}%`,
                  background: qs.pctCorrect >= 70 ? '#15c08a' : qs.pctCorrect >= 40 ? '#f4970a' : '#ff5a4d',
                  transition: 'width .4s',
                }} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-muted)', marginTop: 6 }}>
                {qs.correctCount}/{qs.totalResponded} bonne{qs.correctCount > 1 ? 's' : ''} réponse{qs.correctCount > 1 ? 's' : ''}
              </div>
            </div>
          ))}
      </div>
    )}
  </div>
)}
```

Note: The colour coding in the analytics bar (green/orange/red) is purely informational for the organizer — this does NOT affect participant experience. The stressful colours stay away from the participant view.

- [ ] **Step 4: Verify build compiles**

```bash
cd /Users/loicrossignol/Desktop/vibecoding/interactive-play-quiz && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ExamAdmin.tsx
git commit -m "feat(exam): add per-question difficulty analytics in admin view"
```

---

## Self-Review

**Spec coverage:**
- "définir une durée" → already implemented in ExamBuilder. Not touched. ✅
- "timer apparait mais il ne doit pas être stressant" → Task 1 removes red/pulse/orange, replaces with minute pill + gentle nudge. ✅
- "exporter les résultats" → CSV export already exists in ExamAdmin. Not touched. ✅
- "consulter les résultats" → Existing participant list preserved + Task 2 adds per-question analysis. ✅

**Placeholder scan:** No TBDs, all code is complete.

**Type consistency:**
- `QuestionStat` interface defined before use in Task 2. ✅
- `minutesLeft` derived from existing `secondsLeft` state in Task 1. ✅
- `checkCorrect` used in Task 2 is the function already defined in `ExamAdmin.tsx` at line 360. ✅
