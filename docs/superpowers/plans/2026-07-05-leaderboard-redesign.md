# Leaderboard Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the mid-quiz leaderboard screen (`RaceLeaderboard`) to match the light paper-themed demo (`quizmaster-standings-demo.html`): card rows, callout pill for best climber, streak badges, fixed host bar with "Question suivante", and question stats (okPct).

**Architecture:** Three-task approach — (1) full visual redesign of `RaceLeaderboard.tsx` in place, keeping the existing animation logic (absolute positioning + top transition, score counting) but replacing all styles; (2) add `streak` tracking to `Player` type and `QuizSession.tsx`; (3) thread new props (`questionIndex`, `totalQuestions`, `okPct`) from `QuizSession.tsx` to `RaceLeaderboard`.

**Tech Stack:** React, CSS-in-JS (inline styles), existing design tokens (`--ap-*` CSS vars), lucide-react icons

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/RaceLeaderboard.tsx` | Rewrite visuals | Light theme, callout, host bar, streak badge, okPct header |
| `src/components/QuizSession.tsx` | Modify | Add `streak` to Player, track streak in `showAnswerDistribution`, pass new props |

---

### Task 1: Redesign RaceLeaderboard visuals

**Files:**
- Modify: `src/components/RaceLeaderboard.tsx`

**Context:**

Current props interface (DO NOT CHANGE — backward compatible):
```tsx
interface RaceLeaderboardProps {
  players: Player[];        // Player.streak?: number already exists after Task 2 — add it here first as optional
  onComplete?: () => void;
  isHost?: boolean;
  isLastQuestion?: boolean;
  autoAdvance?: boolean;
  // NEW props added in this task:
  questionIndex?: number;   // 1-based, e.g. 4
  totalQuestions?: number;  // e.g. 8
  okPct?: number;           // e.g. 75 (percent correct on this question)
}
```

Current Player interface (inside RaceLeaderboard.tsx, not the one in QuizSession.tsx):
```tsx
interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  previousScore?: number;
  streak?: number;   // ADD THIS
}
```

Animation logic to KEEP as-is:
- `displayOrder` state initialized to prev-score order, then sorted by new score after counting
- `countingScores` record — score counting animation (0.9s eased)
- `scoresReady` flag — gates the reorder and host bar
- `countdown` — auto-advance timer
- `posMap` — maps player.id to pixel top (for absolute-positioned FLIP)
- `stableOnComplete` / `firedRef` — prevents double fire

**New visual design:**

Replace the return JSX entirely with:

```tsx
// Design tokens
const PAPER = '#fff8ee';
const PAPER_2 = '#f3ecdd';
const CARD = '#ffffff';
const LINE = '#efe6d3';
const LINE_2 = '#d8ccb5';
const INK = '#241b3a';
const MUTED = '#6d6288';
const BRAND = '#7048ff';
const BRAND_DEEP = '#4f2fd0';
const BRAND_SOFT = '#efe9ff';
const GOLD = '#ffb020';
const FLASH_DEEP = '#a86e00';
const FLASH_SOFT = '#fff7e6';
const PRES = '#15c08a';
const PRES_DEEP = '#0b8a63';
const PRES_SOFT = '#e8faf3';
const QUIZ_DEEP = '#c93325';
const QUIZ_SOFT = '#fff3f0';
const SILVER = '#cfd4e2';
const BRONZE = '#e08a5a';
const R_MD = 16;
const R_LG = 24;
const R_PILL = 999;

// Medal config
const MEDAL_CONFIG = {
  1: { bg: GOLD,    shadow: `0 3px 0 ${FLASH_DEEP}` },
  2: { bg: SILVER,  shadow: '0 3px 0 #9aa2b8' },
  3: { bg: BRONZE,  shadow: '0 3px 0 #b05f30' },
} as const;
```

The callout is the "fait marquant" — computed after `scoresReady`:

```tsx
// Inside component, after computing currentRankMap and prevRankMap:
const bestClimber = scoresReady
  ? (() => {
      let best: { name: string; climb: number } | null = null;
      displayOrder.forEach((p) => {
        const climb = (prevRankMap[p.id] ?? 99) - (currentRankMap[p.id] ?? 99);
        if (climb > 0 && (!best || climb > best.climb)) best = { name: p.name, climb };
      });
      return best;
    })()
  : null;
```

Full JSX structure:

```tsx
return (
  <div style={{
    minHeight: '100vh',
    backgroundColor: PAPER,
    backgroundImage: `radial-gradient(${LINE_2} 1px, transparent 1px)`,
    backgroundSize: '28px 28px',
    fontFamily: 'var(--ap-font-body)',
    color: INK,
    display: 'flex',
    flexDirection: 'column',
    overflowX: 'hidden',
  }}>
    <div style={{ flex: 1, maxWidth: 880, margin: '0 auto', width: '100%', padding: '34px 24px 130px' }}>

      {/* Header */}
      <header style={{ textAlign: 'center', marginBottom: 8 }}>
        {questionIndex != null && totalQuestions != null && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 12.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: BRAND_DEEP, background: BRAND_SOFT,
            border: `2px solid rgba(112,72,255,0.32)`,
            padding: '6px 15px', borderRadius: R_PILL, marginBottom: 14,
          }}>
            📊 Classement — après la question {questionIndex}/{totalQuestions}
          </span>
        )}
        <h1 style={{
          fontFamily: 'var(--ap-font-display)',
          fontWeight: 600,
          fontSize: 'clamp(28px, 4vw, 40px)',
          margin: 0,
        }}>
          {isLastQuestion ? '🏆 Résultats finaux' : 'Qui mène la course ?'}
        </h1>
        {okPct != null && (
          <p style={{ marginTop: 8, fontWeight: 700, fontSize: 14.5, color: MUTED }}>
            Sur cette question : <b style={{ color: PRES_DEEP }}>{okPct} %</b> de bonnes réponses
          </p>
        )}
      </header>

      {/* Callout — best climber */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '18px 0 22px', minHeight: 44 }}>
        {bestClimber && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 9,
            fontFamily: 'var(--ap-font-display)', fontWeight: 600, fontSize: 17,
            color: FLASH_DEEP, background: FLASH_SOFT,
            border: `2px solid rgba(255,176,32,0.5)`,
            padding: '9px 20px', borderRadius: R_PILL,
            boxShadow: `0 4px 0 rgba(255,176,32,0.45)`,
            animation: 'callout-in 0.5s cubic-bezier(.2,.7,.3,1.3) forwards',
          }}>
            🚀 {bestClimber.name} gagne {bestClimber.climb} place{bestClimber.climb > 1 ? 's' : ''} !
          </span>
        )}
      </div>

      {/* Board */}
      <section aria-label="Classement des joueurs" style={{ position: 'relative', height: players.length * ROW_TOTAL }}>
        {players.map((player) => {
          const rank = currentRankMap[player.id] ?? 99;
          const prevRank = prevRankMap[player.id] ?? rank;
          const rankChange = prevRank - rank;
          const displayScore = countingScores[player.id] ?? (player.previousScore ?? 0);
          const scoreGain = player.score - (player.previousScore ?? 0);
          const top = posMap[player.id] ?? 0;
          const isFirst = rank === 1;
          const medal = MEDAL_CONFIG[rank as 1|2|3];
          const leaderScore = Math.max(...players.map(p => p.score), 1);
          const gapWidth = Math.round((displayScore / leaderScore) * 100);

          return (
            <div
              key={player.id}
              style={{
                position: 'absolute',
                top,
                left: 0, right: 0,
                height: ROW_H,
                transition: 'top 0.65s cubic-bezier(.2,.7,.3,1.3)',
                display: 'flex', alignItems: 'center', gap: 14,
                background: CARD,
                border: `2px solid ${isFirst && scoresReady ? 'rgba(255,176,32,0.6)' : LINE}`,
                borderRadius: R_MD,
                padding: '0 18px 0 14px',
                boxShadow: isFirst && scoresReady
                  ? `0 4px 0 rgba(255,176,32,0.55), 0 14px 30px rgba(255,176,32,.14)`
                  : `0 4px 0 ${LINE}`,
                overflow: 'hidden',
              }}
            >
              {/* Gap bar (écart au leader) */}
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 0,
                background: PAPER,
                borderRight: `2px solid ${LINE}`,
                width: `${100 - gapWidth}%`,
                transition: 'width 0.8s ease-out',
                pointerEvents: 'none',
              }} />

              {/* Rank badge */}
              <div style={{
                position: 'relative', zIndex: 1,
                flex: 'none', width: 40, height: 40, borderRadius: 12,
                display: 'grid', placeItems: 'center',
                fontFamily: 'var(--ap-font-display)', fontWeight: 600, fontSize: 19,
                background: medal ? medal.bg : PAPER_2,
                color: medal ? (rank === 3 ? '#fff' : INK) : MUTED,
                boxShadow: medal ? medal.shadow : 'none',
                transition: 'background 0.4s, color 0.4s',
              }}>
                {rank}
              </div>

              {/* Avatar */}
              <div style={{
                position: 'relative', zIndex: 1,
                flex: 'none', width: 46, height: 46, borderRadius: '50%',
                background: PAPER_2, border: `2px solid ${LINE}`,
                display: 'grid', placeItems: 'center', fontSize: 23,
              }}>
                <AvatarDisplay emoji={player.avatar} size="sm" />
              </div>

              {/* Name + streak + movement */}
              <div style={{ position: 'relative', zIndex: 1, flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{
                  fontWeight: 800, fontSize: 17,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {player.name}
                </span>
                {(player.streak ?? 0) >= 2 && (
                  <span style={{
                    fontFamily: 'var(--ap-font-display)', fontWeight: 600, fontSize: 12.5,
                    color: QUIZ_DEEP, background: QUIZ_SOFT,
                    border: `2px solid rgba(255,90,77,0.4)`,
                    borderRadius: R_PILL, padding: '2px 9px',
                    flexShrink: 0,
                  }}>
                    🔥 {player.streak}
                  </span>
                )}
              </div>

              {/* Movement badge */}
              {scoresReady && rankChange !== 0 && (
                <div style={{
                  position: 'relative', zIndex: 1,
                  flex: 'none', minWidth: 46, textAlign: 'center',
                  fontSize: 12.5, fontWeight: 800, borderRadius: R_PILL, padding: '4px 10px',
                  color: rankChange > 0 ? PRES_DEEP : QUIZ_DEEP,
                  background: rankChange > 0 ? PRES_SOFT : QUIZ_SOFT,
                  animation: 'mv-pop 0.4s cubic-bezier(.2,.7,.3,1.3) forwards',
                }}>
                  {rankChange > 0 ? `▲ ${rankChange}` : `▼ ${-rankChange}`}
                </div>
              )}

              {/* Score */}
              <div style={{ position: 'relative', zIndex: 1, flex: 'none', textAlign: 'right', minWidth: 92 }}>
                <div style={{
                  fontFamily: 'var(--ap-font-mono)', fontWeight: 700, fontSize: 18,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {displayScore.toLocaleString('fr-FR')}
                </div>
                {scoresReady && scoreGain > 0 && (
                  <div style={{
                    fontSize: 11.5, color: PRES_DEEP, fontWeight: 700,
                    animation: 'plus-in 0.35s ease forwards',
                  }}>
                    +{scoreGain.toLocaleString('fr-FR')}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: MUTED, marginTop: 14 }}>
        {players.length} joueur{players.length > 1 ? 's' : ''}
      </p>
    </div>

    {/* Host bar — fixed at bottom */}
    {isHost && scoresReady && (
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
        background: CARD, borderTop: `2px solid ${LINE}`,
        boxShadow: '0 -14px 34px rgba(60,40,120,.08)',
      }}>
        <div style={{
          maxWidth: 880, margin: '0 auto', padding: '14px 24px',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          {/* Progress */}
          {questionIndex != null && totalQuestions != null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 13.5, color: MUTED }}>
              <span style={{ fontFamily: 'var(--ap-font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                {questionIndex}/{totalQuestions}
              </span>
              <span style={{
                width: 130, height: 8, background: PAPER_2,
                border: `2px solid ${LINE}`, borderRadius: R_PILL, overflow: 'hidden',
                display: 'flex',
              }}>
                <i style={{
                  display: 'block', height: '100%', background: BRAND, borderRadius: R_PILL,
                  width: `${(questionIndex / totalQuestions) * 100}%`,
                  transition: 'width 0.5s ease',
                }} />
              </span>
              questions
            </span>
          )}

          <div style={{ flex: 1 }} />

          {/* Auto-advance progress strip */}
          {!isLastQuestion && (
            <div style={{ width: 100, height: 4, background: PAPER_2, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', background: BRAND, borderRadius: 4,
                width: `${(countdown / AUTO_ADVANCE_MS) * 100}%`,
                transition: 'width 50ms linear',
              }} />
            </div>
          )}

          {/* Next / final button */}
          <button
            onClick={stableOnComplete}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 9,
              fontFamily: 'var(--ap-font-body)', fontWeight: 800, fontSize: 15,
              padding: '13px 26px', borderRadius: R_PILL, border: 'none', cursor: 'pointer',
              color: isLastQuestion ? INK : '#fff',
              background: isLastQuestion ? GOLD : BRAND,
              boxShadow: isLastQuestion ? `0 5px 0 ${FLASH_DEEP}` : `0 5px 0 ${BRAND_DEEP}`,
            }}
          >
            {isLastQuestion ? '🏆 Voir le podium final' : 'Question suivante →'}
          </button>
        </div>
      </div>
    )}

    {/* Keyframe animations — injected via style tag */}
    <style>{`
      @keyframes callout-in { from { opacity: 0; transform: translateY(10px) scale(.9); } to { opacity: 1; transform: none; } }
      @keyframes mv-pop { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: scale(1); } }
      @keyframes plus-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
    `}</style>
  </div>
);
```

- [ ] **Step 1: Read the current file**

```bash
wc -l /Users/loicrossignol/Desktop/vibecoding/interactive-play-quiz/src/components/RaceLeaderboard.tsx
```

- [ ] **Step 2: Add new props to interface + Player streak field**

At the top of `RaceLeaderboard.tsx`, update:

```tsx
interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  previousScore?: number;
  streak?: number;  // ADD
}

interface RaceLeaderboardProps {
  players: Player[];
  onComplete?: () => void;
  isHost?: boolean;
  isLastQuestion?: boolean;
  autoAdvance?: boolean;
  questionIndex?: number;   // ADD
  totalQuestions?: number;  // ADD
  okPct?: number;           // ADD
}
```

- [ ] **Step 3: Add color constants at top of component function**

After `export const RaceLeaderboard = ({...props}: RaceLeaderboardProps) => {`, add the constants block (PAPER, CARD, LINE, INK, etc.) from the spec above.

- [ ] **Step 4: Add bestClimber computation**

After the existing `posMap` computation, add:

```tsx
const bestClimber = scoresReady
  ? (() => {
      let best: { name: string; climb: number } | null = null;
      displayOrder.forEach((p) => {
        const climb = (prevRankMap[p.id] ?? 99) - (currentRankMap[p.id] ?? 99);
        if (climb > 0 && (!best || climb > best.climb)) best = { name: p.name, climb };
      });
      return best;
    })()
  : null;
```

- [ ] **Step 5: Replace the return JSX**

Replace the entire `return (...)` block with the new JSX from the spec above.

- [ ] **Step 6: Verify TypeScript**

```bash
cd /Users/loicrossignol/Desktop/vibecoding/interactive-play-quiz
npx tsc --noEmit 2>&1 | grep -E "RaceLeaderboard"
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add src/components/RaceLeaderboard.tsx
git commit -m "feat(leaderboard): redesign RaceLeaderboard with light theme, callout, host bar"
```

---

### Task 2: Add streak tracking in QuizSession

**Files:**
- Modify: `src/components/QuizSession.tsx`

**Context:**

`Player` interface in `QuizSession.tsx` (around line 40):
```tsx
interface Player {
  id: string; name: string; avatar: string; score: number;
  previousScore?: number; correctAnswers: number;
  joinedAt: Date; lastAnswer?: number; lastAnswerQuestionIndex?: number;
}
```

`showAnswerDistribution` function (around line 628) fetches `freshPlayers: SharedPlayer[]` and syncs them via `setPlayers`. We add streak tracking here.

**What to add:**

1. Add `streak?: number` to `Player` interface
2. Add `const streakMapRef = useRef<Record<string, number>>({})` near other refs (around line 170)
3. In `showAnswerDistribution`, after the `setPlayers` call (around line 660-673), update the streak map by comparing current vs fresh `correctAnswers`:

```tsx
// Update streak map: if player answered correctly this question, increment; else reset
setPlayers(prev => {
  const updated = prev.map(p => {
    const fresh = freshPlayers.find(r => r.id === p.id);
    if (!fresh) return p;
    const answeredThisQuestion = fresh.lastAnswerQuestionIndex === currentQuestionIndex;
    const wasCorrect = answeredThisQuestion && (fresh.correctAnswers ?? 0) > (p.correctAnswers ?? 0);
    const newStreak = wasCorrect ? ((p.streak ?? 0) + 1) : 0;
    streakMapRef.current[p.id] = newStreak;
    return {
      ...p,
      score: fresh.score ?? p.score,
      correctAnswers: fresh.correctAnswers ?? p.correctAnswers,
      lastAnswer: fresh.lastAnswer,
      lastAnswerQuestionIndex: fresh.lastAnswerQuestionIndex,
      streak: newStreak,
    };
  });
  return updated;
});
```

**Important:** The existing `setPlayers` in `showAnswerDistribution` at line ~660 must be REPLACED (not duplicated) with the one above. It already does the score sync — we're extending it to also set `streak`.

- [ ] **Step 1: Read the Player interface and the showAnswerDistribution function**

```bash
sed -n '40,55p' /Users/loicrossignol/Desktop/vibecoding/interactive-play-quiz/src/components/QuizSession.tsx
sed -n '628,690p' /Users/loicrossignol/Desktop/vibecoding/interactive-play-quiz/src/components/QuizSession.tsx
```

- [ ] **Step 2: Add `streak?: number` to Player interface**

Find:
```tsx
interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  previousScore?: number;
  correctAnswers: number;
  joinedAt: Date;
  lastAnswer?: number;
  lastAnswerQuestionIndex?: number;
}
```

Replace with:
```tsx
interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  previousScore?: number;
  correctAnswers: number;
  joinedAt: Date;
  lastAnswer?: number;
  lastAnswerQuestionIndex?: number;
  streak?: number;
}
```

- [ ] **Step 3: Add streakMapRef**

Find the block of `useRef` declarations (around line 150-170). After the last `useRef`, add:

```tsx
const streakMapRef = useRef<Record<string, number>>({});
```

- [ ] **Step 4: Replace the setPlayers call in showAnswerDistribution**

Find the existing `setPlayers` in `showAnswerDistribution` (around line 660):
```tsx
    setPlayers((prev) =>
      prev.map((p) => {
        const fresh = freshPlayers.find((r) => r.id === p.id);
        if (!fresh) return p;
        return {
          ...p,
          score: fresh.score ?? p.score,
          correctAnswers: fresh.correctAnswers ?? p.correctAnswers,
          lastAnswer: fresh.lastAnswer,
          lastAnswerQuestionIndex: fresh.lastAnswerQuestionIndex,
        };
      })
    );
```

Replace with:
```tsx
    setPlayers((prev) =>
      prev.map((p) => {
        const fresh = freshPlayers.find((r) => r.id === p.id);
        if (!fresh) return p;
        const answeredThisQuestion = fresh.lastAnswerQuestionIndex === currentQuestionIndex;
        const wasCorrect = answeredThisQuestion && (fresh.correctAnswers ?? 0) > (p.correctAnswers ?? 0);
        const newStreak = wasCorrect ? ((p.streak ?? 0) + 1) : 0;
        streakMapRef.current[p.id] = newStreak;
        return {
          ...p,
          score: fresh.score ?? p.score,
          correctAnswers: fresh.correctAnswers ?? p.correctAnswers,
          lastAnswer: fresh.lastAnswer,
          lastAnswerQuestionIndex: fresh.lastAnswerQuestionIndex,
          streak: newStreak,
        };
      })
    );
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "QuizSession"
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/components/QuizSession.tsx
git commit -m "feat(leaderboard): track consecutive correct answer streak per player"
```

---

### Task 3: Pass question stats to RaceLeaderboard

**Files:**
- Modify: `src/components/QuizSession.tsx`

**Context:**

`answerDistribution` (line 132) is a `number[]` of percentages per answer option (e.g. `[12, 75, 8, 5]` for 4 options).  
`currentQuestion.correctAnswer` is the index of the correct answer (0-based `number`, or a `string` for open questions).

We compute `okPct` from `answerDistribution[correctAnswer]` — already a percentage.

The `RaceLeaderboard` is rendered at line 1384-1395:
```tsx
if (gameState === 'leaderboard') {
  return (
    <RaceLeaderboard
      players={players}
      onComplete={nextQuestion}
      isHost={isHost}
      isLastQuestion={currentQuestionIndex >= quiz.questions.length - 1}
      autoAdvance={autoAdvance}
    />
  );
}
```

- [ ] **Step 1: Read the leaderboard render block**

```bash
sed -n '1384,1398p' /Users/loicrossignol/Desktop/vibecoding/interactive-play-quiz/src/components/QuizSession.tsx
```

- [ ] **Step 2: Compute okPct from answerDistribution**

`currentQuestion.correctAnswer` is the correct answer index. `answerDistribution[idx]` is already a percent.

- [ ] **Step 3: Update RaceLeaderboard call site**

Find:
```tsx
  if (gameState === 'leaderboard') {
    return (
      <RaceLeaderboard
        players={players}
        onComplete={nextQuestion}
        isHost={isHost}
        isLastQuestion={currentQuestionIndex >= quiz.questions.length - 1}
        autoAdvance={autoAdvance}
      />
    );
  }
```

Replace with:
```tsx
  if (gameState === 'leaderboard') {
    const correctIdx = typeof currentQuestion?.correctAnswer === 'number'
      ? currentQuestion.correctAnswer
      : null;
    const okPct = correctIdx !== null && answerDistribution[correctIdx] != null
      ? answerDistribution[correctIdx]
      : undefined;
    return (
      <RaceLeaderboard
        players={players}
        onComplete={nextQuestion}
        isHost={isHost}
        isLastQuestion={currentQuestionIndex >= quiz.questions.length - 1}
        autoAdvance={autoAdvance}
        questionIndex={currentQuestionIndex + 1}
        totalQuestions={quiz.questions.length}
        okPct={okPct}
      />
    );
  }
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "QuizSession|RaceLeaderboard"
```

Expected: no output.

- [ ] **Step 5: Full build check**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in Xs`

- [ ] **Step 6: Commit + push**

```bash
git add src/components/QuizSession.tsx
git commit -m "feat(leaderboard): pass questionIndex, totalQuestions, okPct to RaceLeaderboard"
git push
```

---

## Self-Review

**Spec coverage:**
- ✅ Light paper theme with dot grid — Task 1
- ✅ Callout "fait marquant" (best climber) — Task 1
- ✅ Streak badge (🔥 N) — Task 1 display + Task 2 tracking
- ✅ Fixed host bar with "Question suivante" button — Task 1
- ✅ Progress bar (Q N/M) — Task 1
- ✅ Gap bar (écart au leader) — Task 1
- ✅ okPct stats ("75% de bonnes réponses") — Task 1 display + Task 3 data
- ✅ Score counting animation — preserved from existing
- ✅ FLIP-like reorder animation — preserved from existing
- ✅ Rank change badges ▲▼ — preserved, restyled

**Placeholder scan:** None. All JSX blocks are fully specified.

**Type consistency:**
- `Player.streak?: number` added in both Task 1 (RaceLeaderboard local Player) and Task 2 (QuizSession Player)
- `okPct?: number` defined in Task 1 props interface, passed in Task 3
- `questionIndex/totalQuestions?: number` defined in Task 1, passed in Task 3
