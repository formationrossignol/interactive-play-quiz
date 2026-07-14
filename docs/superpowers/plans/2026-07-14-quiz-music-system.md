# Quiz Music System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-track `BackgroundMusic.tsx` stub with a phase-based music + SFX system for live quizzes, with host-chosen ambiance and per-device player mute, using self-hosted audio and zero new dependencies.

**Architecture:** A pure data manifest (`audioManifest.ts`) maps ambiances + game phases to self-hosted audio files. A `useGameAudio` hook owns one `HTMLAudioElement` for music plus event SFX, deriving the current track locally from the already-synced `game_state` (no new Supabase sync for playback). An `AudioControls` component gives per-device mute/volume. Ambiance is chosen in `QuizBuilder`, stored on the quiz, and (Task 7) echoed to players through the existing `create_session_atomic` RPC.

**Tech Stack:** React 18, TypeScript, Vitest (node + jsdom per-file), native `HTMLAudioElement`, Arcade Pop CSS tokens, Supabase edge function + Postgres RPC.

---

## File Structure

**Create:**
- `src/lib/audioManifest.ts` — ambiance/phase/SFX data + pure resolvers (`phaseToRole`, `resolveTrack`).
- `src/lib/__tests__/audioManifest.test.ts` — resolver tests (node env).
- `src/lib/audioPrefs.ts` — load/save per-device mute+volume in `localStorage`.
- `src/lib/__tests__/audioPrefs.test.ts` — persistence tests (jsdom env).
- `src/hooks/useGameAudio.ts` — the audio engine hook.
- `src/components/AudioControls.tsx` — mute/volume UI (replaces `BackgroundMusic` button).
- `public/audio/README.md` — asset sourcing instructions + filenames.
- `public/audio/{arcade,chill,epic}/{lobby,question,results,victory}.mp3` — placeholders.
- `public/audio/sfx/{tick,correct,wrong,reveal,podium}.mp3` — placeholders.

**Modify:**
- `src/lib/quizStorage.ts` — add `ambianceId?` to `SavedQuiz`.
- `src/pages/LiveQuizPage.tsx` — thread `ambianceId` onto the host quiz object.
- `src/components/QuizSession.tsx` — add `ambianceId?` to its `QuizSession` interface; use `useGameAudio`; replace `BackgroundMusic`; fire SFX; pass ambiance to `createLiveSession`.
- `src/components/PlayerView.tsx` — use `useGameAudio`; replace `BackgroundMusic`; fire correct/wrong SFX; read `quiz_data.ambianceId`.
- `src/components/QuizBuilder.tsx` — ambiance picker writing `ambianceId`.
- `src/lib/sessionState.ts` — `createLiveSession` accepts optional `ambianceId`.
- `supabase/functions/create-session/index.ts` — forward `ambiance_id` into the RPC.
- `supabase/migrations/<new>_create_session_ambiance.sql` — RPC gains `p_ambiance_id`.

**Delete:**
- `src/components/BackgroundMusic.tsx` (absorbed by `AudioControls` + `useGameAudio`).

---

## Task 1: Audio manifest (pure data + resolvers)

**Files:**
- Create: `src/lib/audioManifest.ts`
- Test: `src/lib/__tests__/audioManifest.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/audioManifest.test.ts
import { describe, expect, it } from 'vitest';
import {
  AMBIANCES,
  SFX,
  DEFAULT_AMBIANCE,
  phaseToRole,
  resolveTrack,
  type AmbianceId,
  type MusicRole,
} from '../audioManifest';

describe('audioManifest', () => {
  it('default ambiance is arcade and is a real ambiance', () => {
    expect(DEFAULT_AMBIANCE).toBe('arcade');
    expect(AMBIANCES.arcade).toBeDefined();
  });

  it('every non-none ambiance defines all four music roles as file paths', () => {
    const roles: MusicRole[] = ['lobby', 'question', 'results', 'victory'];
    for (const id of Object.keys(AMBIANCES) as Exclude<AmbianceId, 'none'>[]) {
      for (const role of roles) {
        const path = AMBIANCES[id].tracks[role];
        expect(path, `${id}.${role}`).toMatch(/^\/audio\/.+\.mp3$/);
      }
    }
  });

  it('every SFX resolves to a file path', () => {
    for (const name of Object.keys(SFX) as (keyof typeof SFX)[]) {
      expect(SFX[name], name).toMatch(/^\/audio\/sfx\/.+\.mp3$/);
    }
  });

  it('maps game phases to the correct music intent', () => {
    expect(phaseToRole('waiting')).toBe('lobby');
    expect(phaseToRole('countdown')).toBe('lobby');
    expect(phaseToRole('question-intro')).toBe('lobby');
    expect(phaseToRole('question')).toBe('question');
    expect(phaseToRole('answer-distribution')).toBe('fade');
    expect(phaseToRole('answer-feedback')).toBe('fade'); // PlayerView's alias
    expect(phaseToRole('leaderboard')).toBe('results');
    expect(phaseToRole('transition')).toBe('results');
    expect(phaseToRole('final')).toBe('victory');
    expect(phaseToRole('abandoned')).toBe('stop');
    expect(phaseToRole('unknown-state')).toBe('stop');
  });

  it('resolveTrack returns a path for real ambiances and null for none', () => {
    expect(resolveTrack('arcade', 'lobby')).toBe(AMBIANCES.arcade.tracks.lobby);
    expect(resolveTrack('none', 'lobby')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/audioManifest.test.ts`
Expected: FAIL — `Cannot find module '../audioManifest'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/audioManifest.ts
// Single source of truth for all quiz audio. Pure data + pure resolvers — no
// side effects, no DOM. The engine (useGameAudio) consumes this.

export type AmbianceId = 'arcade' | 'chill' | 'epic' | 'none';
export type MusicRole = 'lobby' | 'question' | 'results' | 'victory';
export type SfxName = 'tick' | 'answer-correct' | 'answer-wrong' | 'reveal' | 'podium';

// What the current phase wants the music to do. 'fade' = keep playing but duck
// under the SFX; 'stop' = silence.
export type MusicIntent = MusicRole | 'fade' | 'stop';

export const DEFAULT_AMBIANCE: AmbianceId = 'arcade';

export interface Ambiance {
  label: string;
  tracks: Record<MusicRole, string>;
}

export const AMBIANCES: Record<Exclude<AmbianceId, 'none'>, Ambiance> = {
  arcade: {
    label: 'Arcade',
    tracks: {
      lobby: '/audio/arcade/lobby.mp3',
      question: '/audio/arcade/question.mp3',
      results: '/audio/arcade/results.mp3',
      victory: '/audio/arcade/victory.mp3',
    },
  },
  chill: {
    label: 'Chill',
    tracks: {
      lobby: '/audio/chill/lobby.mp3',
      question: '/audio/chill/question.mp3',
      results: '/audio/chill/results.mp3',
      victory: '/audio/chill/victory.mp3',
    },
  },
  epic: {
    label: 'Épique',
    tracks: {
      lobby: '/audio/epic/lobby.mp3',
      question: '/audio/epic/question.mp3',
      results: '/audio/epic/results.mp3',
      victory: '/audio/epic/victory.mp3',
    },
  },
};

export const SFX: Record<SfxName, string> = {
  tick: '/audio/sfx/tick.mp3',
  'answer-correct': '/audio/sfx/correct.mp3',
  'answer-wrong': '/audio/sfx/wrong.mp3',
  reveal: '/audio/sfx/reveal.mp3',
  podium: '/audio/sfx/podium.mp3',
};

// Options for the QuizBuilder picker (includes the silent 'none' choice).
export const AMBIANCE_OPTIONS: { id: AmbianceId; label: string }[] = [
  ...(Object.keys(AMBIANCES) as Exclude<AmbianceId, 'none'>[]).map((id) => ({
    id: id as AmbianceId,
    label: AMBIANCES[id].label,
  })),
  { id: 'none', label: 'Silencieux' },
];

// Accepts a broad string because host and player components each carry their
// own gameState union (PlayerView aliases 'answer-distribution' → 'answer-feedback').
export function phaseToRole(gameState: string): MusicIntent {
  switch (gameState) {
    case 'waiting':
    case 'countdown':
    case 'question-intro':
      return 'lobby';
    case 'question':
      return 'question';
    case 'answer-distribution':
    case 'answer-feedback':
      return 'fade';
    case 'leaderboard':
    case 'transition':
      return 'results';
    case 'final':
      return 'victory';
    default:
      return 'stop';
  }
}

export function resolveTrack(ambianceId: AmbianceId, role: MusicRole): string | null {
  if (ambianceId === 'none') return null;
  const ambiance = AMBIANCES[ambianceId];
  if (!ambiance) return null;
  return ambiance.tracks[role] ?? null;
}

export function normalizeAmbianceId(value: unknown): AmbianceId {
  if (value === 'arcade' || value === 'chill' || value === 'epic' || value === 'none') {
    return value;
  }
  return DEFAULT_AMBIANCE;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/audioManifest.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/audioManifest.ts src/lib/__tests__/audioManifest.test.ts
git commit -m "feat(audio): quiz audio manifest with phase resolvers"
```

---

## Task 2: Audio preferences (per-device mute/volume persistence)

**Files:**
- Create: `src/lib/audioPrefs.ts`
- Test: `src/lib/__tests__/audioPrefs.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/audioPrefs.test.ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { loadAudioPrefs, saveAudioPrefs, DEFAULT_PREFS } from '../audioPrefs';

beforeEach(() => localStorage.clear());

describe('audioPrefs', () => {
  it('returns defaults when nothing stored', () => {
    expect(loadAudioPrefs()).toEqual(DEFAULT_PREFS);
  });

  it('round-trips saved prefs', () => {
    saveAudioPrefs({ muted: true, volume: 0.5 });
    expect(loadAudioPrefs()).toEqual({ muted: true, volume: 0.5 });
  });

  it('clamps volume into 0..1 and coerces bad data to defaults', () => {
    localStorage.setItem('audio.volume', '5');
    localStorage.setItem('audio.muted', 'not-a-bool');
    const prefs = loadAudioPrefs();
    expect(prefs.volume).toBe(1);
    expect(prefs.muted).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/audioPrefs.test.ts`
Expected: FAIL — `Cannot find module '../audioPrefs'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/audioPrefs.ts
// Per-device audio preferences. Each player/host controls their own volume on
// their own machine — deliberately NOT synced across devices.

export interface AudioPrefs {
  muted: boolean;
  volume: number; // 0..1
}

export const DEFAULT_PREFS: AudioPrefs = { muted: false, volume: 0.4 };

const MUTED_KEY = 'audio.muted';
const VOLUME_KEY = 'audio.volume';

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function loadAudioPrefs(): AudioPrefs {
  try {
    const rawMuted = localStorage.getItem(MUTED_KEY);
    const rawVolume = localStorage.getItem(VOLUME_KEY);
    const muted = rawMuted === 'true';
    const parsedVolume = rawVolume === null ? DEFAULT_PREFS.volume : Number(rawVolume);
    const volume = Number.isFinite(parsedVolume) ? clamp01(parsedVolume) : DEFAULT_PREFS.volume;
    return { muted, volume };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveAudioPrefs(prefs: AudioPrefs): void {
  try {
    localStorage.setItem(MUTED_KEY, String(prefs.muted));
    localStorage.setItem(VOLUME_KEY, String(clamp01(prefs.volume)));
  } catch {
    /* storage unavailable (private mode) — ignore, prefs just won't persist */
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/audioPrefs.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/audioPrefs.ts src/lib/__tests__/audioPrefs.test.ts
git commit -m "feat(audio): per-device mute/volume persistence"
```

---

## Task 3: `useGameAudio` engine hook

No unit test (jsdom does not implement `HTMLMediaElement.play`, and adding a hook-testing harness/dependency is out of scope). Logic it depends on is already tested in Tasks 1–2; the hook itself is verified by running the app in Task 9.

**Files:**
- Create: `src/hooks/useGameAudio.ts`

- [ ] **Step 1: Write the hook**

```ts
// src/hooks/useGameAudio.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  phaseToRole,
  resolveTrack,
  SFX,
  normalizeAmbianceId,
  type AmbianceId,
  type SfxName,
} from '@/lib/audioManifest';
import { loadAudioPrefs, saveAudioPrefs } from '@/lib/audioPrefs';

interface UseGameAudioArgs {
  ambianceId: AmbianceId | string | undefined;
  gameState: string;
  /** Host screen plays the shared music bed; players share the same engine. */
  isHost: boolean;
}

export interface GameAudioApi {
  muted: boolean;
  volume: number;
  setMuted: (m: boolean) => void;
  setVolume: (v: number) => void;
  /** Call from a user gesture (host "Lancer", player "Rejoindre") to satisfy autoplay policy. */
  unlock: () => void;
  playSfx: (name: SfxName) => void;
}

const FADE_VOLUME = 0.12; // music ducks to this under 'fade' phases
const SWITCH_DEBOUNCE_MS = 150;

export function useGameAudio({ ambianceId, gameState, isHost }: UseGameAudioArgs): GameAudioApi {
  const ambiance = normalizeAmbianceId(ambianceId);

  const initial = loadAudioPrefs();
  const [muted, setMutedState] = useState(initial.muted);
  const [volume, setVolumeState] = useState(initial.volume);

  const musicRef = useRef<HTMLAudioElement | null>(null);
  const currentSrcRef = useRef<string | null>(null);
  const unlockedRef = useRef(false);
  const switchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live refs so effects read the latest prefs without re-subscribing.
  const mutedRef = useRef(muted);
  const volumeRef = useRef(volume);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);

  // One reused music element for the lifetime of the session screen.
  useEffect(() => {
    const el = new Audio();
    el.loop = true;
    el.preload = 'auto';
    musicRef.current = el;
    return () => {
      el.pause();
      el.src = '';
      musicRef.current = null;
    };
  }, []);

  const applyMusicVolume = useCallback((ducked: boolean) => {
    const el = musicRef.current;
    if (!el) return;
    el.muted = mutedRef.current;
    el.volume = (ducked ? FADE_VOLUME : 1) * volumeRef.current;
  }, []);

  // React to phase / ambiance / mute / volume changes.
  useEffect(() => {
    if (switchTimer.current) clearTimeout(switchTimer.current);
    switchTimer.current = setTimeout(() => {
      const el = musicRef.current;
      if (!el) return;
      const intent = phaseToRole(gameState);

      if (intent === 'stop') {
        el.pause();
        currentSrcRef.current = null;
        return;
      }
      if (intent === 'fade') {
        applyMusicVolume(true);
        return;
      }
      const src = resolveTrack(ambiance, intent);
      if (!src) {
        el.pause();
        currentSrcRef.current = null;
        return;
      }
      if (src !== currentSrcRef.current) {
        currentSrcRef.current = src;
        el.src = src;
      }
      applyMusicVolume(false);
      if (unlockedRef.current && !mutedRef.current) {
        el.play().catch(() => { /* autoplay still blocked — AudioControls prompts a tap */ });
      }
    }, SWITCH_DEBOUNCE_MS);

    return () => { if (switchTimer.current) clearTimeout(switchTimer.current); };
  }, [ambiance, gameState, muted, volume, applyMusicVolume]);

  const setMuted = useCallback((m: boolean) => {
    setMutedState(m);
    saveAudioPrefs({ muted: m, volume: volumeRef.current });
    const el = musicRef.current;
    if (el) {
      el.muted = m;
      if (m) el.pause();
      else if (unlockedRef.current) el.play().catch(() => {});
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    saveAudioPrefs({ muted: mutedRef.current, volume: v });
  }, []);

  const unlock = useCallback(() => {
    if (unlockedRef.current) return;
    unlockedRef.current = true;
    const el = musicRef.current;
    if (el && currentSrcRef.current && !mutedRef.current) {
      el.play().catch(() => {});
    }
  }, []);

  const playSfx = useCallback((name: SfxName) => {
    if (mutedRef.current || !unlockedRef.current) return;
    const src = SFX[name];
    if (!src) return;
    const sfx = new Audio(src);
    sfx.volume = volumeRef.current;
    sfx.play().catch(() => { /* file missing or blocked — non-fatal */ });
  }, []);

  // isHost currently only gates host-only SFX at the call site; kept in the
  // signature so callers document intent and future host-only beds are trivial.
  void isHost;

  return { muted, volume, setMuted, setVolume, unlock, playSfx };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from `useGameAudio.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useGameAudio.ts
git commit -m "feat(audio): useGameAudio engine hook"
```

---

## Task 4: `AudioControls` UI component

**Files:**
- Create: `src/components/AudioControls.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/AudioControls.tsx
import { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GameAudioApi } from '@/hooks/useGameAudio';

interface AudioControlsProps {
  audio: GameAudioApi;
  className?: string;
}

// Per-device mute toggle + volume slider popover. Arcade Pop tokens, white-on-
// translucent to sit over the dark in-session backgrounds.
export const AudioControls = ({ audio, className }: AudioControlsProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => audio.setMuted(!audio.muted)}
        onContextMenu={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        title={audio.muted ? 'Activer le son' : 'Couper le son'}
        aria-label={audio.muted ? 'Activer le son' : 'Couper le son'}
        className="ap-btn ap-btn--ghost ap-btn--sm"
        style={{
          background: 'rgba(255,255,255,0.12)',
          border: '2px solid rgba(255,255,255,0.2)',
          color: '#fff',
          boxShadow: 'none',
          padding: '8px 10px',
        }}
      >
        {audio.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 30,
            background: 'rgba(20,14,40,0.95)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 12, padding: '12px 14px', width: 160,
          }}
        >
          <input
            type="range" min={0} max={1} step={0.05}
            value={audio.volume}
            onChange={(e) => audio.setVolume(Number(e.target.value))}
            aria-label="Volume"
            style={{ width: '100%' }}
          />
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/AudioControls.tsx
git commit -m "feat(audio): AudioControls mute/volume UI"
```

---

## Task 5: Wire audio into QuizSession & PlayerView; remove BackgroundMusic

**Files:**
- Modify: `src/components/QuizSession.tsx` (interface ~line 80–83; import ~line 15; BackgroundMusic use ~line 1165)
- Modify: `src/components/PlayerView.tsx` (import ~line 8; BackgroundMusic use ~line 840)
- Delete: `src/components/BackgroundMusic.tsx`

- [ ] **Step 1: QuizSession — add `ambianceId` to the interface**

In `src/components/QuizSession.tsx`, the `QuizSession` interface currently ends:

```ts
  theme?: string;
  font?: string;
  transitionTime?: number;
}
```

Change to:

```ts
  theme?: string;
  font?: string;
  transitionTime?: number;
  ambianceId?: string;
}
```

- [ ] **Step 2: QuizSession — swap the import**

Replace line 15:

```ts
import { BackgroundMusic } from "./BackgroundMusic";
```

with:

```ts
import { AudioControls } from "./AudioControls";
import { useGameAudio } from "@/hooks/useGameAudio";
```

- [ ] **Step 3: QuizSession — instantiate the engine**

Immediately after the `gameState` state declaration (search `const [gameState, setGameState] = useState<'waiting'` near line 124), add:

```ts
  const audio = useGameAudio({ ambianceId: quiz.ambianceId, gameState, isHost: !!isHost });
```

- [ ] **Step 4: QuizSession — render controls + unlock on start**

Replace the `<BackgroundMusic isPlaying />` line (~1165) with:

```tsx
                <AudioControls audio={audio} />
```

Then find the host handler that launches the quiz (the click handler that first sets game state away from `waiting` — search for `setGameState('question-intro')` or the "Lancer"/start button `onClick`). At the very top of that handler body add:

```ts
    audio.unlock();
```

- [ ] **Step 5: QuizSession — fire host SFX from a phase effect**

Add this effect just below the `useGameAudio` call:

```ts
  // Host-screen SFX on phase entry.
  const prevAudioStateRef = useRef<string>('');
  useEffect(() => {
    if (prevAudioStateRef.current === gameState) return;
    prevAudioStateRef.current = gameState;
    if (gameState === 'answer-distribution') audio.playSfx('reveal');
    else if (gameState === 'final') audio.playSfx('podium');
  }, [gameState, audio]);
```

Add the `tick` cue in the existing per-second timer. Find where `setTimeLeft(remaining)` is called (~line 445) and add, right after it:

```ts
      if (gameState === 'question' && remaining > 0 && remaining <= 5) audio.playSfx('tick');
```

(`useRef` and `useEffect` are already imported in this file.)

- [ ] **Step 6: PlayerView — swap import + instantiate**

Replace line 8:

```ts
import { BackgroundMusic } from "./BackgroundMusic";
```

with:

```ts
import { AudioControls } from "./AudioControls";
import { useGameAudio } from "@/hooks/useGameAudio";
```

After the PlayerView `gameState` state declaration (near line 39), add:

```ts
  const [ambianceId, setAmbianceId] = useState<string>('arcade');
  const audio = useGameAudio({ ambianceId, gameState, isHost: false });
```

- [ ] **Step 7: PlayerView — read ambiance from quiz_data + render controls**

Where `quiz_data` is consumed (near line 261, `if (data.quiz_data?.questions ...)`), add inside that block:

```ts
        if (typeof data.quiz_data.ambianceId === 'string') setAmbianceId(data.quiz_data.ambianceId);
```

Replace `<BackgroundMusic isPlaying={gameState === 'question'} />` (~line 840) with:

```tsx
              <AudioControls audio={audio} />
```

- [ ] **Step 8: PlayerView — unlock on join + fire answer SFX**

Find the join/enter handler (the one that persists the player and moves them into the session — search the `onClick` that calls `sessionStorage.setItem(\`quiz-player-` or the submit that registers the player). Add at the top of that handler:

```ts
    audio.unlock();
```

Find where `setLastAnswerCorrect(...)` is set from the server result (search `setLastAnswerCorrect`). Immediately after it, add:

```ts
      audio.playSfx(correct ? 'answer-correct' : 'answer-wrong');
```

Match `correct` to whatever boolean is in scope there (e.g. the value passed to `setLastAnswerCorrect`). If the value is an expression, hoist it to a `const correct = ...` first, then use it in both calls.

- [ ] **Step 9: Delete the stub**

```bash
git rm src/components/BackgroundMusic.tsx
```

- [ ] **Step 10: Typecheck + existing tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no new type errors; all existing tests pass.

- [ ] **Step 11: Commit**

```bash
git add src/components/QuizSession.tsx src/components/PlayerView.tsx
git commit -m "feat(audio): wire useGameAudio into host + player screens, drop BackgroundMusic"
```

---

## Task 6: Ambiance picker in QuizBuilder + persist on quiz

**Files:**
- Modify: `src/lib/quizStorage.ts` (`SavedQuiz`, line 3–28)
- Modify: `src/pages/LiveQuizPage.tsx` (host quiz object build, ~line 35 and ~line 109)
- Modify: `src/components/QuizBuilder.tsx`

- [ ] **Step 1: Add `ambianceId` to SavedQuiz**

In `src/lib/quizStorage.ts`, inside the `SavedQuiz` interface, after `font?: string;` add:

```ts
  ambianceId?: string;
```

- [ ] **Step 2: Thread ambiance onto the host quiz object**

In `src/pages/LiveQuizPage.tsx` there are two places building the object passed to `QuizSession` (a `normalizeStoredQuiz`-style map with `theme: quiz.theme` ~line 35, and the loaded-quiz map with `theme: loadedQuiz.theme` ~line 109). In each, directly below the `theme:` line add the matching:

```ts
    ambianceId: quiz.ambianceId,
```

(and in the second location:)

```ts
      ambianceId: loadedQuiz.ambianceId,
```

- [ ] **Step 3: Add the picker to QuizBuilder**

`QuizBuilder.tsx` already imports theme data and edits a working quiz object. Near the theme picker UI (search the JSX that renders `THEMES` / `ThemePaletteChips`), add an ambiance selector bound to the quiz's `ambianceId`. Add this import at the top:

```ts
import { AMBIANCE_OPTIONS, DEFAULT_AMBIANCE } from "@/lib/audioManifest";
```

Then, adjacent to the theme control, render:

```tsx
<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
  <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".07em", color: "var(--ap-muted)" }}>
    AMBIANCE MUSICALE
  </span>
  <select
    value={quiz.ambianceId ?? DEFAULT_AMBIANCE}
    onChange={(e) => updateQuizField("ambianceId", e.target.value)}
    style={{
      padding: "8px 10px", borderRadius: 10, border: "1.5px solid var(--ap-line)",
      background: "var(--ap-card)", color: "var(--ap-ink)", fontWeight: 700, fontSize: 13,
    }}
  >
    {AMBIANCE_OPTIONS.map((o) => (
      <option key={o.id} value={o.id}>{o.label}</option>
    ))}
  </select>
</div>
```

Replace `updateQuizField` / `quiz` with whatever this builder uses to mutate the working quiz (match the existing `theme` field's setter — e.g. if theme is set via `setQuiz((q) => ({ ...q, theme: id }))`, mirror that for `ambianceId`). For polls, leave the default as `none` if the builder distinguishes poll type; otherwise `DEFAULT_AMBIANCE` is fine.

- [ ] **Step 4: Typecheck + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/quizStorage.ts src/pages/LiveQuizPage.tsx src/components/QuizBuilder.tsx
git commit -m "feat(audio): host ambiance picker persisted on the quiz"
```

---

## Task 7: Propagate ambiance to players (RPC + edge function)

Players load `quiz_data` (not the full `SavedQuiz`). To let the host's ambiance reach players, echo it into `quiz_data`. Graceful: if skipped, players fall back to `arcade` (Task 5 default), so this task is deferrable but completes the spec.

**Files:**
- Create: `supabase/migrations/20260714120000_create_session_ambiance.sql`
- Modify: `supabase/functions/create-session/index.ts`
- Modify: `src/lib/sessionState.ts` (`createLiveSession`, line 399–412)
- Modify: `src/components/QuizSession.tsx` (`createLiveSession` call, ~line 346)

- [ ] **Step 1: Migration — RPC gains `p_ambiance_id`**

```sql
-- supabase/migrations/20260714120000_create_session_ambiance.sql
-- Add ambiance to quiz_data so players hear the host-chosen music bed.
-- Adding a parameter changes the function signature, so drop the old 4-arg
-- version first (create-or-replace cannot alter the argument list).
drop function if exists create_session_atomic(text, text, jsonb, jsonb);

create or replace function create_session_atomic(
  p_game_code text,
  p_title text,
  p_public_questions jsonb,
  p_private_questions jsonb,
  p_ambiance_id text default 'arcade'
) returns void
language plpgsql
as $$
begin
  insert into session_quiz_answers (game_code, questions, created_at)
  values (p_game_code, p_private_questions, now())
  on conflict (game_code) do update
    set questions = excluded.questions, created_at = excluded.created_at;

  insert into session_state (
    game_code, players, game_state, current_question_index,
    time_left, question_started_at, quiz_data, updated_at
  )
  values (
    p_game_code, '[]'::jsonb, 'waiting', 0,
    0, null,
    jsonb_build_object('title', p_title, 'questions', p_public_questions, 'ambianceId', p_ambiance_id),
    now()
  )
  on conflict (game_code) do update
    set players = '[]'::jsonb,
        game_state = 'waiting',
        current_question_index = 0,
        time_left = 0,
        question_started_at = null,
        quiz_data = excluded.quiz_data,
        updated_at = now();
end;
$$;
```

- [ ] **Step 2: Edge function — accept + forward `ambiance_id`**

In `supabase/functions/create-session/index.ts`, extend the body type:

```ts
interface CreateSessionBody {
  game_code: string;
  title: string;
  questions: FullQuestion[];
  ambiance_id?: string;
}
```

Destructure it:

```ts
    const { game_code, title, questions, ambiance_id } = body;
```

And pass it to the RPC (add the param):

```ts
    const { error: rpcError } = await supabase.rpc("create_session_atomic", {
      p_game_code: game_code,
      p_title: title,
      p_public_questions: publicQuestions,
      p_private_questions: questions,
      p_ambiance_id: ambiance_id ?? "arcade",
    });
```

- [ ] **Step 3: Client — `createLiveSession` forwards ambiance**

In `src/lib/sessionState.ts` change the signature and body:

```ts
export const createLiveSession = async (
  gameCode: string,
  title: string,
  questions: unknown[],
  ambianceId?: string
): Promise<boolean> => {
  const { error } = await supabase.functions.invoke("create-session", {
    body: { game_code: gameCode, title, questions, ambiance_id: ambianceId ?? "arcade" },
  });
  if (error) console.error("[createLiveSession error]", gameCode, await describeFunctionsError(error));
  return !error;
};
```

- [ ] **Step 4: Caller passes the quiz ambiance**

In `src/components/QuizSession.tsx` (~line 346) change:

```ts
        const ok = await createLiveSession(quiz.gameCode, quiz.title, quiz.questions);
```

to:

```ts
        const ok = await createLiveSession(quiz.gameCode, quiz.title, quiz.questions, quiz.ambianceId);
```

- [ ] **Step 5: Existing createLiveSession tests still pass**

Run: `npx vitest run src/lib/__tests__/sessionState.test.ts`
Expected: PASS — the 3-arg calls in the test still work (4th arg optional). If a test asserts the exact `body` shape, update it to include `ambiance_id: 'arcade'`.

- [ ] **Step 6: Deploy backend (manual, requires Supabase access)**

Run: `npx supabase db push` (applies the migration) and `npx supabase functions deploy create-session`.
Expected: migration applied, function deployed. If you lack CLI access, apply the SQL via the Supabase dashboard SQL editor and redeploy the function there.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260714120000_create_session_ambiance.sql supabase/functions/create-session/index.ts src/lib/sessionState.ts src/components/QuizSession.tsx
git commit -m "feat(audio): propagate host ambiance to players via quiz_data"
```

---

## Task 8: Audio assets — placeholders + sourcing doc

Ship silent placeholders so nothing 404s; document exact filenames and CC0 sources for real audio.

**Files:**
- Create: `public/audio/README.md`
- Create: 17 placeholder `.mp3` files under `public/audio/`

- [ ] **Step 1: Create directories + silent placeholders**

Generate a tiny valid silent MP3 once and copy it to every target path (requires `ffmpeg`; if unavailable, see fallback below):

```bash
cd public
mkdir -p audio/arcade audio/chill audio/epic audio/sfx
ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 1 -q:a 9 audio/_silent.mp3 -y
for amb in arcade chill epic; do
  for role in lobby question results victory; do cp audio/_silent.mp3 "audio/$amb/$role.mp3"; done
done
for sfx in tick correct wrong reveal podium; do cp audio/_silent.mp3 "audio/sfx/$sfx.mp3"; done
rm audio/_silent.mp3
cd ..
```

Fallback if `ffmpeg` is not installed: download any CC0 1-second silent mp3, or grab real CC0 clips now (Step 2) and skip placeholders entirely.

- [ ] **Step 2: Write the sourcing README**

```markdown
# Quiz audio assets

All files are self-hosted and must be **CC0 / royalty-free**. Paths below are
referenced by `src/lib/audioManifest.ts` — keep the exact filenames.

## Music (loops), per ambiance
`audio/{arcade,chill,epic}/`
- `lobby.mp3`    — light loop while players join
- `question.mp3` — driving loop during questions
- `results.mp3`  — upbeat loop for leaderboard/transition
- `victory.mp3`  — celebratory loop for the final screen

Ambiance vibes: **arcade** = chiptune/synth, **chill** = lo-fi, **epic** = cinematic.

## SFX (one-shots)
`audio/sfx/`
- `tick.mp3`    — last 5s of the timer (host screen)
- `correct.mp3` — right answer
- `wrong.mp3`   — wrong answer
- `reveal.mp3`  — answer distribution appears
- `podium.mp3`  — final podium stinger

## Where to get CC0 audio
- https://pixabay.com/music/ and https://pixabay.com/sound-effects/ (CC0)
- https://mixkit.co/free-sound-effects/ and https://mixkit.co/free-stock-music/ (free license — check terms)
Keep each music loop < ~1 MB (trim/compress to ~128 kbps mono) to stay light.
```

- [ ] **Step 3: Commit**

```bash
git add public/audio
git commit -m "chore(audio): silent placeholder tracks + sourcing README"
```

---

## Task 9: Manual verification (run the app)

- [ ] **Step 1: Build + start**

Run: `npm run build && npm run dev` (or use the project `run` skill).
Expected: builds clean, dev server starts.

- [ ] **Step 2: Drive the flow**

1. In QuizBuilder, set **Ambiance musicale** on a quiz, save.
2. Launch it live (host). Click "Lancer" — confirm no autoplay error in console; music toggle visible.
3. Toggle mute → music stops; right-click the toggle → volume slider works; reload → mute/volume restored.
4. Join as a player on a second device/tab, tap "Rejoindre".
5. Answer a question → hear correct/wrong SFX (with real audio) or observe `playSfx` calls with placeholders.
6. Watch phase changes: lobby → question → distribution (music ducks) → leaderboard → final.
7. With Task 7 deployed, confirm the player's ambiance matches the host's choice (not just arcade).

Expected: no uncaught console errors; music follows phases; controls are per-device.

- [ ] **Step 3: Full test + typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: green.

---

## Notes for the implementer

- **TDD applies to the pure logic** (Tasks 1–2). The hook, UI, and integration are verified by running the app (Task 9) — jsdom can't play audio, so don't fake playback assertions.
- **Line numbers are approximate** — search for the quoted anchor strings, the files change over time.
- **Task 7 is deferrable**: Tasks 1–6 + 8 give a fully working host-side music system; players simply default to `arcade` until Task 7 ships. Don't block the feature on Supabase deploy access.
- **No new npm dependencies.** Native `HTMLAudioElement` only.
- **Match existing lint idiom** — the codebase has an `any` baseline; don't chase zero warnings.
