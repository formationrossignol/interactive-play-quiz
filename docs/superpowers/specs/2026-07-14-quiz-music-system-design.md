# Quiz Music System — Design

**Date:** 2026-07-14
**Status:** Approved, ready for implementation plan
**Branch context:** `feat/supabase-auth-premium-design`

## Goal

Replace the ad-hoc single-track `BackgroundMusic.tsx` stub with a proper music
system for live quizzes: phase-based background music, sound effects, host-chosen
ambiance per quiz, and per-device player mute — all with self-hosted audio and no
new runtime dependencies.

## Decisions (locked during brainstorming)

- **Scope:** phase-based background music + SFX + host ambiance choice + host→player sync.
- **Audio source:** self-hosted files in `public/audio/` (CC0 / royalty-free). No external CDN, no Supabase Storage.
- **Control model:** host picks the ambiance (stored in the quiz); phase music is
  derived locally from the already-synced `game_state`; each player keeps a local
  mute/volume on their own device. No new master-mute sync.
- **Polls:** silent by default (`ambiance: none`) unless the host opts in.

## Key insight — no new sync

`session_state.game_state` already broadcasts the phase to host and players
(`waiting → countdown → question-intro → question → answer-distribution →
leaderboard → transition → final`, plus `abandoned`). Phase-based music therefore
needs **no new Supabase field** — each client maps `gameState → track` locally.
The only travelling datum is the ambiance choice, which already lives in the quiz
definition (`quiz_data`) that every client loads.

## Architecture

Three focused units plus two integration points.

### 1. `src/lib/audioManifest.ts` — data, no logic
Single source of truth. Exports:
- `AMBIANCES`: `arcade` (default), `chill`, `epic`, and implicit `none`.
- Per ambiance: map of music **role → file path** for roles `lobby`, `question`,
  `results`, `victory`.
- `SFX`: shared map `tick`, `answer-correct`, `answer-wrong`, `reveal`, `podium` → file path.
- Helper `phaseToRole(gameState) → MusicRole | null` (pure).

### 2. `src/hooks/useGameAudio.ts` — the engine
Owns one reused `HTMLAudioElement` for music + a small fixed SFX pool.
Inputs: `{ ambianceId, gameState, isHost }`. Responsibilities:
- Resolve current music role via `phaseToRole`, crossfade on change (debounced ~150ms).
- `playSfx(name)` for event-driven sounds.
- `unlock()` — call from an existing user gesture to satisfy autoplay policy.
- Local mute/volume, persisted to `localStorage` (`audio.muted`, `audio.volume`).
- Full teardown on unmount (pause + release).
No Howler, no new deps — native `HTMLAudioElement`.

### 3. `src/components/AudioControls.tsx` — UI
Mute toggle + volume popover, Arcade Pop tokens (`--ap-*`). Renders in the current
`BackgroundMusic` slots: QuizSession (host, big screen) and PlayerView (player, phone).

### Integration points
- **QuizBuilder:** ambiance picker writing `ambianceId` onto the quiz (defaults `arcade`;
  polls default `none`).
- **QuizSession / PlayerView:** call `useGameAudio({ ambianceId, gameState, isHost })`,
  render `<AudioControls/>`, fire `playSfx` on the relevant events.
- **Remove** `src/components/BackgroundMusic.tsx` (absorbed).

### Data flow
```
QuizBuilder → quiz.ambianceId
   → host & players load quiz
   → useGameAudio({ ambianceId, gameState, isHost })
   → local music track + event SFX
   → per-device mute in AudioControls
```

## Ambiances & phase mapping

| ambiance | vibe | default for |
|----------|------|-------------|
| `arcade` | punchy chiptune/synth | quizzes (brand match) |
| `chill`  | calm lo-fi            | low-energy sessions |
| `epic`   | cinematic tension     | competitive finals |
| `none`   | silent                | polls (default) |

**Phase → music role** (loops unless noted):

| gameState | role |
|-----------|------|
| `waiting` | `lobby` |
| `countdown`, `question-intro` | `lobby` continues (no cut) |
| `question` | `question` |
| `answer-distribution` | music fades down (SFX foreground) |
| `leaderboard`, `transition` | `results` |
| `final` | `victory` one-shot stinger → `results` bed |
| `abandoned` | stop all |

3 loops (`lobby`, `question`, `results`) + 1 stinger (`victory`) per ambiance.

**SFX (one shared set):**

| event | trigger |
|-------|---------|
| `tick` | last 5s of question timer, **host screen only** |
| `answer-correct` | player answer confirmed correct (PlayerView) |
| `answer-wrong` | player answer confirmed wrong (PlayerView) |
| `reveal` | host enters `answer-distribution` |
| `podium` | host enters `final` (with victory stinger) |

## Audio assets

**17 files total:** 4 music × 3 ambiances (12) + 5 SFX. All CC0 / royalty-free,
committed to `public/audio/{ambiance}/…` and `public/audio/sfx/…`.

**Sourcing:** the implementation plan lists exact target filenames and CC0 source
links (Pixabay / Mixkit CC0). Ship tiny **silent placeholder** files first so the
manifest never 404s before real audio is dropped in. Real audio is a follow-up
content task, not a code blocker.

## Edge cases & error handling

- **Autoplay block:** unlock on the existing gesture — host "Lancer", player "Rejoindre".
  If still blocked, `AudioControls` shows a muted state to tap; no crash, no console spam.
- **Missing/404 file:** skip that sound, dev-only log once; music failure never blocks play.
- **Rapid phase changes / unmount:** debounced switch (~150ms), crossfade cancels cleanly,
  full teardown on unmount.
- **Local prefs:** `localStorage` `audio.muted` / `audio.volume`, restored per device.
- **Perf (RAM-constrained dev machine):** one reused music element, fixed SFX pool,
  only the chosen ambiance's files loaded, zero new deps.

## Testing

Vitest, matching `src/lib/__tests__` style. Test decisions, not playback (jsdom can't
play audio; mock `HTMLAudioElement`):
- `audioManifest`: every ambiance resolves all 4 music roles + shared SFX; no dangling paths.
- `useGameAudio`: `phaseToRole` mapping (waiting→lobby, question→question, final→victory,
  answer-distribution→fade, abandoned→stop); mute/volume persistence; unlock gating.

## Out of scope (YAGNI)

- Host uploading custom tracks (would need Supabase Storage — deferred).
- Master mute-all synced across all players.
- Per-question custom music.
- More than 3 ambiances at launch.
