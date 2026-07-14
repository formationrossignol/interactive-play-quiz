// src/hooks/useGameAudio.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

  // Stable identity so consumer effects keyed on the returned api only re-run
  // when mute/volume actually change (the callbacks are already stable).
  return useMemo(
    () => ({ muted, volume, setMuted, setVolume, unlock, playSfx }),
    [muted, volume, setMuted, setVolume, unlock, playSfx],
  );
}
