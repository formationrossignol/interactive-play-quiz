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
