// Synthesized sound effects via the Web Audio API — no audio files needed.
// Each SFX is a short sequence of oscillator "notes" with an attack/decay
// envelope. Cheap, offline, and never 404s.
import type { SfxName } from './audioManifest';

interface Note {
  freq: number;
  start: number; // seconds, relative to trigger
  dur: number; // seconds
  type?: OscillatorType;
  gain?: number; // 0..1, before master volume
}

const PATTERNS: Record<SfxName, Note[]> = {
  // Two ascending notes — a pleasant "ding".
  'answer-correct': [
    { freq: 523.25, start: 0, dur: 0.12 },
    { freq: 659.25, start: 0.1, dur: 0.18 },
  ],
  // Two descending sawtooth notes — a low "buzz".
  'answer-wrong': [
    { freq: 196, start: 0, dur: 0.24, type: 'sawtooth', gain: 0.5 },
    { freq: 130.81, start: 0.11, dur: 0.28, type: 'sawtooth', gain: 0.5 },
  ],
  // Short high blip for the countdown.
  tick: [{ freq: 880, start: 0, dur: 0.05, type: 'square', gain: 0.4 }],
  // Quick upward sweep as answers are revealed.
  reveal: [
    { freq: 440, start: 0, dur: 0.09 },
    { freq: 880, start: 0.07, dur: 0.16 },
  ],
  // Three ascending notes — a mini fanfare for the podium.
  podium: [
    { freq: 523.25, start: 0, dur: 0.14 },
    { freq: 659.25, start: 0.13, dur: 0.14 },
    { freq: 783.99, start: 0.26, dur: 0.26 },
  ],
};

export function playSynthSfx(ctx: AudioContext, name: SfxName, masterVolume: number): void {
  const notes = PATTERNS[name];
  if (!notes) return;
  const now = ctx.currentTime;
  for (const n of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = n.type ?? 'sine';
    osc.frequency.value = n.freq;
    const peak = Math.max(0.0001, (n.gain ?? 0.7) * masterVolume);
    const t0 = now + n.start;
    const t1 = t0 + n.dur;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }
}
