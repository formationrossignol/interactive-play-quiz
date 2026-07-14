// src/lib/__tests__/audioManifest.test.ts
import { describe, expect, it } from 'vitest';
import {
  AMBIANCES,
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

  it('maps game phases to the correct music intent', () => {
    expect(phaseToRole('waiting')).toBe('lobby');
    expect(phaseToRole('countdown')).toBe('lobby');
    expect(phaseToRole('question-intro')).toBe('lobby');
    expect(phaseToRole('question')).toBe('question');
    expect(phaseToRole('answer-distribution')).toBe('fade');
    expect(phaseToRole('answer-feedback')).toBe('fade');
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
