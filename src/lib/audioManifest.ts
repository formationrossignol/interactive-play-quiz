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

// Two shared beds for now: CALM for lobby/results, INTENSE for question/victory.
// All three ambiances reference the same files (identical sound) until distinct
// per-ambiance tracks are dropped in — see public/audio/README.md.
const CALM = '/audio/ludiq-calm.mp3';
const INTENSE = '/audio/ludiq-intense.mp3';

const sharedTracks: Record<MusicRole, string> = {
  lobby: CALM,
  results: CALM,
  question: INTENSE,
  victory: INTENSE,
};

export const AMBIANCES: Record<Exclude<AmbianceId, 'none'>, Ambiance> = {
  arcade: { label: 'Arcade', tracks: { ...sharedTracks } },
  chill: { label: 'Chill', tracks: { ...sharedTracks } },
  epic: { label: 'Épique', tracks: { ...sharedTracks } },
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
