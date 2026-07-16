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
